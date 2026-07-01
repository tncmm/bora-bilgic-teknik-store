import { Button, EmptyState, InputField, SelectField, StatCard, TextareaField } from '@bora/ui';
import type { Category, Product } from '@bora/types';
import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateCategoryName, translateOrderStatus } from '../../shared/lib/i18n';

function parseSpecs(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(':');
      return {
        name: name.trim(),
        value: rest.join(':').trim(),
      };
    })
    .filter((item) => item.name && item.value);
}

export function AdminDashboardPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    newOrders: 0,
    activeInventory: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    if (!token) return;
    void api.getAdminDashboard(token).then(setMetrics).catch(() => undefined);
  }, [token]);

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Sistem Gorunumu' : 'System Overview'}</h1>
          <p>{language === 'tr' ? 'Bora Bilgic Teknik icin canli metrikler ve teknik operasyon ozeti.' : 'Live metrics and technical operations for Bora Bilgic Teknik.'}</p>
        </div>
        <div className="admin-headline__actions">
          <Button variant="secondary">{language === 'tr' ? 'Veriyi Disa Aktar' : 'Export Data'}</Button>
          <Button>+ {language === 'tr' ? 'Urun Ekle' : 'Add Product'}</Button>
        </div>
      </div>

      <div className="admin-grid">
        <StatCard hint={language === 'tr' ? 'Seed siparis verilerinden hesaplanir' : 'Calculated from seeded orders'} title={language === 'tr' ? 'Toplam Satis' : 'Total Sales'} value={formatCurrency(metrics.totalSales, language)} />
        <StatCard hint={language === 'tr' ? 'Beklemedeki siparisler' : 'Orders in pending state'} title={language === 'tr' ? 'Yeni Siparisler' : 'New Orders'} value={`${metrics.newOrders}`} />
        <StatCard hint={language === 'tr' ? 'Mevcut stok toplami' : 'Current total stock'} title={language === 'tr' ? 'Aktif Envanter' : 'Active Inventory'} value={`${metrics.activeInventory}`} />
        <StatCard hint={language === 'tr' ? 'Kritik stok esigi' : 'Critical stock threshold'} title={language === 'tr' ? 'Dusuk Stok Uyarilari' : 'Low Stock Alerts'} value={`${metrics.lowStockCount}`} />
      </div>

      <div className="admin-stat-grid">
        <div className="admin-panel admin-panel--chart">
          <h2>{language === 'tr' ? 'Satis Performansi' : 'Sales Performance'}</h2>
          <div className="bar-chart">
            <span style={{ height: '38%' }} />
            <span style={{ height: '62%' }} />
            <span style={{ height: '44%' }} />
            <span style={{ height: '78%' }} />
            <span className="is-active" style={{ height: '90%' }} />
            <span style={{ height: '28%' }} />
            <span style={{ height: '54%' }} />
          </div>
        </div>
        <div className="table-stack">
          <div className="admin-panel">
            <h2>{language === 'tr' ? 'Sunucu Durumu' : 'Server Status'}</h2>
            <p>{language === 'tr' ? 'Birincil Merkez: Istanbul' : 'Primary Hub: Istanbul'}</p>
            <p>{language === 'tr' ? 'Gecikme: 24ms' : 'Latency: 24ms'}</p>
          </div>
          <div className="admin-panel">
            <h2>{language === 'tr' ? 'Stok Uyarilari' : 'Stock Alerts'}</h2>
            <div className="mini-grid">
              <div>
                <div className="text-muted">DJI Inspire 3</div>
                <strong>{language === 'tr' ? 'Dusuk' : 'Low'}</strong>
              </div>
              <div>
                <div className="text-muted">DJI Matrice 400</div>
                <strong>{language === 'tr' ? 'Teklif' : 'Quote'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminProductsPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    brand: 'DJI',
    categoryId: '',
    shortDescription: '',
    description: '',
    sku: '',
    badge: '',
    heroTag: '',
    price: '0',
    stock: '0',
    isPublished: true,
    isPurchasable: false,
    imageUrl: '',
    imageAlt: '',
    specsText: 'Sensor: Full Frame\nFlight Time: 20 dakika',
  });

  async function loadData() {
    if (!token) return;
    const [nextProducts, nextCategories] = await Promise.all([
      api.getAdminProducts(token),
      api.getAdminCategories(token),
    ]);
    setProducts(nextProducts);
    setCategories(nextCategories);
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const title = useMemo(
    () => (editingProduct ? (language === 'tr' ? 'Urunu Guncelle' : 'Update Product') : language === 'tr' ? 'Urun Ekle' : 'Add Product'),
    [editingProduct, language],
  );

  function fillForm(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      categoryId: product.categoryId,
      shortDescription: product.shortDescription,
      description: product.description,
      sku: product.sku,
      badge: product.badge ?? '',
      heroTag: product.heroTag ?? '',
      price: String(product.price),
      stock: String(product.stock),
      isPublished: product.isPublished,
      isPurchasable: product.isPurchasable,
      imageUrl: product.images[0]?.url ?? '',
      imageAlt: product.images[0]?.alt ?? product.name,
      specsText: product.specs.map((spec) => `${spec.name}: ${spec.value}`).join('\n'),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const payload = {
      name: form.name,
      slug: form.slug,
      brand: form.brand,
      categoryId: form.categoryId,
      shortDescription: form.shortDescription,
      description: form.description,
      sku: form.sku,
      badge: form.badge || null,
      heroTag: form.heroTag || null,
      price: Number(form.price),
      stock: Number(form.stock),
      isPublished: form.isPublished,
      isPurchasable: form.isPurchasable,
      images: [
        {
          url: form.imageUrl,
          alt: form.imageAlt || form.name,
          isPrimary: true,
        },
      ],
      specs: parseSpecs(form.specsText),
    };

    if (editingProduct) {
      await api.updateAdminProduct(token, editingProduct.id, payload);
    } else {
      await api.createAdminProduct(token, payload);
    }

    setEditingProduct(null);
    setForm({
      name: '',
      slug: '',
      brand: 'DJI',
      categoryId: categories[0]?.id ?? '',
      shortDescription: '',
      description: '',
      sku: '',
      badge: '',
      heroTag: '',
      price: '0',
      stock: '0',
      isPublished: true,
      isPurchasable: false,
      imageUrl: '',
      imageAlt: '',
      specsText: 'Sensor: Full Frame\nFlight Time: 20 dakika',
    });
    await loadData();
  }

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Urunleri Yonet' : 'Manage Products'}</h1>
          <p>{language === 'tr' ? 'Admin paneli yalnizca DJI katalogunu yonetir; marka sabitlenmistir.' : 'The admin panel manages only the DJI catalog; the brand is fixed.'}</p>
        </div>
      </div>

      <div className="admin-products-layout">
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>{language === 'tr' ? 'Urun' : 'Product'}</th>
                <th>{language === 'tr' ? 'Marka' : 'Brand'}</th>
                <th>{language === 'tr' ? 'Fiyat' : 'Price'}</th>
                <th>{language === 'tr' ? 'Durum' : 'Status'}</th>
                <th>{language === 'tr' ? 'Aksiyonlar' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <div className="text-muted">{product.shortDescription}</div>
                  </td>
                  <td>{product.brand}</td>
                  <td>{formatCurrency(product.price, language)}</td>
                  <td>{product.isPurchasable ? (language === 'tr' ? 'Satista' : 'Live') : language === 'tr' ? 'Sadece Tanitim' : 'Promo Only'}</td>
                  <td>
                    <div className="admin-table__actions">
                      <Button onClick={() => fillForm(product)} variant="secondary">
                        {language === 'tr' ? 'Duzenle' : 'Edit'}
                      </Button>
                      <Button
                        onClick={() => {
                          if (!token) return;
                          void api.updateSaleStatus(token, product.id, !product.isPurchasable).then(loadData);
                        }}
                        variant="ghost"
                      >
                        {product.isPurchasable ? (language === 'tr' ? 'Satisi Kapat' : 'Close Sale') : language === 'tr' ? 'Satisi Ac' : 'Open Sale'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="admin-panel" onSubmit={handleSubmit}>
          <div className="detail-chip">{title}</div>
          <div className="admin-form-grid">
            <InputField label={language === 'tr' ? 'Urun Adi' : 'Product Name'} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} value={form.name} />
            <InputField label="Slug" onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))} value={form.slug} />
            <InputField disabled label={language === 'tr' ? 'Marka' : 'Brand'} onChange={() => undefined} value={form.brand} />
            <SelectField
              label={language === 'tr' ? 'Kategori' : 'Category'}
              onChange={(event) => setForm((value) => ({ ...value, categoryId: event.target.value }))}
              value={form.categoryId}
            >
              <option value="">{language === 'tr' ? 'Seciniz' : 'Select'}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {translateCategoryName(language, category.slug, category.name)}
                </option>
              ))}
            </SelectField>
            <div className="full">
              <InputField
                label={language === 'tr' ? 'Kisa Aciklama' : 'Short Description'}
                onChange={(event) => setForm((value) => ({ ...value, shortDescription: event.target.value }))}
                value={form.shortDescription}
              />
            </div>
            <div className="full">
              <TextareaField
                label={language === 'tr' ? 'Detay Aciklama' : 'Detailed Description'}
                onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                value={form.description}
              />
            </div>
            <InputField label="SKU" onChange={(event) => setForm((value) => ({ ...value, sku: event.target.value }))} value={form.sku} />
            <InputField label="Badge" onChange={(event) => setForm((value) => ({ ...value, badge: event.target.value }))} value={form.badge} />
            <InputField label="Hero Tag" onChange={(event) => setForm((value) => ({ ...value, heroTag: event.target.value }))} value={form.heroTag} />
            <InputField label={language === 'tr' ? 'Fiyat' : 'Price'} onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} value={form.price} />
            <InputField label={language === 'tr' ? 'Stok' : 'Stock'} onChange={(event) => setForm((value) => ({ ...value, stock: event.target.value }))} value={form.stock} />
            <div className="full">
              <InputField
                label={language === 'tr' ? 'Gorsel URL' : 'Image URL'}
                onChange={(event) => setForm((value) => ({ ...value, imageUrl: event.target.value }))}
                value={form.imageUrl}
              />
            </div>
            <div className="full">
              <InputField
                label={language === 'tr' ? 'Gorsel ALT' : 'Image ALT'}
                onChange={(event) => setForm((value) => ({ ...value, imageAlt: event.target.value }))}
                value={form.imageAlt}
              />
            </div>
            <div className="full">
              <TextareaField
                label="Specs"
                onChange={(event) => setForm((value) => ({ ...value, specsText: event.target.value }))}
                value={form.specsText}
              />
            </div>
          </div>
          <div className="auth-actions" style={{ marginTop: '1rem' }}>
            <label>
              <input
                checked={form.isPublished}
                onChange={(event) => setForm((value) => ({ ...value, isPublished: event.target.checked }))}
                type="checkbox"
              />{' '}
              {language === 'tr' ? 'Yayinda' : 'Published'}
            </label>
            <label>
              <input
                checked={form.isPurchasable}
                onChange={(event) => setForm((value) => ({ ...value, isPurchasable: event.target.checked }))}
                type="checkbox"
              />{' '}
              {language === 'tr' ? 'Satin Alinabilir' : 'Purchasable'}
            </label>
          </div>
          <Button style={{ marginTop: '1rem' }} type="submit">
            {editingProduct ? (language === 'tr' ? 'Guncelle' : 'Update') : language === 'tr' ? 'Olustur' : 'Create'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AdminOrdersPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [orders, setOrders] = useState<Array<any>>([]);

  async function loadOrders() {
    if (!token) return;
    const response = await api.getAdminOrders(token);
    setOrders(response);
  }

  useEffect(() => {
    void loadOrders();
  }, [token]);

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Son Siparisler' : 'Recent Orders'}</h1>
          <p>{language === 'tr' ? 'Seed siparisleri burada statu bazli goruntulenir ve guncellenebilir.' : 'Seeded orders are shown here by status and can be updated.'}</p>
        </div>
      </div>
      <div className="admin-table">
        {orders.length === 0 ? (
          <EmptyState description={language === 'tr' ? 'Henuz siparis kaydi bulunmuyor.' : 'There are no order records yet.'} title={language === 'tr' ? 'Siparis yok' : 'No orders'} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{language === 'tr' ? 'Siparis ID' : 'Order ID'}</th>
                <th>{language === 'tr' ? 'Musteri' : 'Client'}</th>
                <th>{language === 'tr' ? 'Tarih' : 'Date'}</th>
                <th>{language === 'tr' ? 'Durum' : 'Status'}</th>
                <th>{language === 'tr' ? 'Tutar' : 'Amount'}</th>
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
                  <td>{formatDate(order.createdAt, language)}</td>
                  <td>
                    <select
                      className="ui-select"
                      onChange={(event) => {
                        if (!token) return;
                        void api.updateAdminOrderStatus(token, order.id, event.target.value).then(loadOrders);
                      }}
                      value={order.status.toUpperCase()}
                    >
                      <option value="PENDING">{translateOrderStatus(language, 'pending')}</option>
                      <option value="PROCESSING">{translateOrderStatus(language, 'processing')}</option>
                      <option value="SHIPPED">{translateOrderStatus(language, 'shipped')}</option>
                      <option value="DELIVERED">{translateOrderStatus(language, 'delivered')}</option>
                    </select>
                  </td>
                  <td>
                    <strong>{formatCurrency(order.total, language)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [users, setUsers] = useState<Array<any>>([]);

  useEffect(() => {
    if (!token) return;
    void api.getAdminUsers(token).then(setUsers).catch(() => undefined);
  }, [token]);

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Kullanicilari Yonet' : 'Manage Users'}</h1>
          <p>{language === 'tr' ? 'Seed hesaplari ile admin kullanici listesi bos gorunmez.' : 'Seed accounts keep the admin user list from appearing empty.'}</p>
        </div>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>{language === 'tr' ? 'Ad Soyad' : 'Full Name'}</th>
              <th>{language === 'tr' ? 'E-posta' : 'Email'}</th>
              <th>{language === 'tr' ? 'Rol' : 'Role'}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>
                    {user.firstName} {user.lastName}
                  </strong>
                </td>
                <td>{user.email}</td>
                <td>{language === 'tr' ? (user.role === 'admin' ? 'Yonetici' : 'Musteri') : user.role === 'admin' ? 'Admin' : 'Customer'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
