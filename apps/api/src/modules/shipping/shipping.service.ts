import type { CargoEvent, CargoStatus, ShipmentInfo, ShipmentReturnCode } from '@bora/types';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { cancelShipment, createShipment, isYurticiConfigured, queryShipment, saveReturnShipmentCode } from '../../lib/yurtici.js';
import { ShippingRepository } from './shipping.repository.js';

const orderIdSchema = z.string().trim().min(1, 'Siparis kimligi zorunludur.');
const refundIdSchema = z.string().trim().min(1, 'Iade kaydi kimligi zorunludur.');

/** Gonderi kaydinda tutulacak en fazla hareket kaydi; Json alani sinirsiz buyumesin. */
const MAX_CARGO_EVENTS = 20;

/** Tek parca gonderi varsayimi; parcali sevkiyat ihtiyacinda burasi genisletilir. */
const SHIPMENT_PIECE_COUNT = 1;

/** Satici tarafindan faturalanacak gonderi aciklamasi icin savunmaci uzunluk siniri. */
const MAX_DESCRIPTION_LENGTH = 200;

/** Dokuman: receiverAddress min 5 / max 200 karakter. */
const MAX_ADDRESS_LENGTH = 200;

/** Dokuman: receiverPhone1 alan kodu dahil 10 hane rakamdir. */
const RECEIVER_PHONE_LENGTH = 10;

/** Iade kargo kodu gecerlilik suresi (gun). */
const RETURN_CODE_VALIDITY_DAYS = 30;

const CARGO_COMPANY = 'Yurtiçi Kargo';

interface CargoOrderItem {
  productName: string;
  packageLabel?: string | null;
}

/** Siparis kaydindan kargo akisi icin kullanilan minimum alan kumesi. */
interface CargoOrder {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  customerEmail?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingAddressLine: string;
  cargoBarcode?: string | null;
  cargoCompany?: string | null;
  cargoStatus?: string | null;
  cargoLastEvent?: string | null;
  cargoLastSyncedAt?: Date | null;
  cargoEvents?: unknown;
  items: CargoOrderItem[];
}

interface CargoRefund {
  id: string;
  returnCode?: string | null;
  order: CargoOrder;
}

function readCargoEvents(value: unknown): CargoEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((event): event is CargoEvent => Boolean(event) && typeof event === 'object' && 'code' in event);
}

/**
 * Dokuman kurali: receiverPhone1 alan kodu dahil 10 hane rakamdir
 * (ERR_INTG_RECEIVER_PHONE_INVALID_PARAMETER). "+90", "0" ve ayraclar
 * temizlenir; 10 hane cikmazsa gonderi reddedilir.
 */
export function normalizeReceiverPhone(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== RECEIVER_PHONE_LENGTH) {
    throw new AppError(
      'Alici telefonu alan kodu dahil 10 haneli olmalidir; kargo kaydi olusturulamadi.',
      409,
    );
  }

  return digits;
}

function toTrDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

export class ShippingService {
  constructor(private readonly repository = new ShippingRepository()) {}

