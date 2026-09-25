import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';

/**
 * IP tabanli hiz sinirlayicilar (express-rate-limit).
 *
 * Esikler RATE_LIMIT_* env degiskenleriyle ayarlanabilir (varsayilanlar ve
 * dokumantasyon icin apps/api/.env.example'a bakin); mesajlar pencere
 * uzunluguna gore dinamik kurulur.
 *
 * Varsayilan memory store tek instance'lik dagitim icin yeterlidir; yatay
 * olceklemede (birden fazla replica) sinirlar gevser, cunku her instance
 * kendi sayacini tutar. O durumda paylasilan bir Redis store'a gecilmelidir.
 *
 * 429 yanitlari uygulamanin hata formatiyla ayni olan `{ message }` govdesiyle
 * doner; boylece istemci tarafinda tek bir hata isleme yolu kullanilir.
 */
function createLimiter(options: { windowMinutes: number; limit: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMinutes * 60 * 1000,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: `${options.message} Lütfen ${options.windowMinutes} dakika sonra tekrar deneyin.`,
    },
  });
}

/** Giris — kaba kuvvet sifre denemelerini yavaslatir. */
export const loginLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  message: 'Çok fazla giriş denemesi yapıldı.',
});

/** Kayit — otomatik hesap acma ve spam kayitlari engellenir. */
export const registerLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_HOURLY_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_REGISTER_MAX,
  message: 'Çok fazla kayıt denemesi yapıldı.',
});

/** E-posta dogrulama token denemeleri. */
export const verifyEmailLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_HOURLY_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_VERIFY_EMAIL_MAX,
  message: 'Çok fazla doğrulama denemesi yapıldı.',
});

/** Dogrulama e-postasi tekrar gonderimi (serviste 60 sn cooldown da var). */
export const resendVerificationLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_HOURLY_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_RESEND_VERIFICATION_MAX,
  message: 'Çok fazla istek gönderildi.',
});

/** Oturum yenileme. */
export const refreshLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_REFRESH_MAX,
  message: 'Çok fazla oturum yenileme isteği gönderildi.',
});

/** Cikis. */
export const logoutLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_LOGOUT_MAX,
  message: 'Çok fazla çıkış isteği gönderildi.',
});

/** Destek talebi formu: saatte 5 talep — spam form gonderimlerini engeller. */
export const supportLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_HOURLY_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_SUPPORT_MAX,
  message: 'Çok fazla destek talebi gönderildi.',
});

/** Odeme checkout: orta seviye — yeniden denemelere izin verir. */
export const checkoutLimiter = createLimiter({
  windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
  limit: env.RATE_LIMIT_CHECKOUT_MAX,
  message: 'Çok fazla ödeme isteği gönderildi.',
});
