import { NavLink, Outlet } from 'react-router-dom';

export function AdminChrome() {
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
          <NavLink to="/">Mağazayı Gör</NavLink>
        </nav>
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
