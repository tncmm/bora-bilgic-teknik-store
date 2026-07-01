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
});
