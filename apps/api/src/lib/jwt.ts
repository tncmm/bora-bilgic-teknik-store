import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { Role } from '@prisma/client';

import { env } from '../config/env.js';

interface TokenPayload {
  sub: string;
  role: Role;
  email: string;
}

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

/**
 * Refresh token'lar her imzada benzersiz bir jti tasir: ayni saniyede ayni
 * kullanici icin uretilen iki token bile ayri stringlerdir, boylece rotasyon
 * her zaman gercekten yeni bir token uretir (DB'deki hash'ten ayristirilir).
 */
export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign({ ...payload, jti: randomBytes(12).toString('hex') }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}
