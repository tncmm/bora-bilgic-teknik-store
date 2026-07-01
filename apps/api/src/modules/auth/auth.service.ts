import { Role } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
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

export class AuthService {
  constructor(private readonly repository = new AuthRepository()) {}

  async register(payload: unknown) {
    const data = registerSchema.parse(payload);
    const { password, ...userData } = data;

    const existingUser = await this.repository.findUserByEmail(data.email);
    if (existingUser) {
      throw new AppError('Bu e-posta adresi zaten kayitli.', 409);
    }

    const user = await this.repository.createUser({
      ...userData,
      passwordHash: await hashPassword(password),
    });

    return this.buildAuthResponse(user.id, user.email, user.role, user);
  }

  async login(payload: unknown) {
    const data = loginSchema.parse(payload);
    const user = await this.repository.findUserByEmail(data.email);

    if (!user) {
      throw new AppError('Kullanici bulunamadi.', 404);
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('E-posta veya sifre hatali.', 401);
    }

    return this.buildAuthResponse(user.id, user.email, user.role, user);
  }

  async me(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Kullanici bulunamadi.', 404);
    }
    return serializeUser(user);
  }

  async refresh(token: string) {
    const payload = verifyRefreshToken(token);
    const user = await this.repository.findUserById(payload.sub);

    if (!user) {
      throw new AppError('Kullanici bulunamadi.', 404);
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
}
