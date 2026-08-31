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

    return this.buildAuthResponse(verified.id, verified.email, verified.role, verified);
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
      throw new AppError('Kullanıcı bulunamadı.', 404);
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

    return this.buildAuthResponse(user.id, user.email, user.role, user);
  }

  async me(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }
    return serializeUser(user);
  }

  async refresh(token: string) {
    const payload = verifyRefreshToken(token);
    const user = await this.repository.findUserById(payload.sub);

    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }

    return this.buildAuthResponse(user.id, user.email, user.role, user);
  }

  private buildAuthResponse(userId: string, email: string, role: Role, user: any) {
    const accessToken = signAccessToken({ sub: userId, email, role });
    const refreshToken = signRefreshToken({ sub: userId, email, role });

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
