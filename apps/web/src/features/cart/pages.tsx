import { Button, EmptyState, InputField, TextareaField } from '@bora/ui';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency } from '../../shared/lib/format';
import { useI18n } from '../../app/providers/I18nProvider';
import { translateCategoryName } from '../../shared/lib/i18n';

export function CartPage() {
  const { cart, token, syncCart, toggleFavorite, isFavorite } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();
  const subtotal = useMemo(() => cart?.subtotal ?? 0, [cart]);
  const itemCount = cart?.itemCount ?? 0;

  if (!cart || cart.items.length === 0) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState
            description={
              language === 'tr'
                ? 'Katalogdan bir DJI urunu secerek sepeti doldurabilir, kalp ikonuyla kendi favori listenizi de kurabilirsiniz.'
                : 'Pick a DJI product from the catalog to fill your cart, and build a favorites list with the heart icon.'
            }
            title={language === 'tr' ? 'Sepet bos' : 'Your cart is empty'}
          />
        </div>
      </section>
    );
  }

  async function handleQuantityChange(itemId: string, quantity: number) {
    if (!token) return;

    try {
      await api.updateCartItem(token, itemId, quantity);
      await syncCart();
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Adet guncellenemedi' : 'Quantity could not be updated',
        description: (error as Error).message,
      });
    }
  }

  async function handleRemoveItem(itemId: string, productName: string) {
    if (!token) return;

    try {
      await api.removeCartItem(token, itemId);
      await syncCart();
      showToast({
        tone: 'info',
        title: language === 'tr' ? 'Urun sepetten kaldirildi' : 'Product removed from cart',
        description: language === 'tr' ? `${productName} sepetinizden cikarildi.` : `${productName} was removed from your cart.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Urun kaldirilamadi' : 'Product could not be removed',
        description: (error as Error).message,
      });
    }
  }

  async function handleMoveToFavorites(itemId: string, productId: string, productName: string) {
    if (!token) return;

    try {
      if (!isFavorite(productId)) {
        await toggleFavorite(productId);
      }

      await api.removeCartItem(token, itemId);
      await syncCart();
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Favorilere tasindi' : 'Moved to favorites',
        description:
          language === 'tr'
            ? `${productName} favorilerinize kaydedildi ve sepetten kaldirildi.`
            : `${productName} was saved to your favorites and removed from the cart.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Islem tamamlanamadi' : 'Action could not be completed',
        description: (error as Error).message,
      });
    }
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell cart-page">
        <div className="cart-page__headline">
          <div>
            <div className="detail-chip">{language === 'tr' ? 'Sepet' : 'Cart'}</div>
            <h1>{language === 'tr' ? 'Sepetiniz Hazir' : 'Your Cart Is Ready'}</h1>
            <p>
              {language === 'tr'
                ? 'Seciminizi son kez rahatca gozden gecirin, adetleri ayarlayin ve checkout oncesi favori listenizi duzenleyin.'
                : 'Review your selection comfortably, adjust quantities, and organize your favorites before checkout.'}
            </p>
          </div>
          <div className="cart-page__stats">
            <div>
              <span>{language === 'tr' ? 'Urun' : 'Items'}</span>
              <strong>{itemCount}</strong>
            </div>
            <div>
              <span>{language === 'tr' ? 'Ara Toplam' : 'Subtotal'}</span>
              <strong>{formatCurrency(subtotal, language)}</strong>
            </div>
          </div>
        </div>

        <div className="cart-layout cart-layout--enhanced">
          <div className="order-panel">
            <div className="section-header">
              <div>
                <h2>{language === 'tr' ? 'Sepettekiler' : 'Cart Items'}</h2>
                <p>{language === 'tr' ? 'Her satirda gorsel, teknik ozet ve hizli aksiyonlar bulunur.' : 'Each row includes imagery, a technical summary, and quick actions.'}</p>
              </div>
            </div>

            <div className="cart-items-stack">
              {cart.items.map((item) => {
                const image = item.product.images.find((entry) => entry.isPrimary) ?? item.product.images[0];

                return (
                  <article className="cart-product-card" key={item.id}>
                    <div className="cart-product-card__media">
                      <img alt={image?.alt ?? item.product.name} src={image?.url} />
                    </div>

                    <div className="cart-product-card__body">
                      <div className="detail-chip-row">
                        <div className="detail-chip">{translateCategoryName(language, item.product.category.slug, item.product.category.name)}</div>
                        <div className="detail-chip">{item.product.badge ?? item.product.brand}</div>
                      </div>
                      <div className="cart-product-card__topline">
                        <div>
                          <h3>{item.product.name}</h3>
                          <p>{item.product.shortDescription}</p>
                        </div>
                        <strong>{formatCurrency(item.lineTotal, language)}</strong>
                      </div>

                      <div className="cart-product-card__meta">
                        {item.product.specs.slice(0, 3).map((spec) => (
                          <div key={spec.id}>
                            <span>{spec.name}</span>
                            <strong>{spec.value}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="cart-product-card__footer">
                        <div className="cart-quantity-control">
                          <button
                            aria-label={language === 'tr' ? 'Adet azalt' : 'Decrease quantity'}
                            onClick={() => void handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                            type="button"
                          >
                            -
                          </button>
                          <input
                            className="ui-input"
                            min={1}
                            onChange={(event) => void handleQuantityChange(item.id, Math.max(1, Number(event.target.value) || 1))}
                            type="number"
                            value={item.quantity}
                          />
                          <button
                            aria-label={language === 'tr' ? 'Adet arttir' : 'Increase quantity'}
                            onClick={() => void handleQuantityChange(item.id, Math.min(10, item.quantity + 1))}
                            type="button"
                          >
                            +
                          </button>
                        </div>

                        <div className="cart-product-card__actions">
                          <Button
                            onClick={() => void handleMoveToFavorites(item.id, item.product.id, item.product.name)}
                            variant="secondary"
                          >
                            {language === 'tr' ? 'Favorilere Tasi' : 'Move to Favorites'}
                          </Button>
                          <Button onClick={() => void handleRemoveItem(item.id, item.product.name)} variant="ghost">
                            {language === 'tr' ? 'Kaldir' : 'Remove'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="checkout-panel checkout-panel--sticky">
            <div className="section-header">
              <div>
                <h2>{language === 'tr' ? 'Siparis Ozeti' : 'Order Summary'}</h2>
                <p>{language === 'tr' ? 'Checkout oncesi toplamlar ve kisa teslim bilgisi.' : 'Totals and a short delivery summary before checkout.'}</p>
              </div>
            </div>

            <div className="checkout-summary__rows">
              <div className="summary-row">
                <span>{language === 'tr' ? 'Ara toplam' : 'Subtotal'}</span>
                <strong>{formatCurrency(subtotal, language)}</strong>
              </div>
              <div className="summary-row">
                <span>{language === 'tr' ? 'Kargo' : 'Shipping'}</span>
                <strong>{language === 'tr' ? 'Ucretsiz' : 'Free'}</strong>
              </div>
              <div className="summary-row">
                <span>{language === 'tr' ? 'Koruma paketi' : 'Protection plan'}</span>
                <strong>{language === 'tr' ? 'Dahil' : 'Included'}</strong>
              </div>
              <div className="summary-row summary-row--total">
                <span>{language === 'tr' ? 'Genel toplam' : 'Grand total'}</span>
                <strong>{formatCurrency(subtotal, language)}</strong>
              </div>
            </div>

            <div className="cart-mini-list">
              {cart.items.map((item) => (
                <div className="cart-mini-list__row" key={item.id}>
                  <span>
                    {item.product.name} x {item.quantity}
                  </span>
                  <strong>{formatCurrency(item.lineTotal, language)}</strong>
                </div>
              ))}
            </div>

            <div className="cart-summary-note">
              {language === 'tr'
                ? 'Demo checkout odeme almaz; siparis kaydi acilir ve profilinizde siparis gecmisi olarak gorunur.'
                : 'Demo checkout does not take payment; it creates an order record and shows it in your profile history.'}
            </div>

            <Link to="/checkout">
              <Button style={{ marginTop: '1.25rem', width: '100%' }}>{language === 'tr' ? "Checkout'a Gec" : 'Continue to Checkout'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CheckoutPage() {
  const { cart, token, syncCart } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    shippingName: '',
    shippingPhone: '',
    shippingCity: '',
    shippingDistrict: '',
    shippingAddressLine: '',
    notes: '',
  });

  if (!cart || cart.items.length === 0 || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState
            description={language === 'tr' ? 'Checkout oncesi sepetinizde urun bulunmali.' : 'Your cart must contain items before checkout.'}
            title={language === 'tr' ? 'Checkout hazir degil' : 'Checkout is not ready'}
          />
        </div>
      </section>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    try {
      await api.createOrder(token, form);
      await syncCart();
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Siparis olusturuldu' : 'Order created',
        description:
          language === 'tr'
            ? 'Demo siparisiniz kaydedildi ve profil gecmisine eklendi.'
            : 'Your demo order was saved and added to your profile history.',
      });
      navigate('/profil');
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Siparis olusturulamadi' : 'Order could not be created',
        description: (error as Error).message,
      });
    }
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell checkout-layout">
        <form className="checkout-panel" onSubmit={handleSubmit}>
          <div className="section-header">
            <div>
              <h2>{language === 'tr' ? 'Demo Checkout' : 'Demo Checkout'}</h2>
              <p>{language === 'tr' ? 'Bu surumde odeme alinmaz, siparis kaydi olusturulur.' : 'This version does not collect payment; it creates an order record.'}</p>
            </div>
          </div>
          <div className="auth-form-grid">
            <InputField
              label={language === 'tr' ? 'Ad Soyad' : 'Full Name'}
              onChange={(event) => setForm((value) => ({ ...value, shippingName: event.target.value }))}
              required
              value={form.shippingName}
            />
            <InputField
              label={language === 'tr' ? 'Telefon' : 'Phone'}
              onChange={(event) => setForm((value) => ({ ...value, shippingPhone: event.target.value }))}
              required
              value={form.shippingPhone}
            />
            <InputField
              label={language === 'tr' ? 'Sehir' : 'City'}
              onChange={(event) => setForm((value) => ({ ...value, shippingCity: event.target.value }))}
              required
              value={form.shippingCity}
            />
            <InputField
              label={language === 'tr' ? 'Ilce' : 'District'}
              onChange={(event) => setForm((value) => ({ ...value, shippingDistrict: event.target.value }))}
              required
              value={form.shippingDistrict}
            />
            <div className="full">
              <TextareaField
                label={language === 'tr' ? 'Adres' : 'Address'}
                onChange={(event) => setForm((value) => ({ ...value, shippingAddressLine: event.target.value }))}
                required
                value={form.shippingAddressLine}
              />
            </div>
            <div className="full">
              <TextareaField
                label={language === 'tr' ? 'Not' : 'Notes'}
                onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
                value={form.notes}
              />
            </div>
          </div>
          <Button style={{ marginTop: '1.25rem' }} type="submit">
            {language === 'tr' ? 'Siparis Olustur' : 'Create Order'}
          </Button>
        </form>

        <div className="checkout-panel">
          <div className="section-header">
            <div>
              <h2>{language === 'tr' ? 'Ozet' : 'Summary'}</h2>
              <p>{language === 'tr' ? 'Secilen urunler' : 'Selected items'}</p>
            </div>
          </div>
          {cart.items.map((item) => (
            <div className="summary-row" key={item.id}>
              <span>
                {item.product.name} x {item.quantity}
              </span>
              <strong>{formatCurrency(item.lineTotal, language)}</strong>
            </div>
          ))}
          <div className="summary-row summary-row--total">
            <span>{language === 'tr' ? 'Toplam' : 'Total'}</span>
            <strong>{formatCurrency(cart.subtotal, language)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
