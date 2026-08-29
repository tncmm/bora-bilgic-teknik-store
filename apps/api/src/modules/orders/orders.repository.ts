import { prisma } from '../../db/prisma.js';

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
    const orderNumber = `BBT-${Date.now()}`;

    return prisma.$transaction(async (tx) => {
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

      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

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
