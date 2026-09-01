import { z } from 'zod';
import { randomBytes } from 'node:crypto';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { decryptBillingIdentity, encryptBillingIdentity, hashTrackingToken } from '../../lib/crypto.js';
import { sendMail } from '../../lib/mail/transport.js';
import { guestOrderTrackingEmail } from '../../lib/mail/templates.js';
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
  email: z.string().email().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .optional(),
  shippingName: z.string().min(3),
  shippingPhone: z.string().min(10),
  shippingCity: z.string().min(2),
  shippingDistrict: z.string().min(2),
  shippingAddressLine: z.string().min(5),
  billingSameAsShipping: z.boolean().optional(),
  billingType: z.enum(['individual', 'corporate']).default('individual'),
  billingName: z.string().min(3).optional(),
  billingPhone: z.string().min(10).optional(),
  billingCity: z.string().min(2).optional(),
  billingDistrict: z.string().min(2).optional(),
  billingAddressLine: z.string().min(5).optional(),
  companyName: z.string().optional(),
  taxOffice: z.string().optional(),
  taxNumber: z.string().optional(),
  identityNumber: z.string().regex(/^\d{11}$/, 'TC kimlik numarasi 11 haneli olmalidir.'),
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
  async createCheckout(userId: string | undefined, userEmail: string | undefined, payload: unknown, clientIp: string) {
    if (!isPaytrConfigured()) {
      throw new AppError('Odeme saglayici su anda kullanim disi. Lutfen daha sonra tekrar deneyin.', 503);
    }

    const data = checkoutSchema.parse(payload);
    const customerEmail = userEmail ?? data.email;

    if (!customerEmail) {
      throw new AppError('Siparis takibi icin e-posta adresi zorunludur.', 400);
    }

    // Housekeeping before reserving fresh stock: expire own abandoned windows
    // and close anything still open, so stock never stays locked twice.
    if (userId) {
      await this.repository.expireStaleAttempts(userId, new Date(Date.now() - PAYMENT_WINDOW_MS));
      await this.repository.supersedeOpenAttempts(userId);
    }

    const items = userId ? await this.buildItemsFromCart(userId) : await this.buildItemsFromPayload(data.items ?? []);

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const merchantOid = newMerchantOid(`BBT${Date.now().toString(36).toUpperCase()}`);
    const trackingToken = randomBytes(24).toString('base64url');
    const billing = this.resolveBilling(data);

    const attempt = await this.repository.createAttempt({
      userId,
      merchantOid,
      customerEmail,
      trackingTokenHash: hashTrackingToken(trackingToken),
      trackingTokenEncrypted: encryptBillingIdentity(trackingToken),
      total,
      items,
      shippingName: data.shippingName,
      shippingPhone: data.shippingPhone,
      shippingCity: data.shippingCity,
      shippingDistrict: data.shippingDistrict,
      shippingAddressLine: data.shippingAddressLine,
      notes: data.notes,
      ...billing,
    });

    let iframeToken: string;
    try {
      iframeToken = await requestIframeToken({
        merchantOid,
        email: customerEmail,
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

    return { iframeToken, merchantOid, trackingUrl: `${env.WEB_URL}/siparis-takip/${trackingToken}` };
  }

  private async buildItemsFromCart(userId: string): Promise<AttemptItem[]> {
    const cart = await this.repository.findCart(userId);

    if (!cart || cart.items.length === 0) {
      throw new AppError('Odeme baslatmak icin sepetiniz bos olmamali.', 409);
    }

    for (const item of cart.items) {
      if (!item.product.isPurchasable) {
        throw new AppError(`${item.product.name} urunu su anda satisa kapali.`, 409);
      }
    }

    return cart.items.map((item) => {
      const unitPrice = computeEffectivePrice(item.product.price, item.product.discountPercent ?? 0);
      return {
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });
  }

  private async buildItemsFromPayload(payloadItems: Array<{ productId: string; quantity: number }>): Promise<AttemptItem[]> {
    if (payloadItems.length === 0) {
      throw new AppError('Odeme baslatmak icin sepetiniz bos olmamali.', 409);
    }

    const products = await this.repository.findProductsForCheckout(payloadItems);

    return payloadItems.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new AppError('Sepetteki urunlerden biri bulunamadi.', 404);
      }

      if (!product.isPurchasable) {
        throw new AppError(`${product.name} urunu su anda satisa kapali.`, 409);
      }

      const unitPrice = computeEffectivePrice(product.price, product.discountPercent ?? 0);
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });
  }

  private resolveBilling(data: z.infer<typeof checkoutSchema>) {
    const same = data.billingSameAsShipping;
    const identityNumber = data.identityNumber.trim();
    const billingName = same ? data.shippingName : data.billingName?.trim();
    const billingPhone = same ? data.shippingPhone : data.billingPhone?.trim();
    const billingCity = same ? data.shippingCity : data.billingCity?.trim();
    const billingDistrict = same ? data.shippingDistrict : data.billingDistrict?.trim();
    const billingAddressLine = same ? data.shippingAddressLine : data.billingAddressLine?.trim();

    if (!billingName || !billingPhone || !billingCity || !billingDistrict || !billingAddressLine) {
      throw new AppError('Fatura bilgilerini tamamlamalisiniz.', 400);
    }

    return {
      billingType: data.billingType,
      billingName,
      billingPhone,
      billingCity,
      billingDistrict,
      billingAddressLine,
      companyName: data.billingType === 'corporate' ? data.companyName : undefined,
      taxOffice: data.billingType === 'corporate' ? data.taxOffice : undefined,
      taxNumber: data.billingType === 'corporate' ? data.taxNumber : undefined,
      identityNumberEncrypted: encryptBillingIdentity(identityNumber),
      identityNumberLast4: identityNumber.slice(-4),
    };
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

      const order = await this.repository.completeAttempt(merchantOid);
      if (order?.trackingTokenEncrypted) {
        const trackingToken = decryptBillingIdentity(order.trackingTokenEncrypted);
        const email = guestOrderTrackingEmail({
          name: order.shippingName,
          orderNumber: order.orderNumber,
          trackingUrl: `${env.WEB_URL}/siparis-takip/${trackingToken}`,
        });
        await sendMail({ to: order.customerEmail, ...email }).catch((error) => {
          console.error('[PAYTR] Guest order tracking email failed', { merchantOid, error });
        });
      }
      return { outcome: 'paid' as const };
    }

    await this.repository.settleAttempt(merchantOid, {
      status: 'FAILED',
      reason: 'PayTR odemeyi basarisiz olarak bildirdi.',
    });
    return { outcome: 'failed' as const };
  }

  async getStatus(merchantOid: string, userId?: string) {
    const attempt = await this.repository.findAttemptStatus(merchantOid);
    if (!attempt) {
      throw new AppError('Odeme denemesi bulunamadi.', 404);
    }

    if (attempt.userId && attempt.userId !== userId) {
      throw new AppError('Bu odeme denemesini goruntuleme yetkiniz yok.', 403);
    }

    const order = await this.repository.findOrderByPaymentRef(merchantOid);
    return {
      merchantOid,
      status: attempt.status.toLowerCase(),
      orderId: order?.id,
      trackingUrl: attempt.trackingTokenEncrypted ? `/siparis-takip/${decryptBillingIdentity(attempt.trackingTokenEncrypted)}` : undefined,
    };
  }
}
