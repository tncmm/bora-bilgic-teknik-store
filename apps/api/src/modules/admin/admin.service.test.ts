import { describe, expect, it, vi } from 'vitest';

import { AdminService } from './admin.service.js';

describe('AdminService', () => {
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
});
