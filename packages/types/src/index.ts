export type ThemeMode = 'light' | 'dark' | 'system';

export type UserRole = 'customer' | 'admin';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';

export type BrandName = 'DJI';

export type CatalogSectionSlug = 'drone' | 'gimbal' | 'aksiyon-kamera' | 'aksesuar' | 'kurumsal';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  heroTitle?: string | null;
  heroDescription?: string | null;
  heroImageUrl?: string | null;
  sortOrder?: number;
  productCount?: number;
  series?: string[];
  featureTags?: string[];
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  kind?: 'image' | 'video';
  thumbnailUrl?: string | null;
}

export interface ProductSpec {
  id: string;
  name: string;
  value: string;
}

export interface ProductPackageOption {
  id: string;
  name: string;
  price: number;
  description?: string;
  isDefault?: boolean;
}

export interface ProductDetailSection {
  id: string;
  label: string;
  heading?: string;
  body?: string;
  bullets?: string[];
  imageUrl?: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: BrandName;
  categoryId: string;
  category: Category;
  section?: CatalogSectionSlug;
  series?: string | null;
  shortDescription: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  badge?: string | null;
  heroTag?: string | null;
  isPublished: boolean;
  isPurchasable: boolean;
  ratingAverage?: number;
  reviewCount?: number;
  featureTags?: string[];
  heroImageUrl?: string | null;
  heroTitle?: string | null;
  heroDescription?: string | null;
  images: ProductImage[];
  specs: ProductSpec[];
  packageOptions?: ProductPackageOption[];
  detailSections?: ProductDetailSection[];
}

export interface CatalogAvailableFilterOption {
  value: string;
  count: number;
}

export interface CatalogAvailableFilters {
  series: CatalogAvailableFilterOption[];
  features: CatalogAvailableFilterOption[];
  priceRange: {
    min: number;
    max: number;
  };
  sorts: string[];
}

export interface CatalogListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  availableFilters: CatalogAvailableFilters;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  lineTotal: number;
  product: Product;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface Wishlist {
  id: string;
  items: WishlistItem[];
  itemCount: number;
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  items: OrderItem[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface DashboardMetrics {
  totalSales: number;
  activeInventory: number;
  newOrders: number;
  lowStockCount: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ProductFilters {
  category?: string;
  section?: string;
  series?: string;
  search?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  features?: string;
  sort?: string;
  page?: string;
  limit?: string;
  saleMode?: 'purchasable' | 'all';
}
