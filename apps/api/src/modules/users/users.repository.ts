import { prisma } from '../../db/prisma.js';

export class UsersRepository {
  findProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        themePreference: true,
      },
    });
  }

  updateTheme(userId: string, mode: string) {
    return prisma.themePreference.upsert({
      where: { userId },
      update: { mode },
      create: { userId, mode },
    });
  }

  ensureWishlist(userId: string) {
    return prisma.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
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
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  findWishlist(userId: string) {
    return prisma.wishlist.findUnique({
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
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  findPublishedDjiProduct(productId: string) {
    return prisma.product.findFirst({
      where: {
        id: productId,
        brand: 'DJI',
        isPublished: true,
      },
      include: {
        category: true,
        images: true,
        specs: true,
      },
    });
  }

  async addFavorite(wishlistId: string, productId: string) {
    const existing = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId, productId } },
    });

    if (existing) {
      return existing;
    }

    return prisma.wishlistItem.create({
      data: {
        wishlistId,
        productId,
      },
    });
  }

  async removeFavorite(wishlistId: string, productId: string) {
    const existing = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId, productId } },
    });

    if (!existing) {
      return null;
    }

    return prisma.wishlistItem.delete({
      where: { id: existing.id },
    });
  }
}
