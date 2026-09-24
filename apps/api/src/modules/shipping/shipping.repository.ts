import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export interface ShipmentCreateData {
  cargoBarcode: string;
  cargoCompany: string;
  cargoCreatedAt: Date;
}

export interface ShipmentSyncData {
  cargoStatus: string;
  cargoLastEvent: string | null;
  cargoLastSyncedAt: Date;
  cargoEvents: Prisma.InputJsonValue;
}

export class ShippingRepository {
  findOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  setShipment(orderId: string, data: ShipmentCreateData) {
    return prisma.order.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });
  }

  setShipmentSync(orderId: string, data: ShipmentSyncData) {
    return prisma.order.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });
  }

  /** RMA iade kodu üretimi için iade kaydı ve bağlı siparişi getirir. */
  findRefundById(id: string) {
    return prisma.refund.findUnique({
      where: { id },
      include: { order: { include: { items: true } } },
    });
  }

  setRefundReturnCode(refundId: string, data: { returnCode: string; returnCodeValidUntil: Date }) {
    return prisma.refund.update({
      where: { id: refundId },
      data,
    });
  }
}
