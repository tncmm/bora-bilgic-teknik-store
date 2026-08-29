import { EmptyState } from '@bora/ui';
import type { Order } from '@bora/types';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translatePaymentStatus } from '../../shared/lib/i18n';

type AdminOrder = Order & { customer: string; email: string };

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Beklemede' },
  { value: 'PROCESSING', label: 'Hazirlaniyor' },
  { value: 'SHIPPED', label: 'Kargoda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
] as const;

export function AdminOrdersPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  async function loadOrders() {
    if (!token) return;
    const response = await api.getAdminOrders(token);
    setOrders(response);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadOrders());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleStatusChange(order: AdminOrder, nextStatus: string) {
    if (!token) return;

    try {
      await api.updateAdminOrderStatus(token, order.id, nextStatus);
      await loadOrders();
      showToast({
        tone: 'success',
        title: 'Siparis durumu guncellendi',
        description: `${order.orderNumber} artik "${STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label ?? nextStatus}" olarak isaretli.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Durum guncellenemedi',
        description: (error as Error).message,
      });
      await loadOrders();
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Siparisler</h1>
          <p>Odemesi onaylanmis siparisler burada listelenir. Durumu degistirmek icin satirdaki secimi kullanin.</p>
        </div>
      </div>

      <div className="admin-card">
        {orders.length === 0 ? (
          <EmptyState description="Odenmis siparis geldiginde burada gorunecek." title="Henuz siparis yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Siparis No</th>
                  <th>Musteri</th>
                  <th>Tarih</th>
                  <th>Odeme</th>
                  <th style={{ textAlign: 'right' }}>Tutar</th>
                  <th style={{ textAlign: 'right' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                    </td>
                    <td>
                      <strong>{order.customer}</strong>
                      <div className="text-muted">{order.email}</div>
                    </td>
                    <td>{formatDate(order.createdAt, 'tr')}</td>
                    <td>
                      <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>
                        {translatePaymentStatus('tr', order.paymentStatus)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(order.total, 'tr')}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <select
                        className="ui-select"
                        onChange={(event) => void handleStatusChange(order, event.target.value)}
                        value={order.status.toUpperCase()}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
