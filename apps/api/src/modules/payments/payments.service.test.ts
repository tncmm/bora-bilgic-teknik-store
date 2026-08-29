import { beforeEach, describe, expect, it, vi } from 'vitest';

import { newMerchantOid, toKurus } from '../../lib/paytr.js';
import { AppError } from '../../lib/app-error.js';
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

const { isPaytrConfigured, verifyCallbackHash } = await import('../../lib/paytr.js');

const baseOrder = {
  id: 'order-1',
  orderNumber: 'BBT-ABC123',
  paymentStatus: 'PENDING',
  paymentAmount: 1499.5,
  total: 1499.5,
  shippingName: 'Musteri Test',
  shippingPhone: '05551234567',
  shippingCity: 'Istanbul',
  shippingDistrict: 'Kadikoy',
  shippingAddressLine: 'Test mah. 1',
  user: { email: 'musteri@example.com' },
  items: [{ productName: 'DJI Mic 2', unitPrice: 1499.5, quantity: 1 }],
};

function createRepository() {
  return {
    findOrderForUser: vi.fn(),
    assignPaymentRef: vi.fn(async () => undefined),
    findByPaymentRef: vi.fn(),
    markPaid: vi.fn(async () => ({ count: 1 })),
    markFailed: vi.fn(async () => 1),
  };
}

describe('PayTR helpers', () => {
  it('converts TL amounts to kurus strings', () => {
    expect(toKurus(1499.5)).toBe('149950');
    expect(toKurus(0.29)).toBe('29');
  });

  it('mints alphanumeric merchant oids based on the order number', () => {
    const oid = newMerchantOid('BBT-MTEE6Z500BB4C7');
    expect(oid).toMatch(/^BBTMTEE6Z500BB4C7[0-9A-F]{6}$/);
    expect(oid).toMatch(/^[A-Z0-9]+$/);
  });
});

describe('PaymentsService.createPaymentToken', () => {
  it('refuses to run when PayTR is not configured', async () => {
    vi.mocked(isPaytrConfigured).mockReturnValueOnce(false);
    const service = new PaymentsService(createRepository() as never);

    await expect(service.createPaymentToken('user-1', { orderId: 'o1' }, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('rejects when the order does not belong to the caller', async () => {
    const repository = createRepository();
    repository.findOrderForUser.mockResolvedValue(null);
    const service = new PaymentsService(repository as never);

    await expect(service.createPaymentToken('user-1', { orderId: 'o1' }, '127.0.0.1')).rejects.toBeInstanceOf(AppError);
    expect(repository.assignPaymentRef).not.toHaveBeenCalled();
  });

  it('rejects orders whose payment is already resolved', async () => {
    const repository = createRepository();
    repository.findOrderForUser.mockResolvedValue({ ...baseOrder, paymentStatus: 'PAID' });
    const service = new PaymentsService(repository as never);

    await expect(service.createPaymentToken('user-1', { orderId: 'order-1' }, '127.0.0.1')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('stores a fresh merchant oid and returns the iframe token', async () => {
    const repository = createRepository();
    repository.findOrderForUser.mockResolvedValue(baseOrder);
    const service = new PaymentsService(repository as never);

    const result = await service.createPaymentToken('user-1', { orderId: 'order-1' }, '127.0.0.1');

    expect(result.iframeToken).toBe('iframe-token-123');
    expect(result.merchantOid).toMatch(/^BBTABC123[0-9A-F]{6}$/);
    expect(repository.assignPaymentRef).toHaveBeenCalledWith('order-1', result.merchantOid);
  });
});

describe('PaymentsService.handleCallback', () => {
  beforeEach(() => {
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
      service.handleCallback({ merchant_oid: 'X', status: 'success', total_amount: '149950', hash: 'bad' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects notifications for unknown payment refs', async () => {
    const repository = createRepository();
    repository.findByPaymentRef.mockResolvedValue(null);
    const service = new PaymentsService(repository as never);

    await expect(
      service.handleCallback({ merchant_oid: 'UNKNOWN', status: 'success', total_amount: '149950', hash: 'ok' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('marks the order paid when signature and amount check out', async () => {
    const repository = createRepository();
    repository.findByPaymentRef.mockResolvedValue(baseOrder);
    const service = new PaymentsService(repository as never);

    const result = await service.handleCallback({
      merchant_oid: 'BBTABC123000000',
      status: 'success',
      total_amount: '149950',
      hash: 'valid',
    });

    expect(result.outcome).toBe('paid');
    expect(repository.markPaid).toHaveBeenCalledWith('order-1');
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('refuses success callbacks whose amount differs from the order total', async () => {
    const repository = createRepository();
    repository.findByPaymentRef.mockResolvedValue(baseOrder);
    const service = new PaymentsService(repository as never);

    await expect(
      service.handleCallback({ merchant_oid: 'BBTABC123000000', status: 'success', total_amount: '99999', hash: 'valid' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.markPaid).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks the order failed (with stock refund) on failure callbacks', async () => {
    const repository = createRepository();
    repository.findByPaymentRef.mockResolvedValue(baseOrder);
    const service = new PaymentsService(repository as never);

    const result = await service.handleCallback({
      merchant_oid: 'BBTABC123000000',
      status: 'failed',
      total_amount: '149950',
      hash: 'valid',
    });

    expect(result.outcome).toBe('failed');
    expect(repository.markFailed).toHaveBeenCalledWith('order-1', 'paytr_declined', expect.any(String));
    expect(repository.markPaid).not.toHaveBeenCalled();
  });
});
