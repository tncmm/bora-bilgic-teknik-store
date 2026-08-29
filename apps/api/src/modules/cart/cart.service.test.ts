import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { CartService } from './cart.service.js';

describe('CartService', () => {
  it('rejects non-purchasable products', async () => {
    const repository = {
      ensureCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
      findProduct: vi.fn().mockResolvedValue({
        id: 'product-1',
        isPublished: true,
        isPurchasable: false,
        stock: 10,
      }),
      addOrUpdateItem: vi.fn(),
      findCart: vi.fn(),
    };

    const service = new CartService(repository as any);

    await expect(
      service.addItem('user-1', {
        productId: 'product-1',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects with 404 when updating an item owned by another user', async () => {
    const repository = {
      ensureCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
      updateItem: vi.fn().mockResolvedValue({ count: 0 }),
      findCart: vi.fn(),
    };

    const service = new CartService(repository as any);

    await expect(service.updateItem('user-1', 'item-1', { quantity: 2 })).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 404,
      message: 'Sepet kalemi bulunamadi.',
    });
    expect(repository.findCart).not.toHaveBeenCalled();
  });

  it('rejects with 404 when removing an item owned by another user', async () => {
    const repository = {
      ensureCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
      removeItem: vi.fn().mockResolvedValue({ count: 0 }),
      findCart: vi.fn(),
    };

    const service = new CartService(repository as any);

    await expect(service.removeItem('user-1', 'item-1')).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 404,
      message: 'Sepet kalemi bulunamadi.',
    });
    expect(repository.findCart).not.toHaveBeenCalled();
  });

  it('passes the userId to repository update/remove calls', async () => {
    const repository = {
      ensureCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
      updateItem: vi.fn().mockResolvedValue({ count: 1 }),
      removeItem: vi.fn().mockResolvedValue({ count: 1 }),
      findCart: vi.fn().mockResolvedValue({ id: 'cart-1', items: [] }),
    };

    const service = new CartService(repository as any);

    await service.updateItem('user-1', 'item-1', { quantity: 3 });
    await service.removeItem('user-1', 'item-1');

    expect(repository.updateItem).toHaveBeenCalledWith('user-1', 'item-1', 3);
    expect(repository.removeItem).toHaveBeenCalledWith('user-1', 'item-1');
  });
});
