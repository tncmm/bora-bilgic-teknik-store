import { OrderStatus } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export class AdminRepository {
  countDashboardMetrics() {
    // Unpaid orders are payment attempts, not sales: they never reach the
    // dashboard totals.
    return Promise.all([
      prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'PAID' } }),
      prisma.order.count({ where: { status: OrderStatus.PENDING, paymentStatus: 'PAID' } }),
      prisma.product.aggregate({ _sum: { stock: true } }),
      prisma.product.count({ where: { stock: { lte: 3 } } }),
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
    return prisma.product.groupBy({
      by: ['brand'],
      _count: { _all: true },
      orderBy: { _count: { brand: 'desc' } },
    });
  }

  renameBrand(from: string, to: string) {
    return prisma.product.updateMany({
      where: { brand: from },
      data: { brand: to },
    });
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
      where: { paymentStatus: 'PAID' },
      include: {
        items: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getOrder(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  updateOrderStatus(id: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }

  listUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
