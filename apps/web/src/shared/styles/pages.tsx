import { Badge, Button, EmptyState } from '@bora/ui';
import type { Category, Product } from '@bora/types';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { ProductCard } from '../../shared/components/ProductCard';
import { formatCurrency } from '../../shared/lib/format';

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

function BentoCard({ product, featured = false }: { product: Product; featured?: boolean }) {
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
          {product.isPurchasable ? formatCurrency(product.price) : 'Tanitim Urunu'}
        </p>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { products, loading } = useCatalogData();
  const heroProduct = products[0];
  const cameraDrones = useMemo(() => products.filter((product) => product.category.slug === 'camera-drones'), [products]);
  const handheld = useMemo(() => products.filter((product) => product.category.slug === 'handheld'), [products]);
  const enterprise = useMemo(() => products.filter((product) => product.category.slug === 'enterprise'), [products]);

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
            <Badge>DJI Official Focus</Badge>
          </div>
          <h1>
            DJI Ekosistemi.
            <br />
            <span>Tek Bir Katalogda.</span>
          </h1>
          <p>
            Bora Bilgic Teknik artik yalnizca DJI urun ailelerine odaklanir. Kamera dronlari, handheld creator
            sistemleri ve enterprise platformlar tek akista listelenir.
          </p>
          <div className="hero-actions">
            <Link to="/katalog">
              <Button>Tum DJI Koleksiyonu</Button>
            </Link>
            <Link to={heroProduct ? `/urun/${heroProduct.slug}` : '/katalog'}>
              <Button variant="secondary">One Cikan Model</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell">
          <div className="section-header">
            <div>
              <h2>New Arrivals</h2>
              <p>DJI katalogunun one cikan guncel urunleri.</p>
            </div>
            <Link className="section-link" to="/katalog">
              Tumunu Gor
            </Link>
          </div>

          {loading ? (
            <p className="text-muted">Urunler yukleniyor...</p>
          ) : products.length === 0 ? (
            <EmptyState description="Henuz yayinlanan urun bulunmuyor." title="Katalog bos" />
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
              <h2>DJI Koleksiyonlari</h2>
              <p>Resmi DJI urun ailelerine gore sadeleştirilmis vitrin akisi.</p>
            </div>
          </div>
          <div className="standard-grid">
            <Link className="feature-panel feature-panel--wide" to="/katalog?category=camera-drones">
              <div className="detail-chip">Camera Drones</div>
              <h3>Mavic, Air, Mini, Avata ve Inspire ailesi.</h3>
              <p>{cameraDrones.length} urun ile hava goruntuleme odakli ana katalog.</p>
            </Link>
            <Link className="feature-panel feature-panel--tall" to="/katalog?category=handheld">
              <div className="detail-chip">Handheld</div>
              <h3>RS, Osmo ve Mic serileri.</h3>
              <p>{handheld.length} urun ile creator ve prodüksiyon ekipmanlari.</p>
            </Link>
            <Link className="feature-panel feature-panel--tall" to="/katalog?category=enterprise">
              <div className="detail-chip">Enterprise</div>
              <h3>Matrice ve agir saha platformlari.</h3>
              <p>{enterprise.length} urun ile endustriyel ve kurumsal gorevler.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="ui-shell">
          <h2 style={{ fontSize: 'clamp(2.6rem, 5vw, 4.6rem)' }}>The Standard of Excellence</h2>
          <div className="standard-grid">
            <div className="feature-panel feature-panel--wide">
              <div className="detail-chip">Official DJI Families</div>
              <h3>Kategori yapisi resmi DJI urun ailelerine gore yeniden kuruldu.</h3>
              <p>
                Storefront tarafinda yalnizca DJI urunleri gorunur. Kategori, kart ve detay dili de bu kapsamla
                sadeleştirildi.
              </p>
            </div>
            <div className="feature-panel feature-panel--tall">
              <div className="detail-chip">Current Product Mix</div>
              <h3>Amiral gemisi, creator ve enterprise senaryolari tek vitrinde.</h3>
              <p>Mavic 4 Pro, Air 3S, Mini 5 Pro, RS 5 ve Matrice serileri ayni katalogta hizalanir.</p>
            </div>
            <div className="feature-panel feature-panel--tall">
              <div className="detail-chip">Quote + Cart Split</div>
              <h3>Satisa acik ve teklif odakli DJI urunleri ayri davranir.</h3>
              <p>Enterprise veya premium urunler inceleme/teklif akisi ile, digerleri sepete ekleme ile ilerler.</p>
            </div>
            <div className="feature-panel feature-panel--wide">
              <div className="detail-chip">Responsive Storefront</div>
              <h3>Mobil ve masaustu akista ayni DJI hiyerarsisi korunur.</h3>
              <p>
                Filtre sidebar, urun grid, sepet ve admin ekranlari yalnizca DJI portfoyunu yansitacak sekilde
                temizlendi.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function CatalogPage() {
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
  const activeCollection =
    (activeCategorySlug && activeCategorySlug in collectionContent
      ? collectionContent[activeCategorySlug as keyof typeof collectionContent]
      : undefined) ?? null;
  const heroTitle = activeCollection?.name ?? 'DJI Catalog';
  const heroDescription =
    activeCollection?.description ?? 'Tum DJI urun ailelerini tek katalog akisi icinde kesfedin.';

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
              <h3>DJI Koleksiyonu</h3>
              <div className="filter-sidebar__checks">
                <label className="filter-checkbox">
                  <input checked={!activeCategorySlug} onChange={() => setSearchParams(new URLSearchParams())} type="radio" />
                  <span>Tum DJI Urunleri</span>
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
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-sidebar__group">
              <h3>Satis Durumu</h3>
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
                <option value="">Tum yayinlanan DJI urunleri</option>
                <option value="purchasable">Sepete eklenebilenler</option>
              </select>
            </div>
          </aside>

          <div>
            <div className="catalog-body__header">
              <div>
                <h2>{products.length} DJI urunu listeleniyor</h2>
                <p>
                  {activeCategory
                    ? `${activeCategory.name} koleksiyonundaki yayindaki DJI urunleri gosteriliyor.`
                    : 'Storefront yalnizca DJI urunlerini listeler.'}
                </p>
              </div>
              <div className="catalog-sort">
                <span>Odak:</span>
                <strong>{activeCategory?.name ?? 'Tum Koleksiyonlar'}</strong>
              </div>
            </div>

            {loading ? <p className="text-muted">Urunler yukleniyor...</p> : null}
            {error ? <p className="text-muted">{error}</p> : null}
            {!loading && products.length === 0 ? (
              <EmptyState description="Filtreleri degistirerek tekrar deneyin." title="Urun bulunamadi" />
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
          <h2 style={{ fontSize: 'clamp(2.6rem, 5vw, 4.4rem)' }}>The Standard of Excellence</h2>
          <div className="standard-grid">
            <div className="feature-panel feature-panel--wide">
              <div className="detail-chip">Camera Drones</div>
              <h3>Mavic, Air, Mini ve Inspire ekseninde hava portfoyu.</h3>
              <p>Resmi DJI products sayfasindaki Camera Drones ailesi katalogun ana eksenlerinden biri olarak işlendi.</p>
            </div>
            <div className="feature-panel feature-panel--tall">
              <div className="detail-chip">Handheld</div>
              <h3>RS, Osmo ve Mic ekosistemi tek ailede.</h3>
              <p>Handheld koleksiyonu creator ve production ekipmanlarini ayri bir filtre eksenine tasir.</p>
            </div>
            <div className="feature-panel feature-panel--tall">
              <div className="detail-chip">Enterprise</div>
              <h3>Matrice ve lojistik platformlari teklif odakli akista kalir.</h3>
              <p>Satisa acik olmayan DJI sistemleri detay sayfasinda teklif/inceleme diliyle gosterilir.</p>
            </div>
            <div className="feature-panel feature-panel--wide">
              <div className="detail-chip">Clean Navigation</div>
              <h3>Gereksiz sayfalar ve DJI disi katmanlar katalog dilinden cikarildi.</h3>
              <p>Navigation, footer ve ana landing bloklari artik dogrudan DJI urun ailelerine baglaniyor.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
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
        title: 'Urun sepete eklendi',
        description: `${product.name} sepetinize eklendi.`,
      });
    } catch (nextError) {
      showToast({
        tone: 'error',
        title: 'Sepete eklenemedi',
        description: (nextError as Error).message,
      });
    }
  }

  async function handleFavoriteToggle() {
    if (!product) return;

    if (!isAuthenticated) {
      showToast({
        tone: 'info',
        title: 'Giris gerekli',
        description: 'Favorilere eklemek icin once giris yapmalisiniz.',
      });
      return;
    }

    try {
      const action = await toggleFavorite(product.id);
      showToast({
        tone: 'info',
        title: action === 'added' ? 'Favorilere eklendi' : 'Favorilerden kaldirildi',
        description: `${product.name} ${action === 'added' ? 'favorilerinize eklendi.' : 'favorilerinizden cikarildi.'}`,
      });
    } catch (nextError) {
      showToast({
        tone: 'error',
        title: 'Favori islemi tamamlanamadi',
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
          <p className="text-muted">Urun yukleniyor...</p>
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
            <Badge>{product.badge ?? product.category.name}</Badge>
          </div>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="detail-cta-row" style={{ margin: '1.5rem 0' }}>
            <div className="price-text">{product.isPurchasable ? formatCurrency(product.price) : 'Satisa Kapali'}</div>
            <div className="detail-chip">{product.isPurchasable ? `${product.stock} adet stokta` : 'Tanitim modunda yayinlaniyor'}</div>
          </div>
          <div className="detail-cta-row">
            {product.isPurchasable ? (
              <Button disabled={!isAuthenticated} onClick={() => void handleAddToCart()}>
                {isAuthenticated ? 'Sepete Ekle' : 'Giris gerekli'}
              </Button>
            ) : (
              <Button variant="secondary">Teklif Iste</Button>
            )}
            <Button onClick={() => void handleFavoriteToggle()} variant="secondary">
              {favoriteActive ? 'Favorilerden Kaldir' : 'Favorilere Ekle'}
            </Button>
            <Link to="/katalog">
              <Button variant="ghost">Kataloga Don</Button>
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
