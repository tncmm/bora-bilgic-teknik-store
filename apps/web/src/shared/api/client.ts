import { appConfig } from '@bora/config';
import type {
  AuthResponse,
  Cart,
  CatalogListResponse,
  Category,
  DashboardMetrics,
  Order,
  Product,
  ThemeMode,
  User,
  Wishlist,
} from '@bora/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl;

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
  createOrder(token: string, payload: Record<string, string>) {
    return request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  getMyOrders(token: string) {
    return request<Order[]>('/orders/me', {}, token);
  },
  getAdminDashboard(token: string) {
    return request<DashboardMetrics>('/admin/dashboard', {}, token);
  },
  getAdminProducts(token: string) {
    return request<Product[]>('/admin/products', {}, token);
  },
  getAdminCategories(token: string) {
    return request<Category[]>('/admin/categories', {}, token);
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
