import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AdminDashboardPage, AdminOrdersPage, AdminProductsPage, AdminUsersPage } from '../../features/admin/pages';
import { LoginPage, RegisterPage } from '../../features/auth/pages';
import { CartPage, CheckoutPage } from '../../features/cart/pages';
import { CatalogPage, HomePage, ProductDetailPage } from '../../features/catalog/pages';
import { FavoritesPage, ProfilePage } from '../../features/profile/pages';
import { AdminChrome } from '../../shared/components/AdminChrome';
import { SiteChrome } from '../../shared/components/SiteChrome';
import { useI18n } from '../providers/I18nProvider';
import { useSession } from '../providers/SessionProvider';

function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { isAuthenticated, isAdmin } = useSession();

  if (!isAuthenticated) {
    return <Navigate replace to="/giris" />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}

function NotFoundPage() {
  const { language } = useI18n();

  return (
    <div className="ui-shell page-section">
      <h1>{language === 'tr' ? 'Sayfa bulunamadi' : 'Page not found'}</h1>
      <p>{language === 'tr' ? 'Aradiginiz icerik tasinmis olabilir.' : 'The content you are looking for may have moved.'}</p>
      <Link to="/">{language === 'tr' ? 'Ana sayfaya don' : 'Back to home'}</Link>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteChrome />}>
          <Route element={<HomePage />} index />
          <Route element={<CatalogPage />} path="/katalog" />
          <Route element={<ProductDetailPage />} path="/urun/:slug" />
          <Route element={<LoginPage />} path="/giris" />
          <Route element={<RegisterPage />} path="/kayit" />
          <Route element={<ProtectedRoute />}>
            <Route element={<CartPage />} path="/sepet" />
            <Route element={<CheckoutPage />} path="/checkout" />
            <Route element={<ProfilePage />} path="/profil" />
            <Route element={<FavoritesPage />} path="/favoriler" />
          </Route>
        </Route>

        <Route element={<ProtectedRoute adminOnly />}>
          <Route element={<AdminChrome />}>
            <Route element={<AdminDashboardPage />} path="/admin" />
            <Route element={<AdminProductsPage />} path="/admin/urunler" />
            <Route element={<AdminOrdersPage />} path="/admin/siparisler" />
            <Route element={<AdminUsersPage />} path="/admin/kullanicilar" />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
