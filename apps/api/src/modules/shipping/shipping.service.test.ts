import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { ShippingService } from './shipping.service.js';

vi.mock('../../lib/yurtici.js', async (importOriginal) => {
  // Refund-style transport tests below exercise the real client, which reads
  // the Yurtici config from the environment — guarantee it before the module
  // (and therefore config/env.ts) loads.
  process.env.YURTICI_KARGO_USERNAME ??= 'test-user';
  process.env.YURTICI_KARGO_PASSWORD ??= 'test-pass';
  process.env.YURTICI_KARGO_CUSTOMER_ID ??= '12345';

  const actual = await importOriginal<typeof import('../../lib/yurtici.js')>();
  return {
    ...actual,
    isYurticiConfigured: vi.fn(() => true),
    createShipment: vi.fn(async () => ({ barcode: 'YK-TEST-BARCODE' })),
    cancelShipment: vi.fn(async () => ({ cancelled: true, operationStatus: null, message: 'Kargo iptal edildi.' })),
    saveReturnShipmentCode: vi.fn(async (input: { returnCode: string }) => ({ returnCode: input.returnCode })),
    queryShipment: vi.fn(async () => ({
      status: 'OUT_FOR_DELIVERY' as const,
      lastEvent: 'Dagitima cikti',
      lastEventAt: '2026-09-02T10:00:00.000Z',
      events: [],
    })),
  };
});

const { cancelShipment, createShipment, isYurticiConfigured, mapYurticiEventCode, queryShipment, saveReturnShipmentCode } = await import('../../lib/yurtici.js');
const realYurtici = await vi.importActual<typeof import('../../lib/yurtici.js')>('../../lib/yurtici.js');

const paidOrder = {
  id: 'order-1',
  orderNumber: 'BBT-2026-0001',
  paymentStatus: 'PAID',
  shippingName: 'Musteri Test',
  shippingPhone: '05551234567',
  shippingCity: 'Istanbul',
  shippingDistrict: 'Kadikoy',
  shippingAddressLine: 'Moda Caddesi No: 1',
  cargoBarcode: null as string | null,
  cargoCompany: 'Yurtiçi Kargo',
  cargoStatus: null as string | null,
  cargoLastEvent: null,
  cargoLastSyncedAt: null,
  cargoEvents: null,
  items: [{ productName: 'DJI Mic 2', packageLabel: null }],
};

const refundFixture = {
  id: 'refundabcd1234',
  returnCode: null as string | null,
  order: paidOrder,
};

function createRefundRepository(refund: typeof refundFixture | null = refundFixture) {
  return {
    findRefundById: vi.fn(async () => refund),
    setRefundReturnCode: vi.fn(async (_id: string, data: { returnCode: string }) => ({ ...refundFixture, ...data })),
  };
}

function createRepository(order: typeof paidOrder | null = paidOrder) {
  return {
    findOrderById: vi.fn(async () => order),
    setShipment: vi.fn(async (_orderId: string, data: { cargoBarcode: string; cargoCompany: string }) => ({
      ...paidOrder,
      ...data,
    })),
    setShipmentSync: vi.fn(async (_orderId: string, data: Record<string, unknown>) => ({ ...paidOrder, ...data })),
  };
}

