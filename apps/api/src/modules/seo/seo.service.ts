import { env } from '../../config/env.js';
import type { SitemapEntry } from './seo.repository.js';
import { SeoRepository } from './seo.repository.js';

/** Sitemap'te sabit listelenen public storefront yolları. */
const STATIC_PATHS = [
  '/',
  '/katalog',
  '/drone',
  '/gimbal',
  '/aksiyon-kamera',
  '/aksesuar',
  '/kurumsal',
  '/iletisim',
  '/teslimat',
  '/iade',
  '/mesafeli-satis',
  '/gizlilik',
  '/garanti',
  '/sss',
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Sitemap protokolü W3C tarih kabul eder (YYYY-MM-DD). */
function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export class SeoService {
  constructor(
    private readonly repository = new SeoRepository(),
    private readonly siteUrl = env.PUBLIC_SITE_URL.replace(/\/+$/, ''),
  ) {}

  /** Arama motorları + sosyal scraper'ların kırılmaması için her koşulda geçerli XML üretir. */
  async buildSitemapXml(): Promise<string> {
    const entries: SitemapEntry[] = STATIC_PATHS.map((path) => ({ path }));

    try {
      const [categories, products] = await Promise.all([this.repository.listPublishedCategories(), this.repository.listPublishedProducts()]);
      entries.push(
        ...categories.map((category) => ({ path: `/kategori/${category.slug}`, lastmod: category.updatedAt })),
        ...products.map((product) => ({ path: `/urun/${product.slug}`, lastmod: product.updatedAt })),
      );
    } catch (error) {
      // DB erişilemezse statik yollarla sitemap dönmeye devam eder; 500 yerine
      // bayat ama geçerli bir sitemap, arama motoru dizinini korur.
      console.error('[SEO] Sitemap veritabani sorgusu basarisiz; statik yollarla devam ediliyor', { error });
    }

    const urls = entries
      .map((entry) => {
        const lastmod = entry.lastmod ? `<lastmod>${toDateOnly(entry.lastmod)}</lastmod>` : '';
        return `<url><loc>${escapeXml(`${this.siteUrl}${entry.path}`)}</loc>${lastmod}</url>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  }
}
