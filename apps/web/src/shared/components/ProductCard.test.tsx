import type { Product } from '@bora/types';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import { ProductCard } from './ProductCard';

vi.mock('../../app/providers/SessionProvider', () => ({
  useSession: () => ({
    token: 'token',
    isAuthenticated: true,
    syncCart: vi.fn(),
    toggleFavorite: vi.fn(),
    isFavorite: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock('../../app/providers/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../app/providers/I18nProvider', () => ({
  useI18n: () => ({
    language: 'tr',
    locale: 'tr-TR',
  }),
}));

const baseProduct: Product = {
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
  discountPercent: 0,
  effectivePrice: 1000,
  images: [{ id: 'image-1', url: 'https://example.com/image.jpg', alt: 'Image', isPrimary: true, kind: 'image', thumbnailUrl: 'https://example.com/image.jpg' }],
  specs: [{ id: 'spec-1', name: 'Sensor', value: '1-inch' }],
};

describe('ProductCard', () => {
  it('renders add to cart CTA for purchasable products', () => {
    render(
      <MemoryRouter>
        <ProductCard product={baseProduct} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /sepete ekle/i })).toBeInTheDocument();
  });

  it('renders inspect CTA for non-purchasable products', () => {
    render(
      <MemoryRouter>
        <ProductCard product={{ ...baseProduct, isPurchasable: false }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /İncele/i })).toBeInTheDocument();
  });
});
