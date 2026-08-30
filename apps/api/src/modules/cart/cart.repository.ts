import { prisma } from '../../db/prisma.js';

export class CartRepository {
  ensureCart(userId: string) {
    return prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: {
        items: {
          // Stable insertion order: without this the DB may reshuffle rows
          // after every quantity update and the cart UI reorders on each tap.
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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

  findCart(userId: string) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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

  findProduct(productId: string) {
    return prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        images: true,
        specs: true,
      },
    });
  }

  async addOrUpdateItem(cartId: string, productId: string, quantity: number) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
      return;
    }

    await prisma.cartItem.create({
      data: { cartId, productId, quantity },
    });
  }

  updateItem(userId: string, itemId: string, quantity: number) {
    return prisma.cartItem.updateMany({
      where: { id: itemId, cart: { userId } },
      data: { quantity },
    });
  }

  removeItem(userId: string, itemId: string) {
    return prisma.cartItem.deleteMany({
      where: { id: itemId, cart: { userId } },
    });
  }
}
