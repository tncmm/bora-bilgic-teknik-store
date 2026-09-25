import type { SupportTicket } from '@bora/types';
import type { TicketStatus as PrismaTicketStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { decryptBillingIdentity, encryptBillingIdentity, hashTrackingToken } from '../../lib/crypto.js';
import { supportTicketAdminNotificationEmail, supportTicketReceivedEmail, supportTicketReplyEmail } from '../../lib/mail/templates.js';
import { sendMail } from '../../lib/mail/transport.js';
import { SupportRepository } from './support.repository.js';

const SUPPORT_CATEGORIES = ['siparis', 'kargo', 'teknik', 'fatura', 'diger'] as const;

const createTicketSchema = z.object({
  name: z.string().trim().min(2, 'Ad Soyad en az 2 karakter olmalidir.').max(80),
  email: z.string().trim().email('Gecerli bir e-posta adresi girin.'),
  orderNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : undefined)),
  subject: z.string().trim().min(3, 'Konu en az 3 karakter olmalidir.').max(120),
  category: z.enum(SUPPORT_CATEGORIES).default('diger'),
  message: z.string().trim().min(10, 'Mesaj en az 10 karakter olmalidir.').max(2000),
});

const adminUpdateSchema = z.object({
  status: z.enum(SUPPORT_CATEGORIES.length ? ['OPEN', 'IN_PROGRESS', 'CLOSED'] : ['OPEN']).optional(),
  reply: z.string().trim().min(1).max(2000).optional(),
});

/** "DSK-<zaman tabani><rastgele>" — insan-okur, benzersiz. */
function newTicketNumber() {
  return `DSK-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;
}

function serializeTicket(ticket: any): SupportTicket {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    name: ticket.name,
    email: ticket.email,
    orderNumber: ticket.orderNumber ?? null,
    subject: ticket.subject,
    category: ticket.category,
    message: ticket.message,
    status: (ticket.status ?? 'OPEN').toLowerCase(),
    adminReply: ticket.adminReply ?? null,
    repliedAt: ticket.repliedAt ? ticket.repliedAt.toISOString() : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export class SupportService {
  constructor(private readonly repository = new SupportRepository()) {}

  /** Public form: talebi kaydeder, musterinin takip linkini uretir, bildirim maillerini gonderir. */
  async createTicket(userId: string | undefined, payload: unknown): Promise<SupportTicket & { trackingToken: string; trackingUrl: string }> {
    const data = createTicketSchema.parse(payload);
    const trackingToken = randomBytes(24).toString('base64url');

    const ticket = (await this.repository.createTicket({
      ticketNumber: newTicketNumber(),
      name: data.name,
      email: data.email,
      orderNumber: data.orderNumber ?? null,
      subject: data.subject,
      category: data.category,
      message: data.message,
      trackingTokenHash: hashTrackingToken(trackingToken),
      trackingTokenEncrypted: encryptBillingIdentity(trackingToken),
      requestedByUserId: userId ?? null,
    })) as any;

    const serialized = serializeTicket(ticket);
    const trackingUrl = `${env.WEB_URL}/destek-takip/${trackingToken}`;

    // Musteriye onay + takip linki.
    await sendMail({
      to: ticket.email,
      ...supportTicketReceivedEmail({ name: ticket.name, ticketNumber: ticket.ticketNumber, trackingUrl }),
    }).catch((error) => console.error('[SUPPORT] Onay maili gonderilemedi', { ticketNumber: ticket.ticketNumber, error }));

    // Yoneticiye bildirim (ADMIN_EMAIL tanimli degilse magaza gmail'i).
    const adminEmail = env.ADMIN_EMAIL || 'borabilgicdestek@gmail.com';
    await sendMail({
      to: adminEmail,
      ...supportTicketAdminNotificationEmail({
        ticketNumber: ticket.ticketNumber,
        name: ticket.name,
        email: ticket.email,
        orderNumber: ticket.orderNumber,
        subject: ticket.subject,
        message: ticket.message,
      }),
    }).catch((error) => console.error('[SUPPORT] Admin bildirimi gonderilemedi', { ticketNumber: ticket.ticketNumber, error }));

    return { ...serialized, trackingToken, trackingUrl };
  }

  /** Token'li takip: raw token'in hash'i ile dogrudan arama. */
  async getTicketByToken(rawToken: string | undefined): Promise<SupportTicket> {
    if (!rawToken) {
      throw new AppError('Destek talebi bulunamadi.', 404);
    }

    const ticket = (await this.repository.findTicketByTokenHash(hashTrackingToken(rawToken))) as any;
    if (!ticket) {
      throw new AppError('Destek talebi bulunamadi.', 404);
    }

    return serializeTicket(ticket);
  }

  async listTicketsForUser(userId: string): Promise<SupportTicket[]> {
    const tickets = (await this.repository.listTicketsForUser(userId)) as any[];
    return tickets.map(serializeTicket);
  }

  async listTickets(status: string | undefined) {
    const tickets = (await this.repository.listTickets(status)) as any[];
    return tickets.map(serializeTicket);
  }

  /** Admin: durum + opsiyonel cevap. Cevap varsa musterie mail gider. */
  async adminUpdateTicket(rawTicketId: unknown, payload: unknown): Promise<SupportTicket> {
    const ticketId = z.string().trim().min(1, 'Destek talebi kimligi zorunludur.').parse(rawTicketId);
    const data = adminUpdateSchema.parse(payload);

    const existing = (await this.repository.findTicketById(ticketId)) as any;
    if (!existing) {
      throw new AppError('Destek talebi bulunamadi.', 404);
    }

    const update: { status?: PrismaTicketStatus; adminReply?: string; repliedAt?: Date } = {};
    if (data.status) update.status = data.status;
    if (data.reply !== undefined) {
      update.adminReply = data.reply;
      update.repliedAt = new Date();
      if (!data.status) update.status = existing.status === 'OPEN' ? 'IN_PROGRESS' : existing.status;
    }

    if (Object.keys(update).length === 0) {
      throw new AppError('Guncellenecek alan gonderilmedi.', 400);
    }

    const updated = (await this.repository.updateTicket(ticketId, update)) as any;

    if (data.reply !== undefined) {
      // Takip linki sifre cozumunden uretilir; bozuk eski kayitlarda destek
      // sayfasina dusen guvenli bir baglanti kullanilir, mail yine gider.
      let trackingUrl = `${env.WEB_URL}/destek`;
      try {
        trackingUrl = `${env.WEB_URL}/destek-takip/${decryptBillingIdentity(existing.trackingTokenEncrypted)}`;
      } catch (error) {
        console.error('[SUPPORT] Takip token cozumu basarisiz; genel destek baglantisi kullanildi', { ticketNumber: existing.ticketNumber, error });
      }

      await sendMail({
        to: existing.email,
        ...supportTicketReplyEmail({
          name: existing.name,
          ticketNumber: existing.ticketNumber,
          reply: data.reply,
          trackingUrl,
        }),
      }).catch((error) => console.error('[SUPPORT] Cevap maili gonderilemedi', { ticketNumber: existing.ticketNumber, error }));
    }

    return serializeTicket(updated);
  }
}
