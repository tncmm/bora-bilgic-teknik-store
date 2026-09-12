/**
 * SEO sabitleri ve schema.org JSON-LD üreticileri. Bileşenden ayrı tutulur
 * (react-refresh yalnızca bileşen export eden dosyalarla çalışır).
 */

export const SITE_NAME = 'Bora Bilgiç Teknik';
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://borabilgic.net.tr').replace(/\/+$/, '');
export const DEFAULT_OG_IMAGE = `${SITE_URL}/storefront/hero-drone.png`;

export function toAbsoluteUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
  };
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'tr-TR',
  };
}

interface ProductJsonLdInput {
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrls: string[];
  sku: string;
  brand: string;
  effectivePrice: number;
  stock: number;
  isPurchasable: boolean;
  ratingAverage?: number | null;
  reviewCount?: number | null;
}

export function buildProductJsonLd(product: ProductJsonLdInput) {
  const purchasable = product.isPurchasable && product.stock > 0;
  const description = (product.shortDescription || product.description || product.name).slice(0, 300);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: product.imageUrls.slice(0, 5).map(toAbsoluteUrl),
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/urun/${product.slug}`,
      priceCurrency: 'TRY',
      price: product.effectivePrice,
      availability: purchasable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(product.reviewCount && product.reviewCount > 0 && product.ratingAverage
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}

interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function buildBreadcrumbJsonLd(entries: BreadcrumbEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: `${SITE_URL}${entry.path}`,
    })),
  };
}
