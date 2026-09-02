import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CartRepository, MAX_QUANTITY_PER_CART_LINE } from './cart.repository.js';

const tx = {
  cartItem: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('../../db/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    cartItem: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const { prisma } = await import('../../db/prisma.js');

const baseInput = {
  cartId: 'cart-1',
  productId: 'product-1',
  quantity: 2,
  packageOptionId: 'combo',
  packageLabel: 'Fly More Combo',
};

describe('CartRepository.addOrUpdateItem', () => {
  let repository: CartRepository;

  beforeEach(() => {
    repository = new CartRepository();
    vi.clearAllMocks();
  });

  it('creates a new line carrying the package fields', async () => {
    tx.cartItem.findUnique.mockResolvedValue(null);
    tx.cartItem.create.mockResolvedValue({ id: 'item-1' });

    const status = await repository.addOrUpdateItem(baseInput);

    expect(status).toBe('created');
    expect(tx.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 2,
        packageOptionId: 'combo',
        packageLabel: 'Fly More Combo',
      },
    });
    expect(tx.cartItem.updateMany).not.toHaveBeenCalled();
  });

  it('increments an existing line through a conditional update', async () => {
    tx.cartItem.findUnique
      .mockResolvedValueOnce({ id: 'item-1', quantity: 3 }) // composite lookup
      .mockResolvedValueOnce({ id: 'item-1', quantity: 3, product: { stock: 10 } }); // guarded read
    tx.cartItem.updateMany.mockResolvedValue({ count: 1 });

    const status = await repository.addOrUpdateItem(baseInput);

    expect(status).toBe('updated');
    expect(tx.cartItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', quantity: 3 },
      data: { quantity: 5 },
    });
  });

  it('reports a cap violation without writing when the line is already at the limit', async () => {
    expect(MAX_QUANTITY_PER_CART_LINE).toBe(10);
    tx.cartItem.findUnique
      .mockResolvedValueOnce({ id: 'item-1', quantity: 9 })
      .mockResolvedValueOnce({ id: 'item-1', quantity: 9, product: { stock: 100 } });

    const status = await repository.addOrUpdateItem({ ...baseInput, quantity: 2 });

    expect(status).toBe('cap-exceeded');
    expect(tx.cartItem.updateMany).not.toHaveBeenCalled();
  });

  it('reports a stock violation without writing when the total exceeds stock', async () => {
    tx.cartItem.findUnique
      .mockResolvedValueOnce({ id: 'item-1', quantity: 2 })
      .mockResolvedValueOnce({ id: 'item-1', quantity: 2, product: { stock: 5 } });

    const status = await repository.addOrUpdateItem({ ...baseInput, quantity: 4 });

    expect(status).toBe('stock-exceeded');
    expect(tx.cartItem.updateMany).not.toHaveBeenCalled();
  });

  it('re-reads and retries when the conditional update loses a race', async () => {
    tx.cartItem.findUnique
      .mockResolvedValueOnce({ id: 'item-1', quantity: 3 })
      .mockResolvedValueOnce({ id: 'item-1', quantity: 3, product: { stock: 10 } })
      .mockResolvedValueOnce({ id: 'item-1', quantity: 4, product: { stock: 10 } }); // re-read after race
    tx.cartItem.updateMany
      .mockResolvedValueOnce({ count: 0 }) // lost the optimistic race
      .mockResolvedValueOnce({ count: 1 }); // retry lands

    const status = await repository.addOrUpdateItem(baseInput);

    expect(status).toBe('updated');
    expect(tx.cartItem.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'item-1', quantity: 4 },
      data: { quantity: 6 },
    });
  });

  it('falls back to the guarded increment when a parallel create hits the unique key', async () => {
    tx.cartItem.findUnique
      .mockResolvedValueOnce(null) // composite lookup: nothing yet
      .mockResolvedValueOnce({ id: 'item-1', quantity: 1 }) // re-read after P2002
      .mockResolvedValueOnce({ id: 'item-1', quantity: 1, product: { stock: 10 } });
    tx.cartItem.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    tx.cartItem.updateMany.mockResolvedValue({ count: 1 });

    const status = await repository.addOrUpdateItem(baseInput);

    expect(status).toBe('updated');
    expect(tx.cartItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', quantity: 1 },
      data: { quantity: 3 },
    });
  });
});

describe('CartRepository.updateItem', () => {
  let repository: CartRepository;

  beforeEach(() => {
    repository = new CartRepository();
    vi.clearAllMocks();
    vi.mocked(prisma.cartItem.findFirst).mockResolvedValue({ id: 'item-1' } as never);
    vi.mocked(prisma.cartItem.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it('reports a removed line when the item belongs to another user', async () => {
    vi.mocked(prisma.cartItem.findFirst).mockResolvedValue(null);

    const status = await repository.updateItem('user-1', 'item-1', 3);

    expect(status).toBe('removed');
    expect(prisma.cartItem.updateMany).not.toHaveBeenCalled();
  });

  it('rides the stock bound in the update condition', async () => {
    const status = await repository.updateItem('user-1', 'item-1', 3);

    expect(status).toBe('updated');
    expect(prisma.cartItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', product: { is: { stock: { gte: 3 } } } },
      data: { quantity: 3 },
    });
  });

  it('reports a stock violation when the conditional update is a no-op', async () => {
    vi.mocked(prisma.cartItem.updateMany).mockResolvedValue({ count: 0 } as never);

    const status = await repository.updateItem('user-1', 'item-1', 3);

    expect(status).toBe('stock-exceeded');
  });
});
