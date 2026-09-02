import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AdminBrandsPage, AdminCampaignsPage, AdminCategoriesPage, AdminDashboardPage, AdminHeroSlidesPage, AdminOrdersPage, AdminProductFormPage, AdminProductsPage, AdminUsersPage } from '../../features/admin/pages';
import { LoginPage, RegisterPage, VerifyEmailPage } from '../../features/auth/pages';
import { CartPage, CheckoutPage } from '../../features/cart/pages';
import { CatalogPage, ContactPage, HomePage, ProductDetailPage } from '../../features/catalog/pages';
import { DeliveryPage, DistanceSalesPage, FaqPage, PrivacyPage, ReturnPage, WarrantyPage } from '../../features/catalog/info-pages';
import { GuestOrderTrackingPage, OrderDetailPage, OrdersPage } from '../../features/orders/pages';
import { PaymentFailPage, PaymentSuccessPage } from '../../features/orders/payment-pages';
import { AddressFormPage, AddressesPage, FavoritesPage, ProfilePage } from '../../features/profile/pages';
import { AdminChrome } from '../../shared/components/AdminChrome';
import { SiteChrome } from '../../shared/components/SiteChrome';
import { useSession } from '../providers/SessionProvider';

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

function NotFoundPage() {
  return (
    <div className="ui-shell page-section">
      <h1>Sayfa bulunamadi</h1>
      <p>Aradiginiz icerik tasinmis olabilir.</p>
      <Link to="/">Ana sayfaya don</Link>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
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
          <Route element={<CartPage />} path="/sepet" />
          <Route element={<CheckoutPage />} path="/checkout" />
          <Route element={<PaymentSuccessPage />} path="/odeme/basarili" />
          <Route element={<PaymentFailPage />} path="/odeme/basarisiz" />
          <Route element={<GuestOrderTrackingPage />} path="/siparis-takip/:token" />
          <Route element={<LoginPage />} path="/giris" />
          <Route element={<RegisterPage />} path="/kayit" />
          <Route element={<VerifyEmailPage />} path="/dogrula" />
          <Route element={<ProtectedRoute />}>
            <Route element={<ProfilePage />} path="/profil" />
            <Route element={<AddressesPage />} path="/profil/adresler" />
            <Route element={<AddressFormPage />} path="/profil/adresler/ekle" />
            <Route element={<AddressFormPage />} path="/profil/adresler/:addressId/duzenle" />
            <Route element={<FavoritesPage />} path="/favoriler" />
            <Route element={<OrdersPage />} path="/siparislerim" />
            <Route element={<OrderDetailPage />} path="/siparislerim/:orderId" />
          </Route>
        </Route>

        <Route element={<ProtectedRoute adminOnly />}>
          <Route element={<AdminChrome />}>
            <Route element={<AdminDashboardPage />} path="/admin" />
            <Route element={<AdminProductsPage />} path="/admin/urunler" />
            <Route element={<AdminProductFormPage />} path="/admin/urunler/yeni" />
            <Route element={<AdminProductFormPage />} path="/admin/urunler/:productId" />
            <Route element={<AdminCategoriesPage />} path="/admin/kategoriler" />
            <Route element={<AdminCampaignsPage />} path="/admin/kampanyalar" />
            <Route element={<AdminHeroSlidesPage />} path="/admin/hero-gorselleri" />
            <Route element={<AdminBrandsPage />} path="/admin/markalar" />
            <Route element={<AdminOrdersPage />} path="/admin/siparisler" />
            <Route element={<AdminUsersPage />} path="/admin/kullanicilar" />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
