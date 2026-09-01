import { randomBytes } from 'node:crypto';

import { prisma } from '../../db/prisma.js';
import { hashTrackingToken } from '../../lib/crypto.js';

export function generateOrderNumber() {
  return `BBT-${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Orders only ever exist for confirmed payments (they are created by the
 * PayTR callback), so reads additionally filter on PAID as a safety net for
 * rows predating the payment-first flow.
 */
export class OrdersRepository {
  listOrdersForUser(userId: string) {
    return prisma.order.findMany({
      where: { userId, paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
      include: { items: true, refunds: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOrderForUser(userId: string, orderId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      include: { items: true, refunds: { orderBy: { createdAt: 'desc' } } },
    });
  }

  findOrderByTrackingToken(token: string) {
    return prisma.order.findUnique({
      where: { trackingTokenHash: hashTrackingToken(token) },
      include: { items: true, refunds: { orderBy: { createdAt: 'desc' } } },
    });
  }
}
