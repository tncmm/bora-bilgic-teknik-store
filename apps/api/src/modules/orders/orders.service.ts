import { AppError } from '../../lib/app-error.js';
import { buildRefundSelection } from '../../lib/refunds.js';
import { serializeOrder } from '../../lib/serializers.js';
import { OrdersRepository } from './orders.repository.js';
import { z } from 'zod';

const refundRequestSchema = z.object({
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1) })).min(1),
  reason: z.string().trim().min(3).max(120),
  note: z.string().trim().min(10).max(1000),
});

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

  async createRefundRequestForUser(userId: string, orderId: string, payload: unknown) {
    const order = await this.repository.findOrderForUser(userId, orderId);
    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    return this.createRefundRequest(order, userId, payload);
  }

  async createRefundRequestByTrackingToken(token: string, payload: unknown) {
    const order = await this.repository.findOrderByTrackingToken(token);
    if (!order) {
      throw new AppError('Siparis takip linki gecersiz veya siparis henuz olusmadi.', 404);
    }

    return this.createRefundRequest(order, undefined, payload);
  }

  private async createRefundRequest(order: any, userId: string | undefined, payload: unknown) {
    if (!order.paymentRef || !['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw new AppError('Bu siparis icin iade talebi baslatilamaz.', 409);
    }

    const data = refundRequestSchema.parse(payload);
    const selection = buildRefundSelection(order, data.items);
    if (selection.amount <= 0) {
      throw new AppError('Iade tutari hesaplanamadi.', 400);
    }

    const updatedOrder = await this.repository.createRefundRequest(order.id, {
      merchantOid: order.paymentRef,
      amount: selection.amount,
      requestedByUserId: userId,
      requestedByEmail: order.customerEmail,
      customerReason: data.reason,
      customerNote: data.note,
      items: selection.items,
    });

    return serializeOrder(updatedOrder);
  }
}
