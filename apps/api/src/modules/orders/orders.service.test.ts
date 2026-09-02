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
  customerEmail: 'musteri@example.com',
  refundedAmount: 0,
  shippingName: 'Musteri Test',
  shippingPhone: '05551234567',
  shippingCity: 'Istanbul',
  shippingDistrict: 'Kadikoy',
  shippingAddressLine: 'Moda Caddesi No: 1',
  billingType: 'individual',
  billingName: 'Musteri Test',
  billingPhone: '05551234567',
  billingCity: 'Istanbul',
  billingDistrict: 'Kadikoy',
  billingAddressLine: 'Moda Caddesi No: 1',
  companyName: null,
  taxOffice: null,
  taxNumber: null,
  identityNumberLast4: '1234',
  invoicePdfUrl: null,
  invoiceFileName: null,
  invoiceUploadedAt: null,
  invoiceSentAt: null,
  paymentRef: 'BBTTESTOID',
  notes: null,
  items: [],
  refunds: [],
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

  it('creates an item-level refund request for a paid order', async () => {
    const order = {
      ...paidOrder,
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          productName: 'Test Drone',
          quantity: 2,
          unitPrice: 1000,
          lineTotal: 2000,
        },
      ],
    };
    const updatedOrder = {
      ...order,
      refunds: [
        {
          id: 'refund-1',
          amount: 1000,
          status: 'PENDING',
          source: 'customer',
          requestedByUserId: 'user-1',
          requestedByEmail: 'musteri@example.com',
          customerReason: 'Yanlis urun',
          customerNote: 'Bir adetini iade etmek istiyorum.',
          requestedAt: new Date('2026-08-29T10:10:00.000Z'),
          restock: false,
          paytrReference: null,
          failureReason: null,
          createdAt: new Date('2026-08-29T10:10:00.000Z'),
          completedAt: null,
          items: [
            {
              id: 'refund-item-1',
              orderItemId: 'item-1',
              productId: 'product-1',
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
            },
          ],
        },
      ],
    };
    const repository = {
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn().mockResolvedValue(order),
      createRefundRequest: vi.fn().mockResolvedValue(updatedOrder),
    };

    const service = new OrdersService(repository as any);
    const response = await service.createRefundRequestForUser('user-1', 'order-1', {
      items: [{ orderItemId: 'item-1', quantity: 1 }],
      reason: 'Yanlis urun',
      note: 'Bir adetini iade etmek istiyorum.',
    });

    expect(repository.createRefundRequest).toHaveBeenCalledWith('order-1', expect.objectContaining({
      amount: 1000,
      requestedByUserId: 'user-1',
      items: [expect.objectContaining({ orderItemId: 'item-1', quantity: 1, lineTotal: 1000 })],
    }));
    expect(response.items[0]?.pendingRefundQuantity).toBe(1);
    expect(response.items[0]?.refundableQuantity).toBe(1);
  });

  it('rejects refund requests above the remaining refundable item quantity', async () => {
    const repository = {
      listOrdersForUser: vi.fn(),
      findOrderForUser: vi.fn().mockResolvedValue({
        ...paidOrder,
        items: [
          {
            id: 'item-1',
            productId: 'product-1',
            productName: 'Test Drone',
            quantity: 2,
            unitPrice: 1000,
            lineTotal: 2000,
          },
        ],
        refunds: [
          {
            id: 'refund-1',
            amount: 1000,
            status: 'PENDING',
            items: [{ orderItemId: 'item-1', quantity: 1 }],
          },
        ],
      }),
      createRefundRequest: vi.fn(),
    };

    const service = new OrdersService(repository as any);

    await expect(service.createRefundRequestForUser('user-1', 'order-1', {
      items: [{ orderItemId: 'item-1', quantity: 2 }],
      reason: 'Yanlis urun',
      note: 'Iki adet iade etmek istiyorum.',
    })).rejects.toBeInstanceOf(AppError);
    expect(repository.createRefundRequest).not.toHaveBeenCalled();
  });
});