describe('ShippingService.createShipmentForOrder', () => {
  afterEach(() => {
    vi.mocked(isYurticiConfigured).mockReturnValue(true);
    // Vitest 3: mockReset restores the implementation handed to vi.fn above.
    vi.mocked(createShipment).mockReset();
  });

  it('creates a shipment for a paid order and persists the barcode', async () => {
    const repository = createRepository();
    const service = new ShippingService(repository as any);

    const result = await service.createShipmentForOrder('order-1');

    expect(createShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderReference: 'BBT-2026-0001',
        receiverName: 'Musteri Test',
        receiverCity: 'Istanbul',
        receiverDistrict: 'Kadikoy',
        pieceCount: 1,
      }),
    );
    expect(repository.setShipment).toHaveBeenCalledWith('order-1', {
      cargoBarcode: 'YK-TEST-BARCODE',
      cargoCompany: 'Yurtiçi Kargo',
    });
    expect(result).toMatchObject({
      orderId: 'order-1',
      orderNumber: 'BBT-2026-0001',
      cargoBarcode: 'YK-TEST-BARCODE',
      cargoCompany: 'Yurtiçi Kargo',
    });
  });

  it('rejects unpaid orders with 409 before calling the vendor', async () => {
    const repository = createRepository({ ...paidOrder, paymentStatus: 'PENDING' });
    const service = new ShippingService(repository as any);

    await expect(service.createShipmentForOrder('order-1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Odemesi tamamlanmamis siparis icin kargo kaydi olusturulamaz.',
    });
    expect(createShipment).not.toHaveBeenCalled();
    expect(repository.setShipment).not.toHaveBeenCalled();
  });

  it('rejects duplicate shipment records with 409', async () => {
    const repository = createRepository({ ...paidOrder, cargoBarcode: 'EXISTING' });
    const service = new ShippingService(repository as any);

    await expect(service.createShipmentForOrder('order-1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Bu siparis icin zaten kargo kaydi olusturulmus.',
    });
    expect(createShipment).not.toHaveBeenCalled();
    expect(repository.setShipment).not.toHaveBeenCalled();
  });

  it('answers 503 with a clear message while integration credentials are missing', async () => {
    vi.mocked(isYurticiConfigured).mockReturnValue(false);
    const repository = createRepository();
    const service = new ShippingService(repository as any);

    await expect(service.createShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 503 });
    expect(repository.findOrderById).not.toHaveBeenCalled();
  });

  it('returns 502 and persists nothing when the vendor client fails', async () => {
    vi.mocked(createShipment).mockRejectedValue(new AppError('Yurtici Kargo servisine ulasilamadi.', 502));
    const repository = createRepository();
    const service = new ShippingService(repository as any);

    await expect(service.createShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 502 });
    expect(repository.setShipment).not.toHaveBeenCalled();
  });

  it('wraps unexpected vendor client errors into a 502 without persisting', async () => {
    vi.mocked(createShipment).mockRejectedValue(new Error('socket hang up'));
    const repository = createRepository();
    const service = new ShippingService(repository as any);

    await expect(service.createShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 502 });
    expect(repository.setShipment).not.toHaveBeenCalled();
  });
});

describe('ShippingService.syncShipmentForOrder', () => {
  afterEach(() => {
    vi.mocked(isYurticiConfigured).mockReturnValue(true);
    vi.mocked(queryShipment).mockReset();
  });

  it('returns 400 when the order has no cargo record yet', async () => {
    const repository = createRepository();
    const service = new ShippingService(repository as any);

    await expect(service.syncShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(queryShipment).not.toHaveBeenCalled();
  });

  it('syncs status, last event and bounded events from the vendor', async () => {
    const events = Array.from({ length: 25 }, (_, index) => ({
      code: '11',
      description: `Hareket ${index}`,
      occurredAt: `2026-09-0${(index % 8) + 1}T10:00:00.000Z`,
      location: 'Istanbul',
    }));
    vi.mocked(queryShipment).mockResolvedValue({
      status: 'OUT_FOR_DELIVERY',
      lastEvent: 'Dagitima cikti',
      lastEventAt: '2026-09-02T10:00:00.000Z',
      events,
    });

    const repository = createRepository({ ...paidOrder, cargoBarcode: 'YK-TEST-BARCODE' });
    const service = new ShippingService(repository as any);

    const result = await service.syncShipmentForOrder('order-1');

    expect(queryShipment).toHaveBeenCalledWith('YK-TEST-BARCODE');
    expect(repository.setShipmentSync).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        cargoStatus: 'OUT_FOR_DELIVERY',
        cargoLastEvent: 'Dagitima cikti',
      }),
    );
    // Json alani sinirsiz buyumesin: son 20 hareket saklanir.
    const persistedEvents = (repository.setShipmentSync as Mock).mock.calls[0][1].cargoEvents as unknown[];
    expect(persistedEvents).toHaveLength(20);
    expect(result.cargoStatus).toBe('OUT_FOR_DELIVERY');
    expect(result.cargoLastSyncedAt).toBeTruthy();
  });

  it('persists UNKNOWN gracefully when the vendor reports an unmapped code', async () => {
    vi.mocked(queryShipment).mockResolvedValue({
      status: 'UNKNOWN',
      lastEvent: 'Bilinmeyen hareket aciklamasi',
      lastEventAt: '2026-09-02T10:00:00.000Z',
      events: [{ code: '7777', description: 'Bilinmeyen hareket aciklamasi', occurredAt: '2026-09-02T10:00:00.000Z', location: null }],
    });

    const repository = createRepository({ ...paidOrder, cargoBarcode: 'YK-TEST-BARCODE' });
    const service = new ShippingService(repository as any);

    const result = await service.syncShipmentForOrder('order-1');

    expect(repository.setShipmentSync).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ cargoStatus: 'UNKNOWN', cargoLastEvent: 'Bilinmeyen hareket aciklamasi' }),
    );
    expect(result.cargoStatus).toBe('UNKNOWN');
  });
});

