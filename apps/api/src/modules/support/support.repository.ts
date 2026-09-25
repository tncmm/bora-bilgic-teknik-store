import type { TicketStatus } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

const ticketInclude = { requestedBy: { select: { email: true } } };

export class SupportRepository {
  createTicket(data: {
    ticketNumber: string;
    name: string;
    email: string;
    orderNumber: string | null;
    subject: string;
    category: string;
    message: string;
    trackingTokenHash: string;
    trackingTokenEncrypted: string;
    requestedByUserId?: string | null;
  }) {
    return prisma.supportTicket.create({ data, include: ticketInclude });
  }

  findTicketByNumber(ticketNumber: string) {
    return prisma.supportTicket.findUnique({ where: { ticketNumber }, include: ticketInclude });
  }

  findTicketByTokenHash(trackingTokenHash: string) {
    return prisma.supportTicket.findUnique({ where: { trackingTokenHash }, include: ticketInclude });
  }

  listTicketsForUser(userId: string) {
    return prisma.supportTicket.findMany({
      where: { requestedByUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listTickets(status?: string) {
    return prisma.supportTicket.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: ticketInclude,
    });
  }

  findTicketById(id: string) {
    return prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
  }

  updateTicket(id: string, data: { status?: TicketStatus; adminReply?: string; repliedAt?: Date }) {
    return prisma.supportTicket.update({ where: { id }, data, include: ticketInclude });
  }
}
