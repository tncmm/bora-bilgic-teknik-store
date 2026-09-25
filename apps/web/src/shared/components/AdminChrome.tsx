import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { api } from '../api/client';

export function AdminChrome() {
  const [maintenanceOn, setMaintenanceOn] = useState(false);

  useEffect(() => {
    api
      .getSiteStatus()
      .then((status) => setMaintenanceOn(status.maintenanceMode))
      .catch(() => undefined);
  }, []);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <NavLink className="brand-mark" to="/admin">
          <img src="/logo.png" alt="Bora Bilgiç" className="dji-logo" />
        </NavLink>
        <nav className="admin-sidebar__nav">
          <NavLink end to="/admin">Panel</NavLink>
          <NavLink to="/admin/urunler">Ürünler</NavLink>
          <NavLink to="/admin/kampanyalar">Kampanyalar</NavLink>
          <NavLink to="/admin/hero-gorselleri">Ana Görseller</NavLink>
          <NavLink to="/admin/kategoriler">Kategoriler</NavLink>
          <NavLink to="/admin/markalar">Markalar / Ekle</NavLink>
          <NavLink to="/admin/siparisler">Siparişler</NavLink>
          <NavLink to="/admin/kullanicilar">Kullanıcılar</NavLink>
          <NavLink to="/admin/iletisim">İletişim Bilgileri</NavLink>
          <NavLink to="/admin/destek">Destek Talepleri</NavLink>
          <NavLink to="/">Mağazayı Gör</NavLink>
        </nav>
        {maintenanceOn ? (
          <div style={{ background: '#b91c1c', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, margin: '0.75rem', padding: '0.5rem', textAlign: 'center' }}>
            BAKIM MODU AKTİF
          </div>
        ) : null}
        <div className="admin-sidebar__profile">
          <strong>Yönetici Kullanıcı</strong>
          <div className="footer-caption">Sistem Yönetimi</div>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
