import { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodIssue } from 'zod';

import { AppError } from '../lib/app-error.js';

function getFieldLabel(path: string) {
  const labels: Record<string, string> = {
    firstName: 'Ad',
    lastName: 'Soyad',
    email: 'E-posta',
    password: 'Sifre',
    shippingName: 'Ad Soyad',
    shippingPhone: 'Telefon',
    shippingCity: 'Sehir',
    shippingDistrict: 'Ilce',
    shippingAddressLine: 'Adres',
  };

  return labels[path] ?? path;
}

function formatIssue(issue: ZodIssue) {
  const path = issue.path.join('.');
  const label = getFieldLabel(path);

  if (issue.code === 'too_small' && issue.origin === 'string') {
    return `${label} en az ${issue.minimum} karakter olmali.`;
  }

  if (issue.code === 'invalid_format' && path === 'email') {
    return 'Gecerli bir e-posta adresi girin.';
  }

  return issue.message;
}

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof ZodError) {
    const fieldErrors = error.issues.reduce<Record<string, string[]>>((result, issue) => {
      const path = issue.path.join('.') || 'form';
      const message = formatIssue(issue);
      result[path] = [...(result[path] ?? []), message];
      return result;
    }, {});

    const firstMessage = Object.values(fieldErrors).flat()[0] ?? 'Form alanlarini kontrol edin.';

    return res.status(400).json({
      message: firstMessage,
      fieldErrors,
    });
  }

  console.error(error);
  return res.status(500).json({ message: 'Beklenmeyen bir sunucu hatasi olustu.' });
}
