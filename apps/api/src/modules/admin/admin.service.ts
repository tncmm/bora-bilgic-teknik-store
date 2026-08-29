import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { serializeDashboardMetrics, serializeOrder, serializeProduct, serializeUser } from '../../lib/serializers.js';
import { deleteManyMediaFromR2, extractR2KeyFromUrl, uploadMediaToR2 } from '../../lib/r2.js';
import { AdminRepository } from './admin.repository.js';

const specSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

function isAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Root-relative paths point into `apps/web/public`. The leading `//` form is
 * rejected on purpose: it is protocol-relative, so a browser would silently
 * resolve it against another origin.
 */
function isRootRelativePath(value: string) {
  return value.startsWith('/') && !value.startsWith('//');
}

/**
 * Media is served from one of two places: an absolute URL for anything hosted
 * on Cloudflare R2 (or another CDN), or a root-relative path for the legacy
 * imagery still shipped in `apps/web/public`.
 *
 * Accepting only absolute URLs would make every seeded product unsaveable,
 * because the admin edit form sends the existing relative paths straight back.
 */
const mediaUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => isAbsoluteHttpUrl(value) || isRootRelativePath(value), {
    message: 'Medya URLsi http(s) ile baslayan tam bir adres veya /storefront/... gibi goreli bir yol olmalidir.',
  });

/**
 * The admin form submits '' for "no value" rather than null. Treating that as
 * an invalid URL would block saving any product without a video poster.
 */
function emptyStringToNull(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? null : value;
}

const optionalMediaUrlSchema = z.preprocess(emptyStringToNull, mediaUrlSchema.nullable().optional());
const optionalMimeTypeSchema = z.preprocess(emptyStringToNull, z.string().nullable().optional());

const mediaSchema = z.object({
  url: mediaUrlSchema,
  alt: z.string().min(1),
  isPrimary: z.boolean().default(false),
  kind: z.enum(['image', 'video']).default('image'),
  thumbnailUrl: optionalMediaUrlSchema,
  mimeType: optionalMimeTypeSchema,
});

const uploadSchema = z.object({
  kind: z.enum(['image', 'video', 'poster']),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64: z.string().min(1),
});

const productSchemaBase = z.object({
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
  images: z.array(mediaSchema).min(1),
  specs: z.array(specSchema).min(1),
});

interface MediaRefinementContext {
  addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void;
}

/**
 * Shared by create and update so the two paths cannot drift apart.
 *
 * The context parameter is duck-typed rather than imported from zod because
 * the update schema is a partial: `.partial()` must be applied *before* the
 * refinement is attached (zod 4 refuses `.partial()` on an already-refined
 * schema), so the same function has to accept both shapes.
 */
function refineProductMedia(
  product: { images?: Array<{ kind?: string | null; thumbnailUrl?: string | null }> | null },
  context: MediaRefinementContext,
) {
  if (!product.images) {
    return;
  }

  const imageCount = product.images.filter((item) => item.kind === 'image').length;

  if (imageCount === 0) {
    context.addIssue({
      code: 'custom',
      message: 'En az bir gorsel medyasi eklemelisiniz.',
      path: ['images'],
    });
  }

  product.images.forEach((item, index) => {
    if (item.kind === 'video' && !item.thumbnailUrl) {
      context.addIssue({
        code: 'custom',
        message: 'Video icin poster gorseli zorunludur.',
        path: ['images', index, 'thumbnailUrl'],
      });
    }
  });
}

const productSchema = productSchemaBase.superRefine(refineProductMedia);
const updateProductSchema = productSchemaBase.partial().superRefine(refineProductMedia);

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

  /**
   * Collects every stored media URL for a product, images and video posters
   * alike, so both kinds of object can be reclaimed from R2.
   */
  private collectMediaUrls(images: Array<{ url: string; thumbnailUrl?: string | null }>) {
    const urls = images.flatMap((image) => [image.url, image.thumbnailUrl ?? null]);
    return Array.from(new Set(urls.filter((url): url is string => Boolean(url))));
  }

  /** Best-effort: R2 cleanup must never fail the caller's database write. */
  private async removeOrphanedMedia(urls: string[]) {
    const keys = urls
      .map((url) => extractR2KeyFromUrl(url))
      .filter((key): key is string => Boolean(key));

    if (!keys.length) {
      return;
    }

    await deleteManyMediaFromR2(keys);
  }

  async updateProduct(id: string, payload: unknown) {
    const data = updateProductSchema.parse(payload);
    const nextData: Record<string, unknown> = { ...data, brand: 'DJI' };

    if (data.images) {
      const existing = await this.repository.getProduct(id);
      const previousUrls = existing ? this.collectMediaUrls(existing.images) : [];
      const nextUrls = new Set(this.collectMediaUrls(data.images));

      nextData.images = {
        deleteMany: {},
        create: data.images,
      };

      const product = await this.repository.updateProduct(id, nextData);
      // Only reclaim objects the product no longer references.
      await this.removeOrphanedMedia(previousUrls.filter((url) => !nextUrls.has(url)));

      return serializeProduct(product);
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
    const existing = await this.repository.getProduct(id);
    const mediaUrls = existing ? this.collectMediaUrls(existing.images) : [];

    await this.repository.deleteProduct(id);
    await this.removeOrphanedMedia(mediaUrls);
  }

  async uploadMedia(payload: unknown) {
    const data = uploadSchema.parse(payload);
    return uploadMediaToR2(data);
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

    // Fulfilment must never start before money is in the till: moving an
    // order past PENDING requires a successful PayTR payment first.
    if (data.status !== 'PENDING') {
      const order = await this.repository.getOrder(id);

      if (!order) {
        throw new AppError('Siparis bulunamadi.', 404);
      }

      if (order.paymentStatus !== 'PAID') {
        throw new AppError('Odeme tamamlanmadan siparis isleme alinamaz veya kargolanamaz.', 409);
      }
    }

    const order = await this.repository.updateOrderStatus(id, data.status as OrderStatus);
    return serializeOrder(order);
  }

  async listUsers() {
    const users = await this.repository.listUsers();
    return users.map(serializeUser);
  }
}
