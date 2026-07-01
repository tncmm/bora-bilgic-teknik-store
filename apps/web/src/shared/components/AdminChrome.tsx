import { NavLink, Outlet } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { getLanguageLabel } from '../lib/i18n';

export function AdminChrome() {
  const { language, toggleLanguage } = useI18n();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <NavLink className="brand-mark" to="/admin">
          BORA BILGIC
        </NavLink>
        <nav className="admin-sidebar__nav">
          <NavLink end to="/admin">{language === 'tr' ? 'Panel' : 'Dashboard'}</NavLink>
          <NavLink to="/admin/urunler">{language === 'tr' ? 'Urunler' : 'Products'}</NavLink>
          <NavLink to="/admin/siparisler">{language === 'tr' ? 'Siparisler' : 'Orders'}</NavLink>
          <NavLink to="/admin/kullanicilar">{language === 'tr' ? 'Kullanicilar' : 'Users'}</NavLink>
          <NavLink to="/">{language === 'tr' ? 'Magazayi Gor' : 'View Store'}</NavLink>
        </nav>
        <div className="admin-sidebar__profile">
          <button className="header-theme-button" onClick={toggleLanguage} type="button">
            {getLanguageLabel(language)}
          </button>
          <strong>{language === 'tr' ? 'Yonetici Kullanici' : 'Admin User'}</strong>
          <div className="footer-caption">{language === 'tr' ? 'Sistem Yonetimi' : 'System Master'}</div>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
