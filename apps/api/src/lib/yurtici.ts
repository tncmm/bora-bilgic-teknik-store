import { XMLParser } from 'fast-xml-parser';

import type { CargoEvent, CargoStatus } from '@bora/types';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

/**
 * Yurtiçi Kargo KOPS web servisi (SOAP 1.1) istemcisi.
 *
 * Sözleşme, Yurtiçi Kargo'nun resmi entegrasyon dokümanlarıyla doğrulanmıştır:
 * "Web Servis Giden Kargo Teknik Döküman" (createShipment / cancelShipment /
 * queryShipment) ve "RMA İade - saveReturnShipmentCode". Dokümanda
 * yayımlanmayan tek parça olay (cargoEventId) kodlarının tam sayımıdır; o
 * kodlar bilinmedikçe UNKNOWN'a düşer ve ham açıklama korunur.
 *
 * DOKÜMANLA DOĞRULANMIŞ SABİTLER:
 *   - Hizmet adresi: canlı https://webservices.yurticikargo.com/KOPSWebServices/
 *     ShippingOrderDispatcherServices?wsdl (2020 dok.); test
 *     http://testwebservices.yurticikargo.com:9090/... (2016 dok.).
 *     NOT: Erişim, Yurtiçi Kargo'ya önceden tanıtılmış sabit IP'lerle sınırlıdır.
 *   - Operasyon adları: createShipment / cancelShipment / queryShipment /
 *     saveReturnShipmentCode.
 *   - Target namespace: http://yurticikargo.com.tr/ShippingOrderDispatcherServices
 *   - createShipment dil alanı "userLanguage", queryShipment ve
 *     saveReturnShipmentCode için "wsLanguage" (doküman örnekleri farklı).
 *   - createShipment: cargoKey gönderinin barkodudur (şube bunu okur),
 *     invoiceKey gönderi başına TEKİLDİR; telefon 10 hane + alan kodudur.
 *   - queryShipment girdisi: keys / keyType(0=Cargo Key,1=Invoice Key) /
 *     addHistoricalData / onlyTracking; hareket listesi addHistoricalData=true
 *     ile döner.
 *   - Gönderi durumu sinyali operationStatus: IND=Teslimatta, DLV=Teslim
 *     edildi, CNL=İptal.
 */
const YURTICI_DEFAULT_API_URL =
  'https://webservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices?wsdl';
const YURTICI_DEFAULT_TIMEOUT_MS = 15_000;

const YURTICI_SOAP_ENVELOPE_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const YURTICI_KOPS_NAMESPACE = 'http://yurticikargo.com.tr/ShippingOrderDispatcherServices';
const YURTICI_SOAP_ACTION = '';

// Kimlik / oturum alanları.
const YURTICI_FIELD_WS_USER_NAME = 'wsUserName';
const YURTICI_FIELD_WS_PASSWORD = 'wsPassword';

// createShipment isteğindeki ShippingOrderVO alanları (doküman tablosu).
const YURTICI_FIELD_CARGO_KEY = 'cargoKey';
const YURTICI_FIELD_INVOICE_KEY = 'invoiceKey';
const YURTICI_FIELD_RECEIVER_NAME = 'receiverCustName';
const YURTICI_FIELD_RECEIVER_ADDRESS = 'receiverAddress';
const YURTICI_FIELD_RECEIVER_CITY = 'cityName';
const YURTICI_FIELD_RECEIVER_TOWN = 'townName';
const YURTICI_FIELD_RECEIVER_PHONE = 'receiverPhone1';
const YURTICI_FIELD_CARGO_COUNT = 'cargoCount';
const YURTICI_FIELD_DESCRIPTION = 'description';
const YURTICI_FIELD_EMAIL_ADDRESS = 'emailAddress';
const YURTICI_FIELD_USER_LANGUAGE = 'userLanguage';

// createShipment yanıtı: outFlag 0 "en az bir kayıt başarılı", 1 "tüm kayıtlar
// hatalı", 2 "beklenmeyen hata"; gönderi bazında errCode=0 başarı demektir.
const YURTICI_FIELD_OUT_FLAG = 'outFlag';
const YURTICI_FIELD_OUT_RESULT = 'outResult';
const YURTICI_FIELD_ERR_CODE = 'errCode';
const YURTICI_FIELD_ERR_MESSAGE = 'errMessage';
const YURTICI_FIELD_SOAP_FAULT = 'faultstring';
const YURTICI_FIELD_SHIPPING_ORDER_DETAIL = 'shippingOrderDetailVO';

