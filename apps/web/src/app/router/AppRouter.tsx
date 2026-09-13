import { Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { CatalogPage, ContactPage, HomePage, ProductDetailPage } from '../../features/catalog/pages';
import { DeliveryPage, DistanceSalesPage, FaqPage, PrivacyPage, ReturnPage, WarrantyPage } from '../../features/catalog/info-pages';
import { Seo } from '../../shared/components/Seo';
import { AdminChrome } from '../../shared/components/AdminChrome';
import { SiteChrome } from '../../shared/components/SiteChrome';
import { useSession } from '../providers/SessionProvider';

// Storefront kritik yolu (ana sayfa, katalog, ürün detay, bilgi sayfaları)
// eager kalır; hesap/checkout/admin kodu ilk yüklemede inmez. React.lazy
// feature başına ayrı chunk üretir, Suspense rota geçişlerini sarar.
function lazyFeature<T extends Record<string, unknown>>(loader: () => Promise<T>, keys: Array<keyof T & string>) {
  const entries = keys.map((key) => [
    key,
    lazy(() => loader().then((module) => ({ default: module[key] as ComponentType }))),
  ]);
  return Object.fromEntries(entries) as { [K in keyof T & string]: ComponentType };
}

const admin = lazyFeature(() => import('../../features/admin/pages'), [
  'AdminBrandsPage',
  'AdminCampaignsPage',
  'AdminCategoriesPage',
  'AdminDashboardPage',
  'AdminHeroSlidesPage',
  'AdminOrdersPage',
  'AdminProductFormPage',
  'AdminProductsPage',
  'AdminSiteSettingsPage',
  'AdminUsersPage',
]);
const auth = lazyFeature(() => import('../../features/auth/pages'), ['LoginPage', 'RegisterPage', 'VerifyEmailPage']);
const profile = lazyFeature(() => import('../../features/profile/pages'), [
  'AddressFormPage',
  'AddressesPage',
  'FavoritesPage',
  'ProfilePage',
]);
const orders = lazyFeature(() => import('../../features/orders/pages'), [
  'GuestOrderTrackingPage',
  'OrderDetailPage',
  'OrdersPage',
]);
const payments = lazyFeature(() => import('../../features/orders/payment-pages'), [
  'PaymentFailPage',
  'PaymentSuccessPage',
]);
const cart = lazyFeature(() => import('../../features/cart/pages'), ['CartPage']);
const checkout = lazyFeature(() => import('../../features/cart/checkout.page'), ['CheckoutPage']);

function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { isAuthenticated, isAdmin } = useSession();
  const location = useLocation();
  const from = `${location.pathname}${location.search}${location.hash}`;

  if (!isAuthenticated) {
    return <Navigate replace state={{ from }} to="/giris" />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}

/** Route elemanı olarak meta bağlamak için sarmalayıcı; özel sayfalar noindex. */
function SeoRoute({
  title,
  path,
  description,
  noindex = true,
  children,
}: {
  title: string;
  path: string;
  description?: string;
  noindex?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <Seo description={description} noindex={noindex} path={path} title={title} />
      {children}
    </>
  );
}

/** Admin panelin tamamı tek noindex meta ile korunur. */
function AdminLayout() {
  return (
    <SeoRoute path="/admin" title="Yönetim Paneli">
      <AdminChrome />
    </SeoRoute>
  );
}

function RouteFallback() {
  return (
    <div className="page-section" style={{ display: 'grid', minHeight: '50vh', placeItems: 'center' }}>
      <p className="dji-muted">Yükleniyor...</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="ui-shell page-section">
      <Seo description="Aradığınız sayfa bulunamadı; Bora Bilgiç Teknik mağazasına dönebilirsiniz." noindex path="/404" title="Sayfa bulunamadı" />
      <h1>Sayfa bulunamadi</h1>
      <p>Aradiginiz icerik tasinmis olabilir.</p>
      <Link to="/">Ana sayfaya don</Link>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<SiteChrome />}>
            <Route element={<HomePage />} index />
            <Route element={<CatalogPage forcedSection="drone" />} path="/drone" />
            <Route element={<CatalogPage forcedSection="gimbal" />} path="/gimbal" />
            <Route element={<CatalogPage forcedSection="aksiyon-kamera" />} path="/aksiyon-kamera" />
            <Route element={<CatalogPage forcedSection="aksesuar" />} path="/aksesuar" />
            <Route element={<CatalogPage forcedSection="kurumsal" />} path="/kurumsal" />
            <Route element={<CatalogPage />} path="/kategori/:slug" />
            <Route element={<CatalogPage />} path="/katalog" />
            <Route element={<ProductDetailPage />} path="/urun/:slug" />
            <Route element={<ContactPage />} path="/iletisim" />
            <Route element={<DeliveryPage />} path="/teslimat" />
            <Route element={<ReturnPage />} path="/iade" />
            <Route element={<DistanceSalesPage />} path="/mesafeli-satis" />
            <Route element={<PrivacyPage />} path="/gizlilik" />
            <Route element={<WarrantyPage />} path="/garanti" />
            <Route element={<FaqPage />} path="/sss" />
            <Route element={<SeoRoute path="/sepet" title="Sepetim"><cart.CartPage /></SeoRoute>} path="/sepet" />
            <Route element={<SeoRoute path="/checkout" title="Ödeme"><checkout.CheckoutPage /></SeoRoute>} path="/checkout" />
            <Route element={<SeoRoute path="/odeme/basarili" title="Ödeme Başarılı"><payments.PaymentSuccessPage /></SeoRoute>} path="/odeme/basarili" />
            <Route element={<SeoRoute path="/odeme/basarisiz" title="Ödeme Başarısız"><payments.PaymentFailPage /></SeoRoute>} path="/odeme/basarisiz" />
            <Route element={<SeoRoute path="/siparis-takip" title="Sipariş Takibi"><orders.GuestOrderTrackingPage /></SeoRoute>} path="/siparis-takip/:token" />
            <Route element={<SeoRoute path="/giris" title="Giriş Yap"><auth.LoginPage /></SeoRoute>} path="/giris" />
            <Route element={<SeoRoute path="/kayit" title="Üye Ol"><auth.RegisterPage /></SeoRoute>} path="/kayit" />
            <Route element={<SeoRoute path="/dogrula" title="E-posta Doğrulama"><auth.VerifyEmailPage /></SeoRoute>} path="/dogrula" />
            <Route element={<ProtectedRoute />}>
              <Route element={<SeoRoute path="/profil" title="Hesabım"><profile.ProfilePage /></SeoRoute>} path="/profil" />
              <Route element={<SeoRoute path="/profil/adresler" title="Adreslerim"><profile.AddressesPage /></SeoRoute>} path="/profil/adresler" />
              <Route element={<SeoRoute path="/profil/adresler/ekle" title="Adres Ekle"><profile.AddressFormPage /></SeoRoute>} path="/profil/adresler/ekle" />
              <Route element={<SeoRoute path="/profil/adresler" title="Adres Düzenle"><profile.AddressFormPage /></SeoRoute>} path="/profil/adresler/:addressId/duzenle" />
              <Route element={<SeoRoute path="/favoriler" title="Favorilerim"><profile.FavoritesPage /></SeoRoute>} path="/favoriler" />
              <Route element={<SeoRoute path="/siparislerim" title="Siparişlerim"><orders.OrdersPage /></SeoRoute>} path="/siparislerim" />
              <Route element={<SeoRoute path="/siparislerim" title="Sipariş Detayı"><orders.OrderDetailPage /></SeoRoute>} path="/siparislerim/:orderId" />
            </Route>
          </Route>

          <Route element={<ProtectedRoute adminOnly />}>
            <Route element={<AdminLayout />}>
              <Route element={<admin.AdminDashboardPage />} path="/admin" />
              <Route element={<admin.AdminProductsPage />} path="/admin/urunler" />
              <Route element={<admin.AdminProductFormPage />} path="/admin/urunler/yeni" />
              <Route element={<admin.AdminProductFormPage />} path="/admin/urunler/:productId" />
              <Route element={<admin.AdminCategoriesPage />} path="/admin/kategoriler" />
              <Route element={<admin.AdminCampaignsPage />} path="/admin/kampanyalar" />
              <Route element={<admin.AdminHeroSlidesPage />} path="/admin/hero-gorselleri" />
              <Route element={<admin.AdminBrandsPage />} path="/admin/markalar" />
              <Route element={<admin.AdminOrdersPage />} path="/admin/siparisler" />
              <Route element={<admin.AdminUsersPage />} path="/admin/kullanicilar" />
              <Route element={<admin.AdminSiteSettingsPage />} path="/admin/iletisim" />
            </Route>
          </Route>

          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