  /**
   * Odemesi tamamlanmis siparis icin Yurtiçi Kargo gonderi kaydi olusturur.
   * Siparis durumu burada degistirilmez; sevkiyat adimlarini admin elle yonetir.
   * Barkod alinamazsa veritabanina HICBIR sey yazilmaz.
   */
  async createShipmentForOrder(rawOrderId: unknown): Promise<ShipmentInfo> {
    const orderId = orderIdSchema.parse(rawOrderId);

    if (!isYurticiConfigured()) {
      throw new AppError('Kargo entegrasyonu su anda kullanim disi. Entegrasyon kimlik bilgileri tanimlanmadi.', 503);
    }

    const order = (await this.repository.findOrderById(orderId)) as CargoOrder | null;

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    // Admin kurali: para kasaya girmeden fulfilment baslamaz (admin.service ile ayni kural).
    if (order.paymentStatus !== 'PAID') {
      throw new AppError('Odemesi tamamlanmamis siparis icin kargo kaydi olusturulamaz.', 409);
    }

    if (order.cargoBarcode) {
      throw new AppError('Bu siparis icin zaten kargo kaydi olusturulmus.', 409);
    }

    if (!order.shippingName || !order.shippingPhone || !order.shippingCity || !order.shippingDistrict || !order.shippingAddressLine) {
      throw new AppError('Siparisin teslimat bilgileri eksik oldugu icin kargo kaydi olusturulamadi.', 409);
    }

    // Dokuman: receiverCustName min 5 karakter ve en az 4 harf icermeli.
    if (order.shippingName.trim().length < 5) {
      throw new AppError('Alici adi en az 5 karakter olmalidir; kargo kaydi olusturulamadi.', 409);
    }

    const receiverPhone = normalizeReceiverPhone(order.shippingPhone);

    const description = order.items
      .map((item) => (item.packageLabel ? `${item.productName} (${item.packageLabel})` : item.productName))
      .join(', ')
      .slice(0, MAX_DESCRIPTION_LENGTH);

    let result: { barcode: string };
    try {
      result = await createShipment({
        orderReference: order.orderNumber,
        receiverName: order.shippingName.trim(),
        receiverPhone,
        receiverCity: order.shippingCity.trim().slice(0, 40),
        receiverDistrict: order.shippingDistrict.trim().slice(0, 40),
        receiverAddress: order.shippingAddressLine.trim().slice(0, MAX_ADDRESS_LENGTH),
        description: description || 'Bora Bilgic Teknik urunleri',
        emailAddress: order.customerEmail,
        pieceCount: SHIPMENT_PIECE_COUNT,
      });
    } catch (error) {
      throw error instanceof AppError ? error : new AppError('Kargo kaydi olusturulamadi.', 502);
    }

    const updated = (await this.repository.setShipment(order.id, {
      cargoBarcode: result.barcode,
      cargoCompany: CARGO_COMPANY,
    })) as CargoOrder;

    return this.toShipmentInfo(updated);
  }

  /**
   * Mevcut kargo kaydini Yurtiçi Kargo'dan yeniden sorgular ve saklar.
   * Durum önce operationStatus'tan (DLV/IND/CNL) okunur; hareket listesi
   * addHistoricalData=true ile gelen iki yanıt biçiminden birleştirilir.
   */
  async syncShipmentForOrder(rawOrderId: unknown): Promise<ShipmentInfo> {
    const orderId = orderIdSchema.parse(rawOrderId);

    if (!isYurticiConfigured()) {
      throw new AppError('Kargo entegrasyonu su anda kullanim disi. Entegrasyon kimlik bilgileri tanimlanmadi.', 503);
    }

    const order = (await this.repository.findOrderById(orderId)) as CargoOrder | null;

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    if (!order.cargoBarcode) {
      throw new AppError('Bu siparis icin kargo kaydi bulunmuyor; once kargo kaydi olusturun.', 400);
    }

    let result: Awaited<ReturnType<typeof queryShipment>>;
    try {
      result = await queryShipment(order.cargoBarcode);
    } catch (error) {
      throw error instanceof AppError ? error : new AppError('Kargo durumu guncellenemedi.', 502);
    }

    const updated = (await this.repository.setShipmentSync(order.id, {
      cargoStatus: result.status,
      cargoLastEvent: result.lastEvent,
      cargoLastSyncedAt: new Date(),
      cargoEvents: result.events.slice(-MAX_CARGO_EVENTS) as unknown as Prisma.InputJsonValue,
    })) as CargoOrder;

    return this.toShipmentInfo(updated);
  }

