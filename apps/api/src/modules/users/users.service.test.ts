import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  it('rejects adding a non-existent product to favorites', async () => {
    const repository = {
      findPublishedProduct: vi.fn().mockResolvedValue(null),
      ensureWishlist: vi.fn(),
      addFavorite: vi.fn(),
      findWishlist: vi.fn(),
      findProfile: vi.fn(),
      updateTheme: vi.fn(),
    };

    const service = new UsersService(repository as any);

    await expect(
      service.addFavorite('user-1', {
        productId: 'missing-product',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects deleting an address that does not belong to the user', async () => {
    const repository = {
      findAddress: vi.fn().mockResolvedValue(null),
      deleteAddress: vi.fn(),
    };

    const service = new UsersService(repository as any);

    await expect(service.deleteAddress('user-1', 'address-2')).rejects.toBeInstanceOf(AppError);
    expect(repository.deleteAddress).not.toHaveBeenCalled();
  });
});
