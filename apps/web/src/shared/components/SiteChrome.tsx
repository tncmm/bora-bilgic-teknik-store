import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

import type { Category } from '@bora/types';

import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../api/client';
import { storefrontSections } from '../lib/storefront';

export function SiteChrome() {
  const { cartCount, isAuthenticated } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void api.listCategories().then(setCategories).catch(() => undefined);
  }, []);

  return (
    <div className="dji-site-shell">
      <header className="dji-header">
        <div className="ui-shell dji-header__inner">
          <NavLink className="dji-wordmark" to="/">
            <img src="/logo.png" alt="Bora Bilgiç" className="dji-logo" />
          </NavLink>

          <nav className={`dji-nav ${menuOpen ? 'is-open' : ''}`}>
            <NavLink end to="/">
              ANASAYFA
            </NavLink>
            {(categories.length > 0
              ? categories.map((category) => ({ slug: category.slug, label: category.name, path: `/kategori/${category.slug}` }))
              : storefrontSections
            ).map((section) => (
              <NavLink key={section.slug} to={section.path}>
                {section.label.toUpperCase()}
              </NavLink>
            ))}
            <NavLink to="/iletisim">İLETİŞİM</NavLink>
          </nav>

          <div className="dji-header__actions">
            <NavLink aria-label="Katalogda ara" className="dji-header__icon" to="/katalog">
              <span className="material-symbols-outlined">search</span>
            </NavLink>
            <NavLink aria-label="Hesap" className="dji-header__icon" to={isAuthenticated ? '/profil' : '/giris'}>
              <span className="material-symbols-outlined">person</span>
            </NavLink>
            <NavLink aria-label="Sepet" className="dji-header__icon dji-cart-link" to="/sepet">
              <span className="material-symbols-outlined">shopping_cart</span>
              {cartCount > 0 ? <span className="dji-cart-count">{cartCount}</span> : null}
            </NavLink>
            <button aria-label="Menü" className="dji-header__toggle" onClick={() => setMenuOpen((value) => !value)} type="button">
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dji-main">
        <Outlet />
      </main>
    </div>
  );
}
