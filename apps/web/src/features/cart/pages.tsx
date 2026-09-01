import { Button, EmptyState } from '@bora/ui';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { formatCurrency } from '../../shared/lib/format';
import { translateCategoryName } from '../../shared/lib/i18n';

export function CartPage() {
  const { cart, token, updateCartItem, removeCartItem, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const subtotal = useMemo(() => cart?.subtotal ?? 0, [cart]);

  if (!cart || cart.items.length === 0) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <EmptyState description="Katalogdan ürün seçerek sepetini doldurmaya başlayabilirsin." title="Sepetin boş" />
          <div style={{ textAlign: 'center' }}>
            <Link to="/katalog">
              <Button>Kataloğa Git</Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  async function handleQuantityChange(itemId: string, quantity: number) {
    try {
      await updateCartItem(itemId, quantity);
    } catch (error) {
      showToast({ tone: 'error', title: 'Adet güncellenemedi', description: (error as Error).message });
    }
  }

  async function handleRemoveItem(itemId: string, productName: string) {
    try {
      await removeCartItem(itemId);
      showToast({ tone: 'info', title: 'Ürün sepetten kaldırıldı', description: productName });
    } catch (error) {
      showToast({ tone: 'error', title: 'Ürün kaldırılamadı', description: (error as Error).message });
    }
  }

  async function handleMoveToFavorites(itemId: string, productId: string, productName: string) {
    if (!token) return;

    try {
      if (!isFavorite(productId)) {
        await toggleFavorite(productId);
      }

      await removeCartItem(itemId);
      showToast({ tone: 'success', title: 'Favorilere taşındı', description: `${productName} favorilerine kaydedildi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'İşlem tamamlanamadı', description: (error as Error).message });
    }
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="admin-headline">
          <div>
            <h1>Sepet</h1>
            <p>{cart.itemCount} ürün · adetleri ayarla, sonra güvenli ödemeye geç.</p>
          </div>
        </div>

        <div className="checkout-grid">
          <div className="basket-list">
            {cart.items.map((item) => {
              const image = item.product.images.find((entry) => entry.isPrimary) ?? item.product.images[0];
              const maxQty = Math.max(1, Math.min(10, item.product.stock));

              return (
                <article className="basket-item" key={item.id}>
                  <Link className="basket-item__thumb" to={`/urun/${item.product.slug}`}>
                    <img alt={image?.alt ?? item.product.name} src={image?.url} />
                  </Link>

                  <div className="basket-item__body">
                    <div className="basket-item__head">
                      <div>
                        <span className="text-muted">{translateCategoryName('tr', item.product.category.slug, item.product.category.name)} · {item.product.brand}</span>
                        <strong>
                          <Link to={`/urun/${item.product.slug}`}>{item.product.name}</Link>
                        </strong>
                      </div>
                      <button
                        aria-label="Sepetten kaldır"
                        className="basket-item__remove"
                        onClick={() => void handleRemoveItem(item.id, item.product.name)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>

                    <div className="basket-item__foot">
                      <div className="basket-qty">
                        <button
                          aria-label="Adet azalt"
                          disabled={item.quantity <= 1}
                          onClick={() => void handleQuantityChange(item.id, item.quantity - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label="Adet artır"
                          disabled={item.quantity >= maxQty}
                          onClick={() => void handleQuantityChange(item.id, item.quantity + 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-muted">{formatCurrency(Number(item.product.price), 'tr')} / adet</span>
                      <strong className="basket-item__total">{formatCurrency(item.lineTotal, 'tr')}</strong>
                    </div>

                    <button className="basket-item__fav" onClick={() => void handleMoveToFavorites(item.id, item.product.id, item.product.name)} type="button">
                      <span className="material-symbols-outlined">favorite</span> Favorilere taşı
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="checkout-grid__aside">
            <div className="admin-card">
              <div className="admin-card__head">
                <h2>Özet</h2>
              </div>
              <div className="checkout-lines">
                <div className="checkout-line">
                  <span>Ürünler ({cart.itemCount})</span>
                  <strong>{formatCurrency(subtotal, 'tr')}</strong>
                </div>
                <div className="checkout-line checkout-line--muted">
                  <span>Kargo</span>
                  <span>Dahil</span>
                </div>
                <div className="checkout-line checkout-line--total">
                  <span>Toplam</span>
                  <strong>{formatCurrency(subtotal, 'tr')}</strong>
                </div>
              </div>

              <Link to="/checkout">
                <Button style={{ width: '100%', marginTop: '1rem' }}>Ödemeye Geç</Button>
              </Link>
              <Link to="/katalog" style={{ display: 'block', marginTop: '0.5rem', textAlign: 'center' }}>
                <Button variant="ghost" style={{ width: '100%' }}>Alışverişe Devam Et</Button>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export { CheckoutPage } from './checkout.page';
