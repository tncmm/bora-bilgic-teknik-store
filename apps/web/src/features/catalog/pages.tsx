import { Badge, Button, EmptyState } from '@bora/ui';
import type { CatalogListResponse, CatalogSectionSlug, Category, Product, ProductDetailSection, ProductPackageOption } from '@bora/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { CampaignSlider } from '../../shared/components/CampaignSlider';
import { PriceTag } from '../../shared/components/PriceTag';
import { RichTextContent } from '../../shared/components/RichTextContent';
import { formatCurrency } from '../../shared/lib/format';
import { findSectionBySlug, mapLegacyCategoryToSection, storefrontSections } from '../../shared/lib/storefront';
import { translateCategoryName } from '../../shared/lib/i18n';
import { HeroSlider } from './hero-slider';

const serviceHighlights = [
  { icon: 'verified_user', title: 'BORA BİLGİÇ', description: 'Yetkili satıcı ve resmi ürün akışı.' },
  { icon: 'inventory_2', title: '%100 ORİJİNAL', description: 'Tüm ürünler resmi dağıtım kapsamında.' },
  { icon: 'local_shipping', title: 'HIZLI KARGO', description: 'Aynı gün çıkış ve teknik hazırlık akışıyla.' },
  { icon: 'support_agent', title: 'UZMAN DESTEK', description: '7/24 profesyonel teknik yönlendirme.' },
];

const listingRangePresets = [
  { label: '0 - 10.000 TL', min: '', max: '10000' },
  { label: '10.000 - 20.000 TL', min: '10000', max: '20000' },
  { label: '20.000 - 30.000 TL', min: '20000', max: '30000' },
  { label: '30.000 TL ve üzeri', min: '30000', max: '' },
];

const storefrontCurationOrder: Record<string, string[]> = {
  drone: ['dji-mavic-3-pro', 'dji-air-3', 'dji-mini-4-pro', 'dji-avata-2', 'dji-inspire-3'],
  gimbal: ['dji-rs-3-pro', 'dji-rs-3-mini', 'dji-osmo-mobile-6', 'dji-ronin-4d'],
  'aksiyon-kamera': ['dji-osmo-pocket-3', 'dji-osmo-pocket-2', 'dji-osmo-action-4', 'dji-mic-2'],
  aksesuar: ['intelligent-flight-battery', 'battery-charging-hub', 'dji-shoulder-bag', 'nd-filter-set', '128gb-microsd-card'],
  kurumsal: ['dji-matrice-350-rtk'],
};

function getPrimaryImage(product?: Product) {
  if (!product) return undefined;
  return product.images.find((image) => image.isPrimary) ?? product.images[0];
}

function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void api.listCategories().then(setCategories).catch(() => undefined);
  }, []);

  return categories;
}

