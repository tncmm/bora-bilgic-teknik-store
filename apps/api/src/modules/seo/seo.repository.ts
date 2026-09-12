import { prisma } from '../../db/prisma.js';

/** Sitemap girişi: site köküne göre yol + opsiyonel son değişiklik tarihi. */
export interface SitemapEntry {
  path: string;
  lastmod?: Date | null;
}

/**
 * Yayındaki kategoriler ve ürünler; sitemap için tek kaynak.
 * Product.updatedAt admin düzenlemelerinde otomatik güncellendiği için
 * lastmod arama motorlarının yeniden tarama takvimini besler.
 */
export class SeoRepository {
  listPublishedCategories() {
    return prisma.category.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
  }

  listPublishedProducts() {
    return prisma.product.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
