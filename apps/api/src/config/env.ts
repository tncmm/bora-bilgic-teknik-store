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

/** Boş/eksik değeri kabul edip pozitif tam sayıya indirger; varsayılanla döner. */
function positiveIntWithDefault(defaultValue: number) {
  return z.preprocess(blankToUndefined, z.coerce.number().positive().int().default(defaultValue));
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4010),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  // Sitemap/kanonik URL üretiminde kullanılan mağaza kök adresi.
  PUBLIC_SITE_URL: z.preprocess(blankToUndefined, z.string().url().default('https://borabilgic.net.tr')),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  R2_ACCOUNT_ID: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_BUCKET_NAME: optionalText,
  R2_PUBLIC_BASE_URL: optionalUrl,
  // PayTR credentials stay optional so the storefront keeps working without
  // payments; the payments module refuses to operate until all three are set.
  PAYTR_MERCHANT_ID: optionalText,
  PAYTR_MERCHANT_KEY: optionalText,
  PAYTR_MERCHANT_SALT: optionalText,
  // Anything but '0' means test mode: a misconfigured deploy must never
  // silently start charging real cards.
  PAYTR_TEST_MODE: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),
  BILLING_ENCRYPTION_KEY: optionalText,
  // SMTP mail — when any of these is blank the mail service falls back to
  // console logging so the auth flow still works during local development.
  SMTP_HOST: optionalText,
  SMTP_PORT: z.preprocess(blankToUndefined, z.coerce.number().positive().int().optional()),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  SMTP_FROM: optionalText,
  // Only '1' enforces email verification before login. Until SMTP delivery
  // is configured, unverified accounts must not be locked out.
  REQUIRE_EMAIL_VERIFICATION: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),
  // Yurtiçi Kargo entegrasyonu — kimlik bilgileri sonradan tanımlanacaktır.
  // Üç bilgi (kullanıcı adı, şifre, müşteri no) tamamlanana kadar kargo
  // modülü kendisini "yapılandırılmamış" sayar ve 503 döner; API_URL ve
  // TIMEOUT_MS boş kalırsa lib/yurtici.ts içindeki varsayılanlar kullanılır.
  YURTICI_KARGO_API_URL: optionalUrl,
  YURTICI_KARGO_USERNAME: optionalText,
  YURTICI_KARGO_PASSWORD: optionalText,
  YURTICI_KARGO_CUSTOMER_ID: optionalText,
  YURTICI_KARGO_TIMEOUT_MS: z.preprocess(blankToUndefined, z.coerce.number().positive().int().optional()),
  // Parametrik takip linkinde kullanılacak özel alan. Web servisle oluşturulan
  // gönderilerde cargoKey/Anahtar Alan için varsayılan 53 kullanılır.
  YURTICI_KARGO_TRACKING_FIELD_ID: z.preprocess(blankToUndefined, z.string().default('53')),
  // RMA iade kodunun kaydedildiği özel alan (ssfldvn): canlıda 16 ("İade Onay
  // Kodu"); test kullanıcısında tanım olmadığından 53/3 ile test edilir.
  YURTICI_KARGO_RETURN_FIELD_ID: z.preprocess(blankToUndefined, z.string().default('16')),
  // Rate limit eşikleri — prod trafiğine göre kod değiştirmeden ayarlanabilsin
  // diye kod varsayılanlarıyla aynen dokümante edildi. Kısa pencere login /
  // refresh / logout / checkout için, saatlik pencere register / verify /
  // resend akışları için kullanılır.
  RATE_LIMIT_WINDOW_MINUTES: positiveIntWithDefault(15),
  RATE_LIMIT_HOURLY_WINDOW_MINUTES: positiveIntWithDefault(60),
  RATE_LIMIT_LOGIN_MAX: positiveIntWithDefault(10),
  RATE_LIMIT_REGISTER_MAX: positiveIntWithDefault(5),
  RATE_LIMIT_VERIFY_EMAIL_MAX: positiveIntWithDefault(20),
  RATE_LIMIT_RESEND_VERIFICATION_MAX: positiveIntWithDefault(5),
  RATE_LIMIT_REFRESH_MAX: positiveIntWithDefault(30),
  RATE_LIMIT_LOGOUT_MAX: positiveIntWithDefault(30),
  RATE_LIMIT_CHECKOUT_MAX: positiveIntWithDefault(20),
  // Ödeme penceresi: bu süre içinde tamamlanmayan PaymentAttempt'lar süresi
  // dolmuş sayılıp rezerve ettikleri stoğu iade eder.
  PAYMENT_WINDOW_MINUTES: positiveIntWithDefault(30),
  // Bayat ödeme denemelerini temizleyen arka plan sweep'inin periyodu.
  SWEEP_INTERVAL_MINUTES: positiveIntWithDefault(10),
  // PayTR'a giden isteklerin zaman aşımı (ms).
  PAYTR_TIMEOUT_MS: positiveIntWithDefault(15_000),
  // Çerez secure bayrağı için zorunlu override: '1' her zaman secure, '0'
  // hiçbir zaman secure; tanımsızsa NODE_ENV=production veya https WEB_URL
  // türevi kullanılır (aşağıdaki secureCookies türetilmiş alanı).
  COOKIE_SECURE: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),
});

const parsed = envSchema.parse(process.env);

// COOKIE_SECURE açıkça verilmişse kazanır; verilmediyse production/https türevi.
const secureCookies =
  parsed.COOKIE_SECURE === '1' ||
  (parsed.COOKIE_SECURE === undefined && (parsed.NODE_ENV === 'production' || parsed.WEB_URL.startsWith('https://')));

export const env = {
  ...parsed,
  requireEmailVerification: parsed.REQUIRE_EMAIL_VERIFICATION === '1',
  secureCookies,
};
