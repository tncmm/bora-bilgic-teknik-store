import { z } from 'zod';

import { serializeCategory, serializeProduct } from '../../lib/serializers.js';
import { AppError } from '../../lib/app-error.js';
import { CatalogRepository } from './catalog.repository.js';

const querySchema = z.object({
  category: z.string().optional(),
  section: z.string().optional(),
  series: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  features: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(6),
  saleMode: z.enum(['purchasable', 'all']).optional(),
  bestseller: z.string().optional(),
});

export class CatalogService {
  constructor(private readonly repository = new CatalogRepository()) {}

  async listProducts(query: Record<string, string | undefined>) {
    const data = querySchema.parse(query);
    const response = await this.repository.listProducts({
      section: data.section ?? data.category,
      series: data.series,
      search: data.search,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      features: data.features?.split(',').map((item) => item.trim()).filter(Boolean),
      sort: data.sort,
      page: data.page,
      limit: data.limit,
      onlyPurchasable: data.saleMode === 'purchasable',
      onlyBestseller: data.bestseller === 'true',
    });

    return {
      items: response.items.map(serializeProduct),
      total: response.total,
      page: data.page,
      limit: data.limit,
      availableFilters: {
        ...response.availableFilters,
        sorts: ['newest', 'price-asc', 'price-desc', 'rating'],
      },
    };
  }

  async getProduct(slug: string) {
    const product = await this.repository.findProductBySlug(slug);

    if (!product) {
      throw new AppError('Urun bulunamadi.', 404);
    }

    return serializeProduct(product);
  }

  async listCategories() {
    const categories = await this.repository.listCategories();
    return categories.map(serializeCategory);
  }
}
