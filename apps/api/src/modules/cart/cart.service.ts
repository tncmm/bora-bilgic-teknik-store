import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { serializeCart } from '../../lib/serializers.js';
import { CartRepository } from './cart.repository.js';

const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(10),
});

export class CartService {
  constructor(private readonly repository = new CartRepository()) {}

  async getCart(userId: string) {
    const cart = await this.repository.ensureCart(userId);
    return serializeCart(cart);
  }

  async addItem(userId: string, payload: unknown) {
    const data = addItemSchema.parse(payload);
    const cart = await this.repository.ensureCart(userId);
    const product = await this.repository.findProduct(data.productId);

    if (!product || !product.isPublished) {
      throw new AppError('Urun bulunamadi.', 404);
    }

    if (!product.isPurchasable) {
      throw new AppError('Bu urun su anda satisa kapali.', 409);
    }

    if (product.stock < data.quantity) {
      throw new AppError('Stok yetersiz.', 409);
    }

    await this.repository.addOrUpdateItem(cart.id, data.productId, data.quantity);
    const updatedCart = await this.repository.findCart(userId);
    return serializeCart(updatedCart);
  }

  async updateItem(userId: string, itemId: string, payload: unknown) {
    const data = updateItemSchema.parse(payload);
    await this.repository.ensureCart(userId);
    await this.repository.updateItem(itemId, data.quantity);
    const updatedCart = await this.repository.findCart(userId);
    return serializeCart(updatedCart);
  }

  async removeItem(userId: string, itemId: string) {
    await this.repository.ensureCart(userId);
    await this.repository.removeItem(itemId);
    const updatedCart = await this.repository.findCart(userId);
    return serializeCart(updatedCart);
  }
}
