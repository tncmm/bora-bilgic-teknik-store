import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

const includeProduct = {
  category: true,
  images: true,
  specs: true,
} satisfies Prisma.ProductInclude;

function resolveSectionSlugs(section?: string) {
  if (!section) return undefined;

  const aliases: Record<string, string[]> = {
    'camera-drones': ['drone'],
    handheld: ['gimbal', 'aksiyon-kamera', 'aksesuar'],
    enterprise: ['kurumsal'],
    drone: ['drone'],
    gimbal: ['gimbal'],
    'aksiyon-kamera': ['aksiyon-kamera'],
    aksesuar: ['aksesuar'],
    kurumsal: ['kurumsal'],
  };

  return aliases[section] ?? [section];
}

export interface CatalogQuery {
  section?: string;
  series?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  features?: string[];
  sort?: string;
  page: number;
  limit: number;
  onlyPurchasable?: boolean;
  onlyBestseller?: boolean;
}

export class CatalogRepository {
  private buildWhere(filters: Omit<CatalogQuery, 'page' | 'limit' | 'sort'>) {
    const sectionSlugs = resolveSectionSlugs(filters.section);

    return {
      isPublished: true,
      ...(sectionSlugs?.length ? { category: { slug: { in: sectionSlugs } } } : {}),
      ...(filters.series ? { series: filters.series } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { shortDescription: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { series: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number'
        ? {
            price: {
              ...(typeof filters.minPrice === 'number' ? { gte: filters.minPrice } : {}),
              ...(typeof filters.maxPrice === 'number' ? { lte: filters.maxPrice } : {}),
            },
          }
        : {}),
      ...(filters.features?.length ? { featureTags: { hasEvery: filters.features } } : {}),
      ...(filters.onlyPurchasable ? { isPurchasable: true } : {}),
      ...(filters.onlyBestseller ? { isBestseller: true } : {}),
    } satisfies Prisma.ProductWhereInput;
  }

  private getOrderBy(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price-asc':
        return [{ price: 'asc' }];
      case 'price-desc':
        return [{ price: 'desc' }];
      case 'rating':
        return [{ ratingAverage: 'desc' }, { reviewCount: 'desc' }];
      default:
        return [{ isPurchasable: 'desc' }, { createdAt: 'desc' }];
    }
  }

  async listProducts(filters: CatalogQuery) {
    const { page, limit, sort, ...whereFilters } = filters;
    const where = this.buildWhere(whereFilters);
    const filterBaseWhere = this.buildWhere({
      ...whereFilters,
      series: undefined,
      features: undefined,
    });

    const [items, total, filterProducts] = await Promise.all([
      prisma.product.findMany({
        where,
        include: includeProduct,
        orderBy: this.getOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
      prisma.product.findMany({
        where: filterBaseWhere,
        select: {
          series: true,
          featureTags: true,
          price: true,
        },
      }),
    ]);

    return {
      items,
      total,
      availableFilters: {
        series: Object.entries(
          filterProducts.reduce<Record<string, number>>((accumulator, product) => {
            if (!product.series) return accumulator;
            accumulator[product.series] = (accumulator[product.series] ?? 0) + 1;
            return accumulator;
          }, {}),
        ).map(([value, count]) => ({ value, count })),
        features: Object.entries(
          filterProducts.reduce<Record<string, number>>((accumulator, product) => {
            for (const feature of product.featureTags) {
              accumulator[feature] = (accumulator[feature] ?? 0) + 1;
            }
            return accumulator;
          }, {}),
        ).map(([value, count]) => ({ value, count })),
        priceRange: {
          min: filterProducts.length ? Math.min(...filterProducts.map((product) => Number(product.price))) : 0,
          max: filterProducts.length ? Math.max(...filterProducts.map((product) => Number(product.price))) : 0,
        },
      },
    };
  }

  findProductBySlug(slug: string) {
    return prisma.product.findFirst({
      where: { slug, isPublished: true },
      include: includeProduct,
    });
  }

  listCategories() {
    return prisma.category.findMany({
      include: {
        products: {
          where: {
            isPublished: true,
          },
          select: {
            series: true,
            featureTags: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
