import { OrderStatus } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export class AdminRepository {
  countDashboardMetrics() {
    return Promise.all([
      prisma.order.aggregate({ _sum: { total: true } }),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.product.aggregate({ _sum: { stock: true }, where: { brand: 'DJI' } }),
      prisma.product.count({ where: { brand: 'DJI', stock: { lte: 3 } } }),
    ]);
  }

  listProducts() {
    return prisma.product.findMany({
      where: { brand: 'DJI' },
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
      where: {
        products: {
          some: {
            brand: 'DJI',
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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
    return prisma.order.findMany({
      include: {
        items: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
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
