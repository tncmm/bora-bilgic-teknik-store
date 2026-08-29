import type { Order } from '@bora/types';
import { Button, EmptyState } from '@bora/ui';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateOrderStatus } from '../../shared/lib/i18n';

interface OrderDetailLocationState {
  justPlaced?: boolean;
}

const orderFlow = [
  {
    id: 'pending',
    titleTr: 'Siparis Alindi',
    titleEn: 'Order Received',
    descriptionTr: 'Kayit tamamlandi ve kontrol sirasina alindi.',
    descriptionEn: 'The order was recorded and queued for review.',
  },
  {
    id: 'processing',
    titleTr: 'Hazirlaniyor',
    titleEn: 'Preparing',
    descriptionTr: 'Urunler ve teslimat planlamasi hazirlaniyor.',
    descriptionEn: 'Products and delivery planning are being prepared.',
  },
  {
    id: 'shipped',
    titleTr: 'Kargoda',
    titleEn: 'Shipped',
    descriptionTr: 'Paket cikisi yapildi ve teslimata gidiyor.',
    descriptionEn: 'The package has left the warehouse and is in transit.',
  },
  {
    id: 'delivered',
    titleTr: 'Teslim Edildi',
    titleEn: 'Delivered',
    descriptionTr: 'Siparis teslim edildi ve surec tamamlandi.',
    descriptionEn: 'The order was delivered and the flow is complete.',
  },
] as const;

function getOrderStepIndex(status: Order['status']) {
  return orderFlow.findIndex((step) => step.id === status);
}

function getOrderHeadline(status: Order['status'], language: 'tr' | 'en') {
  const copy = {
    pending: language === 'tr' ? 'Siparisiniz onay bekliyor.' : 'Your order is pending review.',
    processing: language === 'tr' ? 'Siparisiniz hazirlaniyor.' : 'Your order is being prepared.',
    shipped: language === 'tr' ? 'Siparisiniz yola cikti.' : 'Your order is on the way.',
    delivered: language === 'tr' ? 'Siparisiniz teslim edildi.' : 'Your order has been delivered.',
  } satisfies Record<Order['status'], string>;

  return copy[status];
}

