import type { Cart, Product, User } from '@bora/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';

import { CheckoutPage } from './checkout.page';

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

vi.mock('../../shared/api/client', () => ({
  api: {
    listAddresses: vi.fn().mockResolvedValue([]),
    startPayment: vi.fn(),
  },
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

const baseCart: Cart = {
  id: 'cart-1',
  items: [{ id: 'item-1', productId: '1', quantity: 1, product: baseProduct, lineTotal: 1000 }],
  subtotal: 1000,
  itemCount: 1,
};

function setSession(overrides: Record<string, unknown> = {}) {
  sessionMock.value = {
    cart: baseCart,
    token: null,
    user: null,
    isAuthenticated: false,
    ...overrides,
  };
}

function renderCheckoutPage() {
  return render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

describe('CheckoutPage email field', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setSession();
  });

  it('keeps a cleared email instead of snapping back to the account email', async () => {
    const user = { email: 'hesap@mail.com', firstName: 'Ada', lastName: 'Yılmaz' } as User;
    setSession({ cart: baseCart, token: 'token', user, isAuthenticated: true });

    renderCheckoutPage();

    const emailInput = screen.getByLabelText('E-posta');
    await waitFor(() => expect(emailInput).toHaveValue('hesap@mail.com'));

    fireEvent.change(emailInput, { target: { value: '' } });

    expect(emailInput).toHaveValue('');
  });

  it('lets guest emails be typed and cleared freely', () => {
    renderCheckoutPage();

    const emailInput = screen.getByLabelText('E-posta');

    fireEvent.change(emailInput, { target: { value: 'misafir@mail.com' } });
    expect(emailInput).toHaveValue('misafir@mail.com');

    fireEvent.change(emailInput, { target: { value: '' } });
    expect(emailInput).toHaveValue('');
  });
});
