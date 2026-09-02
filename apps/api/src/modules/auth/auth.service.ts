import crypto from 'node:crypto';

import { Role } from '@prisma/client';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { sendMail } from '../../lib/mail/transport.js';
import { verificationEmail, welcomeEmail } from '../../lib/mail/templates.js';
import { comparePassword, hashPassword } from '../../lib/password.js';
import { serializeUser } from '../../lib/serializers.js';
import { AuthRepository } from './auth.repository.js';

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.email(),
});

const RESEND_COOLDOWN_MS = 60_000;

/** Refresh JWT'nin omruyle birebir ayni DB son kullanma suresi (7 gun). */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Veritabanina yalnizca ozet yazilir; ham token yalnizca httpOnly cereze
 * konur. Boylece bir veri sizintisindan dogrudan kullanilabilir refresh
 * token'i cikmaz.
 */
function hashRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Oturum yenileme akislarindaki tek tip 401: cerez temizlenip girise donulur. */
const INVALID_REFRESH_MESSAGE = 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';

/**
 * Bilinmeyen e-postalarda da gerçek bir bcrypt karşılaştırması çalıştırmak
 * için kullanılan geçersiz bir hash. Böylece yanıt süresi, adresin veri
 * tabanında var olup olmadığını ele vermez (user enumeration önleme).
 */
const DUMMY_PASSWORD_HASH = '$2b$10$z2OJvqWoVsx7A97SjP7Qy.vFy2OFjM4sJ.bgYasG3.Yigabx2RecS';

export class AuthService {
  constructor(private readonly repository = new AuthRepository()) {}

  async register(payload: unknown) {
    const data = registerSchema.parse(payload);
    const { password, ...userData } = data;

    const existingUser = await this.repository.findUserByEmail(data.email);
    if (existingUser) {
      throw new AppError('Bu e-posta adresi zaten kayıtlı.', 409);
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.repository.createUser({
      ...userData,
      passwordHash: await hashPassword(password),
      emailVerified: false,
      verifyToken,
      verifyTokenExpiry,
    });

    // Fire-and-forget — never block or crash on mail failure.
    void this.sendVerificationMail(user.firstName, user.email, verifyToken);

    return {
      message: env.requireEmailVerification
        ? 'Hesabınız oluşturuldu. Giriş yapabilmek için e-posta adresinize gönderilen doğrulama bağlantısına tıklayın.'
        : 'Hesabınız oluşturuldu. Şimdi giriş yapabilirsiniz.',
    };
  }

  async verifyEmail(payload: unknown) {
    const { token } = verifyEmailSchema.parse(payload);

    const user = await this.repository.findUserByVerifyToken(token);

    if (!user || !user.verifyTokenExpiry || user.verifyTokenExpiry < new Date()) {
      throw new AppError('Doğrulama bağlantısı geçersiz veya süresi dolmuş.', 400);
    }

    const verified = await this.repository.markEmailVerified(user.id);

    // Fire-and-forget welcome email.
    void this.sendWelcomeMail(verified.firstName, verified.email);

    return this.buildAuthResponse(verified);
  }

  async resendVerification(payload: unknown) {
    const { email } = resendVerificationSchema.parse(payload);

    const genericMessage =
      'Doğrulama e-postası gönderildi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.';

    const user = await this.repository.findUserByEmail(email);

    if (!user || user.emailVerified) {
      // Never reveal whether the address exists.
      return { message: genericMessage };
    }

    // Cooldown: use updatedAt as proxy for last token issuance time.
    const elapsed = Date.now() - user.updatedAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return { message: genericMessage };
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.repository.updateVerifyToken(user.id, verifyToken, verifyTokenExpiry);

    void this.sendVerificationMail(user.firstName, user.email, verifyToken);

    return { message: genericMessage };
  }

  async login(payload: unknown) {
    const data = loginSchema.parse(payload);
    const user = await this.repository.findUserByEmail(data.email);

    if (!user) {
      // Bilinmeyen e-posta, hatalı şifreyle aynı genel 401 mesajını döner;
      // karşılaştırma yine de gerçekten çalıştırılır ki zamanlama farkı
      // hesabın varlığını ele vermesin.
      await comparePassword(data.password, DUMMY_PASSWORD_HASH);
      throw new AppError('E-posta veya şifre hatalı.', 401);
    }

    if (env.requireEmailVerification && !user.emailVerified) {
      throw new AppError(
        'Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.',
        403,
      );
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('E-posta veya şifre hatalı.', 401);
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }
    return serializeUser(user);
  }

  async refresh(token: string | undefined) {
    if (!token) {
      throw new AppError(INVALID_REFRESH_MESSAGE, 401);
    }

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      // Imza/omur gecersiz: DB'ye bakmaya gerek yok, cerez temizlenir.
      throw new AppError(INVALID_REFRESH_MESSAGE, 401);
    }

    const tokenHash = hashRefreshToken(token);
    const stored = await this.repository.findRefreshTokenByHash(tokenHash);

    // Bilinmeyen, iptal edilmis (rotasyon sonrasi yeniden kullanim) veya
    // suresi DB tarafinda dolmus token'in hepsi ayni 401'i alir.
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new AppError(INVALID_REFRESH_MESSAGE, 401);
    }

    const user = await this.repository.findUserById(payload.sub);
    if (!user) {
      throw new AppError(INVALID_REFRESH_MESSAGE, 401);
    }

    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });
    const rotated = await this.repository.rotateRefreshToken({
      oldTokenHash: tokenHash,
      userId: user.id,
      newTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revokedAt: new Date(),
    });

    if (!rotated) {
      // Paralel bir istek ayni token'i cebinden cikarmis: bu token artik kapali.
      throw new AppError(INVALID_REFRESH_MESSAGE, 401);
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

    return { accessToken, refreshToken, user: serializeUser(user) };
  }

  /** Cikis: cerezdeki token'in DB satirini iptal eder; hata olsa da cikis basarisiz sayilmaz. */
  async logout(token: string | undefined) {
    if (!token) {
      return;
    }

    try {
      await this.repository.revokeRefreshTokenByHash(hashRefreshToken(token), new Date());
    } catch (error) {
      console.error('[AUTH] Refresh token revoke failed during logout:', error);
    }
  }

  /**
   * Access + refresh ciftini uretir ve refresh token'in sha256 ozetini DB'ye
   * yazar (sunucu tarafi iptal icin). Yazmadan once kullanicinin suresi
   * dolmus/iptal edilmis eski satirlarini ucuz bir deleteMany ile temizler.
   */
  private async buildAuthResponse(user: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  }) {
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });

    await this.repository.deleteStaleRefreshTokens(user.id, new Date());
    await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return {
      accessToken,
      refreshToken,
      user: serializeUser(user),
    };
  }

  /** Sends verification mail; swallows errors so auth responses never break. */
  private async sendVerificationMail(firstName: string, to: string, token: string) {
    try {
      const mail = verificationEmail(firstName, token);
      await sendMail({ to, ...mail });
    } catch (err) {
      console.error('[MAIL] Failed to send verification email:', err);
    }
  }

  /** Sends welcome mail; swallows errors so auth responses never break. */
  private async sendWelcomeMail(firstName: string, to: string) {
    try {
      const mail = welcomeEmail(firstName);
      await sendMail({ to, ...mail });
    } catch (err) {
      console.error('[MAIL] Failed to send welcome email:', err);
    }
  }
}
