import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import { sendMail } from '../../lib/mail/transport.js';
import { invoiceReadyEmail } from '../../lib/mail/templates.js';
import { requestRefund } from '../../lib/paytr.js';
import { buildRefundSelection } from '../../lib/refunds.js';
import { serializeDashboardMetrics, serializeOrder, serializeProduct, serializeUser } from '../../lib/serializers.js';
import { deleteManyMediaFromR2, extractR2KeyFromUrl, uploadInvoicePdfToR2, uploadMediaToR2 } from '../../lib/r2.js';
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

const refundSchema = z.object({
  refundId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  manualAmount: z.number().positive().optional(),
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1) })).optional(),
  reason: z.string().max(500).optional(),
  restock: z.boolean().default(false),
});

const invoiceUploadSchema = z.object({
  fileName: z.string().trim().min(1),
  mimeType: z.literal('application/pdf'),
  base64: z.string().min(1),
});

const mediaSchema = z.object({
  url: mediaUrlSchema,
  // Optional: storefront falls back to the product name when empty.
  alt: z.string().trim().optional(),
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
  brand: z.string().min(2),
  categoryId: z.string().min(1),
  shortDescription: z.string().min(5),
  description: z.string().min(10),
  sku: z.string().min(3),
  badge: z.string().optional().nullable(),
  heroTag: z.string().optional().nullable(),
  price: z.number().min(0),
  discountPercent: z.number().int().min(0).max(100).optional().default(0),
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

const bestsellerStatusSchema = z.object({
  isBestseller: z.boolean(),
});

const categorySchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug yalnizca kucuk harf, rakam ve tire icerebilir.'),
  description: z.string().trim().optional().default(''),
  heroTitle: z.preprocess(emptyStringToNull, z.string().trim().nullable().optional()),
  heroDescription: z.preprocess(emptyStringToNull, z.string().trim().nullable().optional()),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const renameBrandSchema = z.object({
  from: z.string().trim().min(2),
  to: z.string().trim().min(2),
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

  async createCategory(payload: unknown) {
    const data = categorySchema.parse(payload);
    const existing = await this.repository.findCategoryBySlug(data.slug);

    if (existing) {
      throw new AppError('Bu slug baska bir kategori tarafindan kullaniliyor.', 409);
    }

    return this.repository.createCategory(data);
  }

  async updateCategory(id: string, payload: unknown) {
    const data = categorySchema.partial().parse(payload);

    if (data.slug) {
      const existing = await this.repository.findCategoryBySlug(data.slug);

      if (existing && existing.id !== id) {
        throw new AppError('Bu slug baska bir kategori tarafindan kullaniliyor.', 409);
      }
    }

    return this.repository.updateCategory(id, data);
  }

  async deleteCategory(id: string) {
    const productCount = await this.repository.countCategoryProducts(id);

    if (productCount > 0) {
      throw new AppError('Bu kategoriye bagli urunler var; once onlari baska bir kategoriye tasiyin.', 409);
    }

    await this.repository.deleteCategory(id);
  }

  async listBrands() {
    const groups = await this.repository.listBrandSummaries();
    return groups.map((group) => ({ brand: group.brand, productCount: group._count._all }));
  }

  async renameBrand(payload: unknown) {
    const data = renameBrandSchema.parse(payload);
    const result = await this.repository.renameBrand(data.from, data.to);
    return { updated: result.count };
  }

  async createProduct(payload: unknown) {
    const data = productSchema.parse(payload);
    const product = await this.repository.createProduct({
      ...data,
      images: {
        create: data.images.map((item) => ({ ...item, alt: item.alt || data.name })),
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
    const nextData: Record<string, unknown> = { ...data };

    if (data.specs) {
      nextData.specs = {
        deleteMany: {},
        create: data.specs,
      };
    }

    if (data.images) {
      const existing = await this.repository.getProduct(id);
      const previousUrls = existing ? this.collectMediaUrls(existing.images) : [];
      const nextUrls = new Set(this.collectMediaUrls(data.images));

      nextData.images = {
        deleteMany: {},
        create: data.images.map((item) => ({ ...item, alt: item.alt || data.name || existing?.name || 'Urun gorseli' })),
      };

      const product = await this.repository.updateProduct(id, nextData);
      // Only reclaim objects the product no longer references.
      await this.removeOrphanedMedia(previousUrls.filter((url) => !nextUrls.has(url)));

      return serializeProduct(product);
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

  async updateBestsellerStatus(id: string, payload: unknown) {
    const data = bestsellerStatusSchema.parse(payload);
    const product = await this.repository.updateProduct(id, {
      isBestseller: data.isBestseller,
    });
    return serializeProduct(product);
  }

  async listOrders() {
    const orders = await this.repository.listOrders();
    return orders.map((order) => ({
      ...serializeOrder(order),
      customer: order.user ? `${order.user.firstName} ${order.user.lastName}` : order.shippingName,
      email: order.user?.email ?? order.customerEmail,
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

  async refundOrder(id: string, adminId: string | undefined, payload: unknown) {
    const data = refundSchema.parse(payload);
    const order = await this.repository.getOrder(id);

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    if (!order.paymentRef || !['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw new AppError('Bu siparis icin iade baslatilamaz.', 409);
    }

    const completedAmount = Number(order.refundedAmount ?? 0);
    const pendingAmount = (order.refunds ?? [])
      .filter((refund: any) => refund.status === 'PENDING')
      .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
    const availableAmount = Number(order.total) - completedAmount - pendingAmount;
    let refund = data.refundId ? order.refunds.find((entry: any) => entry.id === data.refundId && entry.status === 'PENDING') : null;
    let amount = refund ? Number(refund.amount) : 0;
    let items: Array<{ orderItemId: string; productId: string; quantity: number; unitPrice: number; lineTotal: number }> | undefined;

    if (!refund) {
      if (data.items?.length) {
        const selection = buildRefundSelection(order, data.items);
        amount = selection.amount;
        items = selection.items;
      } else {
        amount = data.manualAmount ?? data.amount ?? 0;
      }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Iade tutari gecersiz.', 400);
    }

    if (!refund && amount > availableAmount) {
      throw new AppError('Iade tutari kalan iade edilebilir tutari asamaz.', 400);
    }

    const isFullRemainingRefund = Math.round(amount * 100) === Math.round(availableAmount * 100);
    if (data.restock && !refund?.items?.length && !items?.length && !isFullRemainingRefund) {
      throw new AppError('Stok geri eklemek icin urun bazli iade secimi gereklidir.', 400);
    }

    if (!refund) {
      refund = await this.repository.createRefund(id, adminId, {
        merchantOid: order.paymentRef,
        amount,
        reason: data.reason,
        restock: data.restock,
        source: 'admin',
        items,
      });
    }

    try {
      const paytrResult = await requestRefund({ merchantOid: order.paymentRef, amount });
      const updatedOrder = await this.repository.completeRefund(refund.id, {
        paytrReference: paytrResult.referenceNo,
        restock: data.restock,
      });
      return serializeOrder(updatedOrder);
    } catch (error) {
      await this.repository.markRefundFailed(refund.id, error instanceof Error ? error.message : 'PayTR iadesi basarisiz.');
      throw error;
    }
  }

  async uploadOrderInvoice(id: string, payload: unknown) {
    const data = invoiceUploadSchema.parse(payload);
    const order = await this.repository.getOrder(id);

    if (!order) {
      throw new AppError('Siparis bulunamadi.', 404);
    }

    if (!['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus)) {
      throw new AppError('Fatura yalnizca odemesi tamamlanmis siparise yuklenebilir.', 409);
    }

    const uploaded = await uploadInvoicePdfToR2({
      orderNumber: order.orderNumber,
      fileName: data.fileName,
      mimeType: data.mimeType,
      base64: data.base64,
    });

    const updatedOrder = await this.repository.updateOrderInvoice(id, {
      invoicePdfUrl: uploaded.url,
      invoiceFileName: data.fileName,
    });

    const email = invoiceReadyEmail({
      name: updatedOrder.shippingName,
      orderNumber: updatedOrder.orderNumber,
      invoiceUrl: uploaded.url,
    });

    await sendMail({ to: updatedOrder.customerEmail, ...email });
    const sentOrder = await this.repository.markInvoiceSent(id);
    return serializeOrder(sentOrder);
  }

  async listUsers() {
    const users = await this.repository.listUsers();
    return users.map(serializeUser);
  }
}
