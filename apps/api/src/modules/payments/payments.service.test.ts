import { beforeEach, describe, expect, it, vi } from 'vitest';

import { newMerchantOid, toKurus } from '../../lib/paytr.js';
import { PaymentsService } from './payments.service.js';

vi.mock('../../lib/paytr.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/paytr.js')>();
  return {
    ...actual,
    isPaytrConfigured: vi.fn(() => true),
    requestIframeToken: vi.fn(async () => 'iframe-token-123'),
    verifyCallbackHash: vi.fn(() => true),
  };
});

vi.mock('../../lib/crypto.js', () => ({
  decryptBillingIdentity: vi.fn((value: string) => value.replace(/^enc:/, '')),
  encryptBillingIdentity: vi.fn((value: string) => `enc:${value}`),
  hashTrackingToken: vi.fn((value: string) => `hash:${value}`),
}));

const { isPaytrConfigured, requestIframeToken, verifyCallbackHash } = await import('../../lib/paytr.js');

const checkoutPayload = {
  shippingName: 'Musteri Test',
  shippingPhone: '05551234567',
  shippingCity: 'Istanbul',
  shippingDistrict: 'Kadikoy',
  shippingAddressLine: 'Moda Caddesi No: 1',
  billingSameAsShipping: true,
  billingType: 'individual',
  identityNumber: '12345678901',
};

const cartWithItem = {
  id: 'cart-1',
  userId: 'user-1',
  items: [
    {
      id: 'item-1',
      productId: 'product-1',
      quantity: 2,
      product: {
        id: 'product-1',
        name: 'DJI Mic 2',
        price: 1499.5,
        stock: 10,
        isPurchasable: true,
      },
    },
  ],
};

const baseAttempt = {
  id: 'attempt-1',
  merchantOid: 'BBTMTE1234ABCDEF',
  status: 'PENDING',
  total: 2999,
  customerEmail: 'musteri@example.com',
  trackingTokenEncrypted: 'enc:test-token',
  shippingName: checkoutPayload.shippingName,
  shippingPhone: checkoutPayload.shippingPhone,
  shippingCity: checkoutPayload.shippingCity,
  shippingDistrict: checkoutPayload.shippingDistrict,
  shippingAddressLine: checkoutPayload.shippingAddressLine,
  user: { email: 'musteri@example.com' },
  userId: 'user-1',
  items: [{ productId: 'product-1', productName: 'DJI Mic 2', quantity: 2, unitPrice: 1499.5, lineTotal: 2999 }],
};

function createRepository() {
  return {
    expireStaleAttempts: vi.fn(async () => 0),
    supersedeOpenAttempts: vi.fn(async () => 0),
    findCart: vi.fn(),
    createAttempt: vi.fn(async () => baseAttempt),
    settleAttempt: vi.fn(async () => 0),
    findAttemptByOid: vi.fn(),
    findAttemptStatus: vi.fn(),
    findOrderByPaymentRef: vi.fn(),
    findProductsForCheckout: vi.fn(),
    completeAttempt: vi.fn(async () => null),
  };
}

describe('PayTR helpers', () => {
  it('converts TL amounts to kurus strings', () => {
    expect(toKurus(1499.5)).toBe('149950');
    expect(toKurus(0.29)).toBe('29');
  });

  it('mints alphanumeric merchant oids', () => {
    expect(newMerchantOid('BBT-ABC-123')).toMatch(/^BBTABC123[0-9A-F]{6}$/);
  });
});

describe('PaymentsService.createCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses to run when PayTR is not configured', async () => {
    vi.mocked(isPaytrConfigured).mockReturnValueOnce(false);
    const repository = createRepository();
    const service = new PaymentsService(repository as never);

    await expect(service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('rejects checkout with an empty cart', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue(null);
    const service = new PaymentsService(repository as never);

    await expect(service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('rejects when a cart item is not purchasable', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue({
      ...cartWithItem,
      items: [{ ...cartWithItem.items[0], product: { ...cartWithItem.items[0].product, isPurchasable: false } }],
    });
    const service = new PaymentsService(repository as never);

    await expect(service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('cleans previous windows, creates the attempt and returns the iframe token', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue(cartWithItem);
    const service = new PaymentsService(repository as never);

    const result = await service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1');

    expect(repository.expireStaleAttempts).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(repository.supersedeOpenAttempts).toHaveBeenCalledWith('user-1');
    expect(repository.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', total: 2999, merchantOid: expect.stringMatching(/^[A-Z0-9]+$/) }),
    );
    expect(requestIframeToken).toHaveBeenCalledWith(
      expect.objectContaining({ merchantOid: result.merchantOid, amountKurus: 299900, email: 'musteri@example.com' }),
    );
    expect(result.iframeToken).toBe('iframe-token-123');
  });

  it('releases stock and fails the attempt when PayTR rejects the token request', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue(cartWithItem);
    vi.mocked(requestIframeToken).mockRejectedValueOnce(new Error('kapali'));
    const service = new PaymentsService(repository as never);

    await expect(service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(repository.settleAttempt).toHaveBeenCalledWith(expect.any(String), {
      status: 'FAILED',
      reason: 'PayTR tokeni uretilemedi.',
    });
  });
});

describe('PaymentsService.handleCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCallbackHash).mockReturnValue(true);
  });

  it('rejects malformed notifications', async () => {
    const service = new PaymentsService(createRepository() as never);
    await expect(service.handleCallback({ merchant_oid: 'X' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects notifications with a bad signature', async () => {
    vi.mocked(verifyCallbackHash).mockReturnValueOnce(false);
    const service = new PaymentsService(createRepository() as never);

    await expect(
      service.handleCallback({ merchant_oid: 'X', status: 'success', total_amount: '299900', hash: 'bad' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects notifications for unknown attempts', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue(null);
    const service = new PaymentsService(repository as never);

    await expect(
      service.handleCallback({ merchant_oid: 'UNKNOWN', status: 'success', total_amount: '299900', hash: 'ok' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('turns a verified success into an order', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue(baseAttempt);
    const service = new PaymentsService(repository as never);

    const result = await service.handleCallback({
      merchant_oid: baseAttempt.merchantOid,
      status: 'success',
      total_amount: '299900',
      hash: 'valid',
    });

    expect(result.outcome).toBe('paid');
    expect(repository.completeAttempt).toHaveBeenCalledWith(baseAttempt.merchantOid);
    expect(repository.settleAttempt).not.toHaveBeenCalled();
  });

  it('refuses success callbacks whose amount differs from the attempt total', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue(baseAttempt);
    const service = new PaymentsService(repository as never);

    await expect(
      service.handleCallback({ merchant_oid: baseAttempt.merchantOid, status: 'success', total_amount: '99999', hash: 'valid' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.completeAttempt).not.toHaveBeenCalled();
    expect(repository.settleAttempt).not.toHaveBeenCalled();
  });

  it('settles the attempt failed (with stock refund) on failure callbacks', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue(baseAttempt);
    const service = new PaymentsService(repository as never);

    const result = await service.handleCallback({
      merchant_oid: baseAttempt.merchantOid,
      status: 'failed',
      total_amount: '299900',
      hash: 'valid',
    });

    expect(result.outcome).toBe('failed');
    expect(repository.settleAttempt).toHaveBeenCalledWith(
      baseAttempt.merchantOid,
      expect.objectContaining({ status: 'FAILED' }),
    );
    expect(repository.completeAttempt).not.toHaveBeenCalled();
  });
});
