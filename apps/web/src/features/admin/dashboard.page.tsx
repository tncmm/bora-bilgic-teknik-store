import { Button, EmptyState, StatCard } from '@bora/ui';
import type { DashboardMetrics, Order, Product } from '@bora/types';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateCategoryName, translatePaymentStatus } from '../../shared/lib/i18n';

type AdminOrder = Order & { customer: string; email: string };

const LOW_STOCK_THRESHOLD = 3;

const emptyMetrics: DashboardMetrics = {
  totalSales: 0,
  newOrders: 0,
  activeInventory: 0,
  lowStockCount: 0,
  totalOrders: 0,
  paidOrders: 0,
  pendingRefundRequests: 0,
};

export function AdminDashboardPage() {
  const { token } = useSession();
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextMetrics, nextProducts, nextOrders] = await Promise.all([
          api.getAdminDashboard(token),
          api.getAdminProducts(token),
          api.getAdminOrders(token),
        ]);
        setMetrics(nextMetrics);
        setProducts(nextProducts);
        setOrders(nextOrders);
      } catch (nextError) {
        setError((nextError as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock).slice(0, 6),
    [products],
  );
  const recentOrders = orders.slice(0, 5);
  const paidOrdersFallback = orders.filter((order) => ['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus)).length;
  const pendingRefundFallback = orders.reduce((count, order) => count + (order.refunds?.filter((refund) => refund.status === 'pending').length ?? 0), 0);
  const visibleMetrics = {
    ...metrics,
    totalOrders: metrics.totalOrders || orders.length,
    paidOrders: metrics.paidOrders || paidOrdersFallback,
    pendingRefundRequests: metrics.pendingRefundRequests || pendingRefundFallback,
  };

  return (
    <div className="admin-page">
      <div className="admin-dashboard-hero">
        <div>
          <span className="detail-chip">Yönetim Paneli</span>
          <h1>Genel Bakış</h1>
          <p>Siparişleri, satışları, stok uyarılarını ve bekleyen iade taleplerini tek yerden takip edin.</p>
        </div>
        <div className="admin-headline__actions">
          <Link to="/admin/urunler/yeni">
            <Button>+ Yeni Ürün</Button>
          </Link>
          <Link to="/admin/markalar">
            <Button variant="secondary">Marka Ekle</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="admin-alert-error" role="alert">
          Genel bakış verileri yüklenemedi: {error}
        </div>
      ) : null}

      <div className="admin-grid admin-grid--six">
        <StatCard hint="Ödemesi tamamlanan siparişlerden" title="Toplam Satış" value={formatCurrency(visibleMetrics.totalSales, 'tr')} />
        <StatCard hint="Tüm sipariş kayıtları" title="Sipariş" value={`${visibleMetrics.totalOrders}`} />
        <StatCard hint="Ödeme alınan siparişler" title="Ödenmiş" value={`${visibleMetrics.paidOrders}`} />
        <StatCard hint="İşlem bekleyen ödenmiş siparişler" title="Yeni" value={`${visibleMetrics.newOrders}`} />
        <StatCard hint="Ürünlerdeki toplam stok" title="Stok" value={`${visibleMetrics.activeInventory}`} />
        <StatCard hint="Admin onayı bekleyen iadeler" title="İade Talebi" value={`${visibleMetrics.pendingRefundRequests}`} />
      </div>

      {loading ? (
        <div className="admin-card">
          <p className="text-muted">Genel bakış yükleniyor...</p>
        </div>
      ) : null}

      <div className="admin-dashboard-columns">
        <div className="admin-card">
          <div className="admin-card__head admin-card__head--row">
            <div>
              <h2>Son Siparişler</h2>
              <p>Sipariş sayfasındaki son kayıtların kısa özeti.</p>
            </div>
            <Link to="/admin/siparisler">
              <Button variant="secondary">Tümünü Gör</Button>
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState description="Sipariş geldiğinde burada hızlıca görünür." title="Sipariş yok" />
          ) : (
            <div className="admin-dashboard-list">
              {recentOrders.map((order) => (
                <Link className="admin-dashboard-order" key={order.id} to="/admin/siparisler">
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <span>{order.customer} · {formatDate(order.createdAt, 'tr')}</span>
                  </div>
                  <div>
                    <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>
                      {translatePaymentStatus('tr', order.paymentStatus)}
                    </span>
                    <strong>{formatCurrency(order.total, 'tr')}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card__head admin-card__head--row">
            <div>
              <h2>Stok Uyarıları</h2>
              <p>Stoğu {LOW_STOCK_THRESHOLD} ve altında olan ürünler.</p>
            </div>
            <Link to="/admin/urunler">
              <Button variant="secondary">Ürünler</Button>
            </Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-muted">Kritik stokta ürün yok.</p>
          ) : (
            <div className="admin-lowstock-list">
              {lowStockProducts.map((product) => (
                <div className="admin-lowstock-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span className="text-muted">{translateCategoryName('tr', product.category.slug, product.category.name)}</span>
                  </div>
                  <span className={product.stock === 0 ? 'order-badge order-badge--payment-failed' : 'order-badge order-badge--payment-pending'}>
                    {product.stock === 0 ? 'Tükendi' : `${product.stock} adet`}
                  </span>
                  <Link to={`/admin/urunler/${product.id}`}>
                    <Button variant="secondary">Düzenle</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
