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
      include: { items: true },
    });
  }
}
