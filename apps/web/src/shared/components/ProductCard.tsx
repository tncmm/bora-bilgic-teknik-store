import type { Product } from '@bora/types';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Button, Card } from '@bora/ui';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../api/client';
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
  const { token, isAuthenticated, syncCart, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();
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
      await onAdded?.();
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
        description:
          action === 'added'
            ? language === 'tr'
              ? `${product.name} favorilerinize eklendi.`
              : `${product.name} was added to your favorites.`
            : language === 'tr'
              ? `${product.name} favorilerinizden cikarildi.`
              : `${product.name} was removed from your favorites.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Favori islemi tamamlanamadi' : 'Favorite action failed',
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
      aria-label={language === 'tr' ? `${product.name} detayina git` : `Open ${product.name} details`}
      className="product-card product-card--interactive"
      onClick={openDetails}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
    >
      <div className="product-card__media">
        <img alt={primaryImage?.alt ?? product.name} src={primaryImage?.url} />
      </div>
      <button
        aria-label={favoriteActive ? (language === 'tr' ? 'Favorilerden kaldir' : 'Remove from favorites') : language === 'tr' ? 'Favorilere ekle' : 'Add to favorites'}
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
            <strong>{product.isPurchasable ? formatCurrency(product.price, language) : language === 'tr' ? 'Teklif Uzerine' : 'Quote on Request'}</strong>
            <span>
              {product.isPurchasable
                ? language === 'tr'
                  ? `${product.stock} adet stokta`
                  : `${product.stock} units in stock`
                : language === 'tr'
                  ? 'Kurumsal teklif veya on siparis icin inceleyin'
                  : 'Review for quote-based or pre-order purchase'}
            </span>
          </div>
          {product.isPurchasable ? (
            <Button
              onClick={(event) => {
                stopCardNavigation(event);
                void handleAddToCart();
              }}
            >
              {language === 'tr' ? 'Sepete Ekle' : 'Add to Cart'}
            </Button>
          ) : (
            <Link
              className="section-link"
              onClick={stopCardNavigation}
              to={`/urun/${product.slug}`}
            >
              {language === 'tr' ? 'Incele' : 'View Details'}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
