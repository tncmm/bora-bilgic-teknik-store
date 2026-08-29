import { describe, expect, it, vi } from 'vitest';

import { CatalogService } from './catalog.service.js';

describe('CatalogService', () => {
  it('maps query filters into a paginated catalog response', async () => {
    const repository = {
      listProducts: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'product-1',
            name: 'DJI Mavic 3 Pro',
            slug: 'dji-mavic-3-pro',
            brand: 'DJI',
            series: 'Mavic Serisi',
            shortDescription: 'Drone',
            description: 'Detayli drone aciklamasi',
            sku: 'SKU-1',
            badge: 'Yeni',
            heroTag: 'Hero',
            price: 88999,
            stock: 4,
            isPublished: true,
            isPurchasable: true,
            featureTags: ['4K Video'],
            ratingAverage: 4.9,
            reviewCount: 125,
            heroImageUrl: 'https://example.com/hero.jpg',
            heroTitle: 'DJI Mavic 3 Pro',
            heroDescription: 'Hero description',
            categoryId: 'category-1',
            category: {
              id: 'category-1',
              name: 'Drone',
              slug: 'drone',
              description: 'Drone category',
            },
            images: [
              {
                id: 'image-1',
                url: 'https://example.com/image.jpg',
                alt: 'Image',
                isPrimary: true,
                kind: 'image',
                thumbnailUrl: 'https://example.com/image.jpg',
              },
            ],
            specs: [{ id: 'spec-1', name: 'Camera', value: '4/3 CMOS' }],
            packageOptions: [{ id: 'standard', name: 'Standart Paket', price: 88999, isDefault: true }],
            detailSections: [{ id: 'aciklama', label: 'Aciklama', body: 'Test body' }],
          },
        ],
        total: 1,
        availableFilters: {
          series: [{ value: 'Mavic Serisi', count: 1 }],
          features: [{ value: '4K Video', count: 1 }],
          priceRange: { min: 88999, max: 88999 },
        },
      }),
      findProductBySlug: vi.fn(),
      listCategories: vi.fn(),
    };

    const service = new CatalogService(repository as any);
    const response = await service.listProducts({
      section: 'drone',
      series: 'Mavic Serisi',
      features: '4K Video',
      minPrice: '1000',
      maxPrice: '99999',
      sort: 'rating',
      page: '2',
      limit: '6',
    });

    expect(repository.listProducts).toHaveBeenCalledWith({
      section: 'drone',
      series: 'Mavic Serisi',
      search: undefined,
      minPrice: 1000,
      maxPrice: 99999,
      features: ['4K Video'],
      sort: 'rating',
      page: 2,
      limit: 6,
      onlyPurchasable: false,
    });
    expect(response.total).toBe(1);
    expect(response.availableFilters.sorts).toEqual(['newest', 'price-asc', 'price-desc', 'rating']);
    expect(response.items[0].section).toBe('drone');
    expect(response.items[0].packageOptions?.[0].name).toBe('Standart Paket');
  });

  it('serializes category counts and grouping metadata', async () => {
    const repository = {
      listProducts: vi.fn(),
      findProductBySlug: vi.fn(),
      listCategories: vi.fn().mockResolvedValue([
        {
          id: 'category-1',
          name: 'Drone',
          slug: 'drone',
          description: 'Drone category',
          heroTitle: 'DRONE',
          heroDescription: 'Hero',
          heroImageUrl: 'https://example.com/hero.jpg',
          sortOrder: 1,
          products: [
            { series: 'Mavic Serisi', featureTags: ['4K Video', 'Katlanabilir'] },
            { series: 'Air Serisi', featureTags: ['4K Video'] },
          ],
        },
      ]),
    };

    const service = new CatalogService(repository as any);
    const categories = await service.listCategories();

    expect(categories[0].productCount).toBe(2);
    expect(categories[0].series).toEqual(['Mavic Serisi', 'Air Serisi']);
    expect(categories[0].featureTags).toContain('4K Video');
  });
});
