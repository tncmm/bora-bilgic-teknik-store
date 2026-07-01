import { CatalogRepository } from './catalog.repository.js';
import { serializeCategory, serializeProduct } from '../../lib/serializers.js';
import { AppError } from '../../lib/app-error.js';

export class CatalogService {
  constructor(private readonly repository = new CatalogRepository()) {}

  async listProducts(query: Record<string, string | undefined>) {
    const products = await this.repository.listProducts({
      category: query.category,
      search: query.search,
      onlyPurchasable: query.saleMode === 'purchasable',
    });

    return products.map(serializeProduct);
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
