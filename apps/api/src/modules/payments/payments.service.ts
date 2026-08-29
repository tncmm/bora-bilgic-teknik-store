import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import {
  isPaytrConfigured,
  newMerchantOid,
  requestIframeToken,
  resolveClientIp,
  toKurus,
  verifyCallbackHash,
} from '../../lib/paytr.js';
import { OrdersRepository } from '../orders/orders.repository.js';

const tokenRequestSchema = z.object({
  orderId: z.string().min(1),
});

export class PaymentsService {
  constructor(private readonly ordersRepository = new OrdersRepository()) {}

  /**
   * Issues a fresh PayTR iframe token for one of the caller's own orders.
   * A new merchant_oid is minted per attempt (PayTR never accepts a reused
   * one) and stored as the order's paymentRef so the callback can resolve it.
   */
  async createPaymentToken(userId: string, payload: unknown, clientIp: string) {
    if (!isPaytrConfigured()) {
      throw new AppError('Odeme saglayici su anda kullanim disi. Lutfen daha sonra tekrar deneyin.', 503);
    }

    const { orderId } = tokenRequestSchema.parse(payload);
    const order = await this.ordersRepository.findOrderForUser(userId, orderId);

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    if (order.paymentStatus !== 'PENDING') {
      throw new AppError('Bu siparis icin odeme daha once tamamlandi veya iptal edildi.', 409);
    }

    const merchantOid = newMerchantOid(order.orderNumber);
    await this.ordersRepository.assignPaymentRef(order.id, merchantOid);

    const amountKurus = Number(toKurus(Number(order.paymentAmount ?? order.total)));
    const iframeToken = await requestIframeToken({
      merchantOid,
      email: order.user.email,
      amountKurus,
      userIp: resolveClientIp(clientIp),
      userName: order.shippingName,
      userAddress: `${order.shippingAddressLine} ${order.shippingDistrict}/${order.shippingCity}`,
      userPhone: order.shippingPhone,
      basket: order.items.map((item) => ({
        name: item.productName,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
      })),
    });

    return { iframeToken, merchantOid };
  }

  /**
   * Handles PayTR's server-to-server notification. Any thrown error becomes a
   * non-OK response, which is exactly what makes PayTR retry the callback.
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

    const order = await this.ordersRepository.findByPaymentRef(merchantOid);
    if (!order) {
      throw new AppError('Odeme bildirimi bir siparisle eslesmedi.', 400);
    }

    if (status === 'success') {
      const expectedKurus = toKurus(Number(order.paymentAmount ?? order.total));
      if (totalAmount !== expectedKurus) {
        // Money moved but the amount disagrees with the order — refuse to
        // confirm automatically; an operator must review this order.
        throw new AppError('Odeme tutari siparis tutari ile eslesmiyor.', 400);
      }

      await this.ordersRepository.markPaid(order.id);
      return { outcome: 'paid' as const };
    }

    await this.ordersRepository.markFailed(order.id, 'paytr_declined', 'PayTR odemeyi basarisiz olarak bildirdi.');
    return { outcome: 'failed' as const };
  }
}
