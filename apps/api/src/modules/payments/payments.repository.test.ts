import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTx = vi.hoisted(() => ({
  paymentAttempt: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  order: {
    create: vi.fn(),
  },
  cartItem: {
    deleteMany: vi.fn(),
  },
  product: {
    update: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: any) => callback(mockTx)),
  paymentAttempt: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
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
                packageLabel: null,
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

describe('PaymentsRepository.expireStaleAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockTx));
  });

  it('expires every stale pending attempt, guests included, and returns their stock', async () => {
    mockPrisma.paymentAttempt.findMany.mockResolvedValue([{ merchantOid: 'OID-A' }, { merchantOid: 'OID-B' }]);
    mockTx.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    mockTx.paymentAttempt.findUnique.mockResolvedValue({
      ...baseAttempt,
      items: [{ productId: 'product-1', quantity: 2 }],
    });
    const repository = new PaymentsRepository();

    const count = await repository.expireStaleAttempts(new Date('2026-01-01T00:00:00Z'));

    expect(count).toBe(2);
    // The sweep must not be user-scoped: the [status, createdAt] index query
    // covers guest attempts (userId null) as well.
    expect(mockPrisma.paymentAttempt.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', createdAt: { lt: new Date('2026-01-01T00:00:00Z') } },
      select: { merchantOid: true },
    });
    expect(mockTx.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { merchantOid: 'OID-B', status: 'PENDING' } }),
    );
    expect(mockTx.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) }),
    );
    expect(mockTx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: { increment: 2 } } }),
    );
  });
});

describe('PaymentsRepository.markPaidWithoutOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockTx));
  });

  it('flags the attempt with the review timestamp and note, leaving the status intact', async () => {
    mockPrisma.paymentAttempt.update.mockResolvedValue({ ...baseAttempt, status: 'FAILED' });
    const repository = new PaymentsRepository();

    await repository.markPaidWithoutOrder(baseAttempt.merchantOid, 'Inceleme notu');

    expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantOid: baseAttempt.merchantOid },
        data: expect.objectContaining({ paidWithoutOrderAt: expect.any(Date), reviewNote: 'Inceleme notu' }),
      }),
    );
  });
});
