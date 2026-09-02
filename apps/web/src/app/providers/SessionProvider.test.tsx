import type { Cart, Product } from '@bora/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import { api } from '../../shared/api/client';
import { SessionProvider, useSession } from './SessionProvider';
import { ToastProvider } from './ToastProvider';

vi.mock('../../shared/api/client', () => ({
  api: {
    login: vi.fn(),
    logout: vi.fn(),
    addToCart: vi.fn(),
    getCart: vi.fn(),
    getProfile: vi.fn(),
    getFavorites: vi.fn(),
  },
}));

const packagedProduct: Product = {
  id: 'product-1',
  name: 'Demo Drone',
  slug: 'demo-drone',
  brand: 'DJI',
  categoryId: 'category-1',
  category: {
    id: 'category-1',
    name: 'Camera Drones',
    slug: 'camera-drones',
    description: 'Açıklama',
  },
  shortDescription: 'Short',
  description: 'Long description',
  price: 1000,
  stock: 10,
  sku: 'SKU-1',
  isPublished: true,
  isPurchasable: true,
  isBestseller: false,
  discountPercent: 20,
  effectivePrice: 800,
  images: [{ id: 'image-1', url: 'https://example.com/image.jpg', alt: 'Image', isPrimary: true, kind: 'image', thumbnailUrl: 'https://example.com/image.jpg' }],
  specs: [],
  packageOptions: [
    { id: 'standard', name: 'Standart Paket', price: 1000, isDefault: true },
    { id: 'combo', name: 'Fly More Combo', price: 1250 },
  ],
};

const baseProduct: Product = {
  ...packagedProduct,
  id: 'product-2',
  name: 'Base Drone',
  slug: 'base-drone',
  packageOptions: undefined,
};

const emptyCart: Cart = { id: 'cart-1', items: [], subtotal: 0, itemCount: 0 };

const sessionUser = {
  id: 'user-1',
  firstName: 'Ada',
  lastName: 'Yılmaz',
  email: 'ada@mail.com',
  role: 'customer' as const,
  themeMode: 'system' as const,
};

function readStoredGuestLines(): Array<Record<string, unknown>> {
  return JSON.parse(window.localStorage.getItem('bora-guest-cart') ?? '[]') as Array<Record<string, unknown>>;
}

function GuestCartProbe({ packageOptionId }: { packageOptionId?: string }) {
  const { addCartItem, cart } = useSession();

  return (
    <div>
      <button onClick={() => void addCartItem(packagedProduct, 2, packageOptionId)} type="button">
        sepete ekle
      </button>
      <pre data-testid="cart">{JSON.stringify(cart?.items ?? [])}</pre>
    </div>
  );
}

function LoginProbe() {
  const { login, cart } = useSession();

  return (
    <div>
      <button onClick={() => void login({ email: 'ada@mail.com', password: 'Password123!' })} type="button">
        giris yap
      </button>
      <pre data-testid="cart">{JSON.stringify(cart?.items ?? [])}</pre>
    </div>
  );
}

function renderSession(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <SessionProvider>{ui}</SessionProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.getProfile).mockResolvedValue(sessionUser);
  vi.mocked(api.getCart).mockResolvedValue(emptyCart);
  vi.mocked(api.getFavorites).mockResolvedValue({ id: 'wishlist-1', items: [], itemCount: 0 });
});

describe('SessionProvider guest cart with packages', () => {
  it('stores packageOptionId, packageLabel and the discounted package unit price for a packaged guest line', async () => {
    renderSession(<GuestCartProbe packageOptionId="combo" />);

    fireEvent.click(screen.getByText('sepete ekle'));

    // Paket fiyati mutlaktir, ardindan urun indirimi uygulanir: 1250 * 0.8 = 1000.
    await waitFor(() => {
      const stored = readStoredGuestLines();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        packageOptionId: 'combo',
        packageLabel: 'Fly More Combo',
        unitPrice: 1000,
        quantity: 2,
      });
    });

    const items = JSON.parse(screen.getByTestId('cart').textContent ?? '[]') as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ packageOptionId: 'combo', packageLabel: 'Fly More Combo', lineTotal: 2000 });
  });

  it('keeps base-product guest lines package-free (old storage shape still works)', async () => {
    renderSession(<GuestCartProbe />);

    fireEvent.click(screen.getByText('sepete ekle'));

    await waitFor(() => {
      const stored = readStoredGuestLines();
      expect(stored).toHaveLength(1);
      expect(stored[0]).not.toHaveProperty('packageOptionId');
      expect(stored[0]).not.toHaveProperty('packageLabel');
    });

    const items = JSON.parse(screen.getByTestId('cart').textContent ?? '[]') as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ packageOptionId: null, packageLabel: null, lineTotal: 1600 });
  });

  it('merges guest lines on login per package and skips failing lines with a toast', async () => {
    window.localStorage.setItem(
      'bora-guest-cart',
      JSON.stringify([
        { product: packagedProduct, quantity: 2, packageOptionId: 'combo', packageLabel: 'Fly More Combo', unitPrice: 1000 },
        { product: baseProduct, quantity: 1 },
      ]),
    );
    vi.mocked(api.login).mockResolvedValue({ user: sessionUser, accessToken: 'token-1' });
    vi.mocked(api.addToCart).mockImplementation(async (_token, payload) => {
      if (payload.productId === 'product-2') {
        // Simulasyon: taban urun satiri stok/paket degisikligine takilir (409).
        throw new Error('Ayni urunden en fazla 10 adet satin alabilirsiniz.');
      }
      return emptyCart;
    });

    renderSession(<LoginProbe />);

    fireEvent.click(screen.getByText('giris yap'));

    await waitFor(() => {
      expect(api.addToCart).toHaveBeenCalledTimes(2);
      // Paketli satir packageOptionId ile, taban satir alan hic gonderilmeden eklenir.
      expect(api.addToCart).toHaveBeenCalledWith('token-1', { productId: 'product-1', quantity: 2, packageOptionId: 'combo' });
      expect(api.addToCart).toHaveBeenCalledWith('token-1', { productId: 'product-2', quantity: 1 });
    });

    // Hatali satir atlandi ama giris ve diger satirin aktarimi tamamlandi.
    await screen.findByText('Sepetin tamamen aktarılamadı');
    await waitFor(() => expect(window.localStorage.getItem('bora-guest-cart')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toBe('[]'));
  });
});
