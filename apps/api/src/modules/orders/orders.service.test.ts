import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { OrdersService } from './orders.service.js';

const paidOrder = {
  id: 'order-1',
  orderNumber: 'BBT-TEST',
  status: 'PENDING',
  paymentStatus: 'PAID',
  createdAt: new Date('2026-08-29T10:00:00.000Z'),
  paidAt: new Date('2026-08-29T10:01:00.000Z'),
  total: 2999,
  shippingName: 'Musteri Test',
  shippingPhone: '05551234567',
  shippingCity: 'Istanbul',
  shippingDistrict: 'Kadikoy',
  shippingAddressLine: 'Moda Caddesi No: 1',
  notes: null,
  items: [],
};

describe('OrdersService', () => {
  it('lists serialized orders for the user', async () => {
    const repository = {
      listOrdersForUser: vi.fn().mockResolvedValue([paidOrder]),
      findOrderForUser: vi.fn(),
    };

    const service = new OrdersService(repository as any);
    const orders = await service.listOrdersForUser('user-1');

    expect(repository.listOrdersForUser).toHaveBeenCalledWith('user-1');
    expect(orders).toHaveLength(1);
    expect(orders[0]?.orderNumber).toBe('BBT-TEST');
    expect(orders[0]?.paymentStatus).toBe('paid');
  });

  it('returns not found for a missing order detail', async () => {
    const repository = {
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn().mockResolvedValue(null),
    };

    const service = new OrdersService(repository as any);

    await expect(service.getOrderForUser('user-1', 'missing-order')).rejects.toBeInstanceOf(AppError);
  });
});
