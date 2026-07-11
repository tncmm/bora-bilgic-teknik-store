import { Button, EmptyState } from '@bora/ui';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useI18n } from '../../app/providers/I18nProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateCategoryName, translateOrderStatus, translateRole } from '../../shared/lib/i18n';

export function ProfilePage() {
  const { isAdmin, token, user, wishlist, favoritesCount } = useSession();
  const { language } = useI18n();
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string; createdAt: string; total: number; status: string }>>([]);

  useEffect(() => {
    if (!token) return;
    void api.getMyOrders(token).then(setOrders).catch(() => undefined);
  }, [token]);

  if (!user) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState
            description={language === 'tr' ? 'Profil goruntulemek icin giris yapin.' : 'Log in to view your profile.'}
            title={language === 'tr' ? 'Profil yok' : 'Profile unavailable'}
          />
        </div>
      </section>
    );
  }

  const favoritePreview = wishlist?.items.slice(0, 2) ?? [];

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell profile-layout profile-layout--wide">
        <div className="profile-card">
          <div className="detail-chip">{language === 'tr' ? 'Profilim' : 'My Profile'}</div>
          <h2 style={{ fontSize: '2.5rem' }}>
            {user.firstName} {user.lastName}
          </h2>
          <div className="profile-card__meta">
            <span>{user.email}</span>
            <span>{language === 'tr' ? 'Rol' : 'Role'}: {translateRole(language, user.role)}</span>
          </div>
          <div className="profile-facts">
            <div>
              <span>{language === 'tr' ? 'Tema' : 'Theme'}</span>
              <strong>{language === 'tr' ? 'Hesap tercihine bagli' : 'Account-backed preference'}</strong>
            </div>
            <div>
              <span>{language === 'tr' ? 'Siparisler' : 'Orders'}</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>{language === 'tr' ? 'Favoriler' : 'Favorites'}</span>
              <strong>{favoritesCount}</strong>
            </div>
            <div>
              <span>{language === 'tr' ? 'Hesap Durumu' : 'Account State'}</span>
              <strong>{language === 'tr' ? 'Aktif' : 'Active'}</strong>
            </div>
          </div>
          <div className="auth-actions" style={{ marginTop: '1.5rem' }}>
            <Link to="/favoriler">
              <Button>{language === 'tr' ? 'Favorilerim' : 'My Favorites'}</Button>
            </Link>
            <Link to="/sepet">
              <Button variant="secondary">{language === 'tr' ? 'Sepete Git' : 'Go to Cart'}</Button>
            </Link>
            {isAdmin ? (
              <Link to="/admin">
                <Button variant="ghost">{language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}</Button>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="profile-card">
          <div className="section-header">
            <div>
              <h2>{language === 'tr' ? 'Favorilerim' : 'My Favorites'}</h2>
              <p>{language === 'tr' ? 'Kaydedilen urunleri daha sonra hizla geri cagirabilirsiniz.' : 'Saved products can be recalled quickly later.'}</p>
            </div>
            <Link className="section-link" to="/favoriler">
              {language === 'tr' ? 'Tumunu gor' : 'View all'}
            </Link>
          </div>
          {favoritePreview.length === 0 ? (
            <EmptyState
              description={language === 'tr' ? 'Kalp ikonunu kullanarak urunleri favorilerinize ekleyin.' : 'Use the heart icon to add products to your favorites.'}
              title={language === 'tr' ? 'Favori urun yok' : 'No favorite products yet'}
            />
          ) : (
            <div className="favorites-preview-list">
              {favoritePreview.map((item) => {
                const image = item.product.images.find((entry) => entry.isPrimary) ?? item.product.images[0];

                return (
                  <div className="favorite-preview-card" key={item.id}>
                    <img alt={image?.alt ?? item.product.name} src={image?.url} />
                    <div>
                      <strong>{item.product.name}</strong>
                      <p>{item.product.shortDescription}</p>
                      <span>{item.product.isPurchasable ? formatCurrency(item.product.price, language) : language === 'tr' ? 'Teklif Uzerine' : 'Quote on Request'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="profile-card profile-card--full">
          <div className="section-header">
            <div>
              <h2>{language === 'tr' ? 'Siparis Gecmisi' : 'Order History'}</h2>
              <p>{language === 'tr' ? 'Seed edilmis siparisler burada gorunur.' : 'Seeded orders appear here.'}</p>
            </div>
          </div>
          {orders.length === 0 ? (
            <EmptyState
              description={language === 'tr' ? 'Bu hesap icin henuz siparis yok.' : 'There are no orders for this account yet.'}
              title={language === 'tr' ? 'Siparis bulunamadi' : 'No orders found'}
            />
          ) : (
            orders.map((order) => (
              <div className="order-history-row" key={order.id}>
                <div>
                  <strong>{order.orderNumber}</strong>
                </div>
                <span>{formatDate(order.createdAt, language)}</span>
                <span className="order-badge">{translateOrderStatus(language, order.status)}</span>
                <strong>{formatCurrency(order.total, language)}</strong>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export function FavoritesPage() {
  const navigate = useNavigate();
  const { token, user, wishlist, toggleFavorite, syncCart } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();

  if (!user || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState
            description={language === 'tr' ? 'Favorileri gormek icin giris yapin.' : 'Log in to view favorites.'}
            title={language === 'tr' ? 'Favoriler kullanilamiyor' : 'Favorites unavailable'}
          />
        </div>
      </section>
    );
  }

  const authToken = token;

  async function handleAddToCart(productId: string, productName: string) {
    try {
      await api.addToCart(authToken, { productId, quantity: 1 });
      await syncCart();
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Urun sepete eklendi' : 'Product added to cart',
        description: language === 'tr' ? `${productName} sepetinize eklendi.` : `${productName} was added to your cart.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Sepete eklenemedi' : 'Could not add to cart',
        description: (error as Error).message,
      });
    }
  }

  async function handleRemoveFavorite(productId: string, productName: string) {
    try {
      await toggleFavorite(productId);
      showToast({
        tone: 'info',
        title: language === 'tr' ? 'Favorilerden kaldirildi' : 'Removed from favorites',
        description: language === 'tr' ? `${productName} favorilerinizden cikarildi.` : `${productName} was removed from your favorites.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Favori kaldirilamadi' : 'Favorite could not be removed',
        description: (error as Error).message,
      });
    }
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="favorites-header">
          <div>
            <div className="detail-chip">{language === 'tr' ? 'Favoriler' : 'Favorites'}</div>
            <h1>{language === 'tr' ? 'Kaydettiginiz Secimler' : 'Your Saved Picks'}</h1>
            <p>
              {language === 'tr'
                ? 'Favori listeniz hesabiniza baglidir. Local storage kullanilmaz; her cihazda ayni hesaptan geri gelir.'
                : 'Your favorites list is tied to your account. It does not use local storage, so it returns on every device.'}
            </p>
          </div>
          <div className="auth-actions">
            <Link to="/katalog">
              <Button variant="secondary">{language === 'tr' ? 'Kataloga Don' : 'Back to Catalog'}</Button>
            </Link>
            <Link to="/sepet">
              <Button>{language === 'tr' ? 'Sepete Git' : 'Go to Cart'}</Button>
            </Link>
          </div>
        </div>

        {!wishlist || wishlist.items.length === 0 ? (
          <EmptyState
            description={language === 'tr' ? 'Bir urunu favorilere ekleyerek kendi kisa listenizi olusturun.' : 'Create your own shortlist by adding a product to favorites.'}
            title={language === 'tr' ? 'Favori listeniz bos' : 'Your favorites list is empty'}
          />
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
                      <div className="detail-chip">{translateCategoryName(language, item.product.category.slug, item.product.category.name)}</div>
                      <div className="detail-chip">{item.product.badge ?? item.product.brand}</div>
                    </div>
                    <h2>{item.product.name}</h2>
                    <p>{item.product.shortDescription}</p>
                    <div className="favorite-card__meta">
                      <strong>{item.product.isPurchasable ? formatCurrency(item.product.price, language) : language === 'tr' ? 'Teklif Uzerine' : 'Quote on Request'}</strong>
                      <span>
                        {item.product.isPurchasable
                          ? language === 'tr'
                            ? `${item.product.stock} adet stokta`
                            : `${item.product.stock} units in stock`
                          : language === 'tr'
                            ? 'Kurumsal teklif ile ilerler'
                            : 'Continues with a quote-based flow'}
                      </span>
                    </div>
                    <div className="favorite-card__actions">
                      {item.product.isPurchasable ? (
                        <Button onClick={() => void handleAddToCart(item.product.id, item.product.name)}>{language === 'tr' ? 'Sepete Ekle' : 'Add to Cart'}</Button>
                      ) : (
                        <Button onClick={() => navigate(`/urun/${item.product.slug}`)} variant="secondary">
                          {language === 'tr' ? 'Incele' : 'View Details'}
                        </Button>
                      )}
                      <Button onClick={() => void handleRemoveFavorite(item.product.id, item.product.name)} variant="ghost">
                        {language === 'tr' ? 'Kaldir' : 'Remove'}
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
