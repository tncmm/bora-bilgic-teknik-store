import { EmptyState, InputField } from '@bora/ui';
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
  { value: 'PROCESSING', label: 'Hazırlanıyor' },
  { value: 'SHIPPED', label: 'Kargoda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
] as const;

export function AdminOrdersPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const refundAmountNumber = Number(refundAmount);
  const canRestockRefund = Boolean(refundOrder && refundAmountNumber === refundOrder.refundableAmount);

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
        title: 'Sipariş durumu güncellendi',
        description: `${order.orderNumber} artık "${STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label ?? nextStatus}" olarak işaretli.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Durum güncellenemedi',
        description: (error as Error).message,
      });
      await loadOrders();
    }
  }

  function openRefundModal(order: AdminOrder) {
    setRefundOrder(order);
    setRefundAmount(String(order.refundableAmount));
    setRefundReason('');
    setRefundRestock(false);
  }

  async function handleRefund() {
    if (!token || !refundOrder) return;

    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ tone: 'error', title: 'İade tutarı geçersiz', description: 'Lütfen pozitif bir tutar girin.' });
      return;
    }

    const confirmed = window.confirm(`${refundOrder.orderNumber} için ${formatCurrency(amount, 'tr')} iade başlatılacak. Onaylıyor musunuz?`);
    if (!confirmed) return;

    setRefunding(true);
    try {
      await api.refundAdminOrder(token, refundOrder.id, {
        amount,
        reason: refundReason.trim() || undefined,
        restock: refundRestock && canRestockRefund,
      });
      setRefundOrder(null);
      await loadOrders();
      showToast({ tone: 'success', title: 'İade tamamlandı', description: `${refundOrder.orderNumber} için PayTR iadesi başarıyla işlendi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'İade yapılamadı', description: (error as Error).message });
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Siparişler</h1>
          <p>Ödemesi onaylanmış siparişler burada listelenir. Durumu değiştirmek için satırdaki seçimi kullanın.</p>
        </div>
      </div>

      <div className="admin-card">
        {orders.length === 0 ? (
          <EmptyState description="Ödenmiş sipariş geldiğinde burada görünecek." title="Henüz sipariş yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Tarih</th>
                  <th>Ödeme</th>
                  <th style={{ textAlign: 'right' }}>Tutar</th>
                  <th style={{ textAlign: 'right' }}>İade</th>
                  <th style={{ textAlign: 'right' }}>Durum</th>
                  <th style={{ textAlign: 'right' }}>Aksiyon</th>
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
                      <strong>{formatCurrency(order.refundedAmount, 'tr')}</strong>
                      <div className="text-muted">Kalan {formatCurrency(order.refundableAmount, 'tr')}</div>
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
                    <td style={{ textAlign: 'right' }}>
                      <button className="admin-table-action" disabled={order.refundableAmount <= 0 || order.paymentStatus === 'refunded'} onClick={() => openRefundModal(order)} type="button">
                        İade Et
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {refundOrder ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div aria-modal="true" className="admin-modal" role="dialog">
            <div className="admin-card__head">
              <h2>PayTR İadesi</h2>
              <p>
                {refundOrder.orderNumber} için en fazla {formatCurrency(refundOrder.refundableAmount, 'tr')} iade edilebilir.
              </p>
            </div>
            <div className="admin-form-grid">
              <InputField label="İade Tutarı" min="1" onChange={(e) => setRefundAmount(e.target.value)} step="0.01" type="number" value={refundAmount} />
              <label className="admin-field">
                <span>Stok</span>
                <label className="checkout-check">
                  <input checked={refundRestock && canRestockRefund} disabled={!canRestockRefund} onChange={(e) => setRefundRestock(e.target.checked)} type="checkbox" />
                  <span>Ürünleri stoka geri ekle</span>
                </label>
                {!canRestockRefund ? <small>Stok geri ekleme yalnızca kalan tutarın tamamı iade edilirken açılır.</small> : null}
              </label>
              <div className="full">
                <textarea className="ui-textarea" onChange={(e) => setRefundReason(e.target.value)} placeholder="İade sebebi" value={refundReason} />
              </div>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-table-action" disabled={refunding} onClick={() => setRefundOrder(null)} type="button">
                Vazgeç
              </button>
              <button className="admin-table-action admin-table-action--danger" disabled={refunding} onClick={() => void handleRefund()} type="button">
                {refunding ? 'İade Ediliyor...' : 'İadeyi Onayla'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
