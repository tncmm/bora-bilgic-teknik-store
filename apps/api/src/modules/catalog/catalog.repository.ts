import { prisma } from '../../db/prisma.js';

export class CatalogRepository {
  listProducts(filters: { category?: string; search?: string; onlyPurchasable?: boolean }) {
    return prisma.product.findMany({
      where: {
        isPublished: true,
        brand: 'DJI',
        ...(filters.category ? { category: { slug: filters.category } } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { brand: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(filters.onlyPurchasable ? { isPurchasable: true } : {}),
      },
      include: {
        category: true,
        images: true,
        specs: true,
      },
      orderBy: [{ isPurchasable: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findProductBySlug(slug: string) {
    return prisma.product.findFirst({
      where: { slug, isPublished: true, brand: 'DJI' },
      include: {
        category: true,
        images: true,
        specs: true,
      },
    });
  }

  listCategories() {
    return prisma.category.findMany({
      where: {
        products: {
          some: {
            isPublished: true,
            brand: 'DJI',
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
