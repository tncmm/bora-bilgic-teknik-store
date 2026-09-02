import type { Product } from '@bora/types';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Button, Card } from '@bora/ui';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { formatCurrency } from '../lib/format';
import { translateCategoryName } from '../lib/i18n';
import { useI18n } from '../../app/providers/I18nProvider';

interface ProductCardProps {
  product: Product;
  onAdded?: () => Promise<void> | void;
}

export function ProductCard({ product, onAdded }: ProductCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, addCartItem, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();
  const favoriteActive = isFavorite(product.id);

  async function handleAddToCart() {
    try {
      await addCartItem(product, 1);
      await onAdded?.();
      showToast({
        tone: 'success',
        title: 'Ürün sepete eklendi',
        description: `${product.name} sepetinize eklendi.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Sepete eklenemedi',
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
        title: action === 'added' ? 'Favorilere eklendi' : 'Favorilerden kaldırıldı',
        description:
          action === 'added'
            ? `${product.name} favorilerinize eklendi.`
            : `${product.name} favorilerinizden çıkarıldı.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Favori işlemi tamamlanamadı',
        description: (error as Error).message,
      });
    }
  }

  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const specsLabel = product.specs.slice(0, 2).map((spec) => spec.value).join(' / ');

  function openDetails() {
    navigate(`/urun/${product.slug}`);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDetails();
  }

  function stopCardNavigation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <Card
      aria-label={`${product.name} detayına git`}
      className="product-card product-card--interactive"
      onClick={openDetails}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
    >
      <div className="product-card__media">
        <img alt={primaryImage?.alt ?? product.name} src={primaryImage?.url} loading="lazy" decoding="async" />
      </div>
      <button
        aria-label={favoriteActive ? 'Favorilerden kaldır' : 'Favorilere ekle'}
        className={`product-card__wish ${favoriteActive ? 'product-card__wish--active' : ''}`}
        onClick={(event) => {
          stopCardNavigation(event);
          void handleFavoriteToggle();
        }}
        type="button"
      >
        <span className="material-symbols-outlined">{favoriteActive ? 'favorite' : 'favorite_border'}</span>
      </button>
      <div className="product-card__body">
        <div className="product-card__kicker">
          {product.badge ?? product.brand} / {specsLabel || translateCategoryName(language, product.category.slug, product.category.name)}
        </div>
        <h3>{product.name}</h3>
        <p>{product.shortDescription}</p>
        <div className="product-card__footer">
          <div>
            <strong>{product.isPurchasable ? formatCurrency(product.price, language) : 'Teklif Üzerine'}</strong>
            <span>
              {product.isPurchasable
                ? `${product.stock} adet stokta`
                : 'Kurumsal teklif veya ön sipariş için inceleyin'}
            </span>
          </div>
          {product.isPurchasable ? (
            <Button
              onClick={(event) => {
                stopCardNavigation(event);
                void handleAddToCart();
              }}
            >
              Sepete Ekle
            </Button>
          ) : (
            <Link
              className="section-link"
              onClick={stopCardNavigation}
              to={`/urun/${product.slug}`}
            >
              İncele
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
