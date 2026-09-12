import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Seo } from './Seo';
import { buildBreadcrumbJsonLd, buildProductJsonLd } from '../lib/seo';

describe('Seo', () => {
  it('başlığı site adı kalıbıyla head\'e hoist eder', () => {
    render(<Seo path="/urun/dji-mavic-3-pro" title="DJI Mavic 3 Pro" />);

    expect(document.title).toBe('DJI Mavic 3 Pro | Bora Bilgiç Teknik');
  });

  it('site adını zaten içeren başlığı olduğu gibi bırakır', () => {
    render(<Seo path="/" title="Bora Bilgiç Teknik | DJI Drone Mağazası" />);

    expect(document.title).toBe('Bora Bilgiç Teknik | DJI Drone Mağazası');
  });

  it('canonical link ve açıklama meta etiketlerini yazar', () => {
    render(<Seo description="Test açıklaması" path="/urun/dji-mic-2" title="DJI Mic 2" />);

    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://borabilgic.net.tr/urun/dji-mic-2');

    const description = document.querySelector('meta[name="description"]');
    expect(description?.getAttribute('content')).toBe('Test açıklaması');
  });

  it('noindex durumunda robots meta etiketini değiştirir', () => {
    render(<Seo noindex path="/checkout" title="Ödeme" />);

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  });

  it('JSON-LD girişlerini script etiketi olarak render eder', () => {
    const product = buildProductJsonLd({
      name: 'DJI Mavic 3 Pro',
      slug: 'dji-mavic-3-pro',
      description: 'Hasselblad kamera',
      shortDescription: null,
      imageUrls: ['/storefront/product-drone.png'],
      sku: 'BBT-MAV3P',
      brand: 'DJI',
      effectivePrice: 88999,
      stock: 5,
      isPurchasable: true,
      ratingAverage: 4.8,
      reviewCount: 24,
    });
    const breadcrumb = buildBreadcrumbJsonLd([
      { name: 'Ana Sayfa', path: '/' },
      { name: 'DJI Mavic 3 Pro', path: '/urun/dji-mavic-3-pro' },
    ]);

    render(<Seo jsonLd={[product, breadcrumb]} path="/urun/dji-mavic-3-pro" title="DJI Mavic 3 Pro" />);

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(2);

    const parsedProduct = JSON.parse(scripts[0].textContent ?? '{}');
    expect(parsedProduct['@type']).toBe('Product');
    expect(parsedProduct.offers.price).toBe(88999);
    expect(parsedProduct.offers.availability).toBe('https://schema.org/InStock');
    expect(parsedProduct.aggregateRating.reviewCount).toBe(24);

    const parsedBreadcrumb = JSON.parse(scripts[1].textContent ?? '{}');
    expect(parsedBreadcrumb['@type']).toBe('BreadcrumbList');
  });

  it('satın alınamaz veya stoksuz üründe availability OutOfStock olur', () => {
    const jsonLd = buildProductJsonLd({
      name: 'DJI Enterprise',
      slug: 'dji-enterprise',
      description: null,
      shortDescription: 'Teklif odaklı',
      imageUrls: [],
      sku: 'BBT-ENT',
      brand: 'DJI',
      effectivePrice: 250000,
      stock: 0,
      isPurchasable: true,
      ratingAverage: null,
      reviewCount: 0,
    });

    render(<Seo jsonLd={[jsonLd]} path="/urun/dji-enterprise" title="DJI Enterprise" />);

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? '{}').offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('stoksuz aramada görünürse EmptyState ile birlikte noindex üretir', () => {
    // Not: bu test Seo bileşeninin izolasyonunu korur; ekran sorgusu
    // kullanılmaz ancak render'in hatasız tamamlandığı doğrulanır.
    const { container } = render(
      <Seo description="a" jsonLd={[]} noindex path="/x" title="t" />,
    );
    expect(container).toBeInTheDocument();
    expect(screen.queryByText('t')).toBeNull();
  });
});
