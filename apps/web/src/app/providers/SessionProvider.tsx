import type { AuthResponse, Cart, Product, ThemeMode, User, Wishlist } from '@bora/types';
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
  addCartItem: (product: Product, quantity: number) => Promise<void>;
  updateCartItem: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
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
const GUEST_CART_KEY = 'bora-guest-cart';

interface GuestCartLine {
  product: Product;
  quantity: number;
}

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

function buildGuestCart(lines: GuestCartLine[]): Cart {
  const items = lines.map((line) => ({
    id: `guest-${line.product.id}`,
    productId: line.product.id,
    quantity: line.quantity,
    product: line.product,
    lineTotal: line.product.effectivePrice * line.quantity,
  }));

  return {
    id: 'guest-cart',
    items,
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function readGuestCart() {
  return buildGuestCart(readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? []);
}

function writeGuestCart(lines: GuestCartLine[]) {
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  return buildGuestCart(lines);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => readStorage<User>(USER_KEY));
  const [cart, setCart] = useState<Cart | null>(() => (window.localStorage.getItem(TOKEN_KEY) ? null : readGuestCart()));
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
    const guestLines = readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? [];
    for (const line of guestLines) {
      await api.addToCart(response.accessToken, { productId: line.product.id, quantity: line.quantity });
    }
    if (guestLines.length > 0) {
      window.localStorage.removeItem(GUEST_CART_KEY);
      await syncCartInternal(response.accessToken);
    }
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
    setCart(readGuestCart());
  }

  async function syncCart() {
    if (!token) {
      setCart(readGuestCart());
      return;
    }
    await syncCartInternal(token);
  }

  async function addCartItem(product: Product, quantity: number) {
    if (token) {
      await api.addToCart(token, { productId: product.id, quantity });
      await syncCartInternal(token);
      return;
    }

    const lines = readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? [];
    const existing = lines.find((line) => line.product.id === product.id);
    if (existing) {
      existing.quantity = Math.min(10, existing.quantity + quantity);
    } else {
      lines.push({ product, quantity });
    }
    setCart(writeGuestCart(lines));
  }

  async function updateCartItem(itemId: string, quantity: number) {
    if (token) {
      await api.updateCartItem(token, itemId, quantity);
      await syncCartInternal(token);
      return;
    }

    const productId = itemId.replace(/^guest-/, '');
    const lines = (readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? []).map((line) =>
      line.product.id === productId ? { ...line, quantity } : line,
    );
    setCart(writeGuestCart(lines));
  }

  async function removeCartItem(itemId: string) {
    if (token) {
      await api.removeCartItem(token, itemId);
      await syncCartInternal(token);
      return;
    }

    const productId = itemId.replace(/^guest-/, '');
    const lines = (readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? []).filter((line) => line.product.id !== productId);
    setCart(writeGuestCart(lines));
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
      addCartItem,
      updateCartItem,
      removeCartItem,
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
