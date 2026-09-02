import { rateLimit } from 'express-rate-limit';

/**
 * IP tabanli hiz sinirlayicilar (express-rate-limit).
 *
 * Varsayilan memory store tek instance'lik dagitim icin yeterlidir; yatay
 * olceklemede (birden fazla replica) sinirlar gevser, cunku her instance
 * kendi sayacini tutar. O durumda paylasilan bir Redis store'a gecilmelidir.
 *
 * 429 yanitlari uygulamanin hata formatiyla ayni olan `{ message }` govdesiyle
 * doner; boylece istemci tarafinda tek bir hata isleme yolu kullanilir.
 */
function createLimiter(options: { windowMs: number; limit: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: options.message },
  });
}

/** Giris: 15 dakikada 10 deneme — kaba kuvvet sifre denemelerini yavaslatir. */
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.',
});

/** Kayit: saatte 5 hesap — otomatik hesap acma ve spam kayitlari engellenir. */
export const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Çok fazla kayıt denemesi yapıldı. Lütfen bir saat sonra tekrar deneyin.',
});

/** E-posta dogrulama: saatte 20 token denemesi. */
export const verifyEmailLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: 'Çok fazla doğrulama denemesi yapıldı. Lütfen bir saat sonra tekrar deneyin.',
});

/** Dogrulama e-postasi tekrar gonderimi: saatte 5 (serviste 60 sn cooldown da var). */
export const resendVerificationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Çok fazla istek gönderildi. Lütfen bir saat sonra tekrar deneyin.',
});

/** Oturum yenileme: 15 dakikada 30 istek. */
export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Çok fazla oturum yenileme isteği gönderildi. Lütfen daha sonra tekrar deneyin.',
});

/** Cikis: 15 dakikada 30 istek. */
export const logoutLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Çok fazla çıkış isteği gönderildi. Lütfen daha sonra tekrar deneyin.',
});

/** Odeme checkout: orta seviye — 15 dakikada 20 istek (yeniden denemelere izin verir). */
export const checkoutLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Çok fazla ödeme isteği gönderildi. Lütfen kısa bir süre sonra tekrar deneyin.',
});