describe('Yurtici event code mapping', () => {
  it('maps codes documented in the official samples (IN/DLV) to normalized statuses', () => {
    expect(mapYurticiEventCode('IN')).toBe('IN_TRANSIT');
    expect(mapYurticiEventCode('DLV')).toBe('DELIVERED');
    expect(mapYurticiEventCode('in')).toBe('IN_TRANSIT');
  });

  it('maps unknown codes to UNKNOWN', () => {
    expect(mapYurticiEventCode('9999')).toBe('UNKNOWN');
    expect(mapYurticiEventCode('')).toBe('UNKNOWN');
  });
});

describe('Yurtici SOAP client (real transport, stubbed fetch)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a shipment with the documented envelope and returns the barcode', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      // Doküman: hedef namespace ship önekiyle, dil alanı createShipment'ta userLanguage.
      expect(body).toContain('xmlns:ship="http://yurticikargo.com.tr/ShippingOrderDispatcherServices"');
      expect(body).toContain('<ship:createShipment>');
      expect(body).toContain('<userLanguage>TR</userLanguage>');
      // Doküman: invoiceKey gönderi başına TEKİL; cargoKey=invoiceKey=sipariş no.
      expect(body).toContain('<cargoKey>BBT-2026-0001</cargoKey>');
      expect(body).toContain('<invoiceKey>BBT-2026-0001</invoiceKey>');
      // Telefon alanı receiverPhone1; 10 hane normalizasyonu servis katmanında
      // (normalizeReceiverPhone) yapılır, istemci aldığını iletir.
      expect(body).toContain('<receiverPhone1>05551234567</receiverPhone1>');
      expect(body).toContain('<emailAddress>test@example.com</emailAddress>');
      expect(body).toContain('&lt;Test&gt;'); // XML escaping of receiver input
      // Kullanıcı adı env'den gelir (gerçek .env değerleri de olabilir).
      expect(body).toContain(String(process.env.YURTICI_KARGO_USERNAME));
      return new Response(
        `<?xml version="1.0" encoding="utf-8"?>` +
          `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
          `<soap:Body><createShipmentResponse><ShippingOrderResultVO><outFlag>0</outFlag>` +
          `<outResult>Başarılı.</outResult>` +
          `<shippingOrderDetailVO><cargoKey>BBT-2026-0001</cargoKey><invoiceKey>BBT-2026-0001</invoiceKey><errCode>0</errCode></shippingOrderDetailVO>` +
          `</ShippingOrderResultVO></createShipmentResponse></soap:Body></soap:Envelope>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await realYurtici.createShipment({
      orderReference: 'BBT-2026-0001',
      receiverName: 'Musteri <Test>',
      receiverPhone: '05551234567',
      receiverCity: 'Istanbul',
      receiverDistrict: 'Kadikoy',
      receiverAddress: 'Moda Caddesi No: 1',
      description: 'DJI Mic 2',
      emailAddress: 'test@example.com',
      pieceCount: 1,
    });

    expect(result).toEqual({ barcode: 'BBT-2026-0001' });
  });

  it('wraps vendor business errors into a 502 AppError with the vendor message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          `<?xml version="1.0" encoding="utf-8"?>` +
            `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
            `<soap:Body><createShipmentResponse><ShippingOrderResultVO><outFlag>1</outFlag>` +
            `<outResult>Hata olustu.</outResult>` +
            `<shippingOrderDetailVO><cargoKey>BBT-2026-0001</cargoKey><errCode>99</errCode><errMessage>Kullanici bulunamadi</errMessage></shippingOrderDetailVO>` +
            `</ShippingOrderResultVO></createShipmentResponse></soap:Body></soap:Envelope>`,
          { status: 200, headers: { 'Content-Type': 'text/xml' } },
        ),
      ),
    );

    await expect(
      realYurtici.createShipment({
        orderReference: 'BBT-2026-0001',
        receiverName: 'Musteri Test',
        receiverPhone: '05551234567',
        receiverCity: 'Istanbul',
        receiverDistrict: 'Kadikoy',
        receiverAddress: 'Moda Caddesi No: 1',
        description: 'DJI Mic 2',
        pieceCount: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 502, message: expect.stringContaining('Kullanici bulunamadi') });
  });

  it('sends the documented query input and normalizes both response shapes', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      // Doküman: queryShipment wsLanguage + keys/keyType(0=cargoKey) +
      // addHistoricalData=true (hareket listesi bununla döner) kullanır.
      expect(body).toContain('<wsLanguage>TR</wsLanguage>');
      expect(body).toContain('<keys>BBT-2026-0001</keys>');
      expect(body).toContain('<keyType>0</keyType>');
      expect(body).toContain('<addHistoricalData>true</addHistoricalData>');
      expect(body).toContain('<onlyTracking>false</onlyTracking>');
      return new Response(
        `<?xml version="1.0" encoding="utf-8"?>` +
          `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
          `<soap:Body><queryShipmentResponse><ShippingDeliveryVO>` +
          `<outFlag>0</outFlag><outResult>Başarılı.</outResult><count>1</count>` +
          `<shippingDeliveryDetailVO>` +
          `<cargoKey>BBT-2026-0001</cargoKey><operationCode>5</operationCode>` +
          `<operationMessage>Kargo teslim edilmiştir.</operationMessage><operationStatus>DLV</operationStatus>` +
          `<shippingDeliveryItemDetailVO><cargoEventId>IN</cargoEventId><cargoEventExplanation>Kargo İndirildi</cargoEventExplanation><arrivalUnitName>AFYON</arrivalUnitName><deliveryDate>20260902</deliveryDate><deliveryTime>100000</deliveryTime></shippingDeliveryItemDetailVO>` +
          `<shippingDeliveryItemDetailVO><cargoEventId>DLV</cargoEventId><cargoEventExplanation>Teslim edildi</cargoEventExplanation><deliveryUnitName>Kadikoy</deliveryUnitName><deliveryDate>20260903</deliveryDate><deliveryTime>123000</deliveryTime></shippingDeliveryItemDetailVO>` +
          `</shippingDeliveryDetailVO>` +
          `</ShippingDeliveryVO></queryShipmentResponse></soap:Body></soap:Envelope>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await realYurtici.queryShipment('BBT-2026-0001');

    // Nihai durum operationStatus'tan (DLV=Teslim edildi, doküman tablosu).
    expect(result.status).toBe('DELIVERED');
    expect(result.lastEvent).toBe('Kargo teslim edilmiştir.');
    // Kompakt YK tarihleri (YYYYMMDD + HHMMSS) ISO'ya çevrilir.
    expect(result.lastEventAt).toBe('2026-09-03T12:30:00.000Z');
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toEqual({
      code: 'IN',
      description: 'Kargo İndirildi',
      occurredAt: '2026-09-02T10:00:00.000Z',
      location: 'AFYON',
    });
  });

  it('falls back to UNKNOWN for an unmapped vendor code while keeping the raw description', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          `<?xml version="1.0" encoding="utf-8"?>` +
            `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
            `<soap:Body><queryShipmentResponse>` +
            `<invDocCargoVOArray><eventId>7777</eventId><eventName>Ozel hareket</eventName><eventDate>02.09.2026</eventDate><eventTime>08:15:00</eventTime><unitName>Sirkeci</unitName></invDocCargoVOArray>` +
            `</queryShipmentResponse></soap:Body></soap:Envelope>`,
          { status: 200, headers: { 'Content-Type': 'text/xml' } },
        ),
      ),
    );

    const result = await realYurtici.queryShipment('BBT-2026-0001');

    expect(result.status).toBe('UNKNOWN');
    expect(result.lastEvent).toBe('Ozel hareket');
    expect(result.lastEventAt).toBe('2026-09-02T08:15:00.000Z');
    expect(result.events[0].location).toBe('Sirkeci');
  });
});

