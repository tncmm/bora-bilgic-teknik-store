import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

/**
 * PayTR iFrame API helpers.
 *
 * Docs summary this module encodes:
 * - Token request: POST https://www.paytr.com/odeme/api/get-token with a
 *   form body; `paytr_token` is base64(HMAC-SHA256) where the KEY is
 *   merchant_key alone and the MESSAGE is the concatenated fields with the
 *   merchant_salt appended AT THE END:
 *   merchant_id+user_ip+merchant_oid+email+payment_amount+user_basket+
 *   no_installment+max_installment+currency+test_mode + merchant_salt.
 *   (Move the salt into the key instead and PayTR answers "gecersiz
 *   paytr_token" — verified against the official sample code.)
 * - Callback: PayTR POSTs merchant_oid, status, total_amount and hash; the
 *   hash is base64(HMAC-SHA256) over merchant_oid + merchant_salt + status +
 *   total_amount keyed with merchant_key alone. The endpoint must answer the
 *   plain text "OK" — anything else makes PayTR retry the callback.
 */
const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';
const PAYTR_REFUND_URL = 'https://www.paytr.com/odeme/iade';

export interface PaytrBasketItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

/**
 * PayTR requires a public IPv4 buyer address and rejects loopback/private or
 * IPv6 sender values with a misleading "paytr_token invalid" error. Behind
 * proxies Express may hand us "::ffff:203.0.113.9" — strip the mapping, keep
 * real public v4 addresses, and in test mode fall back to a stable public
 * placeholder so local development (127.0.0.1 / ::1) can still complete.
 */
export function resolveClientIp(rawIp: string) {
  const ip = rawIp.replace(/^::ffff:/, '');
  const looksV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  const isPrivateOrLoopback =
    /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip);

  if (looksV4 && !isPrivateOrLoopback) {
    return ip;
  }

  return env.PAYTR_TEST_MODE === '0' ? ip : '85.34.78.112';
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
  const noInstallment = '0';
  const maxInstallment = '0';
  const currency = 'TL';
  const okUrl = `${env.WEB_URL}/odeme/basarili?merchant_oid=${encodeURIComponent(input.merchantOid)}`;
  const failUrl = `${env.WEB_URL}/odeme/basarisiz?merchant_oid=${encodeURIComponent(input.merchantOid)}`;

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

  const paytrToken = createHmac('sha256', config.merchantKey).update(hashSource + config.merchantSalt).digest('base64');

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

export interface PaytrRefundInput {
  merchantOid: string;
  amount: number;
}

export async function requestRefund(input: PaytrRefundInput) {
  const config = requirePaytrConfig();
  const returnAmount = input.amount.toFixed(2);
  const paytrToken = createHmac('sha256', config.merchantKey)
    .update(config.merchantId + input.merchantOid + returnAmount + config.merchantSalt)
    .digest('base64');

  const body = new URLSearchParams({
    merchant_id: config.merchantId,
    merchant_oid: input.merchantOid,
    return_amount: returnAmount,
    paytr_token: paytrToken,
  });

  let response: Response;
  try {
    response = await fetch(PAYTR_REFUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new AppError('PayTR iade servisine ulasilamadi.', 502);
  }

  const data = (await response.json().catch(() => null)) as { status?: string; reference_no?: string; err_no?: string; err_msg?: string } | null;

  if (!response.ok || !data || data.status !== 'success') {
    throw new AppError(`PayTR iadesi basarisiz.${data?.err_msg ? ` ${data.err_msg}` : ''}`, 502);
  }

  return {
    referenceNo: data.reference_no ?? null,
  };
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