  /**
   * Kargo kaydini Yurtiçi Kargo tarafinda iptal eder (cancelShipment). Teslim
   * edilmiş (DLV) gönderiler doküman gereği iptal edilemez; kayıt silinmez,
   * CANCELLED olarak işaretlenir.
   */
  async cancelShipmentForOrder(rawOrderId: unknown): Promise<ShipmentInfo> {
    const orderId = orderIdSchema.parse(rawOrderId);

    if (!isYurticiConfigured()) {
      throw new AppError('Kargo entegrasyonu su anda kullanim disi. Entegrasyon kimlik bilgileri tanimlanmadi.', 503);
    }

    const order = (await this.repository.findOrderById(orderId)) as CargoOrder | null;

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    if (!order.cargoBarcode) {
      throw new AppError('Bu siparis icin kargo kaydi bulunmuyor.', 400);
    }

    if (order.cargoStatus === 'DELIVERED') {
      throw new AppError('Teslim edilmis gonderi iptal edilemez.', 409);
    }

    if (order.cargoStatus === 'CANCELLED') {
      throw new AppError('Bu kargo kaydi daha once iptal edilmis.', 409);
    }

    let result: Awaited<ReturnType<typeof cancelShipment>>;
    try {
      result = await cancelShipment([order.cargoBarcode]);
    } catch (error) {
      throw error instanceof AppError ? error : new AppError('Kargo kaydi iptal edilemedi.', 502);
    }

    if (result.operationStatus === 'DLV') {
      throw new AppError('Teslim edilmis gonderi iptal edilemez.', 409);
    }

    const updated = (await this.repository.setShipmentSync(order.id, {
      cargoStatus: 'CANCELLED',
      cargoLastEvent: result.message ?? 'Kargo kaydi iptal edildi.',
      cargoLastSyncedAt: new Date(),
      cargoEvents: (readCargoEvents(order.cargoEvents) as unknown as Prisma.InputJsonValue[]).concat([
        {
          code: 'CNL',
          description: result.message ?? 'Kargo kaydi iptal edildi.',
          occurredAt: new Date().toISOString(),
          location: null,
        },
      ]) as unknown as Prisma.InputJsonValue,
    })) as CargoOrder;

    return this.toShipmentInfo(updated);
  }

  /**
   * RMA (saveReturnShipmentCode): iade kaydı için müşterinin Yurtiçi Kargo
   * şubesine ibraz edeceği iade onay kodunu üretir ve Refund'a işler.
   */
  async createReturnCodeForRefund(rawRefundId: unknown): Promise<ShipmentReturnCode> {
    const refundId = refundIdSchema.parse(rawRefundId);

    if (!isYurticiConfigured()) {
      throw new AppError('Kargo entegrasyonu su anda kullanim disi. Entegrasyon kimlik bilgileri tanimlanmadi.', 503);
    }

    const refund = (await this.repository.findRefundById(refundId)) as CargoRefund | null;

    if (!refund) {
      throw new AppError('Iade kaydi bulunamadi.', 404);
    }

    if (refund.returnCode) {
      throw new AppError('Bu iade icin zaten kargo iade kodu olusturulmus.', 409);
    }

    // Kod tarafimizca üretilir (doküman: "returnCode sizlerin belirleyeceği bir
    // değer"); iade kimliğinden türetilir, tekrar üretimde aynı kalır.
    const returnCode = `IAD-${refund.id.slice(-8).toUpperCase()}`;
    const validUntil = new Date(Date.now() + RETURN_CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    try {
      await saveReturnShipmentCode({
        fieldName: env.YURTICI_KARGO_RETURN_FIELD_ID,
        returnCode,
        startDate: toTrDate(new Date()),
        endDate: toTrDate(validUntil),
        maxCount: 1,
      });
    } catch (error) {
      throw error instanceof AppError ? error : new AppError('Iade kargo kodu olusturulamadi.', 502);
    }

    await this.repository.setRefundReturnCode(refund.id, {
      returnCode,
      returnCodeValidUntil: validUntil,
    });

    return {
      refundId: refund.id,
      returnCode,
      validUntil: validUntil.toISOString(),
    };
  }

  private toShipmentInfo(order: CargoOrder): ShipmentInfo {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      cargoCompany: order.cargoCompany ?? null,
      cargoBarcode: order.cargoBarcode ?? null,
      cargoStatus: (order.cargoStatus as CargoStatus | null) ?? null,
      cargoLastEvent: order.cargoLastEvent ?? null,
      cargoLastSyncedAt: order.cargoLastSyncedAt ? new Date(order.cargoLastSyncedAt).toISOString() : null,
      cargoEvents: readCargoEvents(order.cargoEvents),
    };
  }
}
