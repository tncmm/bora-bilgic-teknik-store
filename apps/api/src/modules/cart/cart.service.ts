import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { findPackageOption, serializeCart } from '../../lib/serializers.js';
import { CartRepository } from './cart.repository.js';

const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  // Opsiyonel: gelmezse taban urun satiri (packageOptionId = '') olusur.
  packageOptionId: z.string().trim().min(1).optional(),
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

    // Paket secimi urunun guncel packageOptions listesinden dogrulanir:
    // bilinmeyen bir paket id'si sepette fiyat zimbalanmadan reddedilir.
    const packageOption = findPackageOption(product, data.packageOptionId);
    if (data.packageOptionId && !packageOption) {
      throw new AppError('Gecersiz paket secimi.', 400);
    }

    const result = await this.repository.addOrUpdateItem({
      cartId: cart.id,
      productId: data.productId,
      quantity: data.quantity,
      packageOptionId: packageOption?.id ?? '',
      packageLabel: packageOption?.name ?? null,
    });

    if (result === 'cap-exceeded') {
      throw new AppError('Ayni urunden en fazla 10 adet satin alabilirsiniz.', 409);
    }
    if (result === 'stock-exceeded') {
      throw new AppError('Stok yetersiz.', 409);
    }
    if (result === 'removed') {
      throw new AppError('Sepet kalemi bulunamadi.', 404);
    }

    const updatedCart = await this.repository.findCart(userId);
    return serializeCart(updatedCart);
  }

  async updateItem(userId: string, itemId: string, payload: unknown) {
    const data = updateItemSchema.parse(payload);
    await this.repository.ensureCart(userId);
    const result = await this.repository.updateItem(userId, itemId, data.quantity);

    if (result === 'removed') {
      throw new AppError('Sepet kalemi bulunamadi.', 404);
    }
    if (result === 'stock-exceeded') {
      throw new AppError('Stok yetersiz.', 409);
    }

    const updatedCart = await this.repository.findCart(userId);
    return serializeCart(updatedCart);
  }

  async removeItem(userId: string, itemId: string) {
    await this.repository.ensureCart(userId);
    const result = await this.repository.removeItem(userId, itemId);

    if (result.count === 0) {
      throw new AppError('Sepet kalemi bulunamadi.', 404);
    }

    const updatedCart = await this.repository.findCart(userId);
    return serializeCart(updatedCart);
  }
}
