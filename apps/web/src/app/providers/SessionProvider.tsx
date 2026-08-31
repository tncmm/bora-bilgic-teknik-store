import type { AuthResponse, Cart, ThemeMode, User, Wishlist } from '@bora/types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../../shared/api/client';

interface SessionContextValue {
  user: User | null;
  token: string | null;
  cart: Cart | null;
  wishlist: Wishlist | null;
  themeMode: ThemeMode;
  isAuthenticated: boolean;
  isAdmin: boolean;
  cartCount: number;
  favoritesCount: number;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { firstName: string; lastName: string; email: string; password: string }) => Promise<string>;
  applyAuthResponse: (response: AuthResponse) => void;
  logout: () => void;
  syncCart: () => Promise<void>;
  syncWishlist: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<'added' | 'removed'>;
  isFavorite: (productId: string) => boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const TOKEN_KEY = 'bora-session-token';
const USER_KEY = 'bora-session-user';
const THEME_KEY = 'bora-theme-mode';

function readStorage<T>(key: string): T | null {
  const value = window.localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function applyTheme(mode: ThemeMode) {
  const theme =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode;

  document.documentElement.dataset.theme = theme;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => readStorage<User>(USER_KEY));
  const [cart, setCart] = useState<Cart | null>(null);
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (window.localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'light';
  });

  useEffect(() => {
    applyTheme(themeMode);
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!token) return;

    void Promise.all([refreshProfileInternal(token), syncCartInternal(token), syncWishlistInternal(token)]);
  }, [token]);

  async function refreshProfileInternal(nextToken: string) {
    try {
      const profile = await api.getProfile(nextToken);
      setUser(profile);
      window.localStorage.setItem(USER_KEY, JSON.stringify(profile));
    } catch {
      logout();
    }
  }

  async function syncCartInternal(nextToken: string) {
    try {
      const nextCart = await api.getCart(nextToken);
      setCart(nextCart);
    } catch {
      setCart(null);
    }
  }

  async function syncWishlistInternal(nextToken: string) {
    try {
      const nextWishlist = await api.getFavorites(nextToken);
      setWishlist(nextWishlist);
    } catch {
      setWishlist(null);
    }
  }

  function applyAuthResponse(response: AuthResponse) {
    setToken(response.accessToken);
    setUser(response.user);
    window.localStorage.setItem(TOKEN_KEY, response.accessToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }

  async function login(payload: { email: string; password: string }) {
    const response = await api.login(payload);
    applyAuthResponse(response);
  }

  async function register(payload: { firstName: string; lastName: string; email: string; password: string }) {
    const response = await api.register(payload);
    return response.message;
  }

  function logout() {
    setToken(null);
    setUser(null);
    setCart(null);
    setWishlist(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    void api.logout();
  }

  async function syncCart() {
    if (!token) return;
    await syncCartInternal(token);
  }

  async function syncWishlist() {
    if (!token) return;
    await syncWishlistInternal(token);
  }

  async function toggleFavorite(productId: string) {
    if (!token) {
      throw new Error('Favoriler için giriş yapmalısınız.');
    }

    const exists = wishlist?.items.some((item) => item.productId === productId) ?? false;
    const nextWishlist = exists ? await api.removeFavorite(token, productId) : await api.addFavorite(token, { productId });
    setWishlist(nextWishlist);
    return exists ? 'removed' : 'added';
  }

  function isFavorite(productId: string) {
    return wishlist?.items.some((item) => item.productId === productId) ?? false;
  }

  async function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode);
    if (token) {
      await api.updateTheme(token, mode);
    }
  }

  async function refreshProfile() {
    if (!token) return;
    await refreshProfileInternal(token);
  }

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      token,
      cart,
      wishlist,
      themeMode,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'admin',
      cartCount: cart?.itemCount ?? 0,
      favoritesCount: wishlist?.itemCount ?? 0,
      login,
      register,
      applyAuthResponse,
      logout,
      syncCart,
      syncWishlist,
      toggleFavorite,
      isFavorite,
      setThemeMode,
      refreshProfile,
    }),
    [user, token, cart, wishlist, themeMode],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }

  return context;
}
