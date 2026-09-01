import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { AppError } from '../../lib/app-error.js';
import { generateOrderNumber } from '../orders/orders.repository.js';

export interface AttemptItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AttemptPayload {
  userId?: string;
  merchantOid: string;
  customerEmail: string;
  trackingTokenHash?: string;
  trackingTokenEncrypted?: string;
  total: number;
  items: AttemptItem[];
  shippingName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingAddressLine: string;
  billingType: string;
  billingName: string;
  billingPhone: string;
  billingCity: string;
  billingDistrict: string;
  billingAddressLine: string;
  companyName?: string;
  taxOffice?: string;
  taxNumber?: string;
  identityNumberEncrypted: string;
  identityNumberLast4: string;
  notes?: string;
}

export class PaymentsRepository {
  findCart(userId: string) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  findAttemptByOid(merchantOid: string) {
    return prisma.paymentAttempt.findUnique({
      where: { merchantOid },
      include: { user: true },
    });
  }

  findProductsForCheckout(items: Array<{ productId: string }>) {
    const ids = [...new Set(items.map((item) => item.productId))];
    return prisma.product.findMany({
      where: { id: { in: ids } },
    });
  }

  findAttemptStatus(merchantOid: string) {
    return prisma.paymentAttempt.findUnique({
      where: { merchantOid },
      include: { user: true },
    });
  }

  findOrderByPaymentRef(paymentRef: string) {
    return prisma.order.findUnique({
      where: { paymentRef },
      include: { items: true, refunds: { orderBy: { createdAt: 'desc' } } },
    });
  }

  /**
   * Terminal transition for any still-pending attempt, with the reserved
   * stock handed back. Count 0 means the attempt was already resolved and
   * the caller must not repeat side effects (idempotency anchor).
   */
  async settleAttempt(merchantOid: string, input: { status: 'FAILED' | 'EXPIRED'; reason: string }) {
    return prisma.$transaction(async (tx) => {
      const settled = await tx.paymentAttempt.updateMany({
        where: { merchantOid, status: 'PENDING' },
        data: { status: input.status, failureReason: input.reason },
      });

      if (settled.count === 0) {
        return 0;
      }

      const attempt = await tx.paymentAttempt.findUnique({ where: { merchantOid } });
      const items = (attempt?.items ?? []) as unknown as AttemptItem[];

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return settled.count;
    });
  }

  /** Abandoned attempts older than the payment window are expired and refunded. */
  async expireStaleAttempts(userId: string, cutoff: Date) {
    const stale = await prisma.paymentAttempt.findMany({
      where: { userId, status: 'PENDING', createdAt: { lt: cutoff } },
      select: { merchantOid: true },
    });

    for (const attempt of stale) {
      await this.settleAttempt(attempt.merchantOid, {
        status: 'EXPIRED',
        reason: 'Odeme suresi doldugu icin deneme otomatik kapatildi.',
      });
    }

    return stale.length;
  }

  /**
   * Starting a new checkout supersedes any attempt that is still open, so a
   * user never locks stock through two parallel payment windows.
   */
  async supersedeOpenAttempts(userId: string) {
    const open = await prisma.paymentAttempt.findMany({
      where: { userId, status: 'PENDING' },
      select: { merchantOid: true },
    });

    for (const attempt of open) {
      await this.settleAttempt(attempt.merchantOid, {
        status: 'FAILED',
        reason: 'Musteri yeni bir odeme denemesi baslatti.',
      });
    }

    return open.length;
  }

  /**
   * Reserves stock and records the attempt in one transaction. Anything
   * failing here rolls both back, so stock and attempts can never drift apart.
   */
  createAttempt(payload: AttemptPayload) {
    return prisma.$transaction(async (tx) => {
      for (const item of payload.items) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (result.count === 0) {
          throw new AppError(`Yetersiz stok: ${item.productName}`, 409);
        }
      }

      return tx.paymentAttempt.create({
        data: {
          merchantOid: payload.merchantOid,
          status: 'PENDING',
          total: payload.total,
          items: payload.items as unknown as Prisma.InputJsonValue,
          shippingName: payload.shippingName,
          shippingPhone: payload.shippingPhone,
          shippingCity: payload.shippingCity,
          shippingDistrict: payload.shippingDistrict,
          shippingAddressLine: payload.shippingAddressLine,
          customerEmail: payload.customerEmail,
          trackingTokenHash: payload.trackingTokenHash,
          trackingTokenEncrypted: payload.trackingTokenEncrypted,
          billingType: payload.billingType,
          billingName: payload.billingName,
          billingPhone: payload.billingPhone,
          billingCity: payload.billingCity,
          billingDistrict: payload.billingDistrict,
          billingAddressLine: payload.billingAddressLine,
          companyName: payload.companyName,
          taxOffice: payload.taxOffice,
          taxNumber: payload.taxNumber,
          identityNumberEncrypted: payload.identityNumberEncrypted,
          identityNumberLast4: payload.identityNumberLast4,
          notes: payload.notes,
          userId: payload.userId,
        },
        include: { user: true },
      });
    });
  }

  /**
   * The only path that turns an attempt into an order: PayTR confirmed the
   * payment, so the order is born PAID, the attempt is marked COMPLETED and
   * the cart is emptied — a single transaction, idempotent via the PENDING
   * guard (a repeated callback is a no-op).
   */
  async completeAttempt(merchantOid: string) {
    return prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({ where: { merchantOid } });

      if (!attempt) {
        throw new AppError('Odeme bildirimi bir denemeyle eslesmedi.', 400);
      }

      if (attempt.status !== 'PENDING') {
        return null;
      }

      const items = attempt.items as unknown as AttemptItem[];
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: attempt.userId,
          status: 'PENDING',
          paymentStatus: 'PAID',
          paidAt: new Date(),
          paymentNotifiedAt: new Date(),
          paymentRef: attempt.merchantOid,
          paymentAmount: attempt.total,
          paymentCurrency: attempt.currency,
          paymentMethod: 'card',
          paymentType: 'card',
          total: attempt.total,
          customerEmail: attempt.customerEmail,
          trackingTokenHash: attempt.trackingTokenHash,
          trackingTokenEncrypted: attempt.trackingTokenEncrypted,
          shippingName: attempt.shippingName,
          shippingPhone: attempt.shippingPhone,
          shippingCity: attempt.shippingCity,
          shippingDistrict: attempt.shippingDistrict,
          shippingAddressLine: attempt.shippingAddressLine,
          billingType: attempt.billingType,
          billingName: attempt.billingName,
          billingPhone: attempt.billingPhone,
          billingCity: attempt.billingCity,
          billingDistrict: attempt.billingDistrict,
          billingAddressLine: attempt.billingAddressLine,
          companyName: attempt.companyName,
          taxOffice: attempt.taxOffice,
          taxNumber: attempt.taxNumber,
          identityNumberEncrypted: attempt.identityNumberEncrypted,
          identityNumberLast4: attempt.identityNumberLast4,
          notes: attempt.notes,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { items: true, refunds: { orderBy: { createdAt: 'desc' } } },
      });

      await tx.paymentAttempt.update({
        where: { merchantOid },
        data: { status: 'COMPLETED' },
      });

      if (attempt.userId) {
        await tx.cartItem.deleteMany({
          where: { cart: { userId: attempt.userId } },
        });
      }

      return order;
    });
  }
}
