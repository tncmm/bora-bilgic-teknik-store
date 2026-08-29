import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

/**
 * PayTR iFrame API helpers.
 *
 * Docs summary this module encodes:
 * - Token request: POST https://www.paytr.com/odeme/api/get-token with a
 *   form body; the `paytr_token` field is base64(HMAC-SHA256) over
 *   merchant_id + user_ip + merchant_oid + email + payment_amount(kurus) +
 *   user_basket(base64) + no_installment + max_installment + currency +
 *   test_mode, keyed with merchant_key + merchant_salt.
 * - Callback: PayTR POSTs merchant_oid, status, total_amount and hash; the
 *   hash is base64(HMAC-SHA256) over merchant_oid + merchant_salt + status +
 *   total_amount keyed with merchant_key alone. The endpoint must answer the
 *   plain text "OK" — anything else makes PayTR retry the callback.
 */
const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

export interface PaytrBasketItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PaytrCallbackPayload {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}

export function isPaytrConfigured() {
  return Boolean(env.PAYTR_MERCHANT_ID && env.PAYTR_MERCHANT_KEY && env.PAYTR_MERCHANT_SALT);
}

function requirePaytrConfig() {
  if (!isPaytrConfigured()) {
    throw new AppError(
      'PayTR ayarlari eksik. PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT degerlerini tanimlayin.',
      503,
    );
  }

  return {
    merchantId: env.PAYTR_MERCHANT_ID as string,
    merchantKey: env.PAYTR_MERCHANT_KEY as string,
    merchantSalt: env.PAYTR_MERCHANT_SALT as string,
  };
}

/** PayTR expects the amount in kurus as a plain integer string. */
export function toKurus(amount: number) {
  return Math.round(amount * 100).toString();
}

function buildUserBasket(items: PaytrBasketItem[]) {
  const basket = items.map((item) => [item.name, item.unitPrice.toFixed(2), item.quantity]);
  return Buffer.from(JSON.stringify(basket), 'utf8').toString('base64');
}

/**
 * merchant_oid must be alphanumeric and unique per payment attempt — a failed
 * oid can never be reused, so retries mint a fresh suffix while keeping the
 * human-readable order number as the base.
 */
export function newMerchantOid(orderNumber: string) {
  const base = orderNumber.replace(/[^A-Za-z0-9]/g, '');
  return `${base}${randomBytes(3).toString('hex').toUpperCase()}`.slice(0, 64);
}

export interface TokenRequestInput {
  merchantOid: string;
  email: string;
  amountKurus: number;
  userIp: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  basket: PaytrBasketItem[];
}

export async function requestIframeToken(input: TokenRequestInput): Promise<string> {
  const config = requirePaytrConfig();
  const testMode = env.PAYTR_TEST_MODE === '0' ? '0' : '1';
  const paymentAmount = String(input.amountKurus);
  const userBasket = buildUserBasket(input.basket);
  const noInstallment = '1';
  const maxInstallment = '0';
  const currency = 'TL';
  const okUrl = `${env.WEB_URL}/odeme/basarili`;
  const failUrl = `${env.WEB_URL}/odeme/basarisiz`;

  const hashSource =
    config.merchantId +
    input.userIp +
    input.merchantOid +
    input.email +
    paymentAmount +
    userBasket +
    noInstallment +
    maxInstallment +
    currency +
    testMode;

  const paytrToken = createHmac('sha256', config.merchantKey + config.merchantSalt).update(hashSource).digest('base64');

  const body = new URLSearchParams({
    merchant_id: config.merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email: input.email,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: testMode,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    timeout_limit: '30',
    currency,
    test_mode: testMode,
    merchant_ok_url: okUrl,
    merchant_fail_url: failUrl,
    user_name: input.userName,
    user_address: input.userAddress,
    user_phone: input.userPhone,
    lang: 'tr',
  });

  let response: Response;
  try {
    response = await fetch(PAYTR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new AppError('PayTR token servisine ulasilamadi.', 502);
  }

  const data = (await response.json().catch(() => null)) as { status?: string; token?: string; reason?: string } | null;

  if (!response.ok || !data || data.status !== 'success' || !data.token) {
    throw new AppError(`PayTR tokeni alinamadi.${data?.reason ? ` ${data.reason}` : ''}`, 502);
  }

  return data.token;
}

export function verifyCallbackHash(payload: PaytrCallbackPayload) {
  const config = requirePaytrConfig();
  const computed = createHmac('sha256', config.merchantKey)
    .update(payload.merchantOid + config.merchantSalt + payload.status + payload.totalAmount)
    .digest('base64');

  const expected = Buffer.from(computed, 'utf8');
  const received = Buffer.from(String(payload.hash ?? ''), 'utf8');

  return expected.length === received.length && timingSafeEqual(expected, received);
}
