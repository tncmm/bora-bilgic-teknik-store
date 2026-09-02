import crypto from 'node:crypto';

import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { comparePassword, hashPassword } from '../../lib/password.js';
import { signRefreshToken } from '../../lib/jwt.js';
import { AuthService } from './auth.service.js';

vi.mock('../../lib/password.js', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

const mockedComparePassword = vi.mocked(comparePassword);
const mockedHashPassword = vi.mocked(hashPassword);

describe('AuthService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedHashPassword.mockResolvedValue('hashed-password');
    mockedComparePassword.mockResolvedValue(true);
  });

  it('does not pass the raw password field to the repository during registration', async () => {
    const createUser = vi.fn().mockResolvedValue({
      id: 'user-1',
      firstName: 'Mustafa',
      lastName: 'Tunc',
      email: 'mustafa@example.com',
      role: Role.CUSTOMER,
      passwordHash: 'hashed-password',
      themePreference: { mode: 'system' },
    });

    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      createUser,
      findUserById: vi.fn(),
    };

    const service = new AuthService(repository as any);

    await service.register({
      firstName: 'Mustafa',
      lastName: 'Tunc',
      email: 'mustafa@example.com',
      password: 'Password123!',
    });

    expect(createUser).toHaveBeenCalledWith({
      firstName: 'Mustafa',
      lastName: 'Tunc',
      email: 'mustafa@example.com',
      passwordHash: expect.any(String),
      emailVerified: false,
      verifyToken: expect.any(String),
      verifyTokenExpiry: expect.any(Date),
    });
    expect(createUser.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it('returns the same generic 401 for unknown email and wrong password', async () => {
    const unknownEmailRepository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
    };
    const unknownEmailService = new AuthService(unknownEmailRepository as any);

    const unknownEmailError = await unknownEmailService
      .login({ email: 'ghost@example.com', password: 'Password123!' })
      .catch((error) => error);

    const wrongPasswordRepository = {
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-1',
        firstName: 'Mustafa',
        lastName: 'Tunc',
        email: 'mustafa@example.com',
        role: Role.CUSTOMER,
        passwordHash: 'hashed-password',
        emailVerified: true,
      }),
    };
    const wrongPasswordService = new AuthService(wrongPasswordRepository as any);
    mockedComparePassword.mockResolvedValue(false);

    const wrongPasswordError = await wrongPasswordService
      .login({ email: 'mustafa@example.com', password: 'WrongPassword123!' })
      .catch((error) => error);

    expect(unknownEmailError).toBeInstanceOf(AppError);
    expect(wrongPasswordError).toBeInstanceOf(AppError);
    expect(unknownEmailError.statusCode).toBe(401);
    expect(wrongPasswordError.statusCode).toBe(401);
    expect(unknownEmailError.message).toBe(wrongPasswordError.message);
    expect(unknownEmailError.message).toBe('E-posta veya şifre hatalı.');
  });

  it('still runs a bcrypt compare for unknown emails so timing does not reveal existence', async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(null),
    };

    const service = new AuthService(repository as any);

    await expect(
      service.login({ email: 'ghost@example.com', password: 'Password123!' }),
    ).rejects.toBeInstanceOf(AppError);

    expect(mockedComparePassword).toHaveBeenCalledTimes(1);
    expect(mockedComparePassword).toHaveBeenCalledWith('Password123!', expect.any(String));
  });
});

