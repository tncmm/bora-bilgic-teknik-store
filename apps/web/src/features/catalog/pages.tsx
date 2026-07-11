import { Badge, Button, EmptyState } from '@bora/ui';
import type { CatalogListResponse, CatalogSectionSlug, Category, Product, ProductDetailSection, ProductPackageOption } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency } from '../../shared/lib/format';
import { findSectionBySlug, mapLegacyCategoryToSection, storefrontSections } from '../../shared/lib/storefront';
import { translateCategoryName } from '../../shared/lib/i18n';

const serviceHighlights = [
  { icon: 'verified_user', title: 'BORA BILGIÇ TEKNIK', description: 'Yetkili satici ve resmi urun akisi.' },
  { icon: 'inventory_2', title: '%100 ORIJINAL', description: 'Tum urunler resmi dagitim kapsaminda.' },
  { icon: 'local_shipping', title: 'HIZLI KARGO', description: 'Ayni gun cikis ve teknik hazirlik akisiyla.' },
  { icon: 'support_agent', title: 'UZMAN DESTEK', description: '7/24 profesyonel teknik yonlendirme.' },
];

const listingRangePresets = [
  { label: '0 - 10.000 TL', min: '', max: '10000' },
  { label: '10.000 - 20.000 TL', min: '10000', max: '20000' },
  { label: '20.000 - 30.000 TL', min: '20000', max: '30000' },
  { label: '30.000 TL ve uzeri', min: '30000', max: '' },
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
    setLoading(true);
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
  const { token, isAuthenticated, syncCart, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const primaryImage = getPrimaryImage(product);
  const favoriteActive = isFavorite(product.id);

  async function handleAddToCart() {
    if (!isAuthenticated || !token) {
      navigate('/giris', { state: { from: `${location.pathname}${location.search}${location.hash}` } });
      return;
    }

    try {
      await api.addToCart(token, {
        productId: product.id,
        quantity: 1,
      });
      await syncCart();
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Urun sepete eklendi' : 'Product added to cart',
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
              ? 'Favorilerden kaldirildi'
              : 'Removed from favorites',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Favori islemi tamamlanamadi' : 'Favorite action failed',
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
            {product.isPurchasable ? formatCurrency(product.price, language) : language === 'tr' ? 'Teklif Uzerine' : 'Quote on Request'}
          </div>
          <span className="dji-product-card__meta">
            {product.isPurchasable ? `${product.stock} adet stokta` : 'Teklif ile satis'}
          </span>
        </div>
      </Link>
      <div className="dji-product-card__actions">
        <button
          aria-label={favoriteActive ? 'Favorilerden kaldir' : 'Favorilere ekle'}
          className={`dji-icon-button ${favoriteActive ? 'is-active' : ''}`}
          onClick={() => void handleFavoriteToggle()}
          type="button"
        >
          <span className="material-symbols-outlined">{favoriteActive ? 'favorite' : 'favorite_border'}</span>
        </button>
        <button aria-label="Karsilastir" className="dji-icon-button" type="button">
          <span className="material-symbols-outlined">compare_arrows</span>
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

function ServiceBand({ overlay = false }: { overlay?: boolean }) {
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

function StoreFooter() {
  return (
    <footer className="dji-footer">
      <div className="ui-shell dji-footer__top">
        <div>
          <div className="dji-wordmark dji-wordmark--footer">Bora Bilgiç Teknik</div>
          <p>Bora Bilgiç Teknik, profesyonel goruntuleme teknolojileri ve creator ekipmanlarini tek vitrinde sunar.</p>
          <div className="dji-footer__socials">
            {['instagram', 'facebook', 'smart_display', 'slideshow'].map((icon) => (
              <a href="/" key={icon}>
                <span className="material-symbols-outlined">{icon}</span>
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4>KURUMSAL</h4>
          <nav>
            <Link to="/kurumsal">Hakkimizda</Link>
            <Link to="/kurumsal">Yetki Belgeleri</Link>
            <Link to="/gizlilik">KVKK / Gizlilik</Link>
            <Link to="/iletisim">Iletisim</Link>
          </nav>
        </div>
        <div>
          <h4>MUSTERI HIZMETLERI</h4>
          <nav>
            <Link to="/teslimat">Kargo & Teslimat</Link>
            <Link to="/iade">Iade & Degisim</Link>
            <Link to="/mesafeli-satis">Mesafeli Satis</Link>
            <Link to="/iletisim">Garanti Sartlari</Link>
            <Link to="/iletisim">Sikca Sorulan Sorular</Link>
          </nav>
        </div>
        <div>
          <h4>GUVENLI ALISVERIS</h4>
          <p>256bit SSL ile bilgileriniz guvende.</p>
          <div className="dji-footer__payments">
            <span>VISA</span>
            <span>Mastercard</span>
            <span>Troy</span>
          </div>
        </div>
      </div>
      <div className="ui-shell dji-footer__bottom">
        <span>© 2024 Bora Bilgiç Teknik. Tum haklari saklidir.</span>
        <div>
          <Link to="/mesafeli-satis">Mesafeli Satis</Link>
          <Link to="/gizlilik">Gizlilik Politikasi</Link>
          <Link to="/teslimat">Teslimat</Link>
          <Link to="/iade">Iade</Link>
          <Link to="/iletisim">Site Haritasi</Link>
        </div>
      </div>
    </footer>
  );
}

function NewsletterBanner() {
  return (
    <section className="dji-newsletter">
      <div className="ui-shell dji-newsletter__card">
        <div>
          <h2>BORA BILGIÇ TEKNIK BULTENI</h2>
          <p>En yeni urunler, kampanyalar ve ilham verici icerik mailinize gelsin.</p>
        </div>
        <form className="dji-newsletter__form">
          <input className="ui-input" placeholder="E-posta adresiniz" type="email" />
          <Button type="submit">ABONE OL</Button>
        </form>
      </div>
    </section>
  );
}

function PurchaseJourneySection() {
  const steps = [
    {
      title: '1. Urunu Secin',
      description: 'Kategori veya urun detay sayfasindan teknik ozellikleri, fiyatlari ve stok bilgisini inceleyin.',
    },
    {
      title: '2. Sepete Ekleyin',
      description: 'Sepette urun adedi, ara toplam ve kargo bilgisi acikca gorunur.',
    },
    {
      title: '3. Teslimat Bilgisi',
      description: 'Checkout ekraninda ad, telefon, il, ilce ve acik adres bilgilerinizi doldurun.',
    },
    {
      title: '4. Odeme Onayi',
      description: 'Odeme oncesi toplam tutar, siparis ozeti ve teslimat bilgileri son kez kontrol edilir.',
    },
  ];

  return (
    <section className="dji-section">
      <div className="ui-shell">
        <div className="dji-section__heading">
          <h2>SATIN ALMA SURECI</h2>
          <Link to="/checkout">ODEME AKISINI GOR</Link>
        </div>
        <div className="dji-purchase-grid">
          {steps.map((step) => (
            <article className="dji-purchase-card" key={step.title}>
              <div className="dji-kicker">{step.title}</div>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
        <div className="dji-compliance-banner">
          <strong>Odeme, teslimat ve iade bilgilendirmesi siparis oncesinde acikca gosterilir.</strong>
          <p>Stoktaki urunler icin fiyat ve teslim sureci, kurumsal urunlerde ise teklif ve termin akisi net sekilde belirtilir.</p>
          <div className="dji-inline-links">
            <Link to="/teslimat">Teslimat</Link>
            <Link to="/iade">Iade</Link>
            <Link to="/mesafeli-satis">Mesafeli Satis</Link>
            <Link to="/gizlilik">Gizlilik</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

interface InfoSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

interface InfoPageProps {
  title: string;
  summary: string;
  pathLabel: string;
  highlights: Array<{ title: string; description: string }>;
  sections: InfoSection[];
}

function InfoPage({ title, summary, pathLabel, highlights, sections }: InfoPageProps) {
  return (
    <>
      <section className="dji-contact-hero">
        <div className="ui-shell">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <span>{pathLabel}</span>
          </div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell">
          <div className="dji-info-grid">
            {highlights.map((item) => (
              <article className="dji-info-card" key={item.title}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className="dji-info-stack">
            {sections.map((section) => (
              <article className="dji-info-section" key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body ? <p>{section.body}</p> : null}
                {section.bullets?.length ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <ServiceBand />
      <StoreFooter />
    </>
  );
}

function EditorialPanels() {
  return (
    <section className="dji-section">
      <div className="ui-shell dji-editorial-grid">
        <article className="dji-editorial-card dji-editorial-card--wide">
          <div>
            <div className="dji-kicker">AERIAL PRODUCTION</div>
            <h3>Mavic, Air ve Mini ailesi ile cekim brief'lerinizi tek vitrinde netlestirin.</h3>
            <p>Seyahat icerigi, reklam prodüksiyonu ve hizli creator deployment senaryolari icin tek akista karar verin.</p>
          </div>
          <img alt="Aerial production" src="/storefront/hero-drone.png" />
        </article>
        <article className="dji-editorial-card">
          <div className="dji-kicker">CREATOR FLOW</div>
          <h3>Gimbal, action ve pocket sistemleri ayni kurgu icinde ilerler.</h3>
          <p>Run-and-gun ekipler, mobil prodüksiyonlar ve social-first icerikler icin hizli setup kombinasyonlari.</p>
        </article>
        <article className="dji-editorial-card">
          <div className="dji-kicker">ENTERPRISE FIELD</div>
          <h3>Kurumsal kesif, denetim ve kamu guvenligi akislarini ayrica ele alin.</h3>
          <p>Quote odakli sistemleri e-ticaret urunlerinden ayrıştıran, karar destekli bir vitrin yapisi.</p>
        </article>
      </div>
    </section>
  );
}

export function HomePage() {
  const { language } = useI18n();
  const categories = useCategories();
  const { data: heroData, loading: heroLoading } = useCatalogProducts({ section: 'drone', limit: '6' });
  const { data: featuredData, loading: featuredLoading } = useCatalogProducts({ saleMode: 'purchasable', sort: 'rating', limit: '5' });
  const heroProducts = heroData?.items ?? [];
  const featuredProducts = featuredData?.items ?? [];
  const heroProduct = heroProducts.find((product) => product.slug === 'dji-mavic-3-pro') ?? heroProducts[0];
  const purchasable = featuredProducts.filter((product) => product.isPurchasable).slice(0, 5);

  return (
    <>
      <section className="dji-hero">
        <div className="dji-hero__background">
          <img alt={heroProduct?.name ?? 'Bora Bilgiç Teknik vitrini'} src={heroProduct?.heroImageUrl ?? getPrimaryImage(heroProduct)?.url} />
        </div>
        <div className="ui-shell dji-hero__content">
          <div className="dji-hero__copy">
            <div className="dji-kicker">{heroProduct?.badge ?? 'YENI'}</div>
            <h1>{heroProduct?.heroTitle ?? 'BORA BILGIÇ TEKNIK'}</h1>
            <h2>{heroProduct?.heroTag ?? 'Ilham Veren Goruntuler'}</h2>
            <p>{heroProduct?.heroDescription ?? heroProduct?.description}</p>
            <div className="dji-hero__actions">
              <Link to="/drone">
                <Button>HEMEN KESFET</Button>
              </Link>
              {heroProduct ? (
                <Link to={`/urun/${heroProduct.slug}`}>
                  <Button variant="secondary">URUNU INCELE</Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <ServiceBand overlay />

      <section className="dji-section">
        <div className="ui-shell">
          <div className="dji-section__heading">
            <h2>KATEGORILER</h2>
            <Link to="/katalog">TUM KATEGORILER</Link>
          </div>
          <div className="dji-category-grid">
            {storefrontSections.slice(0, 4).map((section) => {
              const category = categories.find((item) => item.slug === section.slug);
              return (
                <Link className="dji-category-card" key={section.slug} to={section.path}>
                  <div className="dji-category-card__media">
                    <img alt={section.label} src={category?.heroImageUrl ?? heroProduct?.heroImageUrl ?? getPrimaryImage(heroProduct)?.url} />
                  </div>
                  <div className="dji-category-card__content">
                    <h3>{section.label}</h3>
                    <p>{category?.description ?? translateCategoryName(language, section.slug, section.label)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell">
          <div className="dji-section__heading">
            <h2>COK SATANLAR</h2>
          </div>
          {heroLoading || featuredLoading ? <p className="dji-muted">Urunler yukleniyor...</p> : null}
          <div className="dji-product-grid">
            {purchasable.map((product) => (
              <StorefrontProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <PurchaseJourneySection />
      <EditorialPanels />
      <NewsletterBanner />
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
}) {
  return (
    <aside className="dji-sidebar">
      <div className="dji-sidebar__group">
        <h3>KATEGORILER</h3>
        <button className={`dji-sidebar__link ${!activeSeries ? 'is-active' : ''}`} onClick={() => onSetSeries('')} type="button">
          Tum Urunler
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
        <h3>FIYAT ARALIGI</h3>
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
        <h3>ONE CIKAN OZELLIKLER</h3>
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
        FILTRELERI TEMIZLE
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
  const categories = useCategories();
  const sectionSlug = resolveListingSection(forcedSection, searchParams);
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
          <img alt={section?.label ?? 'Bora Bilgiç Teknik katalog'} src={activeCategory?.heroImageUrl ?? items[0]?.heroImageUrl ?? getPrimaryImage(items[0])?.url} />
        </div>
        <div className="ui-shell dji-listing-hero__content">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <span>{activeCategory?.name ?? section?.label ?? 'Katalog'}</span>
          </div>
          <h1>{activeCategory?.heroTitle ?? section?.label?.toUpperCase() ?? 'KATALOG'}</h1>
          <p>{activeCategory?.heroDescription ?? activeCategory?.description ?? 'Bora Bilgiç Teknik katalogunu teknik ve gorsel olarak tek akista kesfedin.'}</p>
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
                <option value="">Fiyat Araligi</option>
                {listingRangePresets.map((range) => (
                  <option key={range.label} value={range.min}>
                    {range.label}
                  </option>
                ))}
              </select>
              <select className="ui-select" onChange={(event) => updateParam('saleMode', event.target.value)} value={searchParams.get('saleMode') ?? ''}>
                <option value="">Tum urunler</option>
                <option value="purchasable">Sepete eklenebilir</option>
              </select>
            </div>
            <div className="dji-toolbar__right">
              <span>Siralama:</span>
              <select className="ui-select" onChange={(event) => updateParam('sort', event.target.value)} value={searchParams.get('sort') ?? 'newest'}>
                <option value="newest">En Yeniler</option>
                <option value="price-asc">Fiyat Artan</option>
                <option value="price-desc">Fiyat Azalan</option>
                <option value="rating">En Yuksek Puan</option>
              </select>
            </div>
          </div>

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
              selectedFeatures={selectedFeatures}
            />

            <div className="dji-listing-grid-shell">
              {loading ? <p className="dji-muted">Urunler yukleniyor...</p> : null}
              {error ? <p className="dji-muted">{error}</p> : null}
              {!loading && renderedItems.length === 0 ? (
                <EmptyState
                  description="Filtreleri degistirerek tekrar deneyin."
                  title="Urun bulunamadi"
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
                      {Math.min(Number(params.page ?? '1') * Number(params.limit ?? '6'), data?.total ?? 0)} / {data?.total ?? 0} urun gosteriliyor
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
    <div className="dji-detail-tabpanel">
      <div>
        {section.heading ? <h2>{section.heading}</h2> : null}
        {section.body ? <p>{section.body}</p> : null}
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
          <img alt={section.heading ?? 'Bora Bilgiç Teknik visual'} src={section.imageUrl} />
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { language } = useI18n();
  const { token, isAuthenticated, syncCart, toggleFavorite, isFavorite } = useSession();
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
    if (!isAuthenticated || !token) {
      navigate('/giris', { state: { from: `${location.pathname}${location.search}${location.hash}` } });
      return;
    }

    try {
      await api.addToCart(token, { productId: product.id, quantity });
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
      navigate('/giris', { state: { from: `${location.pathname}${location.search}${location.hash}` } });
      return;
    }

    try {
      await toggleFavorite(product.id);
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
          <EmptyState description={error} title="Urun bulunamadi" />
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="page-section">
        <div className="ui-shell">
          <p className="dji-muted">Urun yukleniyor...</p>
        </div>
      </section>
    );
  }

  const gallery: Array<{ id: string; url: string; alt: string; isPrimary: boolean; thumbnailUrl?: string | null }> =
    product.images.length > 0
      ? product.images
      : product.packageOptions?.map((option) => ({
          id: option.id,
          url: product.heroImageUrl ?? '',
          alt: option.name,
          isPrimary: option.isDefault ?? false,
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
                    <img alt={image.alt} src={image.thumbnailUrl ?? image.url} />
                  </button>
                ))}
              </div>
              <div className="dji-detail__stage">
                <img alt={selectedImage?.alt ?? product.name} src={selectedImage?.url} />
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
                <strong>{formatCurrency(activePackage?.price ?? product.price, language)}</strong>
                <span>{product.isPurchasable ? 'KDV dahil' : 'Teklif akisi'}</span>
                <em>{product.stock > 0 ? 'Stokta var' : 'Stok bekleniyor'}</em>
              </div>
              <p className="dji-detail__purchase-note">
                {product.isPurchasable
                  ? 'Sepet, teslimat formu ve odeme oncesi siparis ozeti adimlari ile satin alma sureci net olarak ilerler.'
                  : 'Bu urun kurumsal teklif akisi ile satilir; termin ve fiyat bilgisi talep sonrasi netlestirilir.'}
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
                  <h3>Paket Secimi</h3>
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
            <span>Iletisim</span>
          </div>
          <h1>ILETISIM</h1>
          <p>Kurumsal projeler, teknik kesif, stok teyidi ve satis sonrasi destek icin bizimle hizla iletisime gecin.</p>
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell dji-contact-grid">
          <div className="dji-contact-card">
            <h2>Merkez Ofis</h2>
            <p>Maslak Mah. Teknik Plaza No: 18 / Istanbul</p>
            <p>+90 212 555 00 00</p>
            <p>info@borabilgicteknik.com</p>
          </div>
          <div className="dji-contact-card">
            <h2>Kurumsal Satis</h2>
            <p>Drone filolari, inspection ihtiyaclari ve kurumsal demo akislari icin uzman ekip.</p>
            <Badge>Enterprise Discovery</Badge>
          </div>
          <div className="dji-contact-card">
            <h2>Destek Saatleri</h2>
            <p>Pazartesi - Cumartesi</p>
            <p>09:00 - 19:00</p>
            <p>Uzaktan teknik destek: 7/24 kayit olusturma</p>
          </div>
        </div>
      </section>

      <ServiceBand />
      <StoreFooter />
    </>
  );
}

export function DeliveryPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Ayni Gun Isleme', description: 'Hafta ici mesai saatlerinde onaylanan stoklu siparisler ayni gun operasyon sirasina alinabilir.' },
        { title: 'Turkiye Geneli Gonderim', description: 'Anlasmali kargo firmalari ile Turkiye geneline teslimat yapilir; kurumsal sevklerde ozel planlama sunulur.' },
        { title: 'Takip Bilgisi', description: 'Kargo cikisi sonrasi takip numarasi musteriye iletilir ve teslimat sureci bilgi mesajlari ile desteklenir.' },
      ]}
      pathLabel="Teslimat"
      sections={[
        {
          heading: 'Siparis Hazirlama',
          body: 'Stokta bulunan urunler, odeme ve siparis onayi sonrasinda operasyon ekibi tarafindan paketlenir ve sevke hazir hale getirilir.',
          bullets: [
            'Hafta ici mesai saatlerinde onaylanan siparisler operasyon yogunluguna gore ayni gun veya ertesi is gunu kargoya verilir.',
            'Kurumsal veya teklif ile satilan urunlerde sevk tarihi teklif ve termin bilgisi ile ayrica netlestirilir.',
            'Kutu icerigi, aksesuar ve garanti durumu paketleme oncesi kontrol edilir.',
          ],
        },
        {
          heading: 'Teslimat Sureleri',
          bullets: [
            'Istanbul ici standart sevkiyatlar genellikle 1 is gunu icinde teslim edilir.',
            'Sehir disi teslimatlar, kargo firmasinin operasyonuna bagli olarak 1-3 is gunu arasinda tamamlanir.',
            'Resmi tatil, kampanya donemi veya olumsuz hava kosullarinda sureler uzayabilir.',
          ],
        },
        {
          heading: 'Teslimatta Kontrol',
          bullets: [
            'Kargo paketi teslim alinirken fiziksel hasar kontrol edilmelidir.',
            'Hasarli paketlerde kargo gorevlisi ile tutanak tutulmasi ve urunun teslim alinmamasi onerilir.',
            'Teslimat sonrasi fark edilen eksik veya hasarli durumlarda destek ekibi ile ayni gun icinde iletisime gecilmelidir.',
          ],
        },
      ]}
      summary="Siparis hazirlama, kargo cikisi ve teslimat adimlari burada acikca belirtilir. Stoklu urunlerde kisa termin, kurumsal urunlerde ise teklif bazli sevk planlamasi uygulanir."
      title="TESLIMAT BILGILERI"
    />
  );
}

export function ReturnPage() {
  return (
    <InfoPage
      highlights={[
        { title: '14 Gun Cayma Hakki', description: 'Mesafeli satis kapsaminda, mevzuata uygun urunlerde teslimattan itibaren 14 gun icinde cayma hakki uygulanir.' },
        { title: 'Hizli Inceleme', description: 'Iade talebi olusturulan urunler operasyon ve teknik ekip tarafindan en kisa surede incelenir.' },
        { title: 'Destek Kaydi', description: 'Iade, degisim ve servis sureci icin info@borabilgicteknik.com veya telefon hatti uzerinden kayit acilabilir.' },
      ]}
      pathLabel="Iade"
      sections={[
        {
          heading: 'Iade Kosullari',
          bullets: [
            'Urunun orijinal kutusu, aksesuar ve faturasi ile birlikte eksiksiz olarak gonderilmesi gerekir.',
            'Kullanim izi, fiziksel zarar veya eksik aksesuar bulunan iadeler yeniden degerlendirmeye alinabilir.',
            'Hijyen, lisans veya tekil aktivasyon gerektiren urunlerde ilgili mevzuat kapsamindaki istisnalar uygulanir.',
          ],
        },
        {
          heading: 'Iade Sureci',
          bullets: [
            'Musteri hizmetlerine siparis numarasi ile basvuru yapilir.',
            'Onay sonrasinda urun anlasmali kargo ile geri gonderilir.',
            'Kontrol tamamlandiginda uygun iadeler icin geri odeme sureci baslatilir.',
          ],
        },
        {
          heading: 'Degisim ve Teknik Durumlar',
          body: 'Hasarli, yanlis gonderilen veya ilk kullanimda sorun olusturan urunler icin degisim ya da teknik inceleme sureci ayrica ele alinir.',
          bullets: [
            'Ilk 24 saat icinde bildirilen sevkiyat hatalari oncelikli olarak degerlendirilir.',
            'Garanti kapsamindaki teknik sorunlarda yetkili servis sureci devreye alinabilir.',
            'Kurumsal teklif urunlerinde degisim ve iade kosullari teklif dokumaniyla birlikte degerlendirilir.',
          ],
        },
      ]}
      summary="Iade, degisim ve cayma hakki surecinde hangi adimlarin izlenecegi, urunlerin hangi kosullarda kabul edilecegi ve destek kaydinin nasil acilacagi burada yer alir."
      title="IADE VE DEGİSIM"
    />
  );
}

export function DistanceSalesPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Siparis Ozeti', description: 'Urun adi, fiyat, kargo ve toplam tutar siparis oncesi net bicimde gosterilir.' },
        { title: 'Cayma Hakki', description: 'Mevzuat kapsamindaki urunlerde 14 gunluk cayma hakki ve iade sureci uygulanir.' },
        { title: 'Satici Bilgileri', description: 'Bora Bilgiç Teknik iletisimi, teslimat ve destek bilgileri kamuya acik sekilde sunulur.' },
      ]}
      pathLabel="Mesafeli Satis"
      sections={[
        {
          heading: 'Sozlesme Konusu',
          body: 'Bu sayfa, elektronik ortamda verilen siparislerde satici ile alici arasindaki mesafeli satis iliskisine dair genel bilgilendirme metnidir.',
          bullets: [
            'Urunun temel nitelikleri, fiyati ve varsa teklif akisi satin alma oncesi gorunur.',
            'Alici, siparisi onaylamadan once toplami, teslimat bilgisini ve siparis ozeti ekranini gorur.',
            'Satici, siparisi stok ve operasyon kosullarina gore hazirlayarak sevk eder.',
          ],
        },
        {
          heading: 'Odeme ve Teslim',
          bullets: [
            'Odeme adiminda kart bilgileri guvenli odeme altyapisi uzerinden islenir.',
            'Stoklu urunlerde teslimat bilgisi kargo sureci ile birlikte musterinin erisimine sunulur.',
            'Teklif ile satilan urunlerde siparisin ticari kosullari ayrica teyit edilir.',
          ],
        },
        {
          heading: 'Iptal ve Cayma Hakki',
          bullets: [
            'Alici, kanunen istisna sayilmayan urunlerde teslimattan itibaren 14 gun icinde cayma hakkini kullanabilir.',
            'Iade sureci, urunun eksiksiz ve yeniden satilabilir durumda olmasi sartiyla isletilir.',
            'Ozel siparis, kurumsal proje veya lisans bazli urunlerde farkli ticari kosullar uygulanabilir.',
          ],
        },
      ]}
      summary="Mesafeli satis, siparis onayi, odeme, teslimat ve cayma hakki ile ilgili temel ticari kosullar bu sayfada kamuya acik sekilde ozetlenir."
      title="MESAFELI SATIS"
    />
  );
}

export function PrivacyPage() {
  return (
    <InfoPage
      highlights={[
        { title: 'Veri Toplama', description: 'Siparis, iletisim ve destek sureclerinde gerekli olan temel kimlik ve iletisim bilgileri islenir.' },
        { title: 'Kullanim Amaci', description: 'Toplanan veriler siparis yonetimi, teslimat, destek ve yasal yukumluluklerin yerine getirilmesi icin kullanilir.' },
        { title: 'Koruma', description: 'Veri guvenligi icin teknik ve idari tedbirler uygulanir; odeme verileri guvenli odeme saglayicilari uzerinden islenir.' },
      ]}
      pathLabel="Gizlilik"
      sections={[
        {
          heading: 'Islenen Veriler',
          bullets: [
            'Ad, soyad, e-posta, telefon, teslimat ve fatura adresi',
            'Siparis icerigi, urun tercihleri ve destek kayitlari',
            'Yasal zorunluluk halinde islem kayitlari ve finansal hareket ozetleri',
          ],
        },
        {
          heading: 'Kullanim Amaclari',
          bullets: [
            'Siparis alma, kargo planlama ve musteri hizmetleri sunma',
            'Iade, degisim ve teknik destek surecini yurutme',
            'Yasal, ticari ve mali yukumlulukleri yerine getirme',
          ],
        },
        {
          heading: 'Saklama ve Haklar',
          body: 'Kisisel veriler, ilgili mevzuat ve ticari zorunluluklar cercevesinde gerekli oldugu sure kadar saklanir.',
          bullets: [
            'Kullanici, verilerine iliskin bilgi talep edebilir ve gerekli durumlarda guncelleme isteyebilir.',
            'Mevzuata uygun hallerde silme, duzeltme veya itiraz basvurulari yapilabilir.',
            'Basvurular info@borabilgicteknik.com uzerinden yazili olarak iletilebilir.',
          ],
        },
      ]}
      summary="Kisisel verilerin hangi kapsamda toplandigi, ne amacla kullanildigi ve hangi guvenlik tedbirleriyle korundugu bu sayfada acikca belirtilir."
      title="GIZLILIK POLITIKASI"
    />
  );
}
