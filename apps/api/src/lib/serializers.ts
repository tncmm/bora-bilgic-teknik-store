import type {
  Address,
  Cart,
  Category,
  DashboardMetrics,
  Order,
  Product,
  ProductDetailSection,
  ProductImage,
  ProductPackageOption,
  Wishlist,
  User,
} from '@bora/types';
import { OrderStatus, Prisma, Role } from '@prisma/client';

export function decimalToNumber(value: Prisma.Decimal | number) {
  return Number(value);
}

function readJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (!Array.isArray(value)) return fallback;
  return value as T[];
}

export function serializeCategory(category: {
  id: string;
  name: string;
  slug: string;
  description: string;
  heroTitle?: string | null;
  heroDescription?: string | null;
  heroImageUrl?: string | null;
  sortOrder?: number;
  products?: Array<{ series: string | null; featureTags: string[] }>;
}): Category {
  const products = category.products ?? [];
  const series = [...new Set(products.map((product) => product.series).filter((item): item is string => Boolean(item)))];
  const featureTags = [...new Set(products.flatMap((product) => product.featureTags ?? []))];

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    heroTitle: category.heroTitle ?? null,
    heroDescription: category.heroDescription ?? null,
    heroImageUrl: category.heroImageUrl ?? null,
    sortOrder: category.sortOrder ?? 0,
    productCount: products.length,
    series,
    featureTags,
  };
}

export function serializeProduct(product: any): Product {
  const images: ProductImage[] = product.images.map((image: any) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
    isPrimary: image.isPrimary,
    kind: image.kind ?? 'image',
    thumbnailUrl: image.thumbnailUrl ?? null,
    mimeType: image.mimeType ?? null,
  }));

  const fallbackPackageOptions: ProductPackageOption[] = [
    {
      id: 'standard',
      name: 'Standart Paket',
      price: decimalToNumber(product.price),
      description: 'Temel urun paketi',
      isDefault: true,
    },
  ];

  const fallbackDetailSections: ProductDetailSection[] = [
    {
      id: 'aciklama',
      label: 'Aciklama',
      heading: product.name,
      body: product.description,
      bullets: product.specs.slice(0, 5).map((spec: any) => `${spec.name}: ${spec.value}`),
      imageUrl: product.heroImageUrl ?? images[0]?.url ?? null,
    },
  ];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    shortDescription: product.shortDescription,
    description: product.description,
    price: decimalToNumber(product.price),
    stock: product.stock,
    sku: product.sku,
    badge: product.badge,
    heroTag: product.heroTag,
    isPublished: product.isPublished,
    isPurchasable: product.isPurchasable,
    categoryId: product.categoryId,
    category: serializeCategory(product.category),
    section: product.category?.slug,
    series: product.series ?? null,
    ratingAverage: decimalToNumber(product.ratingAverage ?? 0),
    reviewCount: product.reviewCount ?? 0,
    featureTags: product.featureTags ?? [],
    heroImageUrl: product.heroImageUrl ?? null,
    heroTitle: product.heroTitle ?? null,
    heroDescription: product.heroDescription ?? null,
    images,
    specs: product.specs.map((spec: any) => ({
      id: spec.id,
      name: spec.name,
      value: spec.value,
    })),
    packageOptions: readJsonArray<ProductPackageOption>(product.packageOptions, fallbackPackageOptions),
    detailSections: readJsonArray<ProductDetailSection>(product.detailSections, fallbackDetailSections),
  };
}

export function serializeCart(cart: any): Cart {
  const items = cart.items.map((item: any) => ({
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    lineTotal: decimalToNumber(item.product.price) * item.quantity,
    product: serializeProduct(item.product),
  }));

  return {
    id: cart.id,
    items,
    subtotal: items.reduce((total: number, item: any) => total + item.lineTotal, 0),
    itemCount: items.reduce((count: number, item: any) => count + item.quantity, 0),
  };
}

export function serializeAddress(address: {
  id: string;
  title: string;
  line1: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}): Address {
  return {
    id: address.id,
    title: address.title,
    line1: address.line1,
    city: address.city,
    district: address.district,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function serializeWishlist(wishlist: any): Wishlist {
  const items = wishlist.items.map((item: any) => ({
    id: item.id,
    productId: item.productId,
    createdAt: item.createdAt.toISOString(),
    product: serializeProduct(item.product),
  }));

  return {
    id: wishlist.id,
    items,
    itemCount: items.length,
  };
}

export function serializeOrder(order: any): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status.toLowerCase() as Lowercase<OrderStatus>,
    createdAt: order.createdAt.toISOString(),
    total: decimalToNumber(order.total),
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingCity: order.shippingCity,
    shippingDistrict: order.shippingDistrict,
    shippingAddressLine: order.shippingAddressLine,
    notes: order.notes ?? null,
    items: order.items.map((item: any) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.unitPrice),
      lineTotal: decimalToNumber(item.lineTotal),
    })),
  };
}

export function serializeUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}): User {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role.toLowerCase() as 'customer' | 'admin',
  };
}

export function serializeDashboardMetrics(metrics: DashboardMetrics) {
  return metrics;
}
