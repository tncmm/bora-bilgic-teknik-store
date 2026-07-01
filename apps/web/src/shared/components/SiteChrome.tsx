import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { getLanguageLabel, translateCategoryName, translateThemeMode } from '../lib/i18n';

const navLinks = [
  { to: '/katalog?category=camera-drones', label: 'Camera Drones' },
  { to: '/katalog?category=handheld', label: 'Handheld' },
  { to: '/katalog?category=enterprise', label: 'Enterprise' },
];

const nextThemeMap = {
  light: 'dark',
  dark: 'system',
  system: 'light',
} as const;

export function SiteChrome() {
  const { cartCount, favoritesCount, isAdmin, isAuthenticated, logout, themeMode, setThemeMode } = useSession();
  const { language, toggleLanguage } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div>
      <header className="site-header">
        <div className="ui-shell site-header__inner">
          <div className="site-header__leading">
            <button aria-label={language === 'tr' ? 'Arama' : 'Search'} className="header-icon-button" type="button">
              <span className="material-symbols-outlined">search</span>
            </button>
            <NavLink className="brand-mark" to="/">
              BORA BILGIC TEKNIK
            </NavLink>
          </div>

          <nav className={`site-nav ${menuOpen ? 'site-nav--open' : ''}`}>
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {translateCategoryName(language, new URL(link.to, 'https://example.com').searchParams.get('category') ?? undefined, link.label)}
              </Link>
            ))}
            {isAdmin ? <NavLink to="/admin">{language === 'tr' ? 'Yonetim' : 'Admin'}</NavLink> : null}
          </nav>

          <div className="site-actions">
            <button
              aria-label={language === 'tr' ? `Tema: ${translateThemeMode(language, themeMode)}` : `Theme: ${translateThemeMode(language, themeMode)}`}
              className="header-theme-button"
              onClick={() => void setThemeMode(nextThemeMap[themeMode])}
              type="button"
            >
              {translateThemeMode(language, themeMode)}
            </button>
            <button className="header-theme-button" onClick={toggleLanguage} type="button">
              {getLanguageLabel(language)}
            </button>
            <NavLink aria-label={language === 'tr' ? 'Hesap' : 'Account'} className="header-icon-button" to={isAuthenticated ? '/profil' : '/giris'}>
              <span className="material-symbols-outlined">person</span>
            </NavLink>
            <NavLink aria-label={language === 'tr' ? 'Favoriler' : 'Favorites'} className="header-icon-button cart-badge" to={isAuthenticated ? '/favoriler' : '/giris'}>
              <span className="material-symbols-outlined">favorite</span>
              {favoritesCount > 0 ? <span className="cart-badge__count">{favoritesCount}</span> : null}
            </NavLink>
            <NavLink aria-label={language === 'tr' ? 'Sepet' : 'Cart'} className="header-icon-button cart-badge" to="/sepet">
              <span className="material-symbols-outlined">shopping_bag</span>
              {cartCount > 0 ? <span className="cart-badge__count">{cartCount}</span> : null}
            </NavLink>
            {isAuthenticated ? (
              <button aria-label={language === 'tr' ? 'Cikis yap' : 'Log out'} className="header-icon-button" onClick={logout} type="button">
                <span className="material-symbols-outlined">logout</span>
              </button>
            ) : null}
            <button aria-label={language === 'tr' ? 'Menuyu ac' : 'Open menu'} className="nav-toggle" onClick={() => setMenuOpen((value) => !value)} type="button">
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="ui-shell site-footer__grid">
          <div>
            <h3 className="brand-mark">BORA BILGIC TEKNIK</h3>
            <p>
              {language === 'tr'
                ? 'DJI kamera dronlari, handheld sistemler ve enterprise platformlar icin kurumsal teknik kurgu.'
                : 'A technical storefront focused on DJI camera drones, handheld systems, and enterprise platforms.'}
            </p>
          </div>
          <div>
            <h4>{language === 'tr' ? 'DJI Koleksiyonlari' : 'DJI Collections'}</h4>
            <nav>
              <NavLink to="/katalog?category=camera-drones">{translateCategoryName(language, 'camera-drones')}</NavLink>
              <NavLink to="/katalog?category=handheld">{translateCategoryName(language, 'handheld')}</NavLink>
              <NavLink to="/katalog?category=enterprise">{translateCategoryName(language, 'enterprise')}</NavLink>
            </nav>
          </div>
          <div>
            <h4>{language === 'tr' ? 'Hesap' : 'Account'}</h4>
            <nav>
              <NavLink to="/katalog">{language === 'tr' ? 'Tum DJI Urunleri' : 'All DJI Products'}</NavLink>
              <NavLink to="/favoriler">{language === 'tr' ? 'Favorilerim' : 'My Favorites'}</NavLink>
              <NavLink to="/profil">{language === 'tr' ? 'Profilim' : 'My Profile'}</NavLink>
              <NavLink to="/giris">{language === 'tr' ? 'Giris' : 'Login'}</NavLink>
            </nav>
          </div>
          <div>
            <h4>{language === 'tr' ? 'Destek' : 'Support'}</h4>
            <nav>
              <a href="mailto:info@borabilgicteknik.com">info@borabilgicteknik.com</a>
              <a href="tel:+905551112233">+90 555 111 22 33</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
