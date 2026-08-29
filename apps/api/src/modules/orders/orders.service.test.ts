import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { generateOrderNumber } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

const checkoutPayload = {
  shippingName: 'Demo Musteri',
  shippingPhone: '5551112233',
  shippingCity: 'Istanbul',
  shippingDistrict: 'Kadikoy',
  shippingAddressLine: 'Moda Caddesi',
};

const cartWithItem = {
  items: [
    {
      quantity: 2,
      productId: 'product-1',
      product: {
        name: 'DJI Mic 2',
        isPurchasable: true,
        stock: 10,
        price: 14999,
      },
    },
  ],
};

function buildOrder(data: any, orderNumber: string) {
  return {
    id: 'order-1',
    orderNumber,
    status: 'PENDING',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    total: data.total,
    shippingName: data.shippingName,
    shippingPhone: data.shippingPhone,
    shippingCity: data.shippingCity,
    shippingDistrict: data.shippingDistrict,
    shippingAddressLine: data.shippingAddressLine,
    notes: data.notes ?? null,
    items: data.items.map((item: any, index: number) => ({
      id: `order-item-${index}`,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}

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

  it('rejects with 409 when the atomic in-transaction stock decrement fails', async () => {
    // The pre-transaction stock check passes (cart snapshot says 10), but the
    // authoritative guarded decrement inside the transaction finds no stock.
    const stockLevels: Record<string, number> = { 'product-1': 0 };
    const repository = {
      findCart: vi.fn().mockResolvedValue(cartWithItem),
      createOrder: vi.fn().mockImplementation(async (data: any) => {
        // Mirrors OrdersRepository.createOrder's in-transaction atomic decrement.
        const tx = {
          product: {
            updateMany: ({ where, data: update }: any) => {
              const available = stockLevels[where.id as string] ?? 0;
              if (available >= where.stock.gte) {
                stockLevels[where.id as string] = available - update.stock.decrement;
                return Promise.resolve({ count: 1 });
              }
              return Promise.resolve({ count: 0 });
            },
          },
        };

        for (const item of data.items) {
          const result = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            throw new AppError(`Yetersiz stok: ${item.productName}`, 409);
          }
        }

        return buildOrder(data, generateOrderNumber());
      }),
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn(),
    };

    const service = new OrdersService(repository as any);

    await expect(service.createOrder('user-1', checkoutPayload)).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 409,
      message: 'Yetersiz stok: DJI Mic 2',
    });
  });

  it('assigns a collision-proof BBT- order number', async () => {
    const repository = {
      findCart: vi.fn().mockResolvedValue(cartWithItem),
      createOrder: vi
        .fn()
        .mockImplementation(async (data: any) => buildOrder(data, generateOrderNumber())),
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn(),
    };

    const service = new OrdersService(repository as any);

    const order = await service.createOrder('user-1', checkoutPayload);

    expect(order.orderNumber).toMatch(/^BBT-[0-9A-Z]+$/);
    expect(order.orderNumber.length).toBeGreaterThanOrEqual(12);
  });
});
