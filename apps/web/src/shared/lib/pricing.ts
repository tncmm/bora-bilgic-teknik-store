import type { Product } from '@bora/types';

/**
 * Paketli satirlarin birim fiyati: paket fiyati mutlaktir (taban fiyata delta
 * degildir) ve urunun indirim yuzdesi uzerinden hesaplanir. Backend'deki
 * computeLineUnitPrice semantigiyle birebir aynidir; kurus pozisyonuna yuvarlanir.
 */
export function computePackageUnitPrice(product: Product, packageOptionId?: string | null): number | undefined {
  const option = packageOptionId
    ? product.packageOptions?.find((entry) => entry.id === packageOptionId)
    : undefined;
  if (!option) return undefined;

  const discount = Math.min(100, Math.max(0, product.discountPercent ?? 0));
  return Math.round(option.price * (100 - discount)) / 100;
}
