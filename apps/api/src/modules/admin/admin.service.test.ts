import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { AdminService } from './admin.service.js';

describe('AdminService', () => {
  it('blocks fulfilment transitions while payment is pending', async () => {
    const repository = {
      getOrder: vi.fn().mockResolvedValue({ id: 'order-1', paymentStatus: 'PENDING' }),
      updateOrderStatus: vi.fn(),
    };

    const service = new AdminService(repository as any);

    await expect(service.updateOrderStatus('order-1', { status: 'SHIPPED' })).rejects.toBeInstanceOf(AppError);
    await expect(service.updateOrderStatus('order-1', { status: 'SHIPPED' })).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('allows fulfilment transitions once the order is paid', async () => {
    const paidOrder = {
      id: 'order-1',
      orderNumber: 'BBT-TEST',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
      createdAt: new Date(),
      paidAt: new Date(),
      total: 100,
      shippingName: 'Demo',
      shippingPhone: '555',
      shippingCity: 'Istanbul',
      shippingDistrict: 'Kadikoy',
      shippingAddressLine: 'Adres',
      notes: null,
      items: [],
    };
    const repository = {
      getOrder: vi.fn().mockResolvedValue({ id: 'order-1', paymentStatus: 'PAID' }),
      updateOrderStatus: vi.fn().mockResolvedValue(paidOrder),
    };

    const service = new AdminService(repository as any);

    const result = await service.updateOrderStatus('order-1', { status: 'SHIPPED' });
    expect(repository.updateOrderStatus).toHaveBeenCalledWith('order-1', 'SHIPPED');
    expect(result.status).toBe('shipped');
  });

  it('rejects products that only contain video media', async () => {
    const repository = {
      createProduct: vi.fn(),
    };

    const service = new AdminService(repository as any);

    await expect(
      service.createProduct({
        name: 'Demo Product',
        slug: 'demo-product',
        categoryId: 'category-1',
        shortDescription: 'Kisa aciklama',
        description: 'Bu daha detayli bir aciklamadir.',
        sku: 'SKU-001',
        price: 100,
        stock: 1,
        isPublished: true,
        isPurchasable: true,
        images: [
          {
            url: 'https://example.com/video.mp4',
            alt: 'Demo video',
            isPrimary: false,
            kind: 'video',
            thumbnailUrl: 'https://example.com/poster.jpg',
          },
        ],
        specs: [{ name: 'Sensor', value: '1 inch' }],
      }),
    ).rejects.toThrow();
  });

  it('rejects video media without a poster thumbnail', async () => {
    const repository = {
      createProduct: vi.fn(),
    };

    const service = new AdminService(repository as any);

    await expect(
      service.createProduct({
        name: 'Demo Product',
        slug: 'demo-product',
        categoryId: 'category-1',
        shortDescription: 'Kisa aciklama',
        description: 'Bu daha detayli bir aciklamadir.',
        sku: 'SKU-001',
        price: 100,
        stock: 1,
        isPublished: true,
        isPurchasable: true,
        images: [
          {
            url: 'https://example.com/image.jpg',
            alt: 'Demo image',
            isPrimary: true,
            kind: 'image',
          },
          {
            url: 'https://example.com/video.mp4',
            alt: 'Demo video',
            isPrimary: false,
            kind: 'video',
          },
        ],
        specs: [{ name: 'Sensor', value: '1 inch' }],
      }),
    ).rejects.toThrow();
  });

  it('updates images and specs together using nested writes', async () => {
    const product = {
      id: 'product-1',
      name: 'Demo Product',
      slug: 'demo-product',
      brand: 'DJI',
      categoryId: 'category-1',
      category: { id: 'category-1', name: 'Drone', slug: 'drone', description: 'Drone' },
      shortDescription: 'Kisa aciklama',
      description: 'Bu daha detayli bir aciklamadir.',
      sku: 'SKU-001',
      price: 100,
      discountPercent: 0,
      stock: 1,
      isPublished: true,
      isPurchasable: true,
      isBestseller: false,
      images: [{ id: 'image-1', url: 'https://example.com/image.jpg', alt: 'Demo image', isPrimary: true, kind: 'image' }],
      specs: [{ id: 'spec-1', name: 'Sensor', value: '1 inch' }],
    };
    const repository = {
      getProduct: vi.fn().mockResolvedValue(product),
      updateProduct: vi.fn().mockResolvedValue(product),
    };

    const service = new AdminService(repository as any);

    await service.updateProduct('product-1', {
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      categoryId: product.categoryId,
      shortDescription: product.shortDescription,
      description: product.description,
      sku: product.sku,
      price: product.price,
      stock: product.stock,
      isPublished: product.isPublished,
      isPurchasable: product.isPurchasable,
      images: [{ url: 'https://example.com/image.jpg', alt: 'Demo image', isPrimary: true, kind: 'image' }],
      specs: [{ name: 'Sensor', value: '1 inch' }],
    });

    expect(repository.updateProduct).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({
        images: expect.objectContaining({ deleteMany: {}, create: expect.any(Array) }),
        specs: expect.objectContaining({ deleteMany: {}, create: expect.any(Array) }),
      }),
    );
  });

  it('rejects duplicate category slugs with 409', async () => {
    const repository = {
      findCategoryBySlug: vi.fn().mockResolvedValue({ id: 'category-1' }),
      createCategory: vi.fn(),
    };
    const service = new AdminService(repository as any);

    await expect(service.createCategory({ name: 'Aksesuar', slug: 'aksesuar' })).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.createCategory).not.toHaveBeenCalled();
  });

  it('refuses to delete a category that still has products', async () => {
    const repository = {
      countCategoryProducts: vi.fn().mockResolvedValue(3),
      deleteCategory: vi.fn(),
    };
    const service = new AdminService(repository as any);

    await expect(service.deleteCategory('category-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.deleteCategory).not.toHaveBeenCalled();
  });

  it('renames a brand across all of its products', async () => {
    const repository = {
      listBrandSummaries: vi.fn(),
      findBrandByName: vi.fn(),
      createBrand: vi.fn(),
      renameBrand: vi.fn().mockResolvedValue({ count: 4 }),
    };
    const service = new AdminService(repository as any);

    const result = await service.renameBrand({ from: 'GoPro', to: 'DJI' });

    expect(result.updated).toBe(4);
    expect(repository.renameBrand).toHaveBeenCalledWith('GoPro', 'DJI');
  });

  it('creates an empty brand for product form suggestions', async () => {
    const repository = {
      findBrandByName: vi.fn().mockResolvedValue(null),
      createBrand: vi.fn().mockResolvedValue({ name: 'Insta360' }),
    };
    const service = new AdminService(repository as any);

    const result = await service.createBrand({ name: 'Insta360' });

    expect(repository.createBrand).toHaveBeenCalledWith('Insta360');
    expect(result).toEqual({ brand: 'Insta360', productCount: 0 });
  });

  it('does not delete a brand that still has products', async () => {
    const repository = {
      countBrandProducts: vi.fn().mockResolvedValue(2),
      deleteBrand: vi.fn(),
    };
    const service = new AdminService(repository as any);

    await expect(service.deleteBrand('DJI')).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.deleteBrand).not.toHaveBeenCalled();
  });
});