describe('ShippingService.cancelShipmentForOrder', () => {
  afterEach(() => {
    vi.mocked(isYurticiConfigured).mockReturnValue(true);
    vi.mocked(cancelShipment).mockReset();
  });

  it('marks the order CANCELLED after a successful vendor cancel', async () => {
    const repository = createRepository({ ...paidOrder, cargoBarcode: 'YK-TEST-BARCODE' });
    const service = new ShippingService(repository as any);

    const result = await service.cancelShipmentForOrder('order-1');

    expect(cancelShipment).toHaveBeenCalledWith(['YK-TEST-BARCODE']);
    expect(repository.setShipmentSync).toHaveBeenCalledWith('order-1', expect.objectContaining({ cargoStatus: 'CANCELLED' }));
    expect(result.cargoStatus).toBe('CANCELLED');
  });

  it('rejects delivered shipments with 409 before calling the vendor', async () => {
    const repository = createRepository({ ...paidOrder, cargoBarcode: 'YK-TEST-BARCODE', cargoStatus: 'DELIVERED' });
    const service = new ShippingService(repository as any);

    await expect(service.cancelShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(cancelShipment).not.toHaveBeenCalled();
  });

  it('rejects when the vendor reports the shipment as delivered', async () => {
    const repository = createRepository({ ...paidOrder, cargoBarcode: 'YK-TEST-BARCODE' });
    const service = new ShippingService(repository as any);
    vi.mocked(cancelShipment).mockResolvedValueOnce({ cancelled: false, operationStatus: 'DLV', message: 'Teslim edilmis.' });

    await expect(service.cancelShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.setShipmentSync).not.toHaveBeenCalled();
  });

  it('returns 400 when no shipment exists and 409 for an already cancelled one', async () => {
    const service = new ShippingService(createRepository() as any);
    await expect(service.cancelShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 400 });

    const cancelledRepo = createRepository({ ...paidOrder, cargoBarcode: 'YK-TEST-BARCODE', cargoStatus: 'CANCELLED' });
    await expect(new ShippingService(cancelledRepo as any).cancelShipmentForOrder('order-1')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('ShippingService.createReturnCodeForRefund', () => {
  afterEach(() => {
    vi.mocked(saveReturnShipmentCode).mockReset();
  });

  it('generates an IAD code, sends it to the vendor and persists it', async () => {
    const repository = createRefundRepository();
    const service = new ShippingService(repository as any);

    const result = await service.createReturnCodeForRefund('refundabcd1234');

    expect(result.returnCode).toBe('IAD-ABCD1234');
    expect(saveReturnShipmentCode).toHaveBeenCalledWith(
      expect.objectContaining({ returnCode: 'IAD-ABCD1234', maxCount: 1 }),
    );
    expect(repository.setRefundReturnCode).toHaveBeenCalledWith('refundabcd1234', expect.objectContaining({ returnCode: 'IAD-ABCD1234' }));
    expect(result.validUntil).toBeTruthy();
  });

  it('rejects duplicate return codes with 409 and missing refunds with 404', async () => {
    const duplicateRepo = createRefundRepository({ ...refundFixture, returnCode: 'IAD-ABCD1234' });
    await expect(new ShippingService(duplicateRepo as any).createReturnCodeForRefund('refundabcd1234')).rejects.toMatchObject({ statusCode: 409 });
    expect(duplicateRepo.setRefundReturnCode).not.toHaveBeenCalled();

    const service = new ShippingService(createRefundRepository(null) as any);
    await expect(service.createReturnCodeForRefund('refundabcd1234')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('normalizeReceiverPhone (doküman: 10 hane + alan kodu)', () => {
  it('normalizes +90 and leading zero formats', async () => {
    const { normalizeReceiverPhone } = await import('./shipping.service.js');
    expect(normalizeReceiverPhone('+90 212 555 00 00')).toBe('2125550000');
    expect(normalizeReceiverPhone('02125550000')).toBe('2125550000');
    expect(normalizeReceiverPhone('2125550000')).toBe('2125550000');
  });

  it('rejects short or garbage phones with 409', async () => {
    const { normalizeReceiverPhone } = await import('./shipping.service.js');
    expect(() => normalizeReceiverPhone('5550000')).toThrow();
    expect(() => normalizeReceiverPhone('abc')).toThrow();
  });
});
