import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { serializeOrder } from '../../lib/serializers.js';
import { OrdersRepository } from './orders.repository.js';

const checkoutSchema = z.object({
  shippingName: z.string().min(3),
  shippingPhone: z.string().min(10),
  shippingCity: z.string().min(2),
  shippingDistrict: z.string().min(2),
  shippingAddressLine: z.string().min(5),
  notes: z.string().optional(),
});

export class OrdersService {
  constructor(private readonly repository = new OrdersRepository()) {}

  async createOrder(userId: string, payload: unknown) {
    const data = checkoutSchema.parse(payload);
    const cart = await this.repository.findCart(userId);

    if (!cart || cart.items.length === 0) {
      throw new AppError('Siparis olusturmak icin sepetiniz bos olmamali.', 409);
    }

    for (const item of cart.items) {
      if (!item.product.isPurchasable) {
        throw new AppError(`${item.product.name} urunu su anda satisa kapali.`, 409);
      }
      if (item.product.stock < item.quantity) {
        throw new AppError(`${item.product.name} icin stok yetersiz.`, 409);
      }
    }

    const items = cart.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.product.price),
      lineTotal: Number(item.product.price) * item.quantity,
    }));

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    const order = await this.repository.createOrder({
      userId,
      ...data,
      total,
      items,
    });

    return serializeOrder(order);
  }

  async listOrdersForUser(userId: string) {
    const orders = await this.repository.listOrdersForUser(userId);
    return orders.map(serializeOrder);
  }

  async getOrderForUser(userId: string, orderId: string) {
    const order = await this.repository.findOrderForUser(userId, orderId);

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    return serializeOrder(order);
  }
}