function useCatalogProducts(params: Record<string, string>) {
  const [data, setData] = useState<CatalogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) setLoading(true);
    });
    api
      .listProducts(params)
      .then((response) => {
        if (!mounted) return;
        setData(response);
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

  return { data, loading, error };
}

function StorefrontProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useI18n();
  const { isAuthenticated, addCartItem, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const primaryImage = getPrimaryImage(product);
  const favoriteActive = isFavorite(product.id);

  async function handleAddToCart() {
    try {
      await addCartItem(product, 1);
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Ürün sepete eklendi' : 'Product added to cart',
        description: language === 'tr' ? `${product.name} sepetinize eklendi.` : `${product.name} was added to your cart.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Sepete eklenemedi' : 'Could not add to cart',
        description: (error as Error).message,
      });
    }
  }

  async function handleFavoriteToggle() {
    if (!isAuthenticated) {
      navigate('/giris', { state: { from: `${location.pathname}${location.search}${location.hash}` } });
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
              ? 'Favorilerden kaldırıldı'
              : 'Removed from favorites',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Favori işlemi tamamlanamadı' : 'Favorite action failed',
        description: (error as Error).message,
      });
    }
  }

  return (
    <article className="dji-product-card">
      <Link className="dji-product-card__link" to={`/urun/${product.slug}`}>
        {product.badge ? <span className="dji-product-card__badge">{product.badge}</span> : null}
        <div className="dji-product-card__image">
          <img alt={primaryImage?.alt ?? product.name} src={primaryImage?.url} />
        </div>
        <div className="dji-product-card__content">
          <h3>{product.name}</h3>
          <p className="dji-product-card__description">{product.shortDescription}</p>
          <div className="dji-product-card__price">
            {product.isPurchasable ? (
              <PriceTag discountPercent={product.discountPercent} effectivePrice={product.effectivePrice} price={product.price} />
            ) : (
              'Teklif Üzerine'
            )}
          </div>
          <span className="dji-product-card__meta">
            {product.isPurchasable ? `${product.stock} adet stokta` : 'Teklif ile satış'}
          </span>
        </div>
      </Link>
      <div className="dji-product-card__actions">
        <button
          aria-label={favoriteActive ? 'Favorilerden kaldır' : 'Favorilere ekle'}
          className={`dji-icon-button ${favoriteActive ? 'is-active' : ''}`}
          onClick={() => void handleFavoriteToggle()}
          type="button"
        >
          <span className="material-symbols-outlined">{favoriteActive ? 'favorite' : 'favorite_border'}</span>
        </button>
        <button
          aria-label="Sepete ekle"
          className="dji-icon-button dji-icon-button--accent"
          disabled={!product.isPurchasable}
          onClick={() => void handleAddToCart()}
          type="button"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
        </button>
      </div>
    </article>
  );
}

export function ServiceBand({ overlay = false }: { overlay?: boolean }) {
  return (
    <section className={`dji-service-band ${overlay ? 'dji-service-band--overlay' : ''}`}>
      <div className="ui-shell dji-service-band__grid">
        {serviceHighlights.map((item) => (
          <div className="dji-service-band__item" key={item.title}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StoreFooter() {
  return (
    <footer className="dji-footer">
      <div className="ui-shell dji-footer__top">
        <div>
          <div className="dji-wordmark dji-wordmark--footer">Bora Bilgiç</div>
          <p>Bora Bilgiç, profesyonel görüntüleme teknolojileri ve creator ekipmanlarını tek vitrinde sunar.</p>
        </div>
        <div>
          <h4>KURUMSAL</h4>
          <nav>
            <Link to="/kurumsal">Hakkımızda</Link>
            <Link to="/kurumsal">Yetki Belgeleri</Link>
            <Link to="/gizlilik">KVKK / Gizlilik</Link>
            <Link to="/iletisim">İletişim</Link>
          </nav>
        </div>
        <div>
          <h4>MÜŞTERİ HİZMETLERİ</h4>
          <nav>
            <Link to="/teslimat">Kargo & Teslimat</Link>
            <Link to="/iade">İade & Değişim</Link>
            <Link to="/mesafeli-satis">Mesafeli Satış</Link>
            <Link to="/garanti">Garanti Şartları</Link>
            <Link to="/sss">Sıkça Sorulan Sorular</Link>
          </nav>
        </div>
        <div>
          <h4>GÜVENLİ ALIŞVERİŞ</h4>
          <p>256bit SSL ile bilgileriniz güvende.</p>
          <div className="dji-footer__payments">
            <span>VISA</span>
            <span>Mastercard</span>
            <span>Troy</span>
          </div>
        </div>
      </div>
      <div className="ui-shell dji-footer__bottom">
        <span>© 2024 Bora Bilgiç. Tüm hakları saklıdır.</span>
        <div>
          <Link to="/mesafeli-satis">Mesafeli Satış</Link>
          <Link to="/gizlilik">Gizlilik Politikası</Link>
          <Link to="/teslimat">Teslimat</Link>
          <Link to="/iade">İade</Link>
          <Link to="/iletisim">Site Haritası</Link>
        </div>
      </div>
    </footer>
  );
}

function BestsellersRail({ products }: { products: Product[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const items = useMemo(() => (products.length > 1 ? [...products, ...products, ...products] : products), [products]);

  useEffect(() => {
    if (paused || products.length < 2) return;

    const timer = setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;

      const copyWidth = rail.scrollWidth / 3;
      const cardWidth = (rail.firstElementChild as HTMLElement | null)?.offsetWidth ?? 280;

      if (rail.scrollLeft + cardWidth + 16 >= copyWidth * 2) {
        rail.scrollTo({ left: copyWidth });
      } else {
        rail.scrollBy({ behavior: 'smooth', left: cardWidth + 16 });
      }
    }, 3200);

    return () => clearInterval(timer);
  }, [paused, products.length]);

  return (
    <div className="bestsellers-rail" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} ref={railRef}>
      {items.map((product, index) => (
        <StorefrontProductCard key={`${product.id}-${index}`} product={product} />
      ))}
    </div>
  );
}

export function HomePage() {
  const { language } = useI18n();
  const categories = useCategories();
  const { data: bestsellerData, loading: bestsellerLoading } = useCatalogProducts({ bestseller: 'true', limit: '10' });
  const { data: fallbackData, loading: fallbackLoading } = useCatalogProducts({ saleMode: 'purchasable', sort: 'rating', limit: '5' });
  const bestsellerProducts = bestsellerData?.items ?? [];
  const railProducts = bestsellerProducts.length > 0 ? bestsellerProducts : (fallbackData?.items ?? []).filter((p) => p.isPurchasable).slice(0, 5);
  const loading = bestsellerLoading || (bestsellerProducts.length === 0 && fallbackLoading);

  return (
    <>
      <HeroSlider />

      <ServiceBand overlay />

      <CampaignSlider />

      <section className="dji-section">
        <div className="ui-shell">
          <div className="dji-section__heading">
            <h2>ÇOK SATANLAR</h2>
          </div>
          {loading ? <p className="dji-muted">Ürünler yükleniyor...</p> : null}
          <BestsellersRail products={railProducts} />
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell">
          <div className="dji-section__heading">
            <h2>KATEGORİLER</h2>
            <Link to="/katalog">TÜM KATEGORİLER</Link>
          </div>
          <div className="dji-category-grid">
            {(categories.length > 0
              ? categories.slice(0, 4).map((category) => ({
                  slug: category.slug,
                  label: category.name,
                  path: `/kategori/${category.slug}`,
                  category,
                }))
              : storefrontSections.slice(0, 4).map((section) => ({
                  ...section,
                  category: categories.find((item) => item.slug === section.slug),
                }))
            ).map((section) => {
              const categoryImageUrl = section.category?.heroImageUrl;
              return (
                <Link className="dji-category-card" key={section.slug} to={section.path}>
                  <div className="dji-category-card__media">
                    {categoryImageUrl ? <img alt={section.label} src={categoryImageUrl} /> : null}
                  </div>
                  <div className="dji-category-card__content">
                    <h3>{section.label}</h3>
                    <p>{section.category?.description ?? translateCategoryName(language, section.slug, section.label)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <StoreFooter />
    </>
  );
}

function ListingSidebar({
  activeSeries,
  availableFeatures,
  availableSeries,
  minPrice,
  maxPrice,
  onSetSeries,
  onToggleFeature,
  selectedFeatures,
  onSelectRange,
  onClear,
  open,
}: {
  activeSeries: string;
  availableFeatures: Array<{ value: string; count: number }>;
  availableSeries: Array<{ value: string; count: number }>;
  minPrice: string;
  maxPrice: string;
  onSetSeries: (value: string) => void;
  onToggleFeature: (value: string) => void;
  selectedFeatures: string[];
  onSelectRange: (min: string, max: string) => void;
  onClear: () => void;
  open: boolean;
}) {
  return (
    <aside className={`dji-sidebar${open ? ' is-open' : ''}`}>
      <div className="dji-sidebar__group">
        <h3>KATEGORİLER</h3>
        <button className={`dji-sidebar__link ${!activeSeries ? 'is-active' : ''}`} onClick={() => onSetSeries('')} type="button">
          Tüm Ürünler
        </button>
        {availableSeries.map((series) => (
          <button
            className={`dji-sidebar__link ${activeSeries === series.value ? 'is-active' : ''}`}
            key={series.value}
            onClick={() => onSetSeries(series.value)}
            type="button"
          >
            {series.value}
          </button>
        ))}
      </div>

      <div className="dji-sidebar__group">
        <h3>FİYAT ARALIĞI</h3>
        <div className="dji-sidebar__range-list">
          {listingRangePresets.map((range) => (
            <button
              className={`dji-range-chip ${minPrice === range.min && maxPrice === range.max ? 'is-active' : ''}`}
              key={range.label}
              onClick={() => onSelectRange(range.min, range.max)}
              type="button"
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="dji-price-fields">
          <input className="ui-input" placeholder="Min" value={minPrice} onChange={() => undefined} readOnly />
          <input className="ui-input" placeholder="Max" value={maxPrice} onChange={() => undefined} readOnly />
        </div>
      </div>

      <div className="dji-sidebar__group">
        <h3>ÖNE ÇIKAN ÖZELLİKLER</h3>
        <div className="dji-sidebar__checks">
          {availableFeatures.map((feature) => (
            <label className="dji-check-row" key={feature.value}>
              <input checked={selectedFeatures.includes(feature.value)} onChange={() => onToggleFeature(feature.value)} type="checkbox" />
              <span>{feature.value}</span>
            </label>
          ))}
        </div>
      </div>

      <button className="dji-clear-button" onClick={onClear} type="button">
        FİLTRELERİ TEMİZLE
      </button>
    </aside>
  );
}

function resolveListingSection(forcedSection?: CatalogSectionSlug, searchParams?: URLSearchParams) {
  if (forcedSection) return forcedSection;
  const section = searchParams?.get('section');
  const legacyCategory = searchParams?.get('category');
  return (section as CatalogSectionSlug | null) ?? mapLegacyCategoryToSection(legacyCategory) ?? undefined;
}

export function CatalogPage({ forcedSection }: { forcedSection?: CatalogSectionSlug } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug: routeCategorySlug } = useParams();
  const categories = useCategories();
  const sectionSlug = forcedSection ?? routeCategorySlug ?? resolveListingSection(undefined, searchParams);
  const section = findSectionBySlug(sectionSlug);
  const params = Object.fromEntries(
    Object.entries({
      section: sectionSlug ?? '',
      saleMode: searchParams.get('saleMode') ?? '',
      series: searchParams.get('series') ?? '',
      features: searchParams.get('features') ?? '',
      minPrice: searchParams.get('minPrice') ?? '',
      maxPrice: searchParams.get('maxPrice') ?? '',
      sort: searchParams.get('sort') ?? 'newest',
      page: searchParams.get('page') ?? '1',
      limit: '6',
    }).filter(([, value]) => value),
  );
  const { data, error, loading } = useCatalogProducts(params);
  const activeCategory = categories.find((item) => item.slug === sectionSlug);
  const selectedFeatures = searchParams.get('features')?.split(',').filter(Boolean) ?? [];
  const [filtersOpen, setFiltersOpen] = useState(false);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  }

  function toggleFeature(feature: string) {
    const nextValues = selectedFeatures.includes(feature)
      ? selectedFeatures.filter((item) => item !== feature)
      : [...selectedFeatures, feature];
    updateParam('features', nextValues.join(','));
  }

  function selectRange(min: string, max: string) {
    const next = new URLSearchParams(searchParams);
    if (min) next.set('minPrice', min);
    else next.delete('minPrice');
    if (max) next.set('maxPrice', max);
    else next.delete('maxPrice');
    next.set('page', '1');
    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (sectionSlug) next.set('section', sectionSlug);
    setSearchParams(next);
  }

  const items = data?.items ?? [];
  const renderedItems =
    (searchParams.get('sort') ?? 'newest') === 'newest' && sectionSlug
      ? [...items].sort((left, right) => {
          const order = storefrontCurationOrder[sectionSlug] ?? [];
          const leftIndex = order.indexOf(left.slug);
          const rightIndex = order.indexOf(right.slug);
          return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
        })
      : items;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <section className="dji-listing-hero">
        <div className="dji-listing-hero__background">
          <img alt={section?.label ?? 'Bora Bilgiç kataloğu'} src={activeCategory?.heroImageUrl ?? items[0]?.heroImageUrl ?? getPrimaryImage(items[0])?.url} />
        </div>
        <div className="ui-shell dji-listing-hero__content">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <span>{activeCategory?.name ?? section?.label ?? 'Katalog'}</span>
          </div>
          <h1>{activeCategory?.heroTitle ?? activeCategory?.name ?? section?.label?.toUpperCase() ?? 'KATALOG'}</h1>
          <p>{activeCategory?.heroDescription ?? activeCategory?.description ?? 'Bora Bilgiç kataloğunu teknik ve görsel olarak tek akışta keşfedin.'}</p>
        </div>
      </section>

      <section className="dji-section dji-section--listing">
        <div className="ui-shell">
          <div className="dji-toolbar">
            <div className="dji-toolbar__left">
              <span>Filtrele:</span>
              <select className="ui-select" onChange={(event) => updateParam('series', event.target.value)} value={searchParams.get('series') ?? ''}>
                <option value="">Kategoriler</option>
                {(data?.availableFilters.series ?? []).map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.value}
                  </option>
                ))}
              </select>
              <select className="ui-select" onChange={(event) => updateParam('minPrice', event.target.value)} value={searchParams.get('minPrice') ?? ''}>
                <option value="">Fiyat Aralığı</option>
                {listingRangePresets.map((range) => (
                  <option key={range.label} value={range.min}>
                    {range.label}
                  </option>
                ))}
              </select>
              <select className="ui-select" onChange={(event) => updateParam('saleMode', event.target.value)} value={searchParams.get('saleMode') ?? ''}>
                <option value="">Tüm ürünler</option>
                <option value="purchasable">Sepete eklenebilir</option>
              </select>
            </div>
            <div className="dji-toolbar__right">
              <span>Sıralama:</span>
              <select className="ui-select" onChange={(event) => updateParam('sort', event.target.value)} value={searchParams.get('sort') ?? 'newest'}>
                <option value="newest">En Yeniler</option>
                <option value="price-asc">Fiyat Artan</option>
                <option value="price-desc">Fiyat Azalan</option>
                <option value="rating">En Yüksek Puan</option>
              </select>
            </div>
          </div>

          <button
            aria-expanded={filtersOpen}
            className="dji-filter-toggle"
            onClick={() => setFiltersOpen((value) => !value)}
            type="button"
          >
            <span className="dji-filter-toggle__label">
              <span aria-hidden="true" className="material-symbols-outlined">tune</span>
              Filtreler
            </span>
            <span aria-hidden="true" className={`material-symbols-outlined dji-filter-toggle__chevron${filtersOpen ? ' is-open' : ''}`}>
              expand_more
            </span>
          </button>

          <div className="dji-listing-layout">
            <ListingSidebar
              activeSeries={searchParams.get('series') ?? ''}
              availableFeatures={data?.availableFilters.features ?? []}
              availableSeries={data?.availableFilters.series ?? []}
              maxPrice={searchParams.get('maxPrice') ?? ''}
              minPrice={searchParams.get('minPrice') ?? ''}
              onClear={clearFilters}
              onSelectRange={selectRange}
              onSetSeries={(value) => updateParam('series', value)}
              onToggleFeature={toggleFeature}
              open={filtersOpen}
              selectedFeatures={selectedFeatures}
            />

            <div className="dji-listing-grid-shell">
              {loading ? <p className="dji-muted">Ürünler yükleniyor...</p> : null}
              {error ? <p className="dji-muted">{error}</p> : null}
              {!loading && renderedItems.length === 0 ? (
                <EmptyState
                  description="Filtreleri değiştirerek tekrar deneyin."
                  title="Ürün bulunamadı"
                />
              ) : (
                <>
                  <div className="dji-product-grid">
                    {renderedItems.map((product) => (
                      <StorefrontProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <div className="dji-pagination">
                    <span>
                      {Math.min((Number(params.page ?? '1') - 1) * Number(params.limit ?? '6') + 1, data?.total ?? 0)} -{' '}
                      {Math.min(Number(params.page ?? '1') * Number(params.limit ?? '6'), data?.total ?? 0)} / {data?.total ?? 0} ürün gösteriliyor
                    </span>
                    <div className="dji-pagination__buttons">
                      <button
                        disabled={Number(params.page ?? '1') <= 1}
                        onClick={() => updateParam('page', String(Math.max(1, Number(params.page ?? '1') - 1)))}
                        type="button"
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <strong>{params.page ?? '1'}</strong>
                      <button
                        disabled={Number(params.page ?? '1') >= totalPages}
                        onClick={() => updateParam('page', String(Math.min(totalPages, Number(params.page ?? '1') + 1)))}
                        type="button"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <ServiceBand />
      <StoreFooter />
    </>
  );
}

function ProductTabContent({ section }: { section?: ProductDetailSection }) {
  if (!section) return null;

  return (
    <div className={['dji-detail-tabpanel', !section.imageUrl ? 'dji-detail-tabpanel--copy-only' : ''].filter(Boolean).join(' ')}>
      <div>
        {section.heading ? <h2>{section.heading}</h2> : null}
        {section.body ? <RichTextContent className="dji-detail-description" html={section.body} /> : null}
        {section.bullets?.length ? (
          <ul>
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {section.imageUrl ? (
        <div className="dji-detail-tabpanel__media">
          <img alt={section.heading ?? 'Bora Bilgiç görseli'} src={section.imageUrl} />
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { language } = useI18n();
  const { isAuthenticated, addCartItem, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTabId, setActiveTabId] = useState('aciklama');

  useEffect(() => {
    void api
      .getProduct(slug)
      .then((nextProduct) => {
        setProduct(nextProduct);
        setSelectedImageIndex(0);
        setSelectedPackageId(nextProduct.packageOptions?.find((option) => option.isDefault)?.id ?? nextProduct.packageOptions?.[0]?.id ?? '');
        setActiveTabId(nextProduct.detailSections?.[0]?.id ?? 'aciklama');
      })
      .catch((nextError: Error) => setError(nextError.message));
  }, [slug]);

  async function handleAddToCart() {
    if (!product) return;

    try {
      await addCartItem(product, quantity);
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Ürün sepete eklendi' : 'Product added to cart',
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
      navigate('/giris', { state: { from: `${location.pathname}${location.search}${location.hash}` } });
      return;
    }

    try {
      await toggleFavorite(product.id);
    } catch (nextError) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Favori işlemi tamamlanamadı' : 'Favorite action failed',
        description: (nextError as Error).message,
      });
    }
  }

  if (error) {
    return (
      <section className="page-section">
        <div className="ui-shell">
          <EmptyState description={error} title="Ürün bulunamadı" />
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="page-section">
        <div className="ui-shell">
          <p className="dji-muted">Ürün yükleniyor...</p>
        </div>
      </section>
    );
  }

  const gallery: Array<{
    id: string;
    url: string;
    alt: string;
    isPrimary: boolean;
    thumbnailUrl?: string | null;
    kind: 'image' | 'video';
    mimeType?: string | null;
  }> =
    product.images.length > 0
      ? product.images
      : product.packageOptions?.map((option) => ({
          id: option.id,
          url: product.heroImageUrl ?? '',
          alt: option.name,
          isPrimary: option.isDefault ?? false,
          kind: 'image',
          thumbnailUrl: product.heroImageUrl ?? null,
        })) ?? [];
  const selectedImage = gallery[selectedImageIndex] ?? gallery[0];
  const packageOptions = product.packageOptions ?? [];
  const activePackage =
    packageOptions.find((option) => option.id === selectedPackageId) ??
    packageOptions.find((option) => option.isDefault) ??
    packageOptions[0];
  const tabs = product.detailSections ?? [];
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const favoriteActive = isFavorite(product.id);
  const stars = Math.round(product.ratingAverage ?? 0);

  return (
    <>
      <section className="dji-detail">
        <div className="ui-shell">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <Link to={findSectionBySlug(product.section)?.path ?? '/katalog'}>{product.category.name}</Link>
            {product.series ? (
              <>
                <span>›</span>
                <span>{product.series}</span>
              </>
            ) : null}
            <span>›</span>
            <span>{product.name}</span>
          </div>

          <div className="dji-detail__grid">
            <div className="dji-detail__gallery">
              <div className="dji-detail__thumbs">
                {gallery.map((image, index) => (
                  <button
                    className={index === selectedImageIndex ? 'is-active' : ''}
                    key={image.id}
                    onClick={() => setSelectedImageIndex(index)}
                    type="button"
                  >
                    <img alt={image.alt} src={image.thumbnailUrl ?? image.url} loading="lazy" decoding="async" />
                    {image.kind === 'video' ? (
                      <span className="dji-detail__thumb-badge material-symbols-outlined">play_circle</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="dji-detail__stage">
                {/* The stage image is eager on purpose: it is the page's largest contentful paint. */}
                {selectedImage?.kind === 'video' ? (
                  <video controls playsInline poster={selectedImage.thumbnailUrl ?? undefined} preload="metadata">
                    <source src={selectedImage.url} type={selectedImage.mimeType ?? undefined} />
                  </video>
                ) : (
                  <img
                    alt={selectedImage?.alt ?? product.name}
                    src={selectedImage?.url}
                    decoding="async"
                    width={1200}
                    height={1200}
                  />
                )}
              </div>
            </div>

            <div className="dji-detail__copy">
              <h1>{product.name}</h1>
              <p className="dji-detail__subtitle">{product.heroTag ?? product.shortDescription}</p>
              <div className="dji-detail__rating">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span className={`material-symbols-outlined ${index < stars ? 'is-filled' : ''}`} key={index}>
                    star
                  </span>
                ))}
                <span>
                  {(product.ratingAverage ?? 0).toFixed(1)} ({product.reviewCount ?? 0})
                </span>
              </div>
              <div className="dji-detail__price-row">
                {activePackage && activePackage.price !== product.price ? (
                  <strong>{formatCurrency(activePackage.price, language)}</strong>
                ) : (
                  <PriceTag discountPercent={product.discountPercent} effectivePrice={product.effectivePrice} price={product.price} />
                )}
                <span>{product.isPurchasable ? 'KDV dahil' : 'Teklif akışı'}</span>
                <em>{product.stock > 0 ? 'Stokta var' : 'Stok bekleniyor'}</em>
              </div>
              <p className="dji-detail__purchase-note">
                {product.isPurchasable
                  ? 'Sepet, teslimat formu ve ödeme öncesi sipariş özeti adımları ile satın alma süreci net olarak ilerler.'
                  : 'Bu ürün kurumsal teklif akışı ile satılır; termin ve fiyat bilgisi talep sonrası netleştirilir.'}
              </p>
              <ul className="dji-detail__features">
                {product.specs.map((spec) => (
                  <li key={spec.id}>
                    <span className="material-symbols-outlined">arrow_right_alt</span>
                    {spec.value}
                  </li>
                ))}
              </ul>

              {packageOptions.length > 0 ? (
                <div className="dji-detail__packages">
                  <h3>Paket Seçimi</h3>
                  <div className="dji-detail__package-grid">
                    {packageOptions.map((option: ProductPackageOption) => (
                      <button
                        className={option.id === activePackage?.id ? 'is-active' : ''}
                        key={option.id}
                        onClick={() => setSelectedPackageId(option.id)}
                        type="button"
                      >
                        <strong>{option.name}</strong>
                        <span>{formatCurrency(option.price, language)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="dji-detail__cta-row">
                <div className="dji-stepper">
                  <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">
                    -
                  </button>
                  <span>{quantity}</span>
                  <button onClick={() => setQuantity((value) => Math.min(10, value + 1))} type="button">
                    +
                  </button>
                </div>
                <Button disabled={!product.isPurchasable} onClick={() => void handleAddToCart()}>
                  SEPETE EKLE
                </Button>
                <button className={`dji-icon-button ${favoriteActive ? 'is-active' : ''}`} onClick={() => void handleFavoriteToggle()} type="button">
                  <span className="material-symbols-outlined">{favoriteActive ? 'favorite' : 'favorite_border'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServiceBand />

      <section className="dji-section dji-section--detail">
        <div className="ui-shell">
          <div className="dji-tabs">
            {tabs.map((tab) => (
              <button className={tab.id === activeTab?.id ? 'is-active' : ''} key={tab.id} onClick={() => setActiveTabId(tab.id)} type="button">
                {tab.label}
              </button>
            ))}
          </div>
          <ProductTabContent section={activeTab} />
        </div>
      </section>

      <StoreFooter />
    </>
  );
}

export function ContactPage() {
  return (
    <>
      <section className="dji-contact-hero">
        <div className="ui-shell">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <span>İletişim</span>
          </div>
          <h1>İLETİŞİM</h1>
          <p>Kurumsal projeler, teknik keşif, stok teyidi ve satış sonrası destek için bizimle hızla iletişime geçin.</p>
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell dji-contact-grid">
          <div className="dji-contact-card">
            <h2>Merkez Ofis</h2>
            <p>Maslak Mah. Teknik Plaza No: 18 / İstanbul</p>
            <p>+90 212 555 00 00</p>
            <p>info@borabilgicteknik.com</p>
          </div>
          <div className="dji-contact-card">
            <h2>Kurumsal Satış</h2>
            <p>Drone filoları, inspection ihtiyaçları ve kurumsal demo akışları için uzman ekip.</p>
            <Badge>Enterprise Discovery</Badge>
          </div>
          <div className="dji-contact-card">
            <h2>Destek Saatleri</h2>
            <p>Pazartesi - Cumartesi</p>
            <p>09:00 - 19:00</p>
            <p>Uzaktan teknik destek: 7/24 kayıt oluşturma</p>
          </div>
        </div>
      </section>

      <ServiceBand />
      <StoreFooter />
    </>
  );
}
