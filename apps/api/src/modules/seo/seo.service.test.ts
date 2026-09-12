import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeoService } from './seo.service.js';

const repository = {
  listPublishedCategories: vi.fn(async () => [
    { slug: 'camera-drones', updatedAt: new Date('2026-09-01T10:00:00.000Z') },
    { slug: 'handheld', updatedAt: new Date('2026-08-20T10:00:00.000Z') },
  ]),
  listPublishedProducts: vi.fn(async () => [
    { slug: 'dji-mavic-3-pro', updatedAt: new Date('2026-09-02T08:30:00.000Z') },
    { slug: 'dji-mic-2', updatedAt: new Date('2026-08-15T08:30:00.000Z') },
  ]),
};

describe('SeoService.buildSitemapXml', () => {
  let service: SeoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SeoService(repository as never, 'https://borabilgic.net.tr');
  });

  it('statik yolları, kategorileri ve yayındaki ürünleri tek urlset içinde üretir', async () => {
    const xml = await service.buildSitemapXml();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://borabilgic.net.tr/</loc>');
    expect(xml).toContain('<loc>https://borabilgic.net.tr/katalog</loc>');
    expect(xml).toContain('<loc>https://borabilgic.net.tr/kategori/camera-drones</loc>');
    expect(xml).toContain('<loc>https://borabilgic.net.tr/urun/dji-mavic-3-pro</loc>');
    expect(repository.listPublishedProducts).toHaveBeenCalledTimes(1);
  });

  it('lastmod alanını W3C tarih formatıyla yazar', async () => {
    const xml = await service.buildSitemapXml();

    expect(xml).toContain('<loc>https://borabilgic.net.tr/urun/dji-mavic-3-pro</loc><lastmod>2026-09-02</lastmod>');
    expect(xml).toContain('<loc>https://borabilgic.net.tr/kategori/handheld</loc><lastmod>2026-08-20</lastmod>');
  });

  it('veritabanı hatasında statik yollarla geçerli XML döner ve loglar', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    repository.listPublishedProducts.mockRejectedValueOnce(new Error('db down'));

    const xml = await service.buildSitemapXml();

    expect(xml).toContain('<loc>https://borabilgic.net.tr/</loc>');
    expect(xml).not.toContain('/urun/');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('XML özel karakterlerini escape eder', async () => {
    repository.listPublishedProducts.mockResolvedValueOnce([
      { slug: 'son & co <test>', updatedAt: new Date('2026-08-01T00:00:00.000Z') },
    ]);

    const xml = await service.buildSitemapXml();

    expect(xml).toContain('/urun/son &amp; co &lt;test&gt;');
    expect(xml).not.toContain('/urun/son & co');
  });
});
