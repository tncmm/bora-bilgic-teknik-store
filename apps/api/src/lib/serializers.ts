import { Product, Category, Cart, Order, User, DashboardMetrics, Wishlist } from '@bora/types';
import { OrderStatus, Prisma, Role } from '@prisma/client';

export function decimalToNumber(value: Prisma.Decimal | number) {
  return Number(value);
}

export function serializeCategory(category: {
  id: string;
  name: string;
  slug: string;
  description: string;
}): Category {
  return category;
}

export function serializeProduct(product: any): Product {
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
    images: product.images.map((image: any) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      isPrimary: image.isPrimary,
    })),
    specs: product.specs.map((spec: any) => ({
      id: spec.id,
      name: spec.name,
      value: spec.value,
    })),
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
