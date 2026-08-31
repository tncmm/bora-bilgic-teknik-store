import { Button, StatCard } from '@bora/ui';
import type { Product } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';
import { formatCurrency } from '../../shared/lib/format';
import { translateCategoryName } from '../../shared/lib/i18n';

interface DashboardMetrics {
  totalSales: number;
  newOrders: number;
  activeInventory: number;
  lowStockCount: number;
}

const LOW_STOCK_THRESHOLD = 3;

export function AdminDashboardPage() {
  const { token } = useSession();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    newOrders: 0,
    activeInventory: 0,
    lowStockCount: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!token) return;

    void api.getAdminDashboard(token).then(setMetrics).catch(() => undefined);
    void api.getAdminProducts(token).then(setProducts).catch(() => undefined);
  }, [token]);

  const lowStockProducts = products
    .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock);

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Genel Bakış</h1>
          <p>Mağazanın günlük nabzı: satış, sipariş ve stok durumu.</p>
        </div>
        <div className="admin-headline__actions">
          <Link to="/admin/urunler/yeni">
            <Button>+ Yeni Ürün</Button>
          </Link>
        </div>
      </div>

      <div className="admin-grid">
        <StatCard hint="Ödenmiş siparişlerin toplamı" title="Toplam Satış" value={formatCurrency(metrics.totalSales, 'tr')} />
        <StatCard hint="İşlem bekleyen siparişler" title="Yeni Siparişler" value={`${metrics.newOrders}`} />
        <StatCard hint="Toplam ürün adedi" title="Aktif Stok" value={`${metrics.activeInventory}`} />
        <StatCard hint={`Stoğu ${LOW_STOCK_THRESHOLD} ve altında olan ürünler`} title="Düşük Stok" value={`${metrics.lowStockCount}`} />
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Düşük Stoktaki Ürünler</h2>
          <p>Yeniden sipariş vermeniz gereken ürünler burada listelenir.</p>
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
                  {product.stock === 0 ? 'Tükendi' : `${product.stock} adet kaldı`}
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
  );
}
