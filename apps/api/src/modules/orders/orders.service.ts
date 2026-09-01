import { AppError } from '../../lib/app-error.js';
import { serializeOrder } from '../../lib/serializers.js';
import { OrdersRepository } from './orders.repository.js';

export class OrdersService {
  constructor(private readonly repository = new OrdersRepository()) {}

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

  async getOrderByTrackingToken(token: string) {
    const order = await this.repository.findOrderByTrackingToken(token);

    if (!order) {
      throw new AppError('Siparis takip linki gecersiz veya siparis henuz olusmadi.', 404);
    }

    return serializeOrder(order);
  }
}
