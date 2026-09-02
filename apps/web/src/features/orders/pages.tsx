import { appConfig } from '@bora/config';
import type { Order } from '@bora/types';
import { Button, EmptyState } from '@bora/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api, type RefundRequestPayload } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateOrderStatus, translatePaymentStatus } from '../../shared/lib/i18n';

interface OrderDetailLocationState {
  justPlaced?: boolean;
}

const orderFlow = [
  { id: 'pending', titleTr: 'Alındı', titleEn: 'Received' },
  { id: 'processing', titleTr: 'Hazırlanıyor', titleEn: 'Preparing' },
  { id: 'shipped', titleTr: 'Kargoda', titleEn: 'Shipped' },
  { id: 'delivered', titleTr: 'Teslim', titleEn: 'Delivered' },
] as const;

const refundReasons = [
  'Ürün beklentimi karşılamadı',
  'Yanlış ürün sipariş ettim',
  'Hasarlı veya eksik teslimat',
  'Farklı bir ürün almak istiyorum',
  'Diğer',
] as const;

function getOrderStepIndex(status: Order['status']) {
  return Math.max(0, orderFlow.findIndex((step) => step.id === status));
}

function canOrderRequestRefund(order: Order) {
  return ['paid', 'partially_refunded'].includes(order.paymentStatus) && order.items.some((item) => item.refundableQuantity > 0);
}

function getRefundStatusLabel(item: Order['items'][number]) {
  const parts = [];
  if (item.pendingRefundQuantity > 0) parts.push(`${item.pendingRefundQuantity} adet talep bekliyor`);
  if (item.refundedQuantity > 0) parts.push(`${item.refundedQuantity} adet iade tamamlandı`);
  if (item.refundableQuantity > 0) parts.push(`${item.refundableQuantity} adet iade edilebilir`);
  return parts.length ? parts.join(' · ') : 'İade hakkı yok';
}