describe('AuthService refresh token revocation', () => {
  const user = {
    id: 'user-1',
    firstName: 'Mustafa',
    lastName: 'Tunc',
    email: 'mustafa@example.com',
    role: Role.CUSTOMER,
    emailVerified: true,
    passwordHash: 'hashed-password',
    themePreference: { mode: 'system' },
  };

  const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

  beforeEach(() => {
    vi.resetAllMocks();
    mockedComparePassword.mockResolvedValue(true);
  });

  it('persists the refresh token hash (never the raw token) on login', async () => {
    const repository = {
      findUserByEmail: vi.fn().mockResolvedValue(user),
      deleteStaleRefreshTokens: vi.fn().mockResolvedValue({ count: 0 }),
      createRefreshToken: vi.fn().mockResolvedValue({ id: 'rt-1' }),
    };
    const service = new AuthService(repository as any);

    const result = await service.login({ email: user.email, password: 'Password123!' });

    expect(result.refreshToken).toEqual(expect.any(String));
    expect(repository.createRefreshToken).toHaveBeenCalledWith({
      userId: 'user-1',
      tokenHash: sha256(result.refreshToken),
      expiresAt: expect.any(Date),
    });
    const payload = repository.createRefreshToken.mock.calls[0][0];
    expect(payload.tokenHash).not.toContain('.');
    expect(payload.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    // Stale rows are cleaned before the fresh row is stored.
    expect(repository.deleteStaleRefreshTokens).toHaveBeenCalledWith('user-1', expect.any(Date));
  });

  it('rotates the stored token: revokes the old hash and stores the new one', async () => {
    const oldToken = signRefreshToken({ sub: 'user-1', email: user.email, role: Role.CUSTOMER });
    const repository = {
      findRefreshTokenByHash: vi.fn().mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(oldToken),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
      findUserById: vi.fn().mockResolvedValue(user),
      rotateRefreshToken: vi.fn().mockResolvedValue({ id: 'rt-2' }),
    };
    const service = new AuthService(repository as any);

    const result = await service.refresh(oldToken);

    expect(result.refreshToken).not.toBe(oldToken);
    expect(repository.rotateRefreshToken).toHaveBeenCalledWith({
      oldTokenHash: sha256(oldToken),
      userId: 'user-1',
      newTokenHash: sha256(result.refreshToken),
      expiresAt: expect.any(Date),
      revokedAt: expect.any(Date),
    });
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it('rejects an unknown refresh token hash with 401', async () => {
    const token = signRefreshToken({ sub: 'user-1', email: user.email, role: Role.CUSTOMER });
    const repository = {
      findRefreshTokenByHash: vi.fn().mockResolvedValue(null),
    };
    const service = new AuthService(repository as any);

    await expect(service.refresh(token)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
    });
  });

  it('rejects a revoked refresh token (replayed after rotation) with 401', async () => {
    const token = signRefreshToken({ sub: 'user-1', email: user.email, role: Role.CUSTOMER });
    const repository = {
      findRefreshTokenByHash: vi.fn().mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      }),
    };
    const service = new AuthService(repository as any);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
    expect((repository as any).findUserById).toBeUndefined();
  });

  it('rejects a refresh token whose DB expiry has passed with 401', async () => {
    const token = signRefreshToken({ sub: 'user-1', email: user.email, role: Role.CUSTOMER });
    const repository = {
      findRefreshTokenByHash: vi.fn().mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      }),
    };
    const service = new AuthService(repository as any);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token that fails JWT verification before touching the database', async () => {
    const repository = {
      findRefreshTokenByHash: vi.fn(),
    };
    const service = new AuthService(repository as any);

    await expect(service.refresh('bozuk-token')).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.refresh(undefined)).rejects.toMatchObject({ statusCode: 401 });
    expect(repository.findRefreshTokenByHash).not.toHaveBeenCalled();
  });

  it('rejects the refresh when rotation loses the race to a parallel request', async () => {
    const token = signRefreshToken({ sub: 'user-1', email: user.email, role: Role.CUSTOMER });
    const repository = {
      findRefreshTokenByHash: vi.fn().mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
      findUserById: vi.fn().mockResolvedValue(user),
      rotateRefreshToken: vi.fn().mockResolvedValue(null),
    };
    const service = new AuthService(repository as any);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('revokes the cookie token hash on logout and tolerates a missing cookie', async () => {
    const token = signRefreshToken({ sub: 'user-1', email: user.email, role: Role.CUSTOMER });
    const revokeRefreshTokenByHash = vi.fn().mockResolvedValue({ count: 1 });
    const repository = { revokeRefreshTokenByHash };
    const service = new AuthService(repository as any);

    await service.logout(token);
    await service.logout(undefined);

    expect(revokeRefreshTokenByHash).toHaveBeenCalledTimes(1);
    expect(revokeRefreshTokenByHash).toHaveBeenCalledWith(sha256(token), expect.any(Date));
  });

  it('never fails the logout flow when the revoke call errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const repository = {
      revokeRefreshTokenByHash: vi.fn().mockRejectedValue(new Error('db down')),
    };
    const service = new AuthService(repository as any);

    await expect(service.logout('bir-token')).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});
