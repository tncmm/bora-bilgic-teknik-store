import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

function getBillingKey() {
  if (!env.BILLING_ENCRYPTION_KEY) {
    throw new AppError('Fatura kimlik sifreleme anahtari eksik. BILLING_ENCRYPTION_KEY tanimlayin.', 503);
  }

  const raw = env.BILLING_ENCRYPTION_KEY.trim();
  const decoded = Buffer.from(raw, 'base64');

  if (decoded.length === 32) {
    return decoded;
  }

  if (raw.length >= 32) {
    return createHash('sha256').update(raw).digest();
  }

  throw new AppError('BILLING_ENCRYPTION_KEY en az 32 karakter veya 32 byte base64 olmalidir.', 503);
}

export function encryptBillingIdentity(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getBillingKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptBillingIdentity(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new AppError('Sifreli veri formati gecersiz.', 500);
  }

  const decipher = createDecipheriv('aes-256-gcm', getBillingKey(), Buffer.from(ivValue, 'base64'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

export function hashTrackingToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
