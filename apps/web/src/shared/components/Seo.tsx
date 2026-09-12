/**
 * Sayfa bazlı meta yönetimi — React 19'un native <title>/<meta>/<link>
 * hoisting'ini kullanır; react-helmet gibi ekstra bir dependency gerekmez.
 *
 * Her indexable sayfa kendi <Seo>'sunu render eder; sepet/checkout/giriş/
 * profil/admin gibi özel sayfalar noindex ile çağırır. Hoist edilen etiketler
 * component unmount olduğunda head'den kaldırılır, böylece rota geçişlerinde
 * bayat meta kalmaz.
 */

import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE, toAbsoluteUrl } from '../lib/seo';

interface SeoProps {
  /** Sayfa başlığı; SITE_NAME içermiyorsa `${title} | ${SITE_NAME}` kalıbına oturur. */
  title: string;
  description?: string;
  /** Canonical yol ('/urun/dji-mavic-3-pro' gibi); SITE_URL ile birleşir. */
  path?: string;
  /** Özel sayfalar (sepet, checkout, hesap, admin) için true. */
  noindex?: boolean;
  ogType?: 'website' | 'product';
  ogImage?: string;
  /** schema.org JSON-LD grafikleri (Product, BreadcrumbList, Organization...). */
  jsonLd?: object[];
}

export function Seo({ title, description, path, noindex = false, ogType = 'website', ogImage, jsonLd = [] }: SeoProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonical = `${SITE_URL}${path ?? '/'}`;
  const image = ogImage ? toAbsoluteUrl(ogImage) : DEFAULT_OG_IMAGE;

  return (
    <>
      <title>{fullTitle}</title>
      <link href={canonical} rel="canonical" />
      <meta content={noindex ? 'noindex, follow' : 'index, follow'} name="robots" />
      {description ? <meta content={description} name="description" /> : null}
      <meta content={fullTitle} property="og:title" />
      {description ? <meta content={description} property="og:description" /> : null}
      <meta content={image} property="og:image" />
      <meta content={SITE_NAME} property="og:site_name" />
      <meta content="tr_TR" property="og:locale" />
      <meta content={ogType} property="og:type" />
      <meta content={canonical} property="og:url" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content={fullTitle} name="twitter:title" />
      {description ? <meta content={description} name="twitter:description" /> : null}
      <meta content={image} name="twitter:image" />
      {jsonLd.map((entry, index) => (
        <script dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }} key={`jsonld-${index}`} type="application/ld+json" />
      ))}
    </>
  );
}
