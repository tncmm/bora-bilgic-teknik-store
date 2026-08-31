import { NavLink, Outlet } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';

export function AdminChrome() {
  const { language } = useI18n();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <NavLink className="brand-mark" to="/admin">
          <img src="/logo.png" alt="Bora Bilgiç" className="dji-logo" />
        </NavLink>
        <nav className="admin-sidebar__nav">
          <NavLink end to="/admin">{language === 'tr' ? 'Panel' : 'Dashboard'}</NavLink>
          <NavLink to="/admin/urunler">{language === 'tr' ? 'Ürünler' : 'Products'}</NavLink>
          <NavLink to="/admin/kampanyalar">Kampanyalar</NavLink>
          <NavLink to="/admin/hero-gorselleri">Ana Görseller</NavLink>
          <NavLink to="/admin/kategoriler">Kategoriler</NavLink>
          <NavLink to="/admin/markalar">Markalar</NavLink>
          <NavLink to="/admin/siparisler">{language === 'tr' ? 'Siparişler' : 'Orders'}</NavLink>
          <NavLink to="/admin/kullanicilar">{language === 'tr' ? 'Kullanıcılar' : 'Users'}</NavLink>
          <NavLink to="/">{language === 'tr' ? 'Mağazayı Gör' : 'View Store'}</NavLink>
        </nav>
        <div className="admin-sidebar__profile">
          <strong>{language === 'tr' ? 'Yönetici Kullanıcı' : 'Admin User'}</strong>
          <div className="footer-caption">{language === 'tr' ? 'Sistem Yönetimi' : 'System Master'}</div>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
