import type { Cart, Product } from '@bora/types';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CartPage } from './pages';

const sessionMock = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock('../../app/providers/SessionProvider', () => ({
  useSession: () => sessionMock.value,
}));

vi.mock('../../app/providers/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const discountedProduct: Product = {
  id: '1',
  name: 'Demo Product',
  slug: 'demo-product',
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
  stock: 3,
  sku: 'SKU',
  isPublished: true,
  isPurchasable: true,
  isBestseller: false,
  discountPercent: 20,
  effectivePrice: 800,
  images: [{ id: 'image-1', url: 'https://example.com/image.jpg', alt: 'Image', isPrimary: true, kind: 'image', thumbnailUrl: 'https://example.com/image.jpg' }],
  specs: [{ id: 'spec-1', name: 'Sensor', value: '1-inch' }],
};

const discountedCart: Cart = {
  id: 'cart-1',
  items: [{ id: 'item-1', productId: '1', quantity: 1, product: discountedProduct, lineTotal: 800 }],
  subtotal: 800,
  itemCount: 1,
};

const packagedCart: Cart = {
  id: 'cart-2',
  items: [
    {
      id: 'item-2',
      productId: '1',
      packageOptionId: 'combo',
      packageLabel: 'Fly More Combo',
      quantity: 2,
      product: discountedProduct,
      // Sunucuda paket fiyati mutlak degistirilir sonra indirim uygulanir:
      // 1250 * 0.8 = 1000 birim fiyat -> 2 adet = 2000.
      lineTotal: 2000,
    },
  ],
  subtotal: 2000,
  itemCount: 2,
};

describe('CartPage line prices', () => {
  it('shows the campaign (effective) unit price instead of the list price', () => {
    sessionMock.value = {
      cart: discountedCart,
      token: 'token',
      updateCartItem: vi.fn(),
      removeCartItem: vi.fn(),
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    };

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/₺800 \/ adet/)).toBeInTheDocument();
    expect(screen.queryByText(/₺1\.000/)).not.toBeInTheDocument();
  });

  it('renders the package label and the package-based unit price for packaged lines', () => {
    sessionMock.value = {
      cart: packagedCart,
      token: 'token',
      updateCartItem: vi.fn(),
      removeCartItem: vi.fn(),
      toggleFavorite: vi.fn(),
      isFavorite: () => false,
    };

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Fly More Combo')).toBeInTheDocument();
    // Paketli satirda birim fiyat lineTotal/adetten gelir (1000), urunun kampanyali
    // taban fiyati (800) degil.
    expect(screen.getByText(/₺1\.000 \/ adet/)).toBeInTheDocument();
    expect(screen.queryByText(/₺800 \/ adet/)).not.toBeInTheDocument();
    // Satir toplami ve sepet ozeti ayni paketli tutari gosterir (2 x 1000).
    expect(screen.getAllByText('₺2.000').length).toBeGreaterThan(0);
  });
});
