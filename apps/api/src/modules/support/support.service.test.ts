import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/mail/transport.js', () => ({
  isMailConfigured: vi.fn(() => true),
  sendMail: vi.fn(async () => undefined),
}));

vi.mock('../../config/env.js', async (importOriginal) => {
  // Shipping testiyle ayni desen: env.js degerlendirilmeden once zorunlu
  // env degerleri garanti edilir (CI'da .env yoktur).
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/bora_test?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-16-chars';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-16-chars';
  process.env.BILLING_ENCRYPTION_KEY ??= 'dGVzdC1iaWxsaW5nLWtleS0zMi1ieXRlcy0wMTIzNDU2Nzg=';

  const actual = await importOriginal<typeof import('../../config/env.js')>();
  return {
    ...actual,
    env: { ...actual.env, ADMIN_EMAIL: 'yonetim@example.com', WEB_URL: 'https://borabilgic.net.tr' },
  };
});

const repository = {
  createTicket: vi.fn(async (data: Record<string, unknown>) => ({
    id: 'ticket-1',
    createdAt: new Date('2026-09-25T10:00:00.000Z'),
    updatedAt: new Date('2026-09-25T10:00:00.000Z'),
    status: 'OPEN',
    adminReply: null,
    repliedAt: null,
    ...data,
  })),
  findTicketByTokenHash: vi.fn(async (_token: string): Promise<any> => null),
  listTicketsForUser: vi.fn(async (_userId: string): Promise<any[]> => []),
  updateTicket: vi.fn(async (_id: string, data: Record<string, unknown>) => ({
    id: 'ticket-1',
    ticketNumber: 'DSK-TEST01',
    name: 'Musteri Test',
    email: 'musteri@example.com',
    orderNumber: null,
    subject: 'Kargo gecikti',
    category: 'kargo',
    message: 'Kargom henuz ulasmadi.',
    status: 'IN_PROGRESS',
    trackingTokenEncrypted: 'enc',
    adminReply: null,
    repliedAt: null,
    createdAt: new Date('2026-09-25T10:00:00.000Z'),
    updatedAt: new Date('2026-09-25T10:00:00.000Z'),
    ...data,
  })),
  findTicketById: vi.fn(async (_id: string): Promise<any> => null),
};

const { sendMail } = await import('../../lib/mail/transport.js');
const { hashTrackingToken } = await import('../../lib/crypto.js');
const { SupportService } = await import('./support.service.js');

const validPayload = {
  name: 'Musteri Test',
  email: 'musteri@example.com',
  subject: 'Kargo gecikti',
  category: 'kargo',
  message: 'Kargom henuz ulasmadi, yardimci olabilir misiniz?',
};

describe('SupportService.createTicket', () => {
  let service: InstanceType<typeof SupportService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupportService(repository as never);
  });

  it('talebi kaydeder, token uretir ve iki mail (musteri + admin) gonderir', async () => {
    const result = await service.createTicket(undefined, validPayload);

    expect(result.ticketNumber).toMatch(/^DSK-/);
    expect(result.trackingToken).toBeTruthy();
    expect(result.trackingUrl).toContain('/destek-takip/');
    expect(repository.createTicket).toHaveBeenCalledTimes(1);

    const created = repository.createTicket.mock.calls[0][0];
    expect(created.trackingTokenHash).toBe(hashTrackingToken(result.trackingToken));
    expect(created.requestedByUserId).toBeNull();

    // Musteri onayi + admin bildirimi
    expect(sendMail).toHaveBeenCalledTimes(2);
    const adminCall = (sendMail as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(adminCall.to).toBe('yonetim@example.com');
    expect(adminCall.subject).toContain(result.ticketNumber);
  });

  it('girisli kullanici talebini hesaba baglar', async () => {
    await service.createTicket('user-9', validPayload);

    const created = repository.createTicket.mock.calls[0][0];
    expect(created.requestedByUserId).toBe('user-9');
  });

  it('eksik/bozuk gorevde 400 doner', async () => {
    await expect(service.createTicket(undefined, { ...validPayload, message: 'kisa' })).rejects.toThrow();
  });
});

describe('SupportService.getTicketByToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bilinmeyen token icin 404 doner', async () => {
    const service = new SupportService(repository as never);
    await expect(service.getTicketByToken('wrong-token')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('eslesen token ile talebi dondurur', async () => {
    const service = new SupportService(repository as never);
    const realToken = 'real-token-value';
    repository.findTicketByTokenHash.mockResolvedValueOnce({
      id: 'ticket-1',
      ticketNumber: 'DSK-TEST01',
      name: 'Musteri Test',
      email: 'musteri@example.com',
      orderNumber: null,
      subject: 'Kargo gecikti',
      category: 'kargo',
      message: 'Mesaj',
      status: 'OPEN',
      trackingTokenEncrypted: 'enc',
      adminReply: null,
      repliedAt: null,
      createdAt: new Date('2026-09-25T10:00:00.000Z'),
      updatedAt: new Date('2026-09-25T10:00:00.000Z'),
    });

    const result = await service.getTicketByToken(realToken);

    expect(repository.findTicketByTokenHash).toHaveBeenCalledWith(hashTrackingToken(realToken));
    expect(result.ticketNumber).toBe('DSK-TEST01');
  });
});

describe('SupportService.adminUpdateTicket', () => {
  let service: InstanceType<typeof SupportService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupportService(repository as never);
  });

  it('yanit yazilir, repliedAt set edilir ve musteriye mail gider', async () => {
    const { encryptBillingIdentity } = await import('../../lib/crypto.js');
    repository.findTicketById.mockResolvedValueOnce({
      id: 'ticket-1',
      ticketNumber: 'DSK-TEST01',
      name: 'Musteri Test',
      email: 'musteri@example.com',
      subject: 'Kargo gecikti',
      category: 'kargo',
      message: 'Mesaj',
      status: 'OPEN',
      trackingTokenEncrypted: encryptBillingIdentity('gercek-test-token'),
      adminReply: null,
      repliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.adminUpdateTicket('ticket-1', {
      status: 'IN_PROGRESS',
      reply: 'Kargonuz yolda, özür dileriz.',
    });

    expect(result.status).toBe('in_progress');
    const updateData = repository.updateTicket.mock.calls[0][1];
    expect(updateData.adminReply).toBe('Kargonuz yolda, özür dileriz.');
    expect(updateData.repliedAt).toBeInstanceOf(Date);

    const mailCall = (sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(mailCall.to).toBe('musteri@example.com');
    expect(mailCall.subject).toContain('DSK-TEST01');
  });

  it('olmayan talep icin 404 doner', async () => {
    repository.findTicketById.mockResolvedValueOnce(null);
    await expect(service.adminUpdateTicket('missing', { status: 'CLOSED' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('bos guncellemede 400 doner', async () => {
    repository.findTicketById.mockResolvedValueOnce({
      id: 'ticket-1',
      status: 'OPEN',
      trackingTokenEncrypted: 'enc',
    });
    await expect(service.adminUpdateTicket('ticket-1', {})).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('SupportService.listTicketsForUser', () => {
  it('yalnizca kendi taleplerini dondurur', async () => {
    const service = new SupportService(repository as never);
    repository.listTicketsForUser.mockResolvedValueOnce([
      { id: 't1', ticketNumber: 'DSK-1', name: 'a', email: 'a@x.com', orderNumber: null, subject: 's', category: 'diger', message: 'm', status: 'OPEN', adminReply: null, repliedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const result = await service.listTicketsForUser('user-9');

    expect(repository.listTicketsForUser).toHaveBeenCalledWith('user-9');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('open');
  });
});