// queryShipment girdisi.
const YURTICI_FIELD_WS_LANGUAGE = 'wsLanguage';
const YURTICI_FIELD_KEYS = 'keys';
const YURTICI_FIELD_KEY_TYPE = 'keyType';
const YURTICI_FIELD_ADD_HISTORICAL_DATA = 'addHistoricalData';
const YURTICI_FIELD_ONLY_TRACKING = 'onlyTracking';

// queryShipment yanıtı: hareket listesi (addHistoricalData=true ile dolu) ve
// gönderi seviyesi durum alanları.
const YURTICI_FIELD_INV_DOC_CARGO_ARRAY = 'invDocCargoVOArray';
const YURTICI_FIELD_SHIPPING_DELIVERY_DETAIL = 'shippingDeliveryDetailVO';
const YURTICI_FIELD_SHIPPING_DELIVERY_ITEM_DETAIL = 'shippingDeliveryItemDetailVO';
const YURTICI_FIELD_OPERATION_STATUS = 'operationStatus';
const YURTICI_FIELD_OPERATION_MESSAGE = 'operationMessage';
const YURTICI_FIELD_DELIVERY_DATE = 'deliveryDate';
const YURTICI_FIELD_DELIVERY_TIME = 'deliveryTime';

// cancelShipment / saveReturnShipmentCode alanları.
const YURTICI_FIELD_CARGO_KEYS = 'cargoKeys';
const YURTICI_FIELD_FIELD_NAME = 'fieldName';
const YURTICI_FIELD_RETURN_CODE = 'returnCode';
const YURTICI_FIELD_START_DATE = 'startDate';
const YURTICI_FIELD_END_DATE = 'endDate';
const YURTICI_FIELD_MAX_COUNT = 'maxCount';

/**
 * Dokümanda örneklenen olay kodları → normalize durum. Tam sayım dokümanlarda
 * yayımlanmadığından eşleşmeyen her kod UNKNOWN'a düşer ve ham açıklama
 * korunur — yanlış "teslim edildi" bildiriminden daha güvenli.
 */
const YURTICI_EVENT_CODE_MAP: Record<string, CargoStatus> = {
  IN: 'IN_TRANSIT', // "Kargo İndirildi" — birim/transfer merkezine giriş
  DLV: 'DELIVERED', // teslim olayı
};

export function mapYurticiEventCode(code: string): CargoStatus {
  return YURTICI_EVENT_CODE_MAP[String(code).trim().toUpperCase()] ?? 'UNKNOWN';
}

/**
 * Gönderi seviyesi operationStatus → normalize durum. Dokümandaki tablo:
 * IND=Teslimattadır, DLV=Teslim edilmiş, CNL=İptal; kalan değerler için ham
 * operationMessage son olay olarak saklanır.
 */
export function mapYurticiOperationStatus(status: string): CargoStatus | null {
  const normalized = String(status).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'DLV') return 'DELIVERED';
  if (normalized === 'IND') return 'IN_TRANSIT';
  if (normalized === 'CNL') return 'EXCEPTION';
  return 'UNKNOWN';
}

interface YurticiConfig {
  apiUrl: string;
  username: string;
  password: string;
  customerId: string;
  timeoutMs: number;
}

/**
 * Reports whether the Yurtiçi Kargo integration is usable without throwing.
 * Callers degrade gracefully with a 503 while credentials are pending.
 */
export function isYurticiConfigured() {
  return Boolean(env.YURTICI_KARGO_USERNAME && env.YURTICI_KARGO_PASSWORD && env.YURTICI_KARGO_CUSTOMER_ID);
}

