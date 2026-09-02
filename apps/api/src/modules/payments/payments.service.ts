import { z } from 'zod';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { decryptBillingIdentity, encryptBillingIdentity, hashTrackingToken } from '../../lib/crypto.js';
import { sendMail } from '../../lib/mail/transport.js';
import { guestOrderTrackingEmail } from '../../lib/mail/templates.js';
import { computeLineUnitPrice, findPackageOption } from '../../lib/serializers.js';
import {
  isPaytrConfigured,
  newMerchantOid,
  requestIframeToken,
  resolveClientIp,
  toKurus,
  verifyCallbackHash,
} from '../../lib/paytr.js';
import { PaymentsRepository, type AttemptItem } from './payments.repository.js';

const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  // Opsiyonel: taban urun icin gelmemelidir; geldiginde urunun guncel
  // packageOptions listesinde dogrulanir (asagida, servis katmaninda).
  packageOptionId: z.string().trim().min(1).optional(),
});

/** Tek bir urun icin sepette tutulabilecek en yuksek adet. */
const MAX_QUANTITY_PER_PRODUCT = 10;

/** Ayni urunun farkli paketleri ayri satirlardir; birlestirme anahtari ikilidir. */
const itemKey = (productId: string, packageOptionId?: string) => `${productId}::${packageOptionId ?? ''}`;

const checkoutItemsSchema = z
  .array(checkoutItemSchema)
  .max(20, 'Bir odeme denemesinde en fazla 20 kalem bulundurabilirsiniz.')
  .superRefine((items, ctx) => {
    // Ayni urun+paket satirlari once toplanir: sinir, birlestirilmis adet
    // uzerinden denetlenir, ayni urunu boluk boluk girmek kurali asamaz.
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(itemKey(item.productId, item.packageOptionId), (totals.get(itemKey(item.productId, item.packageOptionId)) ?? 0) + item.quantity);
    }

    for (const [key, quantity] of totals) {
      if (quantity > MAX_QUANTITY_PER_PRODUCT) {
        ctx.addIssue({
          code: 'custom',
          message: 'Ayni urunden en fazla 10 adet satin alabilirsiniz.',
          path: [key.split('::')[0]],
        });
      }
    }
  })
  .transform((items) => mergeItems(items));

function mergeItems(items: Array<{ productId: string; quantity: number; packageOptionId?: string }>) {
  const totals = new Map<string, { productId: string; quantity: number; packageOptionId?: string }>();
  for (const item of items) {
    const key = itemKey(item.productId, item.packageOptionId);
    const existing = totals.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      totals.set(key, { productId: item.productId, quantity: item.quantity, packageOptionId: item.packageOptionId });
    }
  }

  return [...totals.values()];
}