function RefundRequestModal({
  order,
  onClose,
  onSubmit,
}: {
  order: Order;
  onClose: () => void;
  onSubmit: (payload: RefundRequestPayload) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedItems = order.items
    .map((item) => ({ item, quantity: Math.min(quantities[item.id] ?? 0, item.refundableQuantity) }))
    .filter((entry) => entry.quantity > 0);
  const refundTotal = selectedItems.reduce((total, entry) => total + entry.item.unitPrice * entry.quantity, 0);
  const canSubmit = selectedItems.length > 0 && reason.length >= 3 && note.trim().length >= 10 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      showToast({
        tone: 'error',
        title: 'İade talebi eksik',
        description: 'Lütfen ürün/adet seçin, sebep belirleyin ve kısa bir açıklama yazın.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        items: selectedItems.map((entry) => ({ orderItemId: entry.item.id, quantity: entry.quantity })),
        reason,
        note: note.trim(),
      });
      showToast({
        tone: 'success',
        title: 'İade talebi alındı',
        description: 'Talebiniz admin onayına düştü. Para iadesi onaydan sonra işlenecek.',
      });
      onClose();
    } catch (error) {
      showToast({ tone: 'error', title: 'İade talebi oluşturulamadı', description: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div aria-modal="true" className="admin-modal refund-request-modal" role="dialog">
        <div className="admin-card__head">
          <h2>İade Talebi Oluştur</h2>
          <p>İade etmek istediğiniz ürünleri ayrı ayrı seçin. Talep onaylandıktan sonra ödeme iadesi admin tarafından yapılır.</p>
        </div>

        <div className="refund-picker-list">
          {order.items.map((item) => (
            <label className={`refund-picker-item ${item.refundableQuantity <= 0 ? 'is-disabled' : ''}`} key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span>{getRefundStatusLabel(item)}</span>
              </div>
              <input
                disabled={item.refundableQuantity <= 0}
                max={item.refundableQuantity}
                min="0"
                onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                type="number"
                value={quantities[item.id] ?? 0}
              />
            </label>
          ))}
        </div>

        <label className="admin-field">
          <span>İade sebebi</span>
          <select className="ui-select" onChange={(event) => setReason(event.target.value)} value={reason}>
            <option value="">Sebep seçin</option>
            {refundReasons.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Açıklama</span>
          <textarea
            className="ui-textarea"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Talebinizi kısaca açıklayın."
            value={note}
          />
          <small>En az 10 karakter girmeniz gerekir.</small>
        </label>

        <div className="refund-modal-summary">
          <span>Talep tutarı</span>
          <strong>{formatCurrency(refundTotal, 'tr')}</strong>
        </div>

        <div className="admin-modal-actions">
          <button className="admin-table-action" disabled={submitting} onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="admin-table-action admin-table-action--danger" disabled={!canSubmit} onClick={() => void handleSubmit()} type="button">
            {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailView({
  order,
  justPlaced,
  onOrderChange,
  onCreateRefundRequest,
}: {
  order: Order;
  justPlaced?: boolean;
  onOrderChange: (order: Order) => void;
  onCreateRefundRequest: (payload: RefundRequestPayload) => Promise<Order>;
}) {
  const { language } = useI18n();
  const [refundOpen, setRefundOpen] = useState(false);
  const stepIndex = getOrderStepIndex(order.status);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const pendingRefunds = order.refunds?.filter((refund) => refund.status === 'pending') ?? [];
  const completedRefunds = order.refunds?.filter((refund) => refund.status === 'completed') ?? [];

  async function handleRefundSubmit(payload: RefundRequestPayload) {
    const updatedOrder = await onCreateRefundRequest(payload);
    onOrderChange(updatedOrder);
  }

  return (
    <>
      <div className="order-detail-simple">
        <div className={['order-summary-card', justPlaced ? 'order-summary-card--success' : ''].filter(Boolean).join(' ')}>
          <div>
            <span className="detail-chip">{justPlaced ? 'Sipariş Alındı' : 'Sipariş Detayı'}</span>
            <h1>{justPlaced ? 'Tebrikler, siparişiniz alındı.' : order.orderNumber}</h1>
            <p>Bu ekranda sipariş durumunu, ürünleri, fatura bilgisini ve iade taleplerini sade şekilde takip edebilirsiniz.</p>
          </div>
          <div className="order-summary-card__facts">
            <span>{translateOrderStatus(language, order.status)}</span>
            <strong>{formatCurrency(order.total, language)}</strong>
            <small>{formatDate(order.createdAt, language)}</small>
          </div>
        </div>

        <div className="order-mini-grid">
          <div>
            <span>Sipariş No</span>
            <strong>{order.orderNumber}</strong>
          </div>
          <div>
            <span>Ödeme</span>
            <strong>{translatePaymentStatus(language, order.paymentStatus)}</strong>
          </div>
          <div>
            <span>Ürün</span>
            <strong>{itemCount} adet</strong>
          </div>
          <div>
            <span>İade</span>
            <strong>{formatCurrency(order.refundedAmount, language)}</strong>
          </div>
        </div>

        <div className="order-progress order-progress--compact">
          {orderFlow.map((step, index) => (
            <div className={['order-progress__step', index <= stepIndex ? 'is-active' : ''].filter(Boolean).join(' ')} key={step.id}>
              <span className="order-progress__index">{index + 1}</span>
              <strong>{language === 'tr' ? step.titleTr : step.titleEn}</strong>
            </div>
          ))}
        </div>

        <div className="order-detail-split">
          <main className="order-detail-split__main">
            <div className="profile-card">
              <div className="order-section-head">
                <div>
                  <h2>Ürünler</h2>
                  <p>Ürünleri aynı sipariş içinde ayrı ayrı iade talebine konu edebilirsiniz.</p>
                </div>
                {canOrderRequestRefund(order) ? <Button onClick={() => setRefundOpen(true)}>İade Talebi Oluştur</Button> : null}
              </div>

              <div className="order-line-list">
                {order.items.map((item) => (
                  <div className="order-line-card" key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>{getRefundStatusLabel(item)}</span>
                    </div>
                    <div className="order-line-card__numbers">
                      <span>{item.quantity} adet</span>
                      <span>{formatCurrency(item.unitPrice, language)}</span>
                      <strong>{formatCurrency(item.lineTotal, language)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(pendingRefunds.length > 0 || completedRefunds.length > 0) && (
              <div className="profile-card">
                <div className="order-section-head">
                  <div>
                    <h2>İade Süreci</h2>
                    <p>Bekleyen talepler admin onayı sonrası PayTR üzerinden tamamlanır.</p>
                  </div>
                </div>
                <div className="refund-history-list">
                  {[...pendingRefunds, ...completedRefunds].map((refund) => (
                    <div className="refund-history-item" key={refund.id}>
                      <div>
                        <strong>{refund.source === 'customer' ? refund.customerReason : refund.reason || 'Admin iadesi'}</strong>
                        <span>{refund.items?.map((item) => `${item.quantity} adet`).join(', ') || 'Tutar bazlı iade'}</span>
                      </div>
                      <div>
                        <span className={`order-badge order-badge--payment-${refund.status}`}>{refund.status === 'pending' ? 'Onay bekliyor' : 'Tamamlandı'}</span>
                        <strong>{formatCurrency(refund.amount, language)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>

          <aside className="order-detail-split__side">
            <div className="profile-card compact-info-card">
              <h3>Teslimat</h3>
              <strong>{order.shippingName}</strong>
              <p>{order.shippingPhone}</p>
              <p>{order.shippingAddressLine}</p>
              <p>{order.shippingDistrict} / {order.shippingCity}</p>
              {(order.status === 'shipped' || order.status === 'delivered') && (
                <a href={appConfig.cargoTrackingUrl} rel="noreferrer" target="_blank">
                  Kargo takip sayfası
                </a>
              )}
            </div>

            <div className="profile-card compact-info-card">
              <h3>Fatura</h3>
              <strong>{order.billing.name}</strong>
              <p>{order.billing.addressLine}</p>
              <p>{order.billing.district} / {order.billing.city}</p>
              <p>TC Kimlik: ***{order.billing.identityNumberLast4}</p>
              {order.invoicePdfUrl ? (
                <a href={order.invoicePdfUrl} rel="noreferrer" target="_blank">
                  PDF faturayı indir
                </a>
              ) : (
                <span>Fatura yüklendiğinde burada görünür.</span>
              )}
            </div>

            <div className="profile-card compact-info-card">
              <h3>Destek</h3>
              <p>Sipariş numaranızla bizimle iletişime geçerseniz süreci daha hızlı kontrol ederiz.</p>
              <Link to="/iletisim">Destekle iletişime geç</Link>
            </div>
          </aside>
        </div>
      </div>

      {refundOpen ? (
        <RefundRequestModal
          onClose={() => setRefundOpen(false)}
          onSubmit={handleRefundSubmit}
          order={order}
        />
      ) : null}
    </>
  );
}

export function OrdersPage() {
  const { token, user } = useSession();
  const { language } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.getMyOrders(token).then(setOrders).catch(() => undefined);
  }, [token]);

  if (!user || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState
            description={language === 'tr' ? 'Siparişlerinizi görmek için giriş yapın.' : 'Log in to view your orders.'}
            title={language === 'tr' ? 'Siparişler kullanılamıyor' : 'Orders unavailable'}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell orders-layout">
        <div className="profile-card profile-card--full">
          <div className="section-header">
            <div>
              <div className="detail-chip">{language === 'tr' ? 'Siparişlerim' : 'My Orders'}</div>
              <h2>{language === 'tr' ? 'Tüm Sipariş Geçmişiniz' : 'Your Full Order History'}</h2>
              <p>{language === 'tr' ? 'Siparişlerinizi ve iade taleplerinizi buradan takip edebilirsiniz.' : 'Track your orders and refund requests from here.'}</p>
            </div>
            <Link to="/profil">
              <Button variant="secondary">{language === 'tr' ? 'Profile Dön' : 'Back to Profile'}</Button>
            </Link>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="profile-card profile-card--full">
            <EmptyState
              description={language === 'tr' ? 'Bu hesap için henüz sipariş yok.' : 'There are no orders for this account yet.'}
              title={language === 'tr' ? 'Sipariş bulunamadı' : 'No orders found'}
            />
          </div>
        ) : (
          orders.map((order) => (
            <Link className="order-list-card" key={order.id} to={`/siparislerim/${order.id}`}>
              <div>
                <strong>{order.orderNumber}</strong>
                <p>{formatDate(order.createdAt, language)}</p>
              </div>
              <span className="order-badge">{translateOrderStatus(language, order.status)}</span>
              <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>{translatePaymentStatus(language, order.paymentStatus)}</span>
              <strong>{formatCurrency(order.total, language)}</strong>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

export function OrderDetailPage() {
  const { token, user } = useSession();
  const { language } = useI18n();
  const { orderId = '' } = useParams();
  const location = useLocation();
  const state = (location.state ?? null) as OrderDetailLocationState | null;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    void Promise.resolve().then(() => setError(null));
    void api.getMyOrder(token, orderId).then(setOrder).catch((nextError: Error) => setError(nextError.message));
  }, [orderId, token]);

  if (!user || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState
            description={language === 'tr' ? 'Sipariş detaylarını görmek için giriş yapın.' : 'Log in to view order details.'}
            title={language === 'tr' ? 'Sipariş detayı kullanılamıyor' : 'Order detail unavailable'}
          />
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <div className="profile-card profile-card--full">
            <EmptyState
              description={error ?? (language === 'tr' ? 'Sipariş detayları yükleniyor...' : 'Loading order details...')}
              title={error ? (language === 'tr' ? 'Sipariş yüklenemedi' : 'Order could not be loaded') : (language === 'tr' ? 'Lütfen bekleyin' : 'Please wait')}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell orders-layout">
        <OrderDetailView
          justPlaced={state?.justPlaced}
          onCreateRefundRequest={(payload) => api.createMyRefundRequest(token, order.id, payload)}
          onOrderChange={setOrder}
          order={order}
        />
      </div>
    </section>
  );
}

export function GuestOrderTrackingPage() {
  const { token = '' } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void api.trackOrder(token).then(setOrder).catch((nextError: Error) => setError(nextError.message));
  }, [token]);

  const content = useMemo(() => {
    if (error) {
      return (
        <>
          <EmptyState description={error} title="Sipariş takip edilemiyor" />
          <Link to="/iletisim">
            <Button>Destek Al</Button>
          </Link>
        </>
      );
    }

    if (!order) {
      return <EmptyState description="Sipariş bilgileri yükleniyor." title="Lütfen bekleyin" />;
    }

    return (
      <OrderDetailView
        onCreateRefundRequest={(payload) => api.createTrackedRefundRequest(token, payload)}
        onOrderChange={setOrder}
        order={order}
      />
    );
  }, [error, order, token]);

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell orders-layout">{content}</div>
    </section>
  );
}
