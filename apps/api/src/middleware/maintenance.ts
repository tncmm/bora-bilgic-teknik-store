import type { NextFunction, Request, Response } from 'express';

import { SiteSettingsService } from '../modules/site-settings/site-settings.service.js';

const service = new SiteSettingsService();

/** Bakim modunda bile acik kalan yollar: admin panel, oturum, durum/iletisim bilgisi. */
// PayTR callback tam yol olarak muaf: odeme bildirimi bakim modunda bile
// islenmeli; yoksa para cekilip siparis olusmayan Islemler birikir.
const EXEMPT_PREFIXES = ['/auth', '/admin', '/contact-info', '/site-status', '/payments/paytr/callback'];

/**
 * Bakim modu kapisi: acikken musteriye donuk tum /api/v1 yollari 503 doner.
 * Admin paneli ve giris akisi etkilenmez; durum okumasi basarisiz olursa
 * istek gecirilir (ayar okunamadigi icin butun API'yi kapatmayalim).
 */
export function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  if (EXEMPT_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return next();
  }

  service
    .isMaintenanceMode()
    .then((on) => {
      if (!on) return next();
      res.status(503).json({ message: 'Site şu anda bakım modunda. Lütfen daha sonra tekrar deneyin.' });
    })
    .catch((error) => {
      console.error('[MAINTENANCE] Durum kontrolu basarisiz; istek geciriliyor.', { error });
      next();
    });
}
