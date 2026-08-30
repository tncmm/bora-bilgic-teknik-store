import { Button, EmptyState } from '@bora/ui';
import { Link, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { PriceTag } from '../../shared/components/PriceTag';
import { translateCategoryName } from '../../shared/lib/i18n';

export function FavoritesPage() {
  const navigate = useNavigate();
  const { token, user, wishlist, toggleFavorite, syncCart } = useSession();
  const { showToast } = useToast();

  if (!user || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState description="Favorileri gormek icin giris yapmalisin." title="Favoriler kullanilamiyor" />
        </div>
      </section>
    );
  }

  const authToken = token;

  async function handleAddToCart(productId: string, productName: string) {
    try {
      await api.addToCart(authToken, { productId, quantity: 1 });
      await syncCart();
      showToast({ tone: 'success', title: 'Urun sepete eklendi', description: `${productName} sepetine eklendi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Sepete eklenemedi', description: (error as Error).message });
    }
  }

  async function handleRemoveFavorite(productId: string, productName: string) {
    try {
      await toggleFavorite(productId);
      showToast({ tone: 'info', title: 'Favorilerden kaldirildi', description: `${productName} favorilerinden cikarildi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Favori kaldirilamadi', description: (error as Error).message });
    }
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="favorites-header">
          <div>
            <div className="detail-chip">Favoriler</div>
            <h1>Kaydettigin Secimler</h1>
            <p>Favori listen hesabina baglidir; her cihazda ayni hesaptan geri gelir.</p>
          </div>
          <div className="auth-actions">
            <Link to="/katalog">
              <Button variant="secondary">Kataloga Don</Button>
            </Link>
            <Link to="/sepet">
              <Button>Sepete Git</Button>
            </Link>
          </div>
        </div>

        {!wishlist || wishlist.items.length === 0 ? (
          <EmptyState description="Bir urunu favorilere ekleyerek kisa listeni olustur." title="Favori listen bos" />
        ) : (
          <div className="favorites-grid">
            {wishlist.items.map((item) => {
              const image = item.product.images.find((entry) => entry.isPrimary) ?? item.product.images[0];

              return (
                <article className="favorite-card" key={item.id}>
                  <div className="favorite-card__media">
                    <img alt={image?.alt ?? item.product.name} src={image?.url} />
                  </div>
                  <div className="favorite-card__body">
                    <div className="detail-chip-row">
                      <div className="detail-chip">{translateCategoryName('tr', item.product.category.slug, item.product.category.name)}</div>
                      <div className="detail-chip">{item.product.badge ?? item.product.brand}</div>
                    </div>
                    <h2>{item.product.name}</h2>
                    <p>{item.product.shortDescription}</p>
                    <div className="favorite-card__meta">
                      {item.product.isPurchasable ? (
                        <PriceTag discountPercent={item.product.discountPercent} effectivePrice={item.product.effectivePrice} price={item.product.price} />
                      ) : (
                        <strong>Teklif Uzerine</strong>
                      )}
                      <span>{item.product.isPurchasable ? `${item.product.stock} adet stokta` : 'Kurumsal teklif ile ilerler'}</span>
                    </div>
                    <div className="favorite-card__actions">
                      {item.product.isPurchasable ? (
                        <Button onClick={() => void handleAddToCart(item.product.id, item.product.name)}>Sepete Ekle</Button>
                      ) : (
                        <Button onClick={() => navigate(`/urun/${item.product.slug}`)} variant="secondary">
                          Incele
                        </Button>
                      )}
                      <Button onClick={() => void handleRemoveFavorite(item.product.id, item.product.name)} variant="ghost">
                        Kaldir
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
