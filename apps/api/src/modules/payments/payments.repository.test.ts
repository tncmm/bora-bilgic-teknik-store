import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTx = vi.hoisted(() => ({
  paymentAttempt: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  order: {
    create: vi.fn(),
  },
  cartItem: {
    deleteMany: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: any) => callback(mockTx)),
}));

vi.mock('../../db/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../orders/orders.repository.js', () => ({
  generateOrderNumber: vi.fn(() => 'BBT-ORDER-TEST'),
}));

const { PaymentsRepository } = await import('./payments.repository.js');

const baseAttempt = {
  id: 'attempt-1',
  merchantOid: 'BBTORDERTEST1',
  status: 'PENDING',
  total: 68999,
  currency: 'TL',
  customerEmail: 'musteri@example.com',
  trackingTokenHash: 'tracking-hash',
  trackingTokenEncrypted: 'tracking-encrypted',
  userId: 'user-1',
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
  identityNumberEncrypted: 'encrypted-tckn',
  identityNumberLast4: '8901',
  notes: 'Kapiya birakilabilir',
  items: [
    {
      productId: 'product-1',
      productName: 'DJI Mini 4 Pro',
      quantity: 1,
      unitPrice: 68999,
      lineTotal: 68999,
    },
  ],
};

describe('PaymentsRepository.completeAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockTx));
  });

  it('creates a paid order and completes the attempt in one transaction', async () => {
    mockTx.paymentAttempt.findUnique.mockResolvedValue(baseAttempt);
    mockTx.order.create.mockResolvedValue({ id: 'order-1', orderNumber: 'BBT-ORDER-TEST' });
    const repository = new PaymentsRepository();

    const order = await repository.completeAttempt(baseAttempt.merchantOid);

    expect(order).toEqual({ id: 'order-1', orderNumber: 'BBT-ORDER-TEST' });
    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: 'BBT-ORDER-TEST',
          userId: 'user-1',
          paymentStatus: 'PAID',
          paymentRef: baseAttempt.merchantOid,
          customerEmail: 'musteri@example.com',
          identityNumberEncrypted: 'encrypted-tckn',
          items: {
            create: [
              {
                productId: 'product-1',
                productName: 'DJI Mini 4 Pro',
                quantity: 1,
                unitPrice: 68999,
                lineTotal: 68999,
              },
            ],
          },
        }),
        include: { items: true, refunds: { include: { items: true }, orderBy: { createdAt: 'desc' } } },
      }),
    );
    expect(mockTx.paymentAttempt.update).toHaveBeenCalledWith({
      where: { merchantOid: baseAttempt.merchantOid },
      data: { status: 'COMPLETED' },
    });
    expect(mockTx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cart: { userId: 'user-1' } } });
  });

  it('does not create a duplicate order when the callback is retried after completion', async () => {
    mockTx.paymentAttempt.findUnique.mockResolvedValue({ ...baseAttempt, status: 'COMPLETED' });
    const repository = new PaymentsRepository();

    const order = await repository.completeAttempt(baseAttempt.merchantOid);

    expect(order).toBeNull();
    expect(mockTx.order.create).not.toHaveBeenCalled();
    expect(mockTx.paymentAttempt.update).not.toHaveBeenCalled();
  });
});
