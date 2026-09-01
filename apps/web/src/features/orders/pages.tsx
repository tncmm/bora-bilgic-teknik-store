import { appConfig } from '@bora/config';
import type { Order } from '@bora/types';
import { Button, EmptyState } from '@bora/ui';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateOrderStatus, translatePaymentStatus } from '../../shared/lib/i18n';

interface OrderDetailLocationState {
  justPlaced?: boolean;
}

const orderFlow = [
  {
    id: 'pending',
    titleTr: 'Sipariş Alındı',
    titleEn: 'Order Received',
    descriptionTr: 'Kayıt tamamlandı ve kontrol sırasına alındı.',
    descriptionEn: 'The order was recorded and queued for review.',
  },
  {
    id: 'processing',
    titleTr: 'Hazırlanıyor',
    titleEn: 'Preparing',
    descriptionTr: 'Ürünler ve teslimat planlaması hazırlanıyor.',
    descriptionEn: 'Products and delivery planning are being prepared.',
  },
  {
    id: 'shipped',
    titleTr: 'Kargoda',
    titleEn: 'Shipped',
    descriptionTr: 'Paket çıkışı yapıldı ve teslimata gidiyor.',
    descriptionEn: 'The package has left the warehouse and is in transit.',
  },
  {
    id: 'delivered',
    titleTr: 'Teslim Edildi',
    titleEn: 'Delivered',
    descriptionTr: 'Sipariş teslim edildi ve süreç tamamlandı.',
    descriptionEn: 'The order was delivered and the flow is complete.',
  },
] as const;

function getOrderStepIndex(status: Order['status']) {
  return orderFlow.findIndex((step) => step.id === status);
}

function getOrderHeadline(status: Order['status'], language: 'tr' | 'en') {
  const copy = {
    pending: language === 'tr' ? 'Siparişiniz onay bekliyor.' : 'Your order is pending review.',
    processing: language === 'tr' ? 'Siparişiniz hazırlanıyor.' : 'Your order is being prepared.',
    shipped: language === 'tr' ? 'Siparişiniz yola çıktı.' : 'Your order is on the way.',
    delivered: language === 'tr' ? 'Siparişiniz teslim edildi.' : 'Your order has been delivered.',
  } satisfies Record<Order['status'], string>;

  return copy[status];
}

