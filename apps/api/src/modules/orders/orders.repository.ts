import { randomBytes } from 'node:crypto';

import { prisma } from '../../db/prisma.js';
import { AppError } from '../../lib/app-error.js';

export function generateOrderNumber() {
  return `BBT-${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
}

export class OrdersRepository {
  findCart(userId: string) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                images: true,
                specs: true,
              },
            },
          },
        },
      },
    });
  }

  createOrder(data: {
    userId: string;
    shippingName: string;
    shippingPhone: string;
    shippingCity: string;
    shippingDistrict: string;
    shippingAddressLine: string;
    notes?: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    total: number;
  }) {
    const orderNumber = generateOrderNumber();

    return prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: data.items.map((item) => item.productId) } },
        select: { id: true, name: true },
      });
      const nameById = new Map(products.map((product) => [product.id, product.name]));

      for (const item of data.items) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (result.count === 0) {
          throw new AppError(`Yetersiz stok: ${nameById.get(item.productId) ?? item.productName}`, 409);
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: data.userId,
          shippingName: data.shippingName,
          shippingPhone: data.shippingPhone,
          shippingCity: data.shippingCity,
          shippingDistrict: data.shippingDistrict,
          shippingAddressLine: data.shippingAddressLine,
          notes: data.notes,
          total: data.total,
          paymentAmount: data.total,
          paymentCurrency: 'TL',
          items: {
            create: data.items,
          },
        },
        include: { items: true },
      });

      await tx.cartItem.deleteMany({
        where: { cart: { userId: data.userId } },
      });

      return order;
    });
  }

  listOrdersForUser(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOrderForUser(userId: string, orderId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: { items: true, user: true },
    });
  }

  findByPaymentRef(paymentRef: string) {
    return prisma.order.findUnique({
      where: { paymentRef },
      include: { items: true, user: true },
    });
  }

  /** Stores the merchant_oid the next PayTR attempt will identify itself with. */
  assignPaymentRef(orderId: string, paymentRef: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { paymentRef, paymentMethod: 'card', paymentType: 'card' },
    });
  }

  /**
   * Idempotent PENDING -> PAID transition. When the row was already resolved
   * (duplicate callback) the count is 0 and the caller treats it as a no-op.
   */
  markPaid(orderId: string) {
    return prisma.order.updateMany({
      where: { id: orderId, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'PAID', paidAt: new Date(), paymentNotifiedAt: new Date() },
    });
  }

  /**
   * PENDING -> FAILED with a stock refund, atomically. Only ever reverts an
   * order that is still waiting for payment, so a successful payment is never
   * clobbered by a late or forged failure callback.
   */
  async markFailed(orderId: string, code: string, message: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: 'PENDING' },
        data: {
          paymentStatus: 'FAILED',
          paymentFailureCode: code,
          paymentFailureMessage: message,
          paymentNotifiedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return 0;
      }

      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return result.count;
    });
  }

  /**
   * Checkout-time hygiene: pending orders whose payment window expired are
   * cancelled and their stock is returned before a new order is created.
   */
  async expireStalePendingOrders(userId: string, cutoff: Date) {
    const staleOrders = await prisma.order.findMany({
      where: { userId, paymentStatus: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true },
    });

    for (const stale of staleOrders) {
      await this.markFailed(stale.id, 'expired', 'Odeme suresi doldugu icin siparis otomatik iptal edildi.');
    }

    return staleOrders.length;
  }
}
