export const R2_OBJECT_PREFIXES = ['products/images/', 'products/posters/', 'products/videos/', 'orders/invoices/'] as const;

export function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

export function normalizeR2KeyFromPath(pathname: string) {
  const key = pathname.replace(/^\/+/, '').replace(/^media\/+/, '');
  return R2_OBJECT_PREFIXES.some((prefix) => key.startsWith(prefix)) ? key : null;
}

export function buildPublicR2Url(publicBaseUrl: string, key: string) {
  return `${normalizeBaseUrl(publicBaseUrl)}/${key}`;
}
