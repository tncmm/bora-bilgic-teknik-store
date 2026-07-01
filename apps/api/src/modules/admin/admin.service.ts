import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { serializeDashboardMetrics, serializeOrder, serializeProduct, serializeUser } from '../../lib/serializers.js';
import { AdminRepository } from './admin.repository.js';

const specSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  brand: z.string().min(2).optional(),
  categoryId: z.string().min(1),
  shortDescription: z.string().min(5),
  description: z.string().min(10),
  sku: z.string().min(3),
  badge: z.string().optional().nullable(),
  heroTag: z.string().optional().nullable(),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  isPublished: z.boolean(),
  isPurchasable: z.boolean(),
  images: z.array(imageSchema).min(1),
  specs: z.array(specSchema).min(1),
});

const saleStatusSchema = z.object({
  isPurchasable: z.boolean(),
});

const orderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']),
});

export class AdminService {
  constructor(private readonly repository = new AdminRepository()) {}

  async getDashboardMetrics() {
    const [salesAgg, pendingCount, stockAgg, lowStockCount] = await this.repository.countDashboardMetrics();

    return serializeDashboardMetrics({
      totalSales: Number(salesAgg._sum.total ?? 0),
      newOrders: pendingCount,
      activeInventory: stockAgg._sum.stock ?? 0,
      lowStockCount,
    });
  }

  async listProducts() {
    const products = await this.repository.listProducts();
    return products.map(serializeProduct);
  }

  async listCategories() {
    return this.repository.listCategories();
  }

  async createProduct(payload: unknown) {
    const data = productSchema.parse(payload);
    const product = await this.repository.createProduct({
      ...data,
      brand: 'DJI',
      images: {
        create: data.images,
      },
      specs: {
        create: data.specs,
      },
    });

    return serializeProduct(product);
  }

  async updateProduct(id: string, payload: unknown) {
    const data = productSchema.partial().parse(payload);
    const nextData: Record<string, unknown> = { ...data, brand: 'DJI' };

    if (data.images) {
      nextData.images = {
        deleteMany: {},
        create: data.images,
      };
    }

    if (data.specs) {
      nextData.specs = {
        deleteMany: {},
        create: data.specs,
      };
    }

    const product = await this.repository.updateProduct(id, nextData);
    return serializeProduct(product);
  }

  async deleteProduct(id: string) {
    await this.repository.deleteProduct(id);
  }

  async updateSaleStatus(id: string, payload: unknown) {
    const data = saleStatusSchema.parse(payload);
    const product = await this.repository.updateProduct(id, {
      isPurchasable: data.isPurchasable,
    });
    return serializeProduct(product);
  }

  async listOrders() {
    const orders = await this.repository.listOrders();
    return orders.map((order) => ({
      ...serializeOrder(order),
      customer: `${order.user.firstName} ${order.user.lastName}`,
      email: order.user.email,
    }));
  }

  async updateOrderStatus(id: string, payload: unknown) {
    const data = orderStatusSchema.parse(payload);
    const order = await this.repository.updateOrderStatus(id, data.status as OrderStatus);
    return serializeOrder(order);
  }

  async listUsers() {
    const users = await this.repository.listUsers();
    return users.map(serializeUser);
  }
}
