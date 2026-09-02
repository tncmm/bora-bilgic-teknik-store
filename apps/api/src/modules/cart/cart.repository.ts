import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

/** Tek bir sepet satirinda (urun + paket kombinasyonu) tutulabilecek en yuksek adet. */
export const MAX_QUANTITY_PER_CART_LINE = 10;

/**
 * 'created' / 'updated': mutation applied.
 * 'cap-exceeded' / 'stock-exceeded': guard tripped, nothing was written.
 * 'removed': the line vanished concurrently (or belongs to another user).
 */
export type CartItemMutationStatus = 'created' | 'updated' | 'cap-exceeded' | 'stock-exceeded' | 'removed';

export interface AddOrUpdateItemInput {
  cartId: string;
  productId: string;
  quantity: number;
  /** Bos string taban urun satiridir (paket secilmemis). */
  packageOptionId: string;
  packageLabel: string | null;
}

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

  /**
   * Adds or increments a cart line in one transaction. The (cart, product,
   * package) triple is unique, so the same product with different packages
   * lives on separate lines. Guards run inside the transaction: the increment
   * only lands when the per-line cap and the product stock still allow it,
   * mirroring the conditional updateMany pattern of the payments repository.
   */
  async addOrUpdateItem(input: AddOrUpdateItemInput): Promise<CartItemMutationStatus> {
    return prisma.$transaction(async (tx) => {
      const compositeKey = {
        cartId: input.cartId,
        productId: input.productId,
        packageOptionId: input.packageOptionId,
      };
      const existing = await tx.cartItem.findUnique({ where: { cartId_productId_packageOptionId: compositeKey } });

      if (existing) {
        return this.guardedIncrement(tx, existing.id, input.quantity, 0);
      }

      try {
        await tx.cartItem.create({
          data: {
            cartId: input.cartId,
            productId: input.productId,
            quantity: input.quantity,
            packageOptionId: input.packageOptionId,
            packageLabel: input.packageLabel,
          },
        });
        return 'created';
      } catch (error) {
        // A parallel request created the same line first: fall back to the
        // guarded increment instead of surfacing a unique-constraint error.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const fresh = await tx.cartItem.findUnique({ where: { cartId_productId_packageOptionId: compositeKey } });
          if (fresh) {
            return this.guardedIncrement(tx, fresh.id, input.quantity, 0);
          }
        }
        throw error;
      }
    });
  }

  /**
   * Optimistic guarded increment: the decision is based on a fresh read, and
   * the conditional UPDATE re-verifies the quantity it was based on, so two
   * parallel requests can never push a line past the cap or the stock.
   */
  private async guardedIncrement(
    tx: Prisma.TransactionClient,
    itemId: string,
    quantity: number,
    attempt: number,
  ): Promise<CartItemMutationStatus> {
    const line = await tx.cartItem.findUnique({
      where: { id: itemId },
      include: { product: { select: { stock: true } } },
    });

    if (!line) {
      return 'removed';
    }

    const total = line.quantity + quantity;
    if (total > MAX_QUANTITY_PER_CART_LINE) {
      return 'cap-exceeded';
    }
    if (total > line.product.stock) {
      return 'stock-exceeded';
    }

    const result = await tx.cartItem.updateMany({
      where: { id: itemId, quantity: line.quantity },
      data: { quantity: total },
    });

    if (result.count === 1) {
      return 'updated';
    }

    // Lost the race against a concurrent mutation of the same line: re-read
    // and decide again, instead of writing a value computed from stale state.
    if (attempt < 2) {
      return this.guardedIncrement(tx, itemId, quantity, attempt + 1);
    }

    return 'cap-exceeded';
  }

  /**
   * Absolute quantity set for one line (the line id targets the exact row).
   * The stock bound rides the UPDATE's WHERE clause, so an over-stock write
   * is a no-op that the service maps to a proper Turkish error.
   */
  async updateItem(userId: string, itemId: string, quantity: number): Promise<CartItemMutationStatus> {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      select: { id: true },
    });

    if (!item) {
      return 'removed';
    }

    const result = await prisma.cartItem.updateMany({
      where: { id: itemId, product: { is: { stock: { gte: quantity } } } },
      data: { quantity },
    });

    return result.count === 1 ? 'updated' : 'stock-exceeded';
  }

  removeItem(userId: string, itemId: string) {
    return prisma.cartItem.deleteMany({
      where: { id: itemId, cart: { userId } },
    });
  }
}
