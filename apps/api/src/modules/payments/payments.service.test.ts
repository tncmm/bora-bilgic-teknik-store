import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isRetryablePaytrRefundError,
  newMerchantOid,
  PaytrRefundError,
  requestRefund,
  toKurus,
} from '../../lib/paytr.js';
import { PaymentsService } from './payments.service.js';

vi.mock('../../lib/paytr.js', async (importOriginal) => {
  // Refund and timeout tests exercise the real functions, which read the
  // PayTR config from the environment — guarantee it before the module loads.
  process.env.PAYTR_MERCHANT_ID ??= '123456';
  process.env.PAYTR_MERCHANT_KEY ??= 'test-merchant-key';
  process.env.PAYTR_MERCHANT_SALT ??= 'test-merchant-salt';

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

const { decryptBillingIdentity } = await import('../../lib/crypto.js');
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
  trackingTokenHash: 'hash:test-token',
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
    markPaidWithoutOrder: vi.fn(async () => baseAttempt),
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

describe('PayTR refund and timeout handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('completes a refund when PayTR answers success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'success', reference_no: 'REF-1' }), { status: 200 })),
    );

    const result = await requestRefund({ merchantOid: 'OID', amount: 25.5 });

    expect(result).toEqual({ referenceNo: 'REF-1' });
  });

  it('treats errNo 000 as a successful refund even when the status field disagrees', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'failed', err_no: '000' }), { status: 200 })),
    );

    const result = await requestRefund({ merchantOid: 'OID', amount: 25.5 });

    expect(result).toEqual({ referenceNo: null });
  });

  it('throws a refund error carrying the PayTR error code on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ status: 'failed', err_no: '999', err_msg: 'Tutar gecersiz' }), { status: 200 }),
      ),
    );

    await expect(requestRefund({ merchantOid: 'OID', amount: 25.5 })).rejects.toMatchObject({ errNo: '999' });
  });

  it('marks real PayTR error codes retryable but never a success code', () => {
    expect(isRetryablePaytrRefundError(new PaytrRefundError('Hata', '999'))).toBe(true);
    expect(isRetryablePaytrRefundError(new PaytrRefundError('Hata', '000'))).toBe(false);
    expect(isRetryablePaytrRefundError(new PaytrRefundError('Hata'))).toBe(false);
    expect(isRetryablePaytrRefundError(new Error('ag hatasi'))).toBe(false);
  });

  it('cuts off the token request with a clear timeout error', async () => {
    const actual = await vi.importActual<typeof import('../../lib/paytr.js')>('../../lib/paytr.js');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('aborted', 'TimeoutError');
      }),
    );

    await expect(
      actual.requestIframeToken({
        merchantOid: 'OID',
        email: 'musteri@example.com',
        amountKurus: 100,
        userIp: '85.34.78.112',
        userName: 'Musteri Test',
        userAddress: 'Adres',
        userPhone: '05551234567',
        basket: [{ name: 'Urun', unitPrice: 1, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 502, message: 'PayTR token servisi zaman asimina ugradi.' });
  });

  it('cuts off the refund request with a clear timeout error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError');
      }),
    );

    await expect(requestRefund({ merchantOid: 'OID', amount: 1 })).rejects.toMatchObject({
      statusCode: 502,
      message: 'PayTR iade servisi zaman asimina ugradi.',
    });
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

    expect(repository.expireStaleAttempts).toHaveBeenCalledWith(expect.any(Date));
    expect(repository.supersedeOpenAttempts).toHaveBeenCalledWith('user-1');
    expect(repository.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', total: 2999, merchantOid: expect.stringMatching(/^[A-Z0-9]+$/) }),
    );
    expect(requestIframeToken).toHaveBeenCalledWith(
      expect.objectContaining({ merchantOid: result.merchantOid, amountKurus: 299900, email: 'musteri@example.com' }),
    );
    expect(result.iframeToken).toBe('iframe-token-123');
    // The raw tracking token doubles as the status endpoint ownership proof.
    expect(typeof result.trackingToken).toBe('string');
    expect(repository.createAttempt).toHaveBeenCalledWith(expect.objectContaining({ trackingTokenHash: `hash:${result.trackingToken}` }));
  });

  it('also expires stale attempts when a guest starts a checkout', async () => {
    const repository = createRepository();
    repository.findProductsForCheckout.mockResolvedValue([
      { id: 'product-1', name: 'DJI Mic 2', price: 1499.5, discountPercent: 0, isPurchasable: true },
    ]);
    const service = new PaymentsService(repository as never);

    await service.createCheckout(
      undefined,
      undefined,
      { ...checkoutPayload, email: 'musteri@example.com', items: [{ productId: 'product-1', quantity: 2 }] },
      '127.0.0.1',
    );

    expect(repository.expireStaleAttempts).toHaveBeenCalledWith(expect.any(Date));
    expect(repository.supersedeOpenAttempts).not.toHaveBeenCalled();
    expect(repository.createAttempt).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined, total: 2999 }));
  });

  it('merges duplicate product lines and keeps the merged quantity within the cap', async () => {
    const repository = createRepository();
    repository.findProductsForCheckout.mockResolvedValue([
      { id: 'product-1', name: 'DJI Mic 2', price: 1499.5, discountPercent: 0, isPurchasable: true },
    ]);
    const service = new PaymentsService(repository as never);

    await service.createCheckout(
      undefined,
      undefined,
      {
        ...checkoutPayload,
        email: 'musteri@example.com',
        items: [
          { productId: 'product-1', quantity: 6 },
          { productId: 'product-1', quantity: 4 },
        ],
      },
      '127.0.0.1',
    );

    expect(repository.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ productId: 'product-1', quantity: 10 })] }),
    );
  });

  it('rejects guest carts whose merged quantity exceeds the per-product cap', async () => {
    const repository = createRepository();
    const service = new PaymentsService(repository as never);

    await expect(
      service.createCheckout(
        undefined,
        undefined,
        {
          ...checkoutPayload,
          email: 'musteri@example.com',
          items: [
            { productId: 'product-1', quantity: 6 },
            { productId: 'product-1', quantity: 6 },
          ],
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow('Ayni urunden en fazla 10 adet satin alabilirsiniz.');
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('rejects guest carts with more than 20 line items', async () => {
    const repository = createRepository();
    const service = new PaymentsService(repository as never);

    await expect(
      service.createCheckout(
        undefined,
        undefined,
        {
          ...checkoutPayload,
          email: 'musteri@example.com',
          items: Array.from({ length: 21 }, () => ({ productId: 'product-1', quantity: 1 })),
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow('en fazla 20 kalem');
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('uses the checkout email when it is provided for an authenticated payment', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue(cartWithItem);
    const service = new PaymentsService(repository as never);

    await service.createCheckout('user-1', 'hesap@example.com', { ...checkoutPayload, email: 'siparis@example.com' }, '127.0.0.1');

    expect(repository.createAttempt).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: 'siparis@example.com' }));
    expect(requestIframeToken).toHaveBeenCalledWith(expect.objectContaining({ email: 'siparis@example.com' }));
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

describe('PaymentsService.createCheckout (package options)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createAttemptPayloadOf = (repository: unknown) =>
    (repository as any).createAttempt.mock.calls[0][0] as {
      items: Array<{ productId: string; productName: string; packageLabel: string | null; quantity: number; unitPrice: number; lineTotal: number }>;
      total: number;
    };

  const productWithPackages = {
    id: 'product-1',
    name: 'DJI Mic 2',
    price: 1499.5,
    discountPercent: 10,
    stock: 20,
    isPurchasable: true,
    packageOptions: [
      { id: 'standard', name: 'Standart Paket', price: 1499.5, isDefault: true },
      { id: 'combo', name: 'Fly More Combo', price: 1999.5, isDefault: false },
    ],
  };

  it('prices a cart line from its package option and snapshots the label', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 2,
          packageOptionId: 'combo',
          packageLabel: 'Fly More Combo',
          product: productWithPackages,
        },
      ],
    });
    const service = new PaymentsService(repository as never);

    await service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1');

    // Paket fiyati taban fiyatin yerine gecer, indirim ayni oranda uygulanir.
    const attemptPayload = createAttemptPayloadOf(repository);
    expect(attemptPayload.items[0]).toMatchObject({ packageLabel: 'Fly More Combo' });
    expect(attemptPayload.items[0].unitPrice).toBeCloseTo(1799.55, 2);
    expect(attemptPayload.items[0].lineTotal).toBeCloseTo(3599.1, 2);
    expect(attemptPayload.total).toBeCloseTo(3599.1, 2);
  });

  it('keeps charging the base price for cart lines without a package', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 1,
          packageOptionId: '',
          packageLabel: null,
          product: productWithPackages,
        },
      ],
    });
    const service = new PaymentsService(repository as never);

    await service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1');

    const attemptPayload = createAttemptPayloadOf(repository);
    expect(attemptPayload.items[0].unitPrice).toBeCloseTo(1349.55, 2);
    expect(attemptPayload.items[0].packageLabel).toBeNull();
  });

  it('rejects cart lines whose package no longer exists on the product', async () => {
    const repository = createRepository();
    repository.findCart.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 1,
          packageOptionId: 'kaldirilmis-paket',
          packageLabel: 'Eski Paket',
          product: productWithPackages,
        },
      ],
    });
    const service = new PaymentsService(repository as never);

    await expect(
      service.createCheckout('user-1', 'musteri@example.com', checkoutPayload, '127.0.0.1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Sepetteki bir urunun paket secenekleri guncellendi. Lutfen sepetinizi yenileyin.',
    });
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('prices guest package lines from the payload package', async () => {
    const repository = createRepository();
    repository.findProductsForCheckout.mockResolvedValue([productWithPackages]);
    const service = new PaymentsService(repository as never);

    await service.createCheckout(
      undefined,
      undefined,
      {
        ...checkoutPayload,
        email: 'musteri@example.com',
        items: [{ productId: 'product-1', quantity: 1, packageOptionId: 'combo' }],
      },
      '127.0.0.1',
    );

    const attemptPayload = createAttemptPayloadOf(repository);
    expect(attemptPayload.items[0]).toMatchObject({ packageLabel: 'Fly More Combo' });
    expect(attemptPayload.items[0].unitPrice).toBeCloseTo(1799.55, 2);
  });

  it('rejects guest payloads carrying an unknown package id', async () => {
    const repository = createRepository();
    repository.findProductsForCheckout.mockResolvedValue([productWithPackages]);
    const service = new PaymentsService(repository as never);

    await expect(
      service.createCheckout(
        undefined,
        undefined,
        {
          ...checkoutPayload,
          email: 'musteri@example.com',
          items: [{ productId: 'product-1', quantity: 1, packageOptionId: 'olmayan-paket' }],
        },
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Gecersiz paket secimi.' });
    expect(repository.createAttempt).not.toHaveBeenCalled();
  });

  it('keeps different packages of one product on separate attempt lines', async () => {
    const repository = createRepository();
    repository.findProductsForCheckout.mockResolvedValue([productWithPackages]);
    const service = new PaymentsService(repository as never);

    await service.createCheckout(
      undefined,
      undefined,
      {
        ...checkoutPayload,
        email: 'musteri@example.com',
        items: [
          { productId: 'product-1', quantity: 6 },
          { productId: 'product-1', quantity: 6, packageOptionId: 'combo' },
        ],
      },
      '127.0.0.1',
    );

    const attemptPayload = createAttemptPayloadOf(repository);
    expect(attemptPayload.items).toHaveLength(2);
    // Taban urun satiri paketsiz kalir, combo satiri kendi etiketini tasir.
    expect(attemptPayload.items[0]).toMatchObject({ packageLabel: null, quantity: 6 });
    expect(attemptPayload.items[1]).toMatchObject({ packageLabel: 'Fly More Combo', quantity: 6 });
  });

  it('merges identical product+package lines before the cap check', async () => {
    const repository = createRepository();
    repository.findProductsForCheckout.mockResolvedValue([productWithPackages]);
    const service = new PaymentsService(repository as never);

    await service.createCheckout(
      undefined,
      undefined,
      {
        ...checkoutPayload,
        email: 'musteri@example.com',
        items: [
          { productId: 'product-1', quantity: 4, packageOptionId: 'combo' },
          { productId: 'product-1', quantity: 6, packageOptionId: 'combo' },
        ],
      },
      '127.0.0.1',
    );

    const attemptPayload = createAttemptPayloadOf(repository);
    expect(attemptPayload.items).toHaveLength(1);
    expect(attemptPayload.items[0].quantity).toBe(10);
  });
});

