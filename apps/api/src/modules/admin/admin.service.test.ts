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
      renameBrand: vi.fn().mockResolvedValue({ count: 4 }),
    };
    const service = new AdminService(repository as any);

    const result = await service.renameBrand({ from: 'GoPro', to: 'DJI' });

    expect(result.updated).toBe(4);
    expect(repository.renameBrand).toHaveBeenCalledWith('GoPro', 'DJI');
  });
});
