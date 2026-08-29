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

  listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findAddress(userId: string, addressId: string) {
    return prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    });
  }

  createAddress(
    userId: string,
    data: {
      title: string;
      line1: string;
      city: string;
      district: string;
      postalCode: string;
      country: string;
      phone: string;
    },
  ) {
    return prisma.address.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  updateAddress(
    addressId: string,
    data: Partial<{
      title: string;
      line1: string;
      city: string;
      district: string;
      postalCode: string;
      country: string;
      phone: string;
    }>,
  ) {
    return prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  deleteAddress(addressId: string) {
    return prisma.address.delete({
      where: { id: addressId },
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

  findPublishedProduct(productId: string) {
    return prisma.product.findFirst({
      where: {
        id: productId,
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
