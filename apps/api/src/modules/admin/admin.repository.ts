import { OrderStatus } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

const orderInclude = { items: true, refunds: { include: { items: true }, orderBy: { createdAt: 'desc' as const } } };

export class AdminRepository {
  countDashboardMetrics() {
    // Unpaid orders are payment attempts, not sales: they never reach the
    // dashboard totals.
    return Promise.all([
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } }),
      prisma.order.count({ where: { status: OrderStatus.PENDING, paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } }),
      prisma.product.aggregate({ _sum: { stock: true } }),
      prisma.product.count({ where: { stock: { lte: 3 } } }),
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } }),
      prisma.refund.count({ where: { status: 'PENDING' } }),
    ]);
  }

  listProducts() {
    return prisma.product.findMany({
      include: { category: true, images: true, specs: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getProduct(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true, specs: true },
    });
  }

  listCategories() {
    return prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findCategoryBySlug(slug: string) {
    return prisma.category.findUnique({ where: { slug } });
  }

  createCategory(data: { name: string; slug: string; description: string; heroTitle?: string | null; heroDescription?: string | null; sortOrder: number }) {
    return prisma.category.create({ data });
  }

  updateCategory(
    id: string,
    data: { name?: string; slug?: string; description?: string; heroTitle?: string | null; heroDescription?: string | null; sortOrder?: number },
  ) {
    return prisma.category.update({ where: { id }, data });
  }

  countCategoryProducts(id: string) {
    return prisma.product.count({ where: { categoryId: id } });
  }

  deleteCategory(id: string) {
    return prisma.category.delete({ where: { id } });
  }

  listBrandSummaries() {
    return Promise.all([
      prisma.brand.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.groupBy({
        by: ['brand'],
        _count: { _all: true },
        orderBy: { _count: { brand: 'desc' } },
      }),
    ]);
  }

  findBrandByName(name: string) {
    return prisma.brand.findUnique({ where: { name } });
  }

  createBrand(name: string) {
    return prisma.brand.create({ data: { name } });
  }

  renameBrand(from: string, to: string) {
    return prisma.$transaction(async (tx) => {
      await tx.brand.upsert({
        where: { name: to },
        create: { name: to },
        update: {},
      });
      await tx.brand.deleteMany({ where: { name: from } });
      return tx.product.updateMany({
        where: { brand: from },
        data: { brand: to },
      });
    });
  }

  countBrandProducts(name: string) {
    return prisma.product.count({ where: { brand: name } });
  }

  deleteBrand(name: string) {
    return prisma.brand.delete({ where: { name } });
  }

  createProduct(data: any) {
    return prisma.product.create({
      data,
      include: { category: true, images: true, specs: true },
    });
  }

  updateProduct(id: string, data: any) {
    return prisma.product.update({
      where: { id },
      data,
      include: { category: true, images: true, specs: true },
    });
  }

  deleteProduct(id: string) {
    return prisma.product.delete({
      where: { id },
    });
  }

  listOrders() {
    // Operations only ever deal with paid orders. Pending-payment attempts
    // expire on their own and failed ones are kept for the customer's sake.
    return prisma.order.findMany({
      where: { paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
      include: {
        items: true,
        refunds: { include: { items: true }, orderBy: { createdAt: 'desc' } },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Odemesi alindigi halde siparise donemeyen odeme denemeleri. Operator bu
   * satirlari inceleyip PayTR panelinden iade yapmali veya siparisi elle
   * olusturmalidir.
   */
  listAttemptsWithoutOrder() {
    return prisma.paymentAttempt.findMany({
      where: { paidWithoutOrderAt: { not: null } },
      orderBy: { paidWithoutOrderAt: 'desc' },
    });
  }

  getOrder(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
  }

  updateOrderStatus(id: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id },
      data: { status },
      include: orderInclude,
    });
  }

  updateOrderInvoice(id: string, input: { invoicePdfUrl: string; invoiceFileName: string }) {
    return prisma.order.update({
      where: { id },
      data: {
        invoicePdfUrl: input.invoicePdfUrl,
        invoiceFileName: input.invoiceFileName,
        invoiceUploadedAt: new Date(),
      },
      include: orderInclude,
    });
  }

  markInvoiceSent(id: string) {
    return prisma.order.update({
      where: { id },
      data: { invoiceSentAt: new Date() },
      include: orderInclude,
    });
  }

  createRefund(
    orderId: string,
    adminId: string | undefined,
    input: {
      merchantOid: string;
      amount: number;
      reason?: string;
      restock: boolean;
      source?: 'admin' | 'customer';
      requestedByUserId?: string;
      requestedByEmail?: string;
      customerReason?: string;
      customerNote?: string;
      items?: Array<{ orderItemId: string; productId: string; quantity: number; unitPrice: number; lineTotal: number }>;
    },
  ) {
    return prisma.refund.create({
      data: {
        orderId,
        adminId,
        merchantOid: input.merchantOid,
        amount: input.amount,
        reason: input.reason,
        restock: input.restock,
        source: input.source ?? 'admin',
        requestedByUserId: input.requestedByUserId,
        requestedByEmail: input.requestedByEmail,
        customerReason: input.customerReason,
        customerNote: input.customerNote,
        requestedAt: input.source === 'customer' ? new Date() : undefined,
        items: input.items?.length
          ? {
              create: input.items,
            }
          : undefined,
      },
      include: { items: true },
    });
  }

  markRefundFailed(refundId: string, reason: string) {
    return prisma.refund.update({
      where: { id: refundId },
      data: { status: 'FAILED', failureReason: reason },
    });
  }

  recordRefundFailure(refundId: string, reason: string) {
    return prisma.refund.update({
      where: { id: refundId },
      data: { failureReason: reason },
    });
  }

  completeRefund(refundId: string, input: { paytrReference?: string | null; restock: boolean }) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'COMPLETED',
          paytrReference: input.paytrReference,
          restock: input.restock,
          completedAt: new Date(),
        },
        include: { items: true, order: { include: { items: true, refunds: { include: { items: true } } } } },
      });

      const order = refund.order;
      const completedRefunds = order.refunds.filter((entry) => entry.status === 'COMPLETED');
      const refundedAmount = completedRefunds.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const nextPaymentStatus = refundedAmount >= Number(order.total) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      if (input.restock) {
        const itemsToRestock = refund.items.length > 0 ? refund.items : order.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
        for (const item of itemsToRestock) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          refundedAmount,
          paymentStatus: nextPaymentStatus,
          lastRefundedAt: new Date(),
        },
        include: orderInclude,
      });
    });
  }

  listUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
