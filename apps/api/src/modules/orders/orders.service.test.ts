import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  it('prevents checkout for sales-disabled products', async () => {
    const repository = {
      findCart: vi.fn().mockResolvedValue({
        items: [
          {
            quantity: 1,
            productId: 'product-1',
            product: {
              name: 'DJI Matrice 400',
              isPurchasable: false,
              stock: 5,
              price: 100,
            },
          },
        ],
      }),
      createOrder: vi.fn(),
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn(),
    };

    const service = new OrdersService(repository as any);

    await expect(
      service.createOrder('user-1', {
        shippingName: 'Demo Musteri',
        shippingPhone: '5551112233',
        shippingCity: 'Istanbul',
        shippingDistrict: 'Kadikoy',
        shippingAddressLine: 'Moda Caddesi',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns not found for a missing order detail', async () => {
    const repository = {
      findCart: vi.fn(),
      createOrder: vi.fn(),
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn().mockResolvedValue(null),
    };

    const service = new OrdersService(repository as any);

    await expect(service.getOrderForUser('user-1', 'missing-order')).rejects.toBeInstanceOf(AppError);
  });
});