function requireYurticiConfig(): YurticiConfig {
  if (!isYurticiConfigured()) {
    throw new AppError(
      'Kargo entegrasyonu yapilandirilmadi. YURTICI_KARGO_USERNAME, YURTICI_KARGO_PASSWORD ve YURTICI_KARGO_CUSTOMER_ID degerlerini tanimlayin.',
      503,
    );
  }

  return {
    apiUrl: env.YURTICI_KARGO_API_URL ?? YURTICI_DEFAULT_API_URL,
    username: env.YURTICI_KARGO_USERNAME as string,
    password: env.YURTICI_KARGO_PASSWORD as string,
    customerId: env.YURTICI_KARGO_CUSTOMER_ID as string,
    timeoutMs: env.YURTICI_KARGO_TIMEOUT_MS ?? YURTICI_DEFAULT_TIMEOUT_MS,
  };
}

/** AbortSignal.timeout ile kesilen istekleri diger ag hatalarindan ayirir. */
function isTimeoutError(error: unknown) {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;
  return name === 'TimeoutError' || name === 'AbortError';
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** fast-xml-parser çıktısında verilen anahtarın ilk eşleşmesini bulur. */
function deepFind(tree: unknown, key: string): unknown {
  if (!tree || typeof tree !== 'object') {
    return undefined;
  }

  const record = tree as Record<string, unknown>;
  if (key in record) {
    return record[key];
  }

  for (const value of Object.values(record)) {
    const found = Array.isArray(value) ? value.find((entry) => deepFind(entry, key) !== undefined) : deepFind(value, key);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

/** deepFind sonucunu dizine normalize eder; tek öğe → [öğe]. */
function deepFindArray(tree: unknown, key: string): unknown[] {
  const found = deepFind(tree, key);
  if (found === undefined || found === null || found === '') return [];
  return Array.isArray(found) ? found : [found];
}

/**
 * SOAP 1.1 isteğini gönderir ve yanıt gövdesini ayrıştırılmış döndürür.
 * Vendora özgü taşıma ayrıntıları burada biter; arayan taraf yalnızca
 * ayrıştırılmış düz nesne ile çalışır.
 */
async function sendSoapRequest(method: string, bodyXml: string): Promise<Record<string, unknown>> {
  const config = requireYurticiConfig();
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="${YURTICI_SOAP_ENVELOPE_NS}" xmlns:ship="${YURTICI_KOPS_NAMESPACE}">` +
    `<soap:Body><ship:${method}>${bodyXml}</ship:${method}></soap:Body>` +
    `</soap:Envelope>`;

  let response: Response;
  try {
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: YURTICI_SOAP_ACTION,
      },
      body: envelope,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError('Yurtici Kargo servisi zaman asimina ugradi.', 502);
    }
    throw new AppError('Yurtici Kargo servisine ulasilamadi.', 502);
  }

  const rawXml = await response.text().catch(() => '');

  let parsed: Record<string, unknown>;
  try {
    parsed = new XMLParser().parse(rawXml) as Record<string, unknown>;
  } catch {
    throw new AppError('Yurtici Kargo servisi gecersiz bir yanit dondurdu.', 502);
  }

  const fault = deepFind(parsed, YURTICI_FIELD_SOAP_FAULT);
  if (fault !== undefined) {
    throw new AppError(`Yurtici Kargo servisi hata bildirdi. ${String(fault).trim()}`, 502);
  }

  if (!response.ok) {
    throw new AppError(`Yurtici Kargo servisi hata dondurdu. (HTTP ${response.status})`, 502);
  }

  return parsed;
}

/** YK tarihleri "YYYYMMDD" + saat "HHMMSS" (ör. 20110711 / 082304). */
function parseCompactDate(dateValue: unknown, timeValue?: unknown): string | null {
  const date = String(dateValue ?? '').trim();
  if (!/^\d{8}$/.test(date)) {
    return parseDotDate(dateValue, timeValue);
  }
  const time = String(timeValue ?? '').replace(/\D/g, '');
  const iso = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)), 0, 0, 0),
  );
  if (Number.isNaN(iso.getTime())) return null;
  if (time.length >= 2) {
    iso.setUTCHours(Number(time.slice(0, 2)), Number(time.slice(2, 4)) || 0, Number(time.slice(4, 6)) || 0);
  }
  return iso.toISOString();
}

/** "gg.aa.yyyy" tarih + "ss:dd:ss" saat birleşimini ISO stringe çevirir. */
function parseDotDate(dateValue: unknown, timeValue?: unknown): string | null {
  const date = String(dateValue ?? '').trim();
  if (!date) return null;

  const dateParts = date.split(/[.\-/]/).map((part) => Number(part));
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const iso = new Date(Date.UTC(dateParts[2], dateParts[1] - 1, dateParts[0], 0, 0, 0));
  if (Number.isNaN(iso.getTime())) return null;

  const time = String(timeValue ?? '').trim();
  if (time) {
    const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map((part) => Number(part));
    if ([hours, minutes, seconds].every((part) => Number.isFinite(part))) {
      iso.setUTCHours(hours, minutes, seconds);
    }
  }

  return iso.toISOString();
}

export interface YurticiCreateShipmentInput {
  /** Gönderi referansı (cargoKey): sipariş numarası — şube bunu barkod olarak görür. */
  orderReference: string;
  receiverName: string;
  /** 10 hane + alan kodu; doküman kuralı ERR_INTG_RECEIVER_PHONE_INVALID_PARAMETER. */
  receiverPhone: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverAddress: string;
  /** İçerik açıklaması (sipariş ürün adları). */
  description: string;
  /** Alıcı e-postası (emailAddress alanı, opsiyonel). */
  emailAddress?: string | null;
  /** Parça sayısı; şu an tek parça gönderiliyor. */
  pieceCount: number;
}

function buildShipmentOrderXml(input: YurticiCreateShipmentInput): string {
  const config = requireYurticiConfig();
  // invoiceKey gönderi başına TEKİL olmalı (doküman: "Her gönderi için tekil
  // bilgi olmalı") — sabit müşteri kodu göndermek kayıt çakışması yaratır.
  const invoiceKey = input.orderReference;
  const email = input.emailAddress?.trim() ? `<${YURTICI_FIELD_EMAIL_ADDRESS}>${escapeXml(input.emailAddress.trim())}</${YURTICI_FIELD_EMAIL_ADDRESS}>` : '';

  return (
    `<ShippingOrderVO>` +
    `<${YURTICI_FIELD_CARGO_KEY}>${escapeXml(input.orderReference)}</${YURTICI_FIELD_CARGO_KEY}>` +
    `<${YURTICI_FIELD_INVOICE_KEY}>${escapeXml(invoiceKey)}</${YURTICI_FIELD_INVOICE_KEY}>` +
    `<${YURTICI_FIELD_RECEIVER_NAME}>${escapeXml(input.receiverName)}</${YURTICI_FIELD_RECEIVER_NAME}>` +
    `<${YURTICI_FIELD_RECEIVER_PHONE}>${escapeXml(input.receiverPhone)}</${YURTICI_FIELD_RECEIVER_PHONE}>` +
    `<${YURTICI_FIELD_RECEIVER_CITY}>${escapeXml(input.receiverCity)}</${YURTICI_FIELD_RECEIVER_CITY}>` +
    `<${YURTICI_FIELD_RECEIVER_TOWN}>${escapeXml(input.receiverDistrict)}</${YURTICI_FIELD_RECEIVER_TOWN}>` +
    `<${YURTICI_FIELD_RECEIVER_ADDRESS}>${escapeXml(input.receiverAddress)}</${YURTICI_FIELD_RECEIVER_ADDRESS}>` +
    `<${YURTICI_FIELD_CARGO_COUNT}>${escapeXml(String(input.pieceCount))}</${YURTICI_FIELD_CARGO_COUNT}>` +
    `<${YURTICI_FIELD_DESCRIPTION}>${escapeXml(input.description)}</${YURTICI_FIELD_DESCRIPTION}>` +
    email +
    `</ShippingOrderVO>`
  );
}

/** Gönderi yaratma (createShipment): yanıtın detail.errCode'u başarıyı belirler. */
export async function createShipment(input: YurticiCreateShipmentInput): Promise<{ barcode: string }> {
  const config = requireYurticiConfig();

  const bodyXml =
    `<${YURTICI_FIELD_WS_USER_NAME}>${escapeXml(config.username)}</${YURTICI_FIELD_WS_USER_NAME}>` +
    `<${YURTICI_FIELD_WS_PASSWORD}>${escapeXml(config.password)}</${YURTICI_FIELD_WS_PASSWORD}>` +
    `<${YURTICI_FIELD_USER_LANGUAGE}>TR</${YURTICI_FIELD_USER_LANGUAGE}>` +
    buildShipmentOrderXml(input);

  const parsed = await sendSoapRequest('createShipment', bodyXml);

  const outFlag = String(deepFind(parsed, YURTICI_FIELD_OUT_FLAG) ?? '').trim();
  const outResult = String(deepFind(parsed, YURTICI_FIELD_OUT_RESULT) ?? '').trim();
  const details = deepFindArray(parsed, YURTICI_FIELD_SHIPPING_ORDER_DETAIL);
  const detail = (details[0] ?? {}) as Record<string, unknown>;
  const errCode = String(detail[YURTICI_FIELD_ERR_CODE] ?? deepFind(parsed, YURTICI_FIELD_ERR_CODE) ?? '').trim();
  const errMessage = String(detail[YURTICI_FIELD_ERR_MESSAGE] ?? deepFind(parsed, YURTICI_FIELD_ERR_MESSAGE) ?? outResult).trim();

  if (outFlag === '2') {
    throw new AppError('Yurtici Kargo beklenmeyen bir hata bildirdi.', 502);
  }

  if (outFlag === '1' || (errCode && errCode !== '0')) {
    throw new AppError(`Yurtici Kargo gonderi kaydi olusturulamadi.${errMessage ? ` ${errMessage}` : ''}`, 502);
  }

  // Yanıt detail'i cargoKey'i yansıtır; eksikse gönderdiğimiz referans barkoddur.
  const barcode = String(detail[YURTICI_FIELD_CARGO_KEY] ?? '').trim() || input.orderReference;

  if (!barcode.trim()) {
    throw new AppError('Yurtici Kargo gonderi barkodu dondurulmedi.', 502);
  }

  return { barcode: barcode.trim() };
}

export interface YurticiShipmentEvent {
  code: string;
  description: string;
  occurredAt: string | null;
  location: string | null;
}

export interface YurticiShipmentStatusResult {
  status: CargoStatus;
  lastEvent: string | null;
  lastEventAt: string | null;
  events: YurticiShipmentEvent[];
}

function buildEvent(code: unknown, description: unknown, date: unknown, time: unknown, location: unknown): YurticiShipmentEvent {
  return {
    code: String(code ?? '').trim(),
    description: String(description ?? '').trim(),
    occurredAt: parseCompactDate(date, time),
    location: String(location ?? '').trim() || null,
  };
}

/**
 * queryShipment: keys+keyType(0=cargoKey) ile sorgular; hareket listesi
 * addHistoricalData=true ile döner. Doküman iki yanıt biçimi gösterir:
 * shippingDeliveryItemDetailVO (cargoEventId/cargoEventExplanation,
 * deliveryDate/deliveryTime) ve invDocCargoVOArray (eventId/eventName,
 * eventDate/eventTime). İkisi de desteklenir; gönderi seviyesi
 * operationStatus nihai durumu belirler.
 */
export async function queryShipment(barcode: string): Promise<YurticiShipmentStatusResult> {
  const config = requireYurticiConfig();

  const bodyXml =
    `<${YURTICI_FIELD_WS_USER_NAME}>${escapeXml(config.username)}</${YURTICI_FIELD_WS_USER_NAME}>` +
    `<${YURTICI_FIELD_WS_PASSWORD}>${escapeXml(config.password)}</${YURTICI_FIELD_WS_PASSWORD}>` +
    `<${YURTICI_FIELD_WS_LANGUAGE}>TR</${YURTICI_FIELD_WS_LANGUAGE}>` +
    `<${YURTICI_FIELD_KEYS}>${escapeXml(barcode)}</${YURTICI_FIELD_KEYS}>` +
    `<${YURTICI_FIELD_KEY_TYPE}>0</${YURTICI_FIELD_KEY_TYPE}>` +
    `<${YURTICI_FIELD_ADD_HISTORICAL_DATA}>true</${YURTICI_FIELD_ADD_HISTORICAL_DATA}>` +
    `<${YURTICI_FIELD_ONLY_TRACKING}>false</${YURTICI_FIELD_ONLY_TRACKING}>`;

  const parsed = await sendSoapRequest('queryShipment', bodyXml);

  const outFlag = String(deepFind(parsed, YURTICI_FIELD_OUT_FLAG) ?? '').trim();
  const outResult = String(deepFind(parsed, YURTICI_FIELD_OUT_RESULT) ?? '').trim();

  if (outFlag && outFlag !== '0') {
    throw new AppError(`Yurtici Kargo gonderi sorgusu basarisiz.${outResult ? ` ${outResult}` : ''}`, 502);
  }

  // Biçim 1: shippingDeliveryDetailVO → shippingDeliveryItemDetailVO[] (per olay).
  const itemEvents = deepFindArray(parsed, YURTICI_FIELD_SHIPPING_DELIVERY_ITEM_DETAIL).map((entry) => {
    const record = entry as Record<string, unknown>;
    return buildEvent(
      record.cargoEventId,
      record.cargoEventExplanation,
      record[YURTICI_FIELD_DELIVERY_DATE],
      record[YURTICI_FIELD_DELIVERY_TIME],
      record.arrivalUnitName ?? record.arrivalTrCenterName ?? record.departureUnitName,
    );
  });

  // Biçim 2: invDocCargoVOArray (eventId/eventName/eventDate/eventTime/unitName).
  const invDocEvents = deepFindArray(parsed, YURTICI_FIELD_INV_DOC_CARGO_ARRAY).map((entry) => {
    const record = entry as Record<string, unknown>;
    return buildEvent(record.eventId, record.eventName, record.eventDate, record.eventTime, record.unitName);
  });

  // Detay düğümü tek olayı kendi taşıyabilir; her iki biçimi kronolojik birleştir.
  const events = [...itemEvents, ...invDocEvents]
    .filter((event) => event.code || event.description)
    .sort((a, b) => {
      if (!a.occurredAt && !b.occurredAt) return 0;
      if (!a.occurredAt) return 1;
      if (!b.occurredAt) return -1;
      return a.occurredAt.localeCompare(b.occurredAt);
    });

  // Nihai durum: önce operationStatus (dokümanlı IND/DLV/CNL), sonra son olay.
  const operationStatus = String(deepFind(parsed, YURTICI_FIELD_OPERATION_STATUS) ?? '').trim();
  const operationMessage = String(deepFind(parsed, YURTICI_FIELD_OPERATION_MESSAGE) ?? '').trim();
  const operationMapped = mapYurticiOperationStatus(operationStatus);
  const lastEvent = events[events.length - 1];
  const status: CargoStatus =
    operationMapped && operationMapped !== 'UNKNOWN'
      ? operationMapped
      : lastEvent
        ? mapYurticiEventCode(lastEvent.code)
        : 'UNKNOWN';

  return {
    status,
    lastEvent: operationMessage || lastEvent?.description || null,
    lastEventAt: lastEvent?.occurredAt ?? null,
    events,
  };
}

/**
 * cancelShipment: gönderilen cargoKey'lerin gönderilerini iptal eder.
 * Doküman kuralı: teslim edilmiş (DLV) gönderiler iptal edilemez (yanıt
 * operationStatus/errMessage ile bunu bildirir).
 */
export async function cancelShipment(cargoKeys: string[]): Promise<{ cancelled: boolean; operationStatus: string | null; message: string | null }> {
  const config = requireYurticiConfig();

  const keysXml = cargoKeys.map((key) => `<cargoKey>${escapeXml(key)}</cargoKey>`).join('');
  const bodyXml =
    `<${YURTICI_FIELD_WS_USER_NAME}>${escapeXml(config.username)}</${YURTICI_FIELD_WS_USER_NAME}>` +
    `<${YURTICI_FIELD_WS_PASSWORD}>${escapeXml(config.password)}</${YURTICI_FIELD_WS_PASSWORD}>` +
    `<${YURTICI_FIELD_USER_LANGUAGE}>TR</${YURTICI_FIELD_USER_LANGUAGE}>` +
    `<${YURTICI_FIELD_CARGO_KEYS}>${keysXml}</${YURTICI_FIELD_CARGO_KEYS}>`;

  const parsed = await sendSoapRequest('cancelShipment', bodyXml);

  const outFlag = String(deepFind(parsed, YURTICI_FIELD_OUT_FLAG) ?? '').trim();
  const outResult = String(deepFind(parsed, YURTICI_FIELD_OUT_RESULT) ?? '').trim();
  const details = deepFindArray(parsed, 'shippingCancelDetailVO');
  const detail = (details[0] ?? {}) as Record<string, unknown>;
  const errCode = String(detail[YURTICI_FIELD_ERR_CODE] ?? '').trim();
  const errMessage = String(detail[YURTICI_FIELD_ERR_MESSAGE] ?? deepFind(parsed, YURTICI_FIELD_ERR_MESSAGE) ?? outResult).trim();

  if (outFlag === '2') {
    throw new AppError('Yurtici Kargo beklenmeyen bir hata bildirdi.', 502);
  }

  if (outFlag === '1' || (errCode && errCode !== '0')) {
    throw new AppError(`Yurtici Kargo gonderi iptal edilemedi.${errMessage ? ` ${errMessage}` : ''}`, 502);
  }

  return {
    cancelled: true,
    operationStatus: String(detail[YURTICI_FIELD_OPERATION_STATUS] ?? '').trim() || null,
    message: String(detail[YURTICI_FIELD_OPERATION_MESSAGE] ?? errMessage ?? '').trim() || null,
  };
}

export interface YurticiReturnCodeInput {
  /** İade onay kodunun kaydedildiği özel alan: canlı 16, test 53/3. */
  fieldName: string;
  /** Tarafımızca üretilen iade kodu (müşteri şubeye bunu ibraz eder). */
  returnCode: string;
  /** dd.mm.yyyy — dokümanda örnek değer yayımlanmadı; testte doğrulanır. */
  startDate: string;
  endDate: string;
  maxCount: number;
}

/**
 * saveReturnShipmentCode (RMA): müşterinin ürünü Yurtiçi Kargo şubesine
 * ücretsiz gönderebilmesi için iade onay kodu oluşturur. Yanıt
 * ExtendedBaseResultVO: outFlag=0 başarı.
 */
export async function saveReturnShipmentCode(input: YurticiReturnCodeInput): Promise<{ returnCode: string }> {
  const config = requireYurticiConfig();

  const bodyXml =
    `<${YURTICI_FIELD_WS_USER_NAME}>${escapeXml(config.username)}</${YURTICI_FIELD_WS_USER_NAME}>` +
    `<${YURTICI_FIELD_WS_PASSWORD}>${escapeXml(config.password)}</${YURTICI_FIELD_WS_PASSWORD}>` +
    `<${YURTICI_FIELD_WS_LANGUAGE}>TR</${YURTICI_FIELD_WS_LANGUAGE}>` +
    `<${YURTICI_FIELD_FIELD_NAME}>${escapeXml(input.fieldName)}</${YURTICI_FIELD_FIELD_NAME}>` +
    `<${YURTICI_FIELD_RETURN_CODE}>${escapeXml(input.returnCode)}</${YURTICI_FIELD_RETURN_CODE}>` +
    `<${YURTICI_FIELD_START_DATE}>${escapeXml(input.startDate)}</${YURTICI_FIELD_START_DATE}>` +
    `<${YURTICI_FIELD_END_DATE}>${escapeXml(input.endDate)}</${YURTICI_FIELD_END_DATE}>` +
    `<${YURTICI_FIELD_MAX_COUNT}>${escapeXml(String(input.maxCount))}</${YURTICI_FIELD_MAX_COUNT}>`;

  const parsed = await sendSoapRequest('saveReturnShipmentCode', bodyXml);

  const outFlag = String(deepFind(parsed, YURTICI_FIELD_OUT_FLAG) ?? '').trim();
  const outResult = String(deepFind(parsed, YURTICI_FIELD_OUT_RESULT) ?? '').trim();
  const errMessage = String(deepFind(parsed, YURTICI_FIELD_ERR_MESSAGE) ?? outResult).trim();

  if (outFlag && outFlag !== '0') {
    throw new AppError(`Yurtici Kargo iade kodu olusturulamadi.${errMessage ? ` ${errMessage}` : ''}`, 502);
  }

  return { returnCode: input.returnCode };
}
