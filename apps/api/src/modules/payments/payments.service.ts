import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { computeEffectivePrice } from '../../lib/serializers.js';
import {
  isPaytrConfigured,
  newMerchantOid,
  requestIframeToken,
  resolveClientIp,
  toKurus,
  verifyCallbackHash,
} from '../../lib/paytr.js';
import { PaymentsRepository, type AttemptItem } from './payments.repository.js';

const checkoutSchema = z.object({
  shippingName: z.string().min(3),
  shippingPhone: z.string().min(10),
  shippingCity: z.string().min(2),
  shippingDistrict: z.string().min(2),
  shippingAddressLine: z.string().min(5),
  notes: z.string().optional(),
});

/** PayTR collects the card for 30 minutes; after that the attempt expires. */
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

export class PaymentsService {
  constructor(private readonly repository = new PaymentsRepository()) {}

  /**
   * The payment-first checkout: reserves stock, records a PaymentAttempt and
   * returns the PayTR iframe token in one shot. NO order row exists yet —
   * orders are born exclusively from the verified callback.
   */
  async createCheckout(userId: string, payload: unknown, clientIp: string) {
    if (!isPaytrConfigured()) {
      throw new AppError('Odeme saglayici su anda kullanim disi. Lutfen daha sonra tekrar deneyin.', 503);
    }

    const data = checkoutSchema.parse(payload);

    // Housekeeping before reserving fresh stock: expire own abandoned windows
    // and close anything still open, so stock never stays locked twice.
    await this.repository.expireStaleAttempts(userId, new Date(Date.now() - PAYMENT_WINDOW_MS));
    await this.repository.supersedeOpenAttempts(userId);

    const cart = await this.repository.findCart(userId);

    if (!cart || cart.items.length === 0) {
      throw new AppError('Odeme baslatmak icin sepetiniz bos olmamali.', 409);
    }

    for (const item of cart.items) {
      if (!item.product.isPurchasable) {
        throw new AppError(`${item.product.name} urunu su anda satisa kapali.`, 409);
      }
    }

    const items: AttemptItem[] = cart.items.map((item) => {
      const unitPrice = computeEffectivePrice(item.product.price, item.product.discountPercent ?? 0);
      return {
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const merchantOid = newMerchantOid(`BBT${Date.now().toString(36).toUpperCase()}`);

    const attempt = await this.repository.createAttempt({
      userId,
      merchantOid,
      total,
      items,
      ...data,
    });

    let iframeToken: string;
    try {
      iframeToken = await requestIframeToken({
        merchantOid,
        email: attempt.user.email,
        amountKurus: Number(toKurus(total)),
        userIp: resolveClientIp(clientIp),
        userName: data.shippingName,
        userAddress: `${data.shippingAddressLine} ${data.shippingDistrict}/${data.shippingCity}`,
        userPhone: data.shippingPhone,
        basket: items.map((item) => ({ name: item.productName, unitPrice: item.unitPrice, quantity: item.quantity })),
      });
    } catch (error) {
      // PayTR never saw a payable session: release the stock and close the
      // attempt so the storefront can show an immediately retryable error.
      await this.repository.settleAttempt(merchantOid, {
        status: 'FAILED',
        reason: 'PayTR tokeni uretilemedi.',
      });
      throw error instanceof AppError ? error : new AppError('Odeme baslatilamadi.', 502);
    }

    return { iframeToken, merchantOid };
  }

  /**
   * PayTR's server-to-server notification. The order is created here and only
   * here. Any thrown error becomes a non-OK response, which tells PayTR to
   * retry the callback; the repository transitions are PENDING-guarded, so
   * retries are safe.
   */
  async handleCallback(body: Record<string, unknown>) {
    const merchantOid = String(body.merchant_oid ?? '');
    const status = String(body.status ?? '');
    const totalAmount = String(body.total_amount ?? '');
    const hash = String(body.hash ?? '');

    if (!merchantOid || !status || !totalAmount || !hash) {
      throw new AppError('Odeme bildiriminde eksik alanlar var.', 400);
    }

    if (!verifyCallbackHash({ merchantOid, status, totalAmount, hash })) {
      throw new AppError('Odeme bildirimi imzasi dogrulanamadi.', 400);
    }

    const attempt = await this.repository.findAttemptByOid(merchantOid);
    if (!attempt) {
      throw new AppError('Odeme bildirimi bir denemeyle eslesmedi.', 400);
    }

    if (status === 'success') {
      const expectedKurus = toKurus(Number(attempt.total));
      if (totalAmount !== expectedKurus) {
        // Money moved but the amount disagrees — do not create the order
        // automatically; an operator must review this attempt.
        throw new AppError('Odeme tutari beklenen tutarla eslesmiyor.', 400);
      }

      await this.repository.completeAttempt(merchantOid);
      return { outcome: 'paid' as const };
    }

    await this.repository.settleAttempt(merchantOid, {
      status: 'FAILED',
      reason: 'PayTR odemeyi basarisiz olarak bildirdi.',
    });
    return { outcome: 'failed' as const };
  }
}