const checkoutSchema = z.object({
  email: z.string().email().optional(),
  items: checkoutItemsSchema.optional(),
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
    const customerEmail = data.email ?? userEmail;

    if (!customerEmail) {
      throw new AppError('Siparis takibi icin e-posta adresi zorunludur.', 400);
    }

    // Housekeeping before reserving fresh stock: expire every abandoned
    // payment window (guest attempts included) and close this user's still
    // open attempts, so stock never stays locked twice.
    await this.repository.expireStaleAttempts(new Date(Date.now() - PAYMENT_WINDOW_MS));
    if (userId) {
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
        basket: items.map((item) => ({
          name: item.packageLabel ? `${item.productName} (${item.packageLabel})` : item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
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

    // The raw token doubles as the ownership proof for the status endpoint;
    // only its hash is stored, so it must reach the customer right away.
    return { iframeToken, merchantOid, trackingToken, trackingUrl: `${env.WEB_URL}/siparis-takip/${trackingToken}` };
  }

  /**
   * Interval-driven housekeeping: closes every stale PENDING attempt — guest
   * attempts included — so abandoned checkouts release their stock even when
   * nobody checks out again.
   */
  async sweepStaleAttempts() {
    const count = await this.repository.expireStaleAttempts(new Date(Date.now() - PAYMENT_WINDOW_MS));
    if (count > 0) {
      console.log('[PAYTR] Stale payment attempts expired', { count });
    }
    return count;
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
      // Paketli satirda stokta eski bir secim kalmis olabilir; urunun guncel
      // packageOptions listesinde artik bulunmayan paket, taban fiyatla yanlis
      // fiyatlandirma doguracagi icin sepetin yenilenmesini isteriz.
      if (item.packageOptionId && !findPackageOption(item.product, item.packageOptionId)) {
        throw new AppError('Sepetteki bir urunun paket secenekleri guncellendi. Lutfen sepetinizi yenileyin.', 409);
      }

      const unitPrice = computeLineUnitPrice(item.product, item.packageOptionId);
      return {
        productId: item.productId,
        productName: item.product.name,
        packageLabel: item.packageLabel ?? null,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });
  }

  private async buildItemsFromPayload(
    payloadItems: Array<{ productId: string; quantity: number; packageOptionId?: string }>,
  ): Promise<AttemptItem[]> {
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

      // Misafir sepetinden gelen paket secimi de urunun guncel listesine
      // gore dogrulanir; bilinmeyen paket id'si odemeyi durdurur.
      const packageOption = findPackageOption(product, item.packageOptionId);
      if (item.packageOptionId && !packageOption) {
        throw new AppError('Gecersiz paket secimi.', 400);
      }

      const unitPrice = computeLineUnitPrice(product, item.packageOptionId);
      return {
        productId: product.id,
        productName: product.name,
        packageLabel: packageOption?.name ?? null,
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
      if (!order) {
        // The PENDING guard tripped: the attempt was already settled (e.g. the
        // customer started a new checkout or let the window expire while the
        // iframe was open). Money moved without an order — flag the attempt
        // for manual review, then still answer "OK" so PayTR stops retrying.
        await this.recordPaidWithoutOrder(merchantOid);
        return { outcome: 'paid' as const };
      }

      if (order.trackingTokenEncrypted) {
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

  /**
   * Money was charged for an attempt that is no longer open. Only closed
   * attempts (FAILED/EXPIRED) are flagged: a COMPLETED one means this is an
   * idempotent retry and its order already exists. A missing attempt keeps
   * the original 400 so PayTR keeps retrying.
   */
  private async recordPaidWithoutOrder(merchantOid: string) {
    const attempt = await this.repository.findAttemptByOid(merchantOid);
    if (!attempt) {
      throw new AppError('Odeme bildirimi bir denemeyle eslesmedi.', 400);
    }

    if (attempt.status !== 'FAILED' && attempt.status !== 'EXPIRED') {
      return;
    }

    const reviewNote =
      'Odeme basarili geldi ancak deneme daha once kapatilmis ve stok geri verilmisti. ' +
      'Siparis olusmadi; PayTR panelinden iade yapilmali veya siparis elle olusturulmali.';

    await this.repository.markPaidWithoutOrder(merchantOid, reviewNote);
    console.error('[PAYTR] Payment succeeded but no order was created', {
      merchantOid,
      attemptStatus: attempt.status,
      customerEmail: attempt.customerEmail,
    });
  }

  /**
   * Payment status lookup. The raw tracking token handed out at checkout is
   * the ownership proof: its sha256 digest must match the stored hash. A
   * missing or wrong token answers with the exact same 404 as an unknown
   * merchantOid, so the existence of an attempt is never revealed.
   */
  async getStatus(merchantOid: string, trackingToken: string | undefined) {
    const attempt = await this.repository.findAttemptStatus(merchantOid);
    if (!attempt || !this.hasValidTrackingToken(attempt.trackingTokenHash, trackingToken)) {
      throw new AppError('Odeme denemesi bulunamadi.', 404);
    }

    const order = await this.repository.findOrderByPaymentRef(merchantOid);
    let trackingUrl: string | undefined;
    if (attempt.trackingTokenEncrypted) {
      try {
        trackingUrl = `/siparis-takip/${decryptBillingIdentity(attempt.trackingTokenEncrypted)}`;
      } catch (error) {
        console.error('[PAYTR] Payment status tracking token decrypt failed', { merchantOid, error });
      }
    }

    return {
      merchantOid,
      status: attempt.status.toLowerCase(),
      orderId: order?.id,
      trackingUrl,
    };
  }

  /** Timing-safe comparison of the raw token's digest against the stored hash. */
  private hasValidTrackingToken(storedHash: string | null, rawToken: string | undefined) {
    if (!storedHash || !rawToken) {
      return false;
    }

    const provided = Buffer.from(hashTrackingToken(rawToken), 'utf8');
    const expected = Buffer.from(storedHash, 'utf8');

    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
}
