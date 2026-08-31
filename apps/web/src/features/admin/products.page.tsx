import { Button, EmptyState } from '@bora/ui';
import type { Category, Product } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency } from '../../shared/lib/format';
import { translateCategoryName } from '../../shared/lib/i18n';

export function AdminProductsPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');

  async function loadData() {
    if (!token) return;
    const [nextProducts, nextCategories] = await Promise.all([api.getAdminProducts(token), api.getAdminCategories(token)]);
    setProducts(nextProducts);
    setCategories(nextCategories);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const query = search.trim().toLowerCase();
  const visibleProducts = query
    ? products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query))
    : products;

  async function toggleSale(product: Product) {
    if (!token) return;
    try {
      await api.updateSaleStatus(token, product.id, !product.isPurchasable);
      await loadData();
      showToast({
        tone: 'success',
        title: product.isPurchasable ? 'Satış kapatıldı' : 'Satış açıldı',
        description: product.isPurchasable ? 'Ürün artık satın alınamaz, vitrine teklif modunda çıkar.' : 'Ürün tekrar satın alınabilir.',
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'İşlem başarısız', description: (error as Error).message });
    }
  }

  async function toggleBestseller(product: Product) {
    if (!token) return;
    try {
      await api.updateBestsellerStatus(token, product.id, !product.isBestseller);
      await loadData();
      showToast({
        tone: 'success',
        title: product.isBestseller ? 'Çok satan kaldırıldı' : 'Çok satan işaretlendi',
        description: product.isBestseller ? 'Ürün çok satanlar listesinden çıkarıldı.' : 'Ürün çok satanlar listesine eklendi.',
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'İşlem başarısız', description: (error as Error).message });
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Ürünler</h1>
          <p>DJI katalogundaki tüm ürünler. Düzenleme ve yeni ürün oluşturma ayrı sayfada yapılır.</p>
        </div>
        <div className="admin-headline__actions">
          <Link to="/admin/urunler/yeni">
            <Button>+ Yeni Ürün</Button>
          </Link>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            className="ui-input admin-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ürün adı veya SKU ara..."
            value={search}
          />
          <span className="text-muted">{visibleProducts.length} ürün</span>
        </div>

        {visibleProducts.length === 0 ? (
          <EmptyState description="Aradığınız filtreyle eşleşen ürün bulunamadı." title="Ürün bulunamadı" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Kategori</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'center' }}>Çok Satan</th>
                  <th style={{ textAlign: 'right' }}>Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <div className="text-muted">{product.sku}</div>
                    </td>
                    <td>{categories.length ? translateCategoryName('tr', product.category.slug, product.category.name) : ''}</td>
                    <td>{formatCurrency(product.price, 'tr')}</td>
                    <td>
                      <span className={product.stock === 0 ? 'order-badge order-badge--payment-failed' : product.stock <= 3 ? 'order-badge order-badge--payment-pending' : 'order-badge order-badge--payment-paid'}>
                        {product.stock} adet
                      </span>
                    </td>
                    <td>{product.isPurchasable ? 'Satışta' : 'Satışa Kapalı'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="admin-switch-wrap" onClick={() => void toggleBestseller(product)} type="button" aria-pressed={product.isBestseller}>
                        <span className={product.isBestseller ? 'order-badge order-badge--payment-paid' : 'order-badge'}>{product.isBestseller ? 'Evet' : 'Hayır'}</span>
                      </button>
                    </td>
                    <td>
                      <div className="admin-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Link to={`/admin/urunler/${product.id}`}>
                          <Button variant="secondary">Düzenle</Button>
                        </Link>
                        <Button onClick={() => void toggleSale(product)} variant="ghost">
                          {product.isPurchasable ? 'Satışı Kapat' : 'Satışı Aç'}
                        </Button>
                      </div>
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
