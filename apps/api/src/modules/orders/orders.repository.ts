import { randomBytes } from 'node:crypto';

import { prisma } from '../../db/prisma.js';
import { hashTrackingToken } from '../../lib/crypto.js';

const orderInclude = { items: true, refunds: { include: { items: true }, orderBy: { createdAt: 'desc' as const } } };

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
      include: orderInclude,
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
      include: orderInclude,
    });
  }

  findOrderByTrackingToken(token: string) {
    return prisma.order.findUnique({
      where: { trackingTokenHash: hashTrackingToken(token) },
      include: orderInclude,
    });
  }

  createRefundRequest(
    orderId: string,
    input: {
      merchantOid: string;
      amount: number;
      requestedByUserId?: string;
      requestedByEmail: string;
      customerReason: string;
      customerNote: string;
      items: Array<{ orderItemId: string; productId: string; quantity: number; unitPrice: number; lineTotal: number }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.refund.create({
        data: {
          orderId,
          merchantOid: input.merchantOid,
          amount: input.amount,
          source: 'customer',
          requestedByUserId: input.requestedByUserId,
          requestedByEmail: input.requestedByEmail,
          customerReason: input.customerReason,
          customerNote: input.customerNote,
          requestedAt: new Date(),
          restock: false,
          items: { create: input.items },
        },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
    });
  }
}