function getOrderSupportCopy(status: Order['status'], language: 'tr' | 'en') {
  const copy = {
    pending: language === 'tr' ? 'Siparişiniz kontrol aşamasında. Ekip kısa süre içinde işleme alır.' : 'Your order is in review. The team will move it into processing shortly.',
    processing: language === 'tr' ? 'Hazırlama süreci devam ediyor. Teslimat ve paket içeriği netleştiriliyor.' : 'Preparation is underway. Delivery timing and package contents are being finalized.',
    shipped: language === 'tr' ? 'Siparişiniz sevkte. Teslimat için telefonunuzu ulaşılabilir tutmanız iyi olur.' : 'Your order is in transit. Keeping your phone reachable will help with delivery.',
    delivered: language === 'tr' ? 'Teslimat tamamlandı. Destek gerektiğinde sipariş numaranızla hızlı ilerlenebilir.' : 'Delivery is complete. Support can help faster when you share your order number.',
  } satisfies Record<Order['status'], string>;

  return copy[status];
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
              <p>{language === 'tr' ? 'Oluşturduğunuz tüm siparişleri, tutarları ve detay ekranlarını buradan takip edebilirsiniz.' : 'Track every order, total, and detail screen from here.'}</p>
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
    void api.getMyOrder(token, orderId).then(setOrder).catch((nextError: Error) => {
      setError(nextError.message);
    });
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

  if (error) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <div className="profile-card profile-card--full">
            <EmptyState
              description={error}
              title={language === 'tr' ? 'Sipariş yüklenemedi' : 'Order could not be loaded'}
            />
          </div>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <div className="profile-card profile-card--full">
            <p className="text-muted">{language === 'tr' ? 'Sipariş detayları yükleniyor...' : 'Loading order details...'}</p>
          </div>
        </div>
      </section>
    );
  }

  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const stepIndex = getOrderStepIndex(order.status);

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell orders-layout">
        <div className={['profile-card', 'profile-card--full', 'order-detail-hero', state?.justPlaced ? 'order-success-card' : ''].filter(Boolean).join(' ')}>
          <div className="section-header">
            <div>
              <div className="detail-chip">{state?.justPlaced ? (language === 'tr' ? 'Sipariş Alındı' : 'Order Received') : order.orderNumber}</div>
              <h2>{state?.justPlaced ? (language === 'tr' ? 'Tebrikler, siparişiniz alındı.' : 'Congratulations, your order has been received.') : order.orderNumber}</h2>
              <p>
                {state?.justPlaced
                  ? language === 'tr'
                    ? 'Siparişiniz başarıyla kaydedildi. Aşağıda sipariş özeti, ürün satırları ve teslimat detayları yer alıyor.'
                    : 'Your order has been recorded successfully. The summary, item lines, and delivery details are shown below.'
                  : language === 'tr'
                    ? 'Sipariş detaylarınızı daha net bir akışla, süreç durumu ve teslimat bilgileriyle birlikte burada görebilirsiniz.'
                    : 'Review your order in a clearer flow here, including progress status and delivery details.'}
              </p>
            </div>
            <div className="auth-actions">
              <Link to="/siparislerim">
                <Button variant="secondary">{language === 'tr' ? 'Tüm Siparişler' : 'All Orders'}</Button>
              </Link>
              <Link to="/katalog">
                <Button>{language === 'tr' ? 'Alışverişe Dön' : 'Continue Shopping'}</Button>
              </Link>
            </div>
          </div>

          <div className="order-hero-facts">
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Durum' : 'Status'}</span>
              <strong>{translateOrderStatus(language, order.status)}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Sipariş Tarihi' : 'Order Date'}</span>
              <strong>{formatDate(order.createdAt, language)}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Ürün Adedi' : 'Item Count'}</span>
              <strong>{itemCount}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Genel Toplam' : 'Grand Total'}</span>
              <strong>{formatCurrency(order.total, language)}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Ödeme' : 'Payment'}</span>
              <strong>
                {translatePaymentStatus(language, order.paymentStatus)}
                {order.paidAt ? ` · ${formatDate(order.paidAt, language)}` : ''}
              </strong>
            </div>
          </div>
        </div>

        <div className="profile-card profile-card--full">
          <div className="order-progress">
            {orderFlow.map((step, index) => (
              <div className={['order-progress__step', index <= stepIndex ? 'is-active' : ''].filter(Boolean).join(' ')} key={step.id}>
                <span className="order-progress__index">{index + 1}</span>
                <div>
                  <strong>{language === 'tr' ? step.titleTr : step.titleEn}</strong>
                  <p>{language === 'tr' ? step.descriptionTr : step.descriptionEn}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {order.status === 'shipped' || order.status === 'delivered' ? (
          <div className="profile-card profile-card--full">
            <div className="section-header">
              <div>
                <h2>{language === 'tr' ? 'Kargo Takibi' : 'Shipment Tracking'}</h2>
                <p>
                  {language === 'tr'
                    ? 'Siparişiniz Yurtiçi Kargo ile yola çıktı. Takip numaranız kargo firması tarafından SMS ile gönderilir; aşağıdaki buton sizi kargo firmasının takip sayfasına götürür.'
                    : 'Your order has been handed to Yurtici Kargo. The tracking number is sent to you by SMS; the button below opens the carrier’s tracking page.'}
                </p>
              </div>
            </div>
            <a href={appConfig.cargoTrackingUrl} rel="noreferrer" target="_blank" style={{ display: 'inline-block', maxWidth: 320 }}>
              <Button style={{ width: '100%' }}>
                {language === 'tr' ? 'Kargoyu Takip Et' : 'Track Shipment'}
              </Button>
            </a>
          </div>
        ) : null}

        <div className="profile-card profile-card--full">
          <div className="order-kpi-grid">
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Sipariş No' : 'Order Number'}</span>
              <strong>{order.orderNumber}</strong>
            </div>
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Teslimat Kişisi' : 'Delivery Contact'}</span>
              <strong>{order.shippingName}</strong>
            </div>
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Telefon' : 'Phone'}</span>
              <strong>{order.shippingPhone}</strong>
            </div>
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Süreç Notu' : 'Progress Note'}</span>
              <strong>{getOrderHeadline(order.status, language)}</strong>
            </div>
          </div>
        </div>

        <div className="order-detail-main profile-card--full">
          <div className="order-detail-primary">
            <div className="profile-card">
              <div className="section-header">
                <div>
                  <h2>{language === 'tr' ? 'Ürün Satırları' : 'Order Items'}</h2>
                  <p>{language === 'tr' ? 'Siparişinize eklenen ürünler, adetler ve satır toplamları.' : 'Products included in your order, quantities, and line totals.'}</p>
                </div>
              </div>
              <div className="order-item-list">
                {order.items.map((item) => (
                  <div className="order-item-card" key={item.id}>
                    <div className="order-item-card__media">
                      <span>{item.productName.slice(0, 1)}</span>
                    </div>
                    <div className="order-item-card__body">
                      <div className="order-item-card__heading">
                        <strong>{item.productName}</strong>
                        <span>{language === 'tr' ? 'Satır Toplamı' : 'Line Total'}</span>
                      </div>
                      <div className="order-item-card__meta">
                        <div>
                          <span>{language === 'tr' ? 'Birim Fiyat' : 'Unit Price'}</span>
                          <strong>{formatCurrency(item.unitPrice, language)}</strong>
                        </div>
                        <div>
                          <span>{language === 'tr' ? 'Adet' : 'Quantity'}</span>
                          <strong>{item.quantity}</strong>
                        </div>
                        <div>
                          <span>{language === 'tr' ? 'Ara Toplam' : 'Subtotal'}</span>
                          <strong>{formatCurrency(item.lineTotal, language)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {order.notes ? (
              <div className="profile-card">
                <div className="section-header">
                  <div>
                    <h2>{language === 'tr' ? 'Sipariş Notunuz' : 'Your Order Note'}</h2>
                    <p>{language === 'tr' ? 'Checkout sırasında eklediğiniz not burada saklanır.' : 'The note you left during checkout is shown here.'}</p>
                  </div>
                </div>
                <div className="order-note-card">
                  <p>{order.notes}</p>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="order-detail-sidebar">
            <div className="profile-card">
              <div className="section-header">
                <div>
                  <h2>{language === 'tr' ? 'Sipariş Özetiniz' : 'Order Summary'}</h2>
                  <p>{formatDate(order.createdAt, language)}</p>
                </div>
              </div>
              <div className="order-detail-stack">
                <div className="checkout-summary-box">
                  <strong>{language === 'tr' ? 'Ürün Toplamı' : 'Products Total'}</strong>
                  <p>{formatCurrency(order.total, language)}</p>
                </div>
                <div className="checkout-summary-box">
                  <strong>{language === 'tr' ? 'Kargo' : 'Shipping'}</strong>
                  <p>{language === 'tr' ? 'Sipariş detayına dahil' : 'Included in the order detail'}</p>
                </div>
                <div className="checkout-summary-box">
                  <strong>{language === 'tr' ? 'Genel Toplam' : 'Grand Total'}</strong>
                  <p>{formatCurrency(order.total, language)}</p>
                </div>
              </div>
            </div>

            <div className="profile-card">
              <div className="section-header">
                <div>
                  <h2>{language === 'tr' ? 'Teslimat Bilgileri' : 'Delivery Details'}</h2>
                  <p>{language === 'tr' ? 'Teslimat kişisi ve açık adres bilgileri.' : 'Delivery contact and full address details.'}</p>
                </div>
              </div>
              <div className="order-detail-stack">
                <div className="checkout-summary-box">
                  <strong>{order.shippingName}</strong>
                  <p>{order.shippingPhone}</p>
                </div>
                <div className="checkout-summary-box">
                  <strong>{language === 'tr' ? 'Adres' : 'Address'}</strong>
                  <p>{order.shippingAddressLine}</p>
                  <p>{order.shippingDistrict} / {order.shippingCity}</p>
                </div>
              </div>
            </div>

            <div className="profile-card order-support-card">
              <div className="section-header">
                <div>
                  <h2>{language === 'tr' ? 'Süreç ve Destek' : 'Progress and Support'}</h2>
                  <p>{language === 'tr' ? 'Siparişiniz için kısa durum özeti ve yönlendirme.' : 'A short status summary and guidance for your order.'}</p>
                </div>
              </div>
              <div className="order-support-card__body">
                <strong>{getOrderHeadline(order.status, language)}</strong>
                <p>{getOrderSupportCopy(order.status, language)}</p>
                <div className="order-support-card__actions">
                  <Link to="/iletisim">
                    <Button variant="secondary">{language === 'tr' ? 'Destekle İletişime Geç' : 'Contact Support'}</Button>
                  </Link>
                  <Link to="/teslimat">
                    <Button variant="ghost">{language === 'tr' ? 'Teslimat Bilgisi' : 'Delivery Info'}</Button>
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function GuestOrderTrackingPage() {
  const { token = '' } = useParams();
  const { language } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void api.trackOrder(token).then(setOrder).catch((nextError: Error) => setError(nextError.message));
  }, [token]);

  if (error) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <EmptyState description={error} title="Sipariş takip edilemiyor" />
          <Link to="/iletisim">
            <Button>Destek Al</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <EmptyState description="Sipariş bilgileri yükleniyor." title="Lütfen bekleyin" />
        </div>
      </section>
    );
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell orders-layout">
        <div className="order-confirmation-card">
          <div>
            <div className="detail-chip">Sipariş Takibi</div>
            <h1>{order.orderNumber}</h1>
            <p>Ödeme ve teslimat sürecini bu güvenli bağlantıdan takip edebilirsin.</p>
          </div>
          <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>{translatePaymentStatus(language, order.paymentStatus)}</span>
        </div>

        <div className="order-detail-grid">
          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Ürünler</h2>
              <p>{order.items.length} satır</p>
            </div>
            <div className="checkout-lines">
              {order.items.map((item) => (
                <div className="checkout-line" key={item.id}>
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <strong>{formatCurrency(item.lineTotal, language)}</strong>
                </div>
              ))}
            </div>
          </div>

          <aside className="admin-card">
            <div className="checkout-summary-box">
              <span>Durum</span>
              <strong>{translateOrderStatus(language, order.status)}</strong>
            </div>
            <div className="checkout-summary-box">
              <span>Toplam</span>
              <strong>{formatCurrency(order.total, language)}</strong>
            </div>
            <div className="checkout-summary-box">
              <span>Teslimat</span>
              <strong>{order.shippingCity}</strong>
              <p>{order.shippingAddressLine}</p>
            </div>
            <div className="checkout-summary-box">
              <span>Fatura</span>
              <strong>{order.billing.name}</strong>
              <p>TC Kimlik: ***{order.billing.identityNumberLast4}</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
