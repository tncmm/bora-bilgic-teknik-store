import { Role } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/app-error.js';
import { verifyAccessToken } from '../lib/jwt.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    return next(new AppError('Bu islem icin giris yapmalisiniz.', 401));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    return next();
  } catch {
    return next(new AppError('Oturum suresi dolmus veya gecersiz.', 401));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.role !== Role.ADMIN) {
    return next(new AppError('Bu alan icin admin yetkisi gerekiyor.', 403));
  }

  return next();
}
