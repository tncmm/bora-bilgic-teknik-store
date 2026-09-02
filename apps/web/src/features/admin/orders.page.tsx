import { EmptyState, InputField } from '@bora/ui';
import { PRODUCT_MEDIA_LIMITS, type Order, type Refund } from '@bora/types';
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

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const [, base64 = ''] = dataUrl.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AdminOrdersPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const [refundRequest, setRefundRequest] = useState<Refund | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [refunding, setRefunding] = useState(false);
  const [invoiceUploadingOrderId, setInvoiceUploadingOrderId] = useState<string | null>(null);
  const refundAmountNumber = Number(refundAmount);
  const selectedRefundItems = refundOrder
    ? refundOrder.items
        .map((item) => ({ item, quantity: Math.min(refundQuantities[item.id] ?? 0, item.refundableQuantity) }))
        .filter((entry) => entry.quantity > 0)
    : [];
  const selectedRefundTotal = selectedRefundItems.reduce((total, entry) => total + entry.item.unitPrice * entry.quantity, 0);
  const effectiveRefundAmount = refundRequest || selectedRefundItems.length === 0 ? refundAmountNumber : selectedRefundTotal;
  const pendingRefundRequests = refundOrder?.refunds?.filter((refund) => refund.status === 'pending') ?? [];
  const canRestockRefund = Boolean(refundRequest?.items?.length || selectedRefundItems.length || (refundOrder && effectiveRefundAmount === refundOrder.refundableAmount));

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

  function openRefundModal(order: AdminOrder, request?: Refund) {
    setRefundOrder(order);
    setRefundRequest(request ?? null);
    setRefundAmount(String(request?.amount ?? order.refundableAmount));
    setRefundReason(request?.customerReason ?? request?.reason ?? '');
    setRefundRestock(false);
    setRefundQuantities(
      request?.items?.reduce<Record<string, number>>((acc, item) => {
        acc[item.orderItemId] = item.quantity;
        return acc;
      }, {}) ?? {},
    );
  }

  async function handleRefund() {
    if (!token || !refundOrder) return;

    const amount = effectiveRefundAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ tone: 'error', title: 'İade tutarı geçersiz', description: 'Lütfen pozitif bir tutar girin.' });
      return;
    }

    const confirmed = window.confirm(`${refundOrder.orderNumber} için ${formatCurrency(amount, 'tr')} iade başlatılacak. Onaylıyor musunuz?`);
    if (!confirmed) return;

    setRefunding(true);
    try {
      await api.refundAdminOrder(token, refundOrder.id, {
        refundId: refundRequest?.id,
        manualAmount: refundRequest ? undefined : selectedRefundItems.length ? undefined : amount,
        amount,
        items: refundRequest
          ? undefined
          : selectedRefundItems.length
            ? selectedRefundItems.map((entry) => ({ orderItemId: entry.item.id, quantity: entry.quantity }))
            : undefined,
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

  async function handleInvoiceUpload(order: AdminOrder, file: File | undefined) {
    if (!token || !file) return;

    if (file.type !== 'application/pdf') {
      showToast({ tone: 'error', title: 'Fatura yüklenemedi', description: 'Fatura yalnızca PDF formatında yüklenebilir.' });
      return;
    }

    if (file.size > PRODUCT_MEDIA_LIMITS.invoicePdfBytes) {
      showToast({ tone: 'error', title: 'Fatura yüklenemedi', description: 'PDF boyutu 10 MB sınırını aşamaz.' });
      return;
    }

    setInvoiceUploadingOrderId(order.id);
    try {
      const base64 = await readFileAsBase64(file);
      await api.uploadAdminOrderInvoice(token, order.id, {
        fileName: file.name,
        mimeType: 'application/pdf',
        base64,
      });
      await loadOrders();
      showToast({ tone: 'success', title: 'Fatura gönderildi', description: `${order.orderNumber} faturası yüklendi ve müşteriye mail gönderildi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Fatura gönderilemedi', description: (error as Error).message });
      await loadOrders();
    } finally {
      setInvoiceUploadingOrderId(null);
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
                  <th>Fatura</th>
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
                      {(order.refunds?.filter((refund) => refund.status === 'pending').length ?? 0) > 0 ? (
                        <div className="text-muted">Bekleyen talep var</div>
                      ) : null}
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
                    <td>
                      {order.invoicePdfUrl ? (
                        <a className="admin-table-action" href={order.invoicePdfUrl} rel="noreferrer" target="_blank">
                          PDF Aç
                        </a>
                      ) : (
                        <span className="text-muted">Yok</span>
                      )}
                      <div className="text-muted">{order.invoiceSentAt ? 'Mail gönderildi' : order.invoiceUploadedAt ? 'Mail bekliyor' : 'PDF max 10 MB'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <label className={`admin-table-action ${invoiceUploadingOrderId === order.id ? 'is-disabled' : ''}`}>
                        {invoiceUploadingOrderId === order.id ? 'Yükleniyor...' : 'Fatura Yükle'}
                        <input
                          accept="application/pdf"
                          hidden
                          onChange={(event) => {
                            void handleInvoiceUpload(order, event.target.files?.[0]);
                            event.currentTarget.value = '';
                          }}
                          type="file"
                        />
                      </label>
                      <button className="admin-table-action" disabled={order.refundableAmount <= 0 || order.paymentStatus === 'refunded'} onClick={() => openRefundModal(order)} type="button">
                        İade Et
                      </button>
                      {order.refunds
                        ?.filter((refund) => refund.status === 'pending')
                        .map((refund) => (
                          <button className="admin-table-action admin-table-action--danger" key={refund.id} onClick={() => openRefundModal(order, refund)} type="button">
                            Talebi Onayla
                          </button>
                        ))}
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
              <h2>{refundRequest ? 'Müşteri İade Talebi' : 'PayTR İadesi'}</h2>
              <p>
                {refundOrder.orderNumber} için en fazla {formatCurrency(refundOrder.refundableAmount, 'tr')} iade edilebilir.
              </p>
            </div>
            {pendingRefundRequests.length > 0 && !refundRequest ? (
              <div className="refund-history-list">
                {pendingRefundRequests.map((request) => (
                  <button className="refund-admin-request" key={request.id} onClick={() => openRefundModal(refundOrder, request)} type="button">
                    <span>
                      <strong>{request.customerReason ?? 'Müşteri iade talebi'}</strong>
                      <small>{request.customerNote}</small>
                    </span>
                    <strong>{formatCurrency(request.amount, 'tr')}</strong>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="admin-form-grid">
              <InputField
                disabled={Boolean(refundRequest) || selectedRefundItems.length > 0}
                label="İade Tutarı"
                min="1"
                onChange={(e) => setRefundAmount(e.target.value)}
                step="0.01"
                type="number"
                value={selectedRefundItems.length > 0 ? String(selectedRefundTotal) : refundAmount}
              />
              <label className="admin-field">
                <span>Stok</span>
                <label className="checkout-check">
                  <input checked={refundRestock && canRestockRefund} disabled={!canRestockRefund} onChange={(e) => setRefundRestock(e.target.checked)} type="checkbox" />
                  <span>Ürünleri stoka geri ekle</span>
                </label>
                {!canRestockRefund ? <small>Stok geri ekleme için ürün/adet seçimi veya tam iade gerekir.</small> : null}
              </label>
              {!refundRequest ? (
                <div className="full refund-picker-list">
                  {refundOrder.items.map((item) => (
                    <label className={`refund-picker-item ${item.refundableQuantity <= 0 ? 'is-disabled' : ''}`} key={item.id}>
                      <div>
                        <strong>{item.productName}</strong>
                        <span>En fazla {item.refundableQuantity} adet · {formatCurrency(item.unitPrice, 'tr')}</span>
                      </div>
                      <input
                        disabled={item.refundableQuantity <= 0}
                        max={item.refundableQuantity}
                        min="0"
                        onChange={(event) => {
                          setRefundQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }));
                        }}
                        type="number"
                        value={refundQuantities[item.id] ?? 0}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="full refund-history-list">
                  <div className="refund-admin-note">
                    <strong>{refundRequest.customerReason}</strong>
                    <p>{refundRequest.customerNote}</p>
                  </div>
                  {refundRequest.items?.map((item) => {
                    const orderItem = refundOrder.items.find((entry) => entry.id === item.orderItemId);
                    return (
                      <div className="refund-history-item" key={item.id}>
                        <div>
                          <strong>{orderItem?.productName ?? item.productId}</strong>
                          <span>{item.quantity} adet</span>
                        </div>
                        <strong>{formatCurrency(item.lineTotal, 'tr')}</strong>
                      </div>
                    );
                  })}
                </div>
              )}
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
