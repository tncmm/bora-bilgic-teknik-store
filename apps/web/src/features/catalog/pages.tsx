import { Badge, Button, EmptyState } from '@bora/ui';
import type { Category, Product } from '@bora/types';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useI18n } from '../../app/providers/I18nProvider';
import { api } from '../../shared/api/client';
import { ProductCard } from '../../shared/components/ProductCard';
import { formatCurrency } from '../../shared/lib/format';
import { translateCategoryName } from '../../shared/lib/i18n';

function useCatalogData(params?: Record<string, string>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .listProducts(params)
      .then((response) => {
        if (!mounted) return;
        setProducts(response);
        setError(null);
      })
      .catch((nextError: Error) => {
        if (!mounted) return;
        setError(nextError.message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [JSON.stringify(params)]);

  return { products, loading, error };
}

const collectionContent = {
  'camera-drones': {
    name: 'Camera Drones',
    description: 'Mavic, Air, Mini, Avata ve Inspire ailesi ile DJI hava goruntuleme sistemleri.',
  },
  handheld: {
    name: 'Handheld',
    description: 'RS, Osmo ve Mic serileri ile DJI creator ve production ekosistemi.',
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Matrice ve FlyCart platformlari ile saha, denetim ve operasyon gorevleri.',
  },
} as const;

const visualLibrary = {
  camera: [
    'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1524143986875-3b098d78b363?auto=format&fit=crop&w=1200&q=80',
  ],
  handheld: [
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520672106821-15c55e1a4a14?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  ],
  enterprise: [
    'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1524143986875-3b098d78b363?auto=format&fit=crop&w=1200&q=80',
  ],
} as const;

function getPrimaryImage(product?: Product) {
  if (!product) return undefined;
  return product.images.find((image) => image.isPrimary) ?? product.images[0];
}

function getGalleryImages(products: Product[], limit = 3) {
  return products
    .map((product) => {
      const image = getPrimaryImage(product);
      return image ? { src: image.url, alt: image.alt } : null;
    })
    .filter((image): image is { src: string; alt: string } => Boolean(image))
    .slice(0, limit);
}

function CollectionShowcaseCard({
  title,
  description,
  count,
  imageUrl,
  gallery,
  eyebrow,
  to,
  countLabel,
  footerLabel,
  className = '',
}: {
  title: string;
  description: string;
  count: number;
  imageUrl?: string;
  gallery: Array<{ src: string; alt: string }>;
  eyebrow: string;
  to: string;
  countLabel: string;
  footerLabel: string;
  className?: string;
}) {
  return (
    <Link className={['collection-showcase', className].filter(Boolean).join(' ')} to={to}>
      <div className="collection-showcase__media">
        {imageUrl ? <img alt={title} src={imageUrl} /> : null}
      </div>
      <div className="collection-showcase__overlay" />
      <div className="collection-showcase__body">
        <div className="detail-chip-row">
          <Badge>{eyebrow}</Badge>
          <Badge>{count} {countLabel}</Badge>
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
        {gallery.length > 0 ? (
          <div className="collection-showcase__thumbs">
            {gallery.map((image) => (
              <div className="collection-showcase__thumb" key={`${title}-${image.src}`}>
                <img alt={image.alt} src={image.src} />
              </div>
            ))}
          </div>
        ) : null}
        <div className="collection-showcase__footer">
          <span>{footerLabel}</span>
          <strong>{count.toString().padStart(2, '0')}</strong>
        </div>
      </div>
    </Link>
  );
}

function StoryPanel({
  kicker,
  title,
  description,
  imageUrl,
  gallery,
  stat,
  className = '',
}: {
  kicker: string;
  title: string;
  description: string;
  imageUrl?: string;
  gallery: Array<{ src: string; alt: string }>;
  stat?: string;
  className?: string;
}) {
  return (
    <div className={['feature-panel', className].filter(Boolean).join(' ')}>
      <div className="feature-panel__media">{imageUrl ? <img alt={title} src={imageUrl} /> : null}</div>
      <div className="feature-panel__body">
        <div className="feature-panel__topline">
          <div className="detail-chip">{kicker}</div>
          {stat ? <div className="feature-panel__stat">{stat}</div> : null}
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
        {gallery.length > 0 ? (
          <div className="feature-panel__thumbs">
            {gallery.map((image) => (
              <div className="feature-panel__thumb" key={`${title}-${image.src}`}>
                <img alt={image.alt} src={image.src} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BentoCard({ product, featured = false }: { product: Product; featured?: boolean }) {
  const { language } = useI18n();
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  return (
    <Link className={`bento-card ${featured ? 'bento-card--featured' : 'bento-card--stack'}`} to={`/urun/${product.slug}`}>
      <img alt={primaryImage?.alt ?? product.name} src={primaryImage?.url} />
      <div className="bento-card__content">
        <div className="detail-chip-row">
          <Badge>{product.badge ?? product.brand}</Badge>
          <Badge>{product.specs[0]?.value ?? product.category.name}</Badge>
        </div>
        <h3>{product.name}</h3>
        <p>{product.shortDescription}</p>
        <p className="price-text" style={{ marginTop: '1rem' }}>
          {product.isPurchasable ? formatCurrency(product.price, language) : language === 'tr' ? 'Tanitim Urunu' : 'Promo Product'}
        </p>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { language } = useI18n();
  const { products, loading } = useCatalogData();
  const heroProduct = products[0];
  const cameraDrones = useMemo(() => products.filter((product) => product.category.slug === 'camera-drones'), [products]);
  const handheld = useMemo(() => products.filter((product) => product.category.slug === 'handheld'), [products]);
  const enterprise = useMemo(() => products.filter((product) => product.category.slug === 'enterprise'), [products]);
  const cameraLead = cameraDrones[0];
  const handheldLead = handheld[0];
  const enterpriseLead = enterprise[0];
  const ui = language === 'tr'
    ? {
        heroBadge: 'DJI Resmi Odak',
        heroTitle: 'DJI Ekosistemi.',
        heroTitleAccent: 'Tek Bir Katalogda.',
        heroDescription:
          'Bora Bilgic Teknik artik yalnizca DJI urun ailelerine odaklanir. Kamera dronlari, handheld creator sistemleri ve enterprise platformlar tek akista listelenir.',
        heroPrimary: 'Tum DJI Koleksiyonu',
        heroSecondary: 'One Cikan Model',
        newArrivals: 'Yeni Gelenler',
        newArrivalsDesc: 'DJI katalogunun one cikan guncel urunleri.',
        viewAll: 'Tumunu Gor',
        loading: 'Urunler yukleniyor...',
        emptyTitle: 'Katalog bos',
        emptyDesc: 'Henuz yayinlanan urun bulunmuyor.',
        collections: 'DJI Koleksiyonlari',
        collectionsDesc: 'Hava, creator ve saha odakli DJI aileleri tek vitrinde gruplanir.',
        countLabel: 'urun',
        footerLabel: 'Koleksiyona git',
        showcaseAerial: 'Aerial Core',
        showcaseAerialDesc: 'Mavic, Air, Mini, Avata ve Inspire ailesi ile cekim akisini havadan kuran ana vitrin.',
        showcaseCreator: 'Creator Rig',
        showcaseCreatorDesc: 'RS, Osmo ve Mic serileri ile elde cekim, ses ve hareket kontrolunu tamamlayan hat.',
        showcaseEnterprise: 'Mission Systems',
        showcaseEnterpriseDesc: 'Matrice ve lojistik platformlari ile denetim, operasyon ve teklif odakli enterprise hat.',
        excellence: 'The Standard of Excellence',
        excellenceAerialTitle: 'Mavic, Air, Mini, Avata ve Inspire cekim hattinin tamami tek ailede.',
        excellenceAerialDesc:
          'Mavic 4 Pro, Air 3S, Mini 5 Pro, Avata 360 ve Inspire 3; kompakt creator cekimlerinden ileri seviye sinema produksiyonuna kadar tum hava senaryolarini ayni ailede toplar.',
        excellenceAerialKicker: 'Aerial Flagship',
        excellenceAerialStat: `${cameraDrones.length} Model`,
        excellenceCreatorTitle: 'Elde cekim, aksiyon kamera ve ses zinciri ayni vitrine baglanir.',
        excellenceCreatorDesc:
          'RS 5, Osmo Action 6, Osmo Mobile 8P ve Mic 2; tek kisi cekimden hizli set kurulumuna kadar creator akisinin tum temel halkalarini kaplar.',
        excellenceCreatorKicker: 'Creator Setup',
        excellenceCreatorStat: 'RS / Osmo / Mic',
        excellenceEnterpriseTitle: 'Matrice platformlari saha ve operasyon senaryolari icin ayri katmanda durur.',
        excellenceEnterpriseDesc:
          'Matrice serisi premium saha gorevleri, denetim ve kurumsal operasyonlarda teklif odakli ilerler; vitrin dili de buna gore ayrisir.',
        excellenceEnterpriseKicker: 'Enterprise Missions',
        excellenceEnterpriseStat: 'Quote Ready',
        excellenceShoppingTitle: 'Hizli satin alma ile premium teklif akisi ayni showroom dili icinde ayrisir.',
        excellenceShoppingDesc:
          'Mini 5 Pro, Air 3S ve RS 5 gibi hizli karar verilen modeller dogrudan sepete gider; Inspire 3 ve Matrice gibi ust segment urunler ise inceleme ve teklif akisini korur.',
        excellenceShoppingKicker: 'Shopping Flow',
        excellenceShoppingStat: 'Cart + Quote',
      }
    : {
        heroBadge: 'DJI Official Focus',
        heroTitle: 'DJI Ecosystem.',
        heroTitleAccent: 'In One Catalog.',
        heroDescription:
          'Bora Bilgic Teknik now focuses exclusively on DJI product families. Camera drones, handheld creator systems, and enterprise platforms are presented in a single flow.',
        heroPrimary: 'Browse All DJI Collections',
        heroSecondary: 'Featured Model',
        newArrivals: 'New Arrivals',
        newArrivalsDesc: 'Highlighted current products from the DJI catalog.',
        viewAll: 'View All',
        loading: 'Loading products...',
        emptyTitle: 'Catalog is empty',
        emptyDesc: 'There are no published products yet.',
        collections: 'DJI Collections',
        collectionsDesc: 'Aerial, creator, and field-focused DJI families are grouped into one storefront.',
        countLabel: 'items',
        footerLabel: 'Open collection',
        showcaseAerial: 'Aerial Core',
        showcaseAerialDesc: 'The main aerial showcase built around Mavic, Air, Mini, Avata, and Inspire families.',
        showcaseCreator: 'Creator Rig',
        showcaseCreatorDesc: 'A line that completes handheld shooting, audio, and motion control with RS, Osmo, and Mic series.',
        showcaseEnterprise: 'Mission Systems',
        showcaseEnterpriseDesc: 'Enterprise line for inspection, operations, and quote-driven workflows with Matrice and logistics platforms.',
        excellence: 'The Standard of Excellence',
        excellenceAerialTitle: 'The full Mavic, Air, Mini, Avata, and Inspire capture line in one family.',
        excellenceAerialDesc:
          'Mavic 4 Pro, Air 3S, Mini 5 Pro, Avata 360, and Inspire 3 cover every aerial scenario, from compact creator shoots to advanced cinema production.',
        excellenceAerialKicker: 'Aerial Flagship',
        excellenceAerialStat: `${cameraDrones.length} Models`,
        excellenceCreatorTitle: 'Handheld shooting, action camera, and audio chain connect in one showcase.',
        excellenceCreatorDesc:
          'RS 5, Osmo Action 6, Osmo Mobile 8P, and Mic 2 cover the full creator workflow from solo capture to fast set builds.',
        excellenceCreatorKicker: 'Creator Setup',
        excellenceCreatorStat: 'RS / Osmo / Mic',
        excellenceEnterpriseTitle: 'Matrice platforms stay separated for field and operational scenarios.',
        excellenceEnterpriseDesc:
          'The Matrice series moves through a quote-led flow for premium field missions, inspections, and enterprise operations.',
        excellenceEnterpriseKicker: 'Enterprise Missions',
        excellenceEnterpriseStat: 'Quote Ready',
        excellenceShoppingTitle: 'Fast purchase and premium quote flow stay separated within the same showroom language.',
        excellenceShoppingDesc:
          'Quick-decision models like Mini 5 Pro, Air 3S, and RS 5 move straight to cart, while upper-tier systems like Inspire 3 and Matrice retain a review-and-quote flow.',
        excellenceShoppingKicker: 'Shopping Flow',
        excellenceShoppingStat: 'Cart + Quote',
      };
  const cameraGallery = getGalleryImages(cameraDrones).length ? getGalleryImages(cameraDrones) : visualLibrary.camera.map((src, index) => ({ src, alt: `Camera visual ${index + 1}` }));
  const handheldGallery = getGalleryImages(handheld).length ? getGalleryImages(handheld) : visualLibrary.handheld.map((src, index) => ({ src, alt: `Handheld visual ${index + 1}` }));
  const enterpriseGallery = getGalleryImages(enterprise).length ? getGalleryImages(enterprise) : visualLibrary.enterprise.map((src, index) => ({ src, alt: `Enterprise visual ${index + 1}` }));

  return (
    <>
      <section className="hero-stage">
        <div className="hero-stage__background">
          <img
            alt="Professional precision"
            src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=80"
          />
        </div>
        <div className="ui-shell hero-stage__content">
          <div className="hero-stage__eyebrow">
            <Badge>{ui.heroBadge}</Badge>
          </div>
          <h1>
            {ui.heroTitle}
            <br />
            <span>{ui.heroTitleAccent}</span>
          </h1>
          <p>{ui.heroDescription}</p>
          <div className="hero-actions">
            <Link to="/katalog">
              <Button>{ui.heroPrimary}</Button>
            </Link>
            <Link to={heroProduct ? `/urun/${heroProduct.slug}` : '/katalog'}>
              <Button variant="secondary">{ui.heroSecondary}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell">
          <div className="section-header">
            <div>
              <h2>{ui.newArrivals}</h2>
              <p>{ui.newArrivalsDesc}</p>
            </div>
            <Link className="section-link" to="/katalog">
              {ui.viewAll}
            </Link>
          </div>

          {loading ? (
            <p className="text-muted">{ui.loading}</p>
          ) : products.length === 0 ? (
            <EmptyState description={ui.emptyDesc} title={ui.emptyTitle} />
          ) : (
            <div className="bento-grid">
              {products[0] ? <BentoCard featured product={products[0]} /> : null}
              {products.slice(1, 3).map((product) => (
                <BentoCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell">
          <div className="section-header">
            <div>
              <h2>{ui.collections}</h2>
              <p>{ui.collectionsDesc}</p>
            </div>
          </div>
          <div className="collection-showcase-grid">
            <CollectionShowcaseCard
              className="collection-showcase--hero"
              count={cameraDrones.length}
              countLabel={ui.countLabel}
              description={ui.showcaseAerialDesc}
              eyebrow={ui.showcaseAerial}
              footerLabel={ui.footerLabel}
              gallery={cameraGallery}
              imageUrl={getPrimaryImage(cameraLead)?.url ?? visualLibrary.camera[0]}
              title={translateCategoryName(language, 'camera-drones', 'Camera Drones')}
              to="/katalog?category=camera-drones"
            />
            <CollectionShowcaseCard
              className="collection-showcase--stack-top"
              count={handheld.length}
              countLabel={ui.countLabel}
              description={ui.showcaseCreatorDesc}
              eyebrow={ui.showcaseCreator}
              footerLabel={ui.footerLabel}
              gallery={handheldGallery}
              imageUrl={getPrimaryImage(handheldLead)?.url ?? visualLibrary.handheld[0]}
              title={translateCategoryName(language, 'handheld', 'Handheld')}
              to="/katalog?category=handheld"
            />
            <CollectionShowcaseCard
              className="collection-showcase--stack-bottom"
              count={enterprise.length}
              countLabel={ui.countLabel}
              description={ui.showcaseEnterpriseDesc}
              eyebrow={ui.showcaseEnterprise}
              footerLabel={ui.footerLabel}
              gallery={enterpriseGallery}
              imageUrl={getPrimaryImage(enterpriseLead)?.url ?? visualLibrary.enterprise[0]}
              title={translateCategoryName(language, 'enterprise', 'Enterprise')}
              to="/katalog?category=enterprise"
            />
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell">
          <h2 style={{ fontSize: 'clamp(2.6rem, 5vw, 4.6rem)' }}>{ui.excellence}</h2>
          <div className="standard-grid">
            <StoryPanel
              className="feature-panel--wide feature-panel--immersive"
              description={ui.excellenceAerialDesc}
              gallery={cameraGallery}
              imageUrl={getPrimaryImage(cameraLead)?.url ?? visualLibrary.camera[0]}
              kicker={ui.excellenceAerialKicker}
              stat={ui.excellenceAerialStat}
              title={ui.excellenceAerialTitle}
            />
            <StoryPanel
              className="feature-panel--tall"
              description={ui.excellenceCreatorDesc}
              gallery={getGalleryImages(products.slice(0, 3)).length ? getGalleryImages(products.slice(0, 3)) : visualLibrary.camera.map((src, index) => ({ src, alt: `Product mix visual ${index + 1}` }))}
              imageUrl={getPrimaryImage(handheldLead)?.url ?? visualLibrary.handheld[0]}
              kicker={ui.excellenceCreatorKicker}
              stat={ui.excellenceCreatorStat}
              title={ui.excellenceCreatorTitle}
            />
            <StoryPanel
              className="feature-panel--tall"
              description={ui.excellenceEnterpriseDesc}
              gallery={enterpriseGallery}
              imageUrl={getPrimaryImage(enterpriseLead)?.url ?? visualLibrary.enterprise[0]}
              kicker={ui.excellenceEnterpriseKicker}
              stat={ui.excellenceEnterpriseStat}
              title={ui.excellenceEnterpriseTitle}
            />
            <StoryPanel
              className="feature-panel--wide"
              description={ui.excellenceShoppingDesc}
              gallery={handheldGallery}
              imageUrl={getPrimaryImage(handheldLead)?.url ?? visualLibrary.handheld[0]}
              kicker={ui.excellenceShoppingKicker}
              stat={ui.excellenceShoppingStat}
              title={ui.excellenceShoppingTitle}
            />
          </div>
        </div>
      </section>
    </>
  );
}

export function CatalogPage() {
  const { language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategorySlug = searchParams.get('category') ?? '';
  const params = Object.fromEntries(
    [
      ['saleMode', searchParams.get('saleMode') ?? ''],
      ['category', activeCategorySlug],
    ].filter(([, value]) => value),
  );
  const { products, error, loading } = useCatalogData(params);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void api.listCategories().then(setCategories).catch(() => undefined);
  }, []);

  const activeCategory = categories.find((category) => category.slug === activeCategorySlug);
  const cameraProducts = useMemo(() => products.filter((product) => product.category.slug === 'camera-drones'), [products]);
  const handheldProducts = useMemo(() => products.filter((product) => product.category.slug === 'handheld'), [products]);
  const enterpriseProducts = useMemo(() => products.filter((product) => product.category.slug === 'enterprise'), [products]);
  const activeCollection =
    (activeCategorySlug && activeCategorySlug in collectionContent
      ? collectionContent[activeCategorySlug as keyof typeof collectionContent]
      : undefined) ?? null;
  const heroTitle = activeCollection ? translateCategoryName(language, activeCategorySlug, activeCollection.name) : language === 'tr' ? 'DJI Katalogu' : 'DJI Catalog';
  const heroDescription =
    language === 'tr'
      ? activeCollection?.description ?? 'Tum DJI urun ailelerini tek katalog akisi icinde kesfedin.'
      : activeCategorySlug === 'camera-drones'
        ? 'DJI aerial imaging systems built around the Mavic, Air, Mini, Avata, and Inspire families.'
        : activeCategorySlug === 'handheld'
          ? 'DJI creator and production ecosystem built around RS, Osmo, and Mic series.'
          : activeCategorySlug === 'enterprise'
            ? 'DJI field, inspection, and operational platforms built around Matrice and FlyCart systems.'
            : 'Discover all DJI product families in one catalog flow.';

  return (
    <>
      <section className="catalog-hero">
        <div className="catalog-hero__background">
          <img
            alt="Drone catalog"
            src="https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1600&q=80"
          />
        </div>
        <div className="ui-shell catalog-hero__content">
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell catalog-layout">
          <aside className="filter-sidebar">
            <div className="filter-sidebar__group">
              <h3>{language === 'tr' ? 'DJI Koleksiyonu' : 'DJI Collection'}</h3>
              <div className="filter-sidebar__checks">
                <label className="filter-checkbox">
                  <input checked={!activeCategorySlug} onChange={() => setSearchParams(new URLSearchParams())} type="radio" />
                  <span>{language === 'tr' ? 'Tum DJI Urunleri' : 'All DJI Products'}</span>
                </label>
                {categories.map((category) => (
                  <label className="filter-checkbox" key={category.id}>
                    <input
                      checked={activeCategorySlug === category.slug}
                      onChange={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('category', category.slug);
                        setSearchParams(next);
                      }}
                      type="radio"
                    />
                    <span>{translateCategoryName(language, category.slug, category.name)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-sidebar__group">
              <h3>{language === 'tr' ? 'Satis Durumu' : 'Sale Mode'}</h3>
              <select
                className="ui-select"
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  if (event.target.value) next.set('saleMode', event.target.value);
                  else next.delete('saleMode');
                  setSearchParams(next);
                }}
                value={searchParams.get('saleMode') ?? ''}
              >
                <option value="">{language === 'tr' ? 'Tum yayinlanan DJI urunleri' : 'All published DJI products'}</option>
                <option value="purchasable">{language === 'tr' ? 'Sepete eklenebilenler' : 'Purchasable only'}</option>
              </select>
            </div>
          </aside>

          <div>
            <div className="catalog-body__header">
              <div>
                <h2>{language === 'tr' ? `${products.length} DJI urunu listeleniyor` : `${products.length} DJI products listed`}</h2>
                <p>
                  {activeCategory
                    ? language === 'tr'
                      ? `${translateCategoryName(language, activeCategory.slug, activeCategory.name)} koleksiyonundaki yayindaki DJI urunleri gosteriliyor.`
                      : `Published DJI products from the ${translateCategoryName(language, activeCategory.slug, activeCategory.name)} collection are shown.`
                    : language === 'tr'
                      ? 'Storefront yalnizca DJI urunlerini listeler.'
                      : 'The storefront lists DJI products only.'}
                </p>
              </div>
              <div className="catalog-sort">
                <span>{language === 'tr' ? 'Odak:' : 'Focus:'}</span>
                <strong>{activeCategory ? translateCategoryName(language, activeCategory.slug, activeCategory.name) : language === 'tr' ? 'Tum Koleksiyonlar' : 'All Collections'}</strong>
              </div>
            </div>

            {loading ? <p className="text-muted">{language === 'tr' ? 'Urunler yukleniyor...' : 'Loading products...'}</p> : null}
            {error ? <p className="text-muted">{error}</p> : null}
            {!loading && products.length === 0 ? (
              <EmptyState description={language === 'tr' ? 'Filtreleri degistirerek tekrar deneyin.' : 'Try again by changing the filters.'} title={language === 'tr' ? 'Urun bulunamadi' : 'No products found'} />
            ) : (
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell">
          <h2 style={{ fontSize: 'clamp(2.6rem, 5vw, 4.4rem)' }}>{language === 'tr' ? 'The Standard of Excellence' : 'The Standard of Excellence'}</h2>
          <div className="standard-grid">
            <StoryPanel
              className="feature-panel--wide feature-panel--immersive"
              description="Mavic 4 Pro, Air 3S, Mini 5 Pro, Avata 360 ve Inspire 3 ayni kamera drone vitrini icinde; seyahat, creator ve sinema kullanimlari ayri segmentler olarak okunur."
              gallery={getGalleryImages(cameraProducts).length ? getGalleryImages(cameraProducts) : visualLibrary.camera.map((src, index) => ({ src, alt: `Camera catalog visual ${index + 1}` }))}
              imageUrl={getPrimaryImage(cameraProducts[0] ?? products[0])?.url ?? visualLibrary.camera[0]}
              kicker={translateCategoryName(language, 'camera-drones', 'Camera Drones')}
              stat={language === 'tr' ? `${cameraProducts.length} Urun` : `${cameraProducts.length} Products`}
              title={
                language === 'tr'
                  ? 'Mavic, Air, Mini, Avata ve Inspire ailesi ayni hava vitrini icinde akar.'
                  : 'Mavic, Air, Mini, Avata, and Inspire families flow through the same aerial showcase.'
              }
            />
            <StoryPanel
              className="feature-panel--tall"
              description={
                language === 'tr'
                  ? 'RS 5, Osmo Action 6, Osmo Mobile 8P ve Mic 2; creator tarafinda hareket, aksiyon ve ses ekipmanlarini tek blokta toplar.'
                  : 'RS 5, Osmo Action 6, Osmo Mobile 8P, and Mic 2 gather motion, action, and audio tools into one creator block.'
              }
              gallery={getGalleryImages(handheldProducts).length ? getGalleryImages(handheldProducts) : visualLibrary.handheld.map((src, index) => ({ src, alt: `Handheld catalog visual ${index + 1}` }))}
              imageUrl={getPrimaryImage(handheldProducts[0])?.url ?? visualLibrary.handheld[0]}
              kicker={translateCategoryName(language, 'handheld', 'Handheld')}
              stat={language === 'tr' ? `${handheldProducts.length} Urun` : `${handheldProducts.length} Products`}
              title={language === 'tr' ? 'RS, Osmo ve Mic serileri creator cekim zincirini tamamlar.' : 'RS, Osmo, and Mic series complete the creator capture chain.'}
            />
            <StoryPanel
              className="feature-panel--tall"
              description={
                language === 'tr'
                  ? 'Matrice ailesi ve saha sistemleri katalogtan kaybolmaz; satin alma yerine teklif ve kesif odakli bir karar akisi ile anlatilir.'
                  : 'Matrice family and field systems do not disappear from the catalog; they are presented with a quote- and discovery-led decision flow.'
              }
              gallery={getGalleryImages(enterpriseProducts).length ? getGalleryImages(enterpriseProducts) : visualLibrary.enterprise.map((src, index) => ({ src, alt: `Enterprise catalog visual ${index + 1}` }))}
              imageUrl={getPrimaryImage(enterpriseProducts[0])?.url ?? visualLibrary.enterprise[0]}
              kicker={translateCategoryName(language, 'enterprise', 'Enterprise')}
              stat={language === 'tr' ? `${enterpriseProducts.length} Urun` : `${enterpriseProducts.length} Products`}
              title={language === 'tr' ? 'Matrice platformlari saha ve kurumsal operasyon vitrini olarak ayrisir.' : 'Matrice platforms separate into a field and enterprise operations showcase.'}
            />
            <StoryPanel
              className="feature-panel--wide"
              description={
                language === 'tr'
                  ? 'Sepete eklenebilen modeller fiyat ve stokla ilerler; premium ve operasyonel sistemler ise teklif veya inceleme odakli davranarak kullaniciyi yaniltmaz.'
                  : 'Purchasable models move with price and stock, while premium and operational systems stay in quote or review-driven flows without misleading the user.'
              }
              gallery={getGalleryImages(products.slice(0, 3)).length ? getGalleryImages(products.slice(0, 3)) : visualLibrary.camera.map((src, index) => ({ src, alt: `Navigation visual ${index + 1}` }))}
              imageUrl={getPrimaryImage(products[2])?.url ?? visualLibrary.camera[2]}
              kicker={language === 'tr' ? 'Satin Alma Mantigi' : 'Purchase Logic'}
              stat="Cart + Quote"
              title={
                language === 'tr'
                  ? 'Satin alinabilen modeller ile teklif odakli sistemler ayni katalogta dogru sekilde ayrilir.'
                  : 'Purchasable models and quote-driven systems are separated correctly inside the same catalog.'
              }
            />
          </div>
        </div>
      </section>
    </>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { language } = useI18n();
  const { token, isAuthenticated, syncCart, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getProduct(slug)
      .then(setProduct)
      .catch((nextError: Error) => setError(nextError.message));
  }, [slug]);

  async function handleAddToCart() {
    if (!token || !product) return;
    try {
      await api.addToCart(token, { productId: product.id, quantity: 1 });
      await syncCart();
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Urun sepete eklendi' : 'Product added to cart',
        description: language === 'tr' ? `${product.name} sepetinize eklendi.` : `${product.name} was added to your cart.`,
      });
    } catch (nextError) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Sepete eklenemedi' : 'Could not add to cart',
        description: (nextError as Error).message,
      });
    }
  }

  async function handleFavoriteToggle() {
    if (!product) return;

    if (!isAuthenticated) {
      showToast({
        tone: 'info',
        title: language === 'tr' ? 'Giris gerekli' : 'Login required',
        description: language === 'tr' ? 'Favorilere eklemek icin once giris yapmalisiniz.' : 'You need to log in before adding favorites.',
      });
      return;
    }

    try {
      const action = await toggleFavorite(product.id);
      showToast({
        tone: 'info',
        title:
          action === 'added'
            ? language === 'tr'
              ? 'Favorilere eklendi'
              : 'Added to favorites'
            : language === 'tr'
              ? 'Favorilerden kaldirildi'
              : 'Removed from favorites',
        description:
          action === 'added'
            ? language === 'tr'
              ? `${product.name} favorilerinize eklendi.`
              : `${product.name} was added to your favorites.`
            : language === 'tr'
              ? `${product.name} favorilerinizden cikarildi.`
              : `${product.name} was removed from your favorites.`,
      });
    } catch (nextError) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Favori islemi tamamlanamadi' : 'Favorite action failed',
        description: (nextError as Error).message,
      });
    }
  }

  if (error) {
    return (
      <section className="page-section">
        <div className="ui-shell">
          <EmptyState description={error} title={language === 'tr' ? 'Urun bulunamadi' : 'Product not found'} />
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="page-section">
        <div className="ui-shell">
          <p className="text-muted">{language === 'tr' ? 'Urun yukleniyor...' : 'Loading product...'}</p>
        </div>
      </section>
    );
  }

  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const favoriteActive = isFavorite(product.id);

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell product-detail">
        <div className="product-detail__visual">
          <img alt={primaryImage.alt} src={primaryImage.url} />
        </div>
        <div className="product-detail__copy">
          <div className="detail-chip-row">
            <Badge>{product.brand}</Badge>
            <Badge>{product.badge ?? translateCategoryName(language, product.category.slug, product.category.name)}</Badge>
          </div>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="detail-cta-row" style={{ margin: '1.5rem 0' }}>
            <div className="price-text">{product.isPurchasable ? formatCurrency(product.price, language) : language === 'tr' ? 'Satisa Kapali' : 'Not for Direct Sale'}</div>
            <div className="detail-chip">
              {product.isPurchasable
                ? language === 'tr'
                  ? `${product.stock} adet stokta`
                  : `${product.stock} units in stock`
                : language === 'tr'
                  ? 'Tanitim modunda yayinlaniyor'
                  : 'Published in promo mode'}
            </div>
          </div>
          <div className="detail-cta-row">
            {product.isPurchasable ? (
              <Button disabled={!isAuthenticated} onClick={() => void handleAddToCart()}>
                {isAuthenticated ? (language === 'tr' ? 'Sepete Ekle' : 'Add to Cart') : language === 'tr' ? 'Giris gerekli' : 'Login required'}
              </Button>
            ) : (
              <Button variant="secondary">{language === 'tr' ? 'Teklif Iste' : 'Request Quote'}</Button>
            )}
            <Button onClick={() => void handleFavoriteToggle()} variant="secondary">
              {favoriteActive ? (language === 'tr' ? 'Favorilerden Kaldir' : 'Remove from Favorites') : language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites'}
            </Button>
            <Link to="/katalog">
              <Button variant="ghost">{language === 'tr' ? 'Kataloga Don' : 'Back to Catalog'}</Button>
            </Link>
          </div>
          <div className="spec-grid">
            {product.specs.map((spec) => (
              <div key={spec.id}>
                <span>{spec.name}</span>
                <strong>{spec.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
