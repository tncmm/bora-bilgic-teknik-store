import { Router } from 'express';

import { SeoService } from './seo.service.js';

const router = Router();
const service = new SeoService();

// app.ts icerisinde /api/v1/seo altina baglanir; nginx /sitemap.xml yolunu
// buraya proxy eder (deploy/nginx/bora-bilgic-teknik-store.conf).
router.get('/sitemap.xml', async (_req, res) => {
  const xml = await service.buildSitemapXml();
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

export { router as seoRoutes };
