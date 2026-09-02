import { AppError } from './app-error.js';
import { decimalToNumber } from './serializers.js';

export interface RefundSelectionInput {
  orderItemId: string;
  quantity: number;
}

export interface RefundLineItem {
  orderItemId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function buildRefundSelection(order: any, requestedItems: RefundSelectionInput[]) {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new AppError('Iade icin en az bir urun secmelisiniz.', 400);
  }

  const consumedByOrderItem = new Map<string, number>();
  for (const refund of order.refunds ?? []) {
    if (!['PENDING', 'COMPLETED'].includes(refund.status)) continue;
    for (const item of refund.items ?? []) {
      consumedByOrderItem.set(item.orderItemId, (consumedByOrderItem.get(item.orderItemId) ?? 0) + item.quantity);
    }
  }

  const selectedByOrderItem = new Map<string, number>();
  for (const item of requestedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new AppError('Iade adedi pozitif tam sayi olmalidir.', 400);
    }
    selectedByOrderItem.set(item.orderItemId, (selectedByOrderItem.get(item.orderItemId) ?? 0) + item.quantity);
  }

  const lines: RefundLineItem[] = [];
  for (const [orderItemId, quantity] of selectedByOrderItem.entries()) {
    const orderItem = order.items.find((item: any) => item.id === orderItemId);
    if (!orderItem) {
      throw new AppError('Iade seciminde siparis urunu bulunamadi.', 400);
    }

    const availableQuantity = orderItem.quantity - (consumedByOrderItem.get(orderItemId) ?? 0);
    if (quantity > availableQuantity) {
      throw new AppError(`${orderItem.productName} icin iade edilebilir adet asildi.`, 400);
    }

    const unitPrice = decimalToNumber(orderItem.unitPrice);
    lines.push({
      orderItemId,
      productId: orderItem.productId,
      quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * quantity * 100) / 100,
    });
  }

  const amount = Math.round(lines.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  return { amount, items: lines };
}
