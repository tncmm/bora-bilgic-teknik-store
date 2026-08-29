import 'dotenv/config';
import { z } from 'zod';

/**
 * Env files conventionally declare an unset optional key as an empty string.
 * An empty string is not `undefined`, so it would reach `.url()` and crash the
 * process at boot — meaning a freshly copied `.env.example` could not start
 * the API. Blank optional values are therefore normalised to undefined first.
 *
 * Required keys deliberately skip this: a blank DATABASE_URL should fail loudly.
 */
function blankToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

const optionalText = z.preprocess(blankToUndefined, z.string().optional());
const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4010),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  R2_ACCOUNT_ID: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_BUCKET_NAME: optionalText,
  R2_PUBLIC_BASE_URL: optionalUrl,
});

export const env = envSchema.parse(process.env);