function getOrderSupportCopy(status: Order['status'], language: 'tr' | 'en') {
  const copy = {
    pending: language === 'tr' ? 'Siparisiniz kontrol asamasinda. Ekip kisa sure icinde isleme alir.' : 'Your order is in review. The team will move it into processing shortly.',
    processing: language === 'tr' ? 'Hazirlama sureci devam ediyor. Teslimat ve paket icerigi netlestiriliyor.' : 'Preparation is underway. Delivery timing and package contents are being finalized.',
    shipped: language === 'tr' ? 'Siparisiniz sevkte. Teslimat icin telefonunuzu ulasilabilir tutmaniz iyi olur.' : 'Your order is in transit. Keeping your phone reachable will help with delivery.',
    delivered: language === 'tr' ? 'Teslimat tamamlandi. Destek gerektiginde siparis numaranizla hizli ilerlenebilir.' : 'Delivery is complete. Support can help faster when you share your order number.',
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
            description={language === 'tr' ? 'Siparislerinizi gormek icin giris yapin.' : 'Log in to view your orders.'}
            title={language === 'tr' ? 'Siparisler kullanilamiyor' : 'Orders unavailable'}
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
              <div className="detail-chip">{language === 'tr' ? 'Siparislerim' : 'My Orders'}</div>
              <h2>{language === 'tr' ? 'Tum Siparis Gecmisiniz' : 'Your Full Order History'}</h2>
              <p>{language === 'tr' ? 'Olusturdugunuz tum siparisleri, tutarlari ve detay ekranlarini buradan takip edebilirsiniz.' : 'Track every order, total, and detail screen from here.'}</p>
            </div>
            <Link to="/profil">
              <Button variant="secondary">{language === 'tr' ? 'Profile Don' : 'Back to Profile'}</Button>
            </Link>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="profile-card profile-card--full">
            <EmptyState
              description={language === 'tr' ? 'Bu hesap icin henuz siparis yok.' : 'There are no orders for this account yet.'}
              title={language === 'tr' ? 'Siparis bulunamadi' : 'No orders found'}
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
            description={language === 'tr' ? 'Siparis detaylarini gormek icin giris yapin.' : 'Log in to view order details.'}
            title={language === 'tr' ? 'Siparis detayi kullanilamiyor' : 'Order detail unavailable'}
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
              title={language === 'tr' ? 'Siparis yuklenemedi' : 'Order could not be loaded'}
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
            <p className="text-muted">{language === 'tr' ? 'Siparis detaylari yukleniyor...' : 'Loading order details...'}</p>
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
              <div className="detail-chip">{state?.justPlaced ? (language === 'tr' ? 'Siparis Alindi' : 'Order Received') : order.orderNumber}</div>
              <h2>{state?.justPlaced ? (language === 'tr' ? 'Tebrikler, siparisiniz alindi.' : 'Congratulations, your order has been received.') : order.orderNumber}</h2>
              <p>
                {state?.justPlaced
                  ? language === 'tr'
                    ? 'Siparisiniz basariyla kaydedildi. Asagida siparis ozeti, urun satirlari ve teslimat detaylari yer aliyor.'
                    : 'Your order has been recorded successfully. The summary, item lines, and delivery details are shown below.'
                  : language === 'tr'
                    ? 'Siparis detaylarinizi daha net bir akisla, surec durumu ve teslimat bilgileriyle birlikte burada gorebilirsiniz.'
                    : 'Review your order in a clearer flow here, including progress status and delivery details.'}
              </p>
            </div>
            <div className="auth-actions">
              <Link to="/siparislerim">
                <Button variant="secondary">{language === 'tr' ? 'Tum Siparisler' : 'All Orders'}</Button>
              </Link>
              <Link to="/katalog">
                <Button>{language === 'tr' ? 'Alisverise Don' : 'Continue Shopping'}</Button>
              </Link>
            </div>
          </div>

          <div className="order-hero-facts">
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Durum' : 'Status'}</span>
              <strong>{translateOrderStatus(language, order.status)}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Siparis Tarihi' : 'Order Date'}</span>
              <strong>{formatDate(order.createdAt, language)}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Urun Adedi' : 'Item Count'}</span>
              <strong>{itemCount}</strong>
            </div>
            <div className="order-hero-fact">
              <span>{language === 'tr' ? 'Genel Toplam' : 'Grand Total'}</span>
              <strong>{formatCurrency(order.total, language)}</strong>
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

        <div className="profile-card profile-card--full">
          <div className="order-kpi-grid">
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Siparis No' : 'Order Number'}</span>
              <strong>{order.orderNumber}</strong>
            </div>
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Teslimat Kisisi' : 'Delivery Contact'}</span>
              <strong>{order.shippingName}</strong>
            </div>
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Telefon' : 'Phone'}</span>
              <strong>{order.shippingPhone}</strong>
            </div>
            <div className="order-kpi-card">
              <span>{language === 'tr' ? 'Surec Notu' : 'Progress Note'}</span>
              <strong>{getOrderHeadline(order.status, language)}</strong>
            </div>
          </div>
        </div>

        <div className="order-detail-main profile-card--full">
          <div className="order-detail-primary">
            <div className="profile-card">
              <div className="section-header">
                <div>
                  <h2>{language === 'tr' ? 'Urun Satirlari' : 'Order Items'}</h2>
                  <p>{language === 'tr' ? 'Siparisinize eklenen urunler, adetler ve satir toplamlari.' : 'Products included in your order, quantities, and line totals.'}</p>
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
                        <span>{language === 'tr' ? 'Satir Toplami' : 'Line Total'}</span>
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
                    <h2>{language === 'tr' ? 'Siparis Notunuz' : 'Your Order Note'}</h2>
                    <p>{language === 'tr' ? 'Checkout sirasinda eklediginiz not burada saklanir.' : 'The note you left during checkout is shown here.'}</p>
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
                  <h2>{language === 'tr' ? 'Siparis Ozetiniz' : 'Order Summary'}</h2>
                  <p>{formatDate(order.createdAt, language)}</p>
                </div>
              </div>
              <div className="order-detail-stack">
                <div className="checkout-summary-box">
                  <strong>{language === 'tr' ? 'Urun Toplami' : 'Products Total'}</strong>
                  <p>{formatCurrency(order.total, language)}</p>
                </div>
                <div className="checkout-summary-box">
                  <strong>{language === 'tr' ? 'Kargo' : 'Shipping'}</strong>
                  <p>{language === 'tr' ? 'Siparis detayina dahil' : 'Included in the order detail'}</p>
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
                  <p>{language === 'tr' ? 'Teslimat kisisi ve acik adres bilgileri.' : 'Delivery contact and full address details.'}</p>
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
                  <h2>{language === 'tr' ? 'Surec ve Destek' : 'Progress and Support'}</h2>
                  <p>{language === 'tr' ? 'Siparisiniz icin kisa durum ozeti ve yonlendirme.' : 'A short status summary and guidance for your order.'}</p>
                </div>
              </div>
              <div className="order-support-card__body">
                <strong>{getOrderHeadline(order.status, language)}</strong>
                <p>{getOrderSupportCopy(order.status, language)}</p>
                <div className="order-support-card__actions">
                  <Link to="/iletisim">
                    <Button variant="secondary">{language === 'tr' ? 'Destekle Iletisime Gec' : 'Contact Support'}</Button>
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
