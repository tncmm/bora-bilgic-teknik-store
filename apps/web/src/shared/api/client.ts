import { appConfig } from '@bora/config';
import type {
  Address,
  AddressPayload,
  AdminUploadKind,
  AuthResponse,
  Cart,
  CatalogListResponse,
  Category,
  DashboardMetrics,
  Order,
  PaytrTokenResponse,
  Product,
  ThemeMode,
  User,
  Wishlist,
} from '@bora/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl;

interface AdminMediaUploadResponse {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

export type AdminCategory = Category & { _count?: { products: number } };

export interface CheckoutPayload {
  shippingName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingAddressLine: string;
  notes?: string;
}

interface ApiErrorPayload {
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new ApiError(body.message ?? 'Beklenmeyen bir hata olustu.', response.status, body.fieldErrors);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listProducts(params?: Record<string, string>) {
    const search = new URLSearchParams(params);
    return request<CatalogListResponse>(`/products${search.toString() ? `?${search.toString()}` : ''}`);
  },
  getProduct(slug: string) {
    return request<Product>(`/products/${slug}`);
  },
  listCategories() {
    return request<Category[]>('/categories');
  },
  register(payload: { firstName: string; lastName: string; email: string; password: string }) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return request<void>('/auth/logout', { method: 'POST' });
  },
  getProfile(token: string) {
    return request<User & { themeMode: ThemeMode }>('/users/me', {}, token);
  },
  updateTheme(token: string, mode: ThemeMode) {
    return request('/users/theme', {
      method: 'PATCH',
      body: JSON.stringify({ mode }),
    }, token);
  },
  listAddresses(token: string) {
    return request<Address[]>('/users/addresses', {}, token);
  },
  createAddress(token: string, payload: AddressPayload) {
    return request<Address>('/users/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  updateAddress(token: string, addressId: string, payload: Partial<AddressPayload>) {
    return request<Address>(`/users/addresses/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },
  deleteAddress(token: string, addressId: string) {
    return request<void>(`/users/addresses/${addressId}`, { method: 'DELETE' }, token);
  },
  getCart(token: string) {
    return request<Cart>('/cart', {}, token);
  },
  getFavorites(token: string) {
    return request<Wishlist>('/users/favorites', {}, token);
  },
  addFavorite(token: string, payload: { productId: string }) {
    return request<Wishlist>('/users/favorites/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  removeFavorite(token: string, productId: string) {
    return request<Wishlist>(`/users/favorites/items/${productId}`, { method: 'DELETE' }, token);
  },
  addToCart(token: string, payload: { productId: string; quantity: number }) {
    return request<Cart>('/cart/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  updateCartItem(token: string, itemId: string, quantity: number) {
    return request<Cart>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }, token);
  },
  removeCartItem(token: string, itemId: string) {
    return request<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' }, token);
  },
  startPayment(token: string, payload: CheckoutPayload) {
    return request<PaytrTokenResponse>('/payments/paytr/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  getMyOrders(token: string) {
    return request<Order[]>('/orders/me', {}, token);
  },
  getMyOrder(token: string, orderId: string) {
    return request<Order>(`/orders/me/${orderId}`, {}, token);
  },
  getAdminDashboard(token: string) {
    return request<DashboardMetrics>('/admin/dashboard', {}, token);
  },
  getAdminProducts(token: string) {
    return request<Product[]>('/admin/products', {}, token);
  },
  getAdminCategories(token: string) {
    return request<AdminCategory[]>('/admin/categories', {}, token);
  },
  createAdminCategory(token: string, payload: { name: string; slug: string; description?: string; sortOrder?: number }) {
    return request<Category>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  updateAdminCategory(token: string, categoryId: string, payload: { name?: string; slug?: string; description?: string; sortOrder?: number }) {
    return request<Category>(`/admin/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },
  deleteAdminCategory(token: string, categoryId: string) {
    return request<void>(`/admin/categories/${categoryId}`, { method: 'DELETE' }, token);
  },
  getAdminBrands(token: string) {
    return request<Array<{ brand: string; productCount: number }>>('/admin/brands', {}, token);
  },
  renameAdminBrand(token: string, payload: { from: string; to: string }) {
    return request<{ updated: number }>('/admin/brands/rename', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  uploadAdminMedia(token: string, payload: { kind: AdminUploadKind; fileName: string; mimeType: string; base64: string }) {
    return request<AdminMediaUploadResponse>('/admin/media/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  createAdminProduct(token: string, payload: Record<string, unknown>) {
    return request<Product>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  updateAdminProduct(token: string, productId: string, payload: Record<string, unknown>) {
    return request<Product>(`/admin/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },
  deleteAdminProduct(token: string, productId: string) {
    return request<void>(`/admin/products/${productId}`, { method: 'DELETE' }, token);
  },
  updateSaleStatus(token: string, productId: string, isPurchasable: boolean) {
    return request<Product>(`/admin/products/${productId}/sale-status`, {
      method: 'PATCH',
      body: JSON.stringify({ isPurchasable }),
    }, token);
  },
  getAdminOrders(token: string) {
    return request<Array<Order & { customer: string; email: string }>>('/admin/orders', {}, token);
  },
  updateAdminOrderStatus(token: string, orderId: string, status: string) {
    return request<Order>(`/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token);
  },
  getAdminUsers(token: string) {
    return request<User[]>('/admin/users', {}, token);
  },
};