describe('PaymentsService.sweepStaleAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expires stale attempts for every user and guest through the repository', async () => {
    const repository = createRepository();
    repository.expireStaleAttempts.mockResolvedValue(3);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const service = new PaymentsService(repository as never);

    const count = await service.sweepStaleAttempts();

    expect(count).toBe(3);
    expect(repository.expireStaleAttempts).toHaveBeenCalledWith(expect.any(Date));
    consoleLog.mockRestore();
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

  it('flags a paid callback for an already closed attempt without creating an order', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue({ ...baseAttempt, status: 'FAILED' });
    repository.completeAttempt.mockResolvedValueOnce(null);
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
    expect(repository.markPaidWithoutOrder).toHaveBeenCalledWith(
      baseAttempt.merchantOid,
      expect.stringContaining('Siparis olusmadi'),
    );
  });

  it('does not flag an already completed attempt on a repeated success callback', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue({ ...baseAttempt, status: 'COMPLETED' });
    repository.completeAttempt.mockResolvedValueOnce(null);
    const service = new PaymentsService(repository as never);

    const result = await service.handleCallback({
      merchant_oid: baseAttempt.merchantOid,
      status: 'success',
      total_amount: '299900',
      hash: 'valid',
    });

    expect(result.outcome).toBe('paid');
    expect(repository.markPaidWithoutOrder).not.toHaveBeenCalled();
  });

  it('keeps rejecting success callbacks whose attempt vanished before completion', async () => {
    const repository = createRepository();
    repository.findAttemptByOid.mockResolvedValue(baseAttempt);
    repository.completeAttempt.mockResolvedValueOnce(null);
    repository.findAttemptByOid.mockResolvedValueOnce(null);
    const service = new PaymentsService(repository as never);

    await expect(
      service.handleCallback({ merchant_oid: baseAttempt.merchantOid, status: 'success', total_amount: '299900', hash: 'valid' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.markPaidWithoutOrder).not.toHaveBeenCalled();
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

describe('PaymentsService.getStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers with the stored shape when the raw tracking token matches', async () => {
    const repository = createRepository();
    repository.findAttemptStatus.mockResolvedValue({ ...baseAttempt, status: 'COMPLETED' });
    repository.findOrderByPaymentRef.mockResolvedValue({ id: 'order-1' });
    const service = new PaymentsService(repository as never);

    const result = await service.getStatus(baseAttempt.merchantOid, 'test-token');

    expect(result).toEqual({
      merchantOid: baseAttempt.merchantOid,
      status: 'completed',
      orderId: 'order-1',
      trackingUrl: '/siparis-takip/test-token',
    });
  });

  it('does not fail the payment status response when tracking token decrypt fails', async () => {
    const repository = createRepository();
    repository.findAttemptStatus.mockResolvedValue({ ...baseAttempt, status: 'COMPLETED' });
    repository.findOrderByPaymentRef.mockResolvedValue({ id: 'order-1' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(decryptBillingIdentity).mockImplementationOnce(() => {
      throw new Error('bad key');
    });
    const service = new PaymentsService(repository as never);

    const result = await service.getStatus(baseAttempt.merchantOid, 'test-token');

    expect(result).toEqual({
      merchantOid: baseAttempt.merchantOid,
      status: 'completed',
      orderId: 'order-1',
      trackingUrl: undefined,
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[PAYTR] Payment status tracking token decrypt failed',
      expect.objectContaining({ merchantOid: baseAttempt.merchantOid }),
    );
    consoleError.mockRestore();
  });

  it('answers guest attempts with the tracking token, without any session', async () => {
    const repository = createRepository();
    repository.findAttemptStatus.mockResolvedValue({ ...baseAttempt, status: 'PENDING', userId: null, user: null });
    const service = new PaymentsService(repository as never);

    const result = await service.getStatus(baseAttempt.merchantOid, 'test-token');

    expect(result.status).toBe('pending');
    expect(result.orderId).toBeUndefined();
  });

  it('hides known attempts behind the unknown-oid 404 when the token is missing', async () => {
    const repository = createRepository();
    repository.findAttemptStatus.mockResolvedValue(baseAttempt);
    const service = new PaymentsService(repository as never);

    await expect(service.getStatus(baseAttempt.merchantOid, undefined)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Odeme denemesi bulunamadi.',
    });
    expect(repository.findOrderByPaymentRef).not.toHaveBeenCalled();
  });

  it('hides known attempts behind the unknown-oid 404 when the token is wrong', async () => {
    const repository = createRepository();
    repository.findAttemptStatus.mockResolvedValue(baseAttempt);
    const service = new PaymentsService(repository as never);

    await expect(service.getStatus(baseAttempt.merchantOid, 'wrong-token')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Odeme denemesi bulunamadi.',
    });
    expect(repository.findOrderByPaymentRef).not.toHaveBeenCalled();
  });

  it('hides unknown attempts behind the same 404', async () => {
    const repository = createRepository();
    repository.findAttemptStatus.mockResolvedValue(null);
    const service = new PaymentsService(repository as never);

    await expect(service.getStatus('UNKNOWN', 'test-token')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Odeme denemesi bulunamadi.',
    });
  });
});
