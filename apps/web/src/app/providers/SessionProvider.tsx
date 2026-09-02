import type { AuthResponse, Cart, Product, User, Wishlist } from '@bora/types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../../shared/api/client';
import { computePackageUnitPrice } from '../../shared/lib/pricing';
import { useToast } from './ToastProvider';

interface SessionContextValue {
  user: User | null;
  token: string | null;
  cart: Cart | null;
  wishlist: Wishlist | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  cartCount: number;
  favoritesCount: number;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { firstName: string; lastName: string; email: string; password: string }) => Promise<string>;
  applyAuthResponse: (response: AuthResponse) => void;
  logout: () => void;
  syncCart: () => Promise<void>;
  addCartItem: (product: Product, quantity: number, packageOptionId?: string) => Promise<void>;
  updateCartItem: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  syncWishlist: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<'added' | 'removed'>;
  isFavorite: (productId: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const TOKEN_KEY = 'bora-session-token';
const USER_KEY = 'bora-session-user';
const GUEST_CART_KEY = 'bora-guest-cart';

interface GuestCartLine {
  product: Product;
  quantity: number;
  /** Paketli satirlarda secilen paket; taban urunde yok (eski kayitlarla uyumlu). */
  packageOptionId?: string;
  packageLabel?: string | null;
  /** Paketli satirlarin birim fiyati (paket fiyati + urun indirimi). */
  unitPrice?: number;
}

/** Ayni urunun farkli paketleri ayri satirlardir; taban satir id'si eski haliyle kalir. */
function guestLineId(line: Pick<GuestCartLine, 'product' | 'packageOptionId'>) {
  return line.packageOptionId ? `guest-${line.product.id}-${line.packageOptionId}` : `guest-${line.product.id}`;
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

function buildGuestCart(lines: GuestCartLine[]): Cart {
  const items = lines.map((line) => {
    // Paketli satirlarda unitPrice (paket fiyati uzerinden indirim); eski/temel
    // kayitlarda urunun etkin fiyati kullanilir.
    const unitPrice = line.unitPrice ?? line.product.effectivePrice ?? line.product.price;
    return {
      id: guestLineId(line),
      productId: line.product.id,
      packageOptionId: line.packageOptionId ?? null,
      packageLabel: line.packageLabel ?? null,
      quantity: line.quantity,
      product: line.product,
      lineTotal: unitPrice * line.quantity,
    };
  });

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
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => readStorage<User>(USER_KEY));
  const [cart, setCart] = useState<Cart | null>(() => (window.localStorage.getItem(TOKEN_KEY) ? null : readGuestCart()));
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);

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
    let skippedLines = 0;
    for (const line of guestLines) {
      try {
        // Taban satirlarda packageOptionId alanini hic gondermeyerek taban urun satiri olustur.
        await api.addToCart(response.accessToken, {
          productId: line.product.id,
          quantity: line.quantity,
          ...(line.packageOptionId ? { packageOptionId: line.packageOptionId } : {}),
        });
      } catch {
        // Tek satir (stok/paket degismis, limit dolu vb.) tum girisi bloklamasin.
        skippedLines += 1;
      }
    }
    if (guestLines.length > 0) {
      window.localStorage.removeItem(GUEST_CART_KEY);
      await syncCartInternal(response.accessToken);
      if (skippedLines > 0) {
        showToast({
          tone: 'error',
          title: 'Sepetin tamamen aktarılamadı',
          description: `${skippedLines} ürün stok ya da paket değişikliği nedeniyle sepete eklenemedi.`,
        });
      }
    }
  }

  async function register(payload: { firstName: string; lastName: string; email: string; password: string }) {
    const response = await api.register(payload);
    return response.message;
  }

  function logout() {
    const currentToken = token;
    setToken(null);
    setUser(null);
    setCart(null);
    setWishlist(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    void api.logout(currentToken ?? undefined).catch(() => undefined);
    setCart(readGuestCart());
  }

  async function syncCart() {
    if (!token) {
      setCart(readGuestCart());
      return;
    }
    await syncCartInternal(token);
  }

  async function addCartItem(product: Product, quantity: number, packageOptionId?: string) {
    if (token) {
      await api.addToCart(token, {
        productId: product.id,
        quantity,
        ...(packageOptionId ? { packageOptionId } : {}),
      });
      await syncCartInternal(token);
      return;
    }

    const lines = readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? [];
    // Ayni urun + ayni paket tek satirda birlesir; farkli paket ayri satirdir.
    const existing = lines.find(
      (line) => line.product.id === product.id && (line.packageOptionId ?? undefined) === packageOptionId,
    );
    if (existing) {
      existing.quantity = Math.min(10, existing.quantity + quantity);
    } else {
      const unitPrice = computePackageUnitPrice(product, packageOptionId);
      const option = packageOptionId
        ? product.packageOptions?.find((entry) => entry.id === packageOptionId)
        : undefined;
      lines.push({
        product,
        quantity,
        ...(packageOptionId
          ? {
              packageOptionId,
              packageLabel: option?.name ?? null,
              ...(unitPrice !== undefined ? { unitPrice } : {}),
            }
          : {}),
      });
    }
    setCart(writeGuestCart(lines));
  }

  async function updateCartItem(itemId: string, quantity: number) {
    if (token) {
      await api.updateCartItem(token, itemId, quantity);
      await syncCartInternal(token);
      return;
    }

    const lines = (readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? []).map((line) =>
      guestLineId(line) === itemId ? { ...line, quantity } : line,
    );
    setCart(writeGuestCart(lines));
  }

  async function removeCartItem(itemId: string) {
    if (token) {
      await api.removeCartItem(token, itemId);
      await syncCartInternal(token);
      return;
    }

    const lines = (readStorage<GuestCartLine[]>(GUEST_CART_KEY) ?? []).filter((line) => guestLineId(line) !== itemId);
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
      refreshProfile,
    }),
    [user, token, cart, wishlist, showToast],
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
