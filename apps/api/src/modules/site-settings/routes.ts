import { Router } from 'express';

import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { SiteSettingsService } from './site-settings.service.js';

const service = new SiteSettingsService();

// app.ts /api/v1 altina baglanir: public iletisim bilgileri.
export const siteSettingsPublicRouter = Router();
siteSettingsPublicRouter.get('/contact-info', async (_req, res) => {
  res.json(await service.getContactInfo());
});

// Bakim gate'i ve SPA'nin okudugu hafif durum endpoint'i.
siteSettingsPublicRouter.get('/site-status', async (_req, res) => {
  const settings = await service.getContactInfo();
  res.json({ maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage });
});

// app.ts /api/v1/admin altina baglanir; requireAuth+requireAdmin guard'i icerir.
export const siteSettingsAdminRouter = Router();
siteSettingsAdminRouter.use(requireAuth, requireAdmin);
siteSettingsAdminRouter.get('/site-settings', async (_req, res) => {
  res.json(await service.getSettings());
});
siteSettingsAdminRouter.put('/site-settings', async (req, res) => {
  res.json(await service.updateSettings(req.body));
});
