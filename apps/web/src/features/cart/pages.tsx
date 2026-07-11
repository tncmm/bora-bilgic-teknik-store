import { Button, EmptyState, InputField, TextareaField } from '@bora/ui';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency } from '../../shared/lib/format';
import { useI18n } from '../../app/providers/I18nProvider';
import { translateCategoryName } from '../../shared/lib/i18n';

function PurchaseProcessPanel({ showLoginStep = true }: { showLoginStep?: boolean }) {
  const { language } = useI18n();

  const steps = [
    language === 'tr' ? 'Urunu secin ve detay sayfasindan sepete ekleyin.' : 'Select a product and add it to cart from the detail page.',
    showLoginStep
      ? language === 'tr'
        ? 'Siparisi tamamlamak icin giris yapin veya yeni hesap olusturun.'
        : 'Log in or create an account to complete the order.'
      : language === 'tr'
        ? 'Sepette adet ve urun kontrolunu tamamlayin.'
        : 'Review quantities and products in the cart.',
    language === 'tr'
      ? 'Teslimat ve fatura bilgilerinizi checkout ekraninda doldurun.'
      : 'Fill in delivery and billing details on the checkout screen.',
    language === 'tr'
      ? 'Odeme oncesi toplam tutar, kargo ve siparis ozeti net olarak gosterilir.'
      : 'The total, shipping, and order summary are shown clearly before payment.',
    language === 'tr'
      ? 'Onay sonrasi siparisiniz kayda alinir ve surec profilinizden takip edilir.'
      : 'After approval, the order is recorded and can be tracked from your profile.',
  ];

  return (
    <div className="checkout-panel">
      <div className="section-header">
        <div>
          <h2>{language === 'tr' ? 'Satin Alma Sureci' : 'Purchase Flow'}</h2>
          <p>
            {language === 'tr'
              ? 'PayTR incelemesi icin urun seciminden siparis onayina kadar tum adimlar acikca listelenir.'
              : 'For payment review, every step from product selection to order approval is listed clearly.'}
          </p>
        </div>
      </div>

      <ol className="purchase-steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="compliance-grid">
        <div className="compliance-card">
          <strong>{language === 'tr' ? 'Odeme' : 'Payment'}</strong>
          <p>{language === 'tr' ? 'Kart ile guvenli odeme, siparis ozeti ve toplam tutar oncesinde acikca gosterilir.' : 'Secure card payment with a clear total and order summary before approval.'}</p>
        </div>
        <div className="compliance-card">
          <strong>{language === 'tr' ? 'Teslimat' : 'Delivery'}</strong>
          <p>{language === 'tr' ? 'Stoktaki urunlerde hizli kargo, kurumsal urunlerde teklif ve termin bilgilendirmesi sunulur.' : 'Fast shipping for in-stock items, quote and lead-time information for enterprise items.'}</p>
        </div>
        <div className="compliance-card">
          <strong>{language === 'tr' ? 'Iade ve Destek' : 'Returns and Support'}</strong>
          <p>{language === 'tr' ? 'Siparis sonrasi destek, iade ve degisim surecleri musteri hizmetleri ekibi tarafindan yonetilir.' : 'After-sales support, returns, and exchange flows are managed by customer service.'}</p>
        </div>
      </div>

      <div className="dji-inline-links">
        <Link to="/teslimat">{language === 'tr' ? 'Teslimat' : 'Delivery'}</Link>
        <Link to="/iade">{language === 'tr' ? 'Iade' : 'Returns'}</Link>
        <Link to="/mesafeli-satis">{language === 'tr' ? 'Mesafeli Satis' : 'Distance Sales'}</Link>
        <Link to="/gizlilik">{language === 'tr' ? 'Gizlilik' : 'Privacy'}</Link>
      </div>
    </div>
  );
}

export function CartPage() {
  const { cart, token, syncCart, toggleFavorite, isFavorite, isAuthenticated } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();
  const subtotal = useMemo(() => cart?.subtotal ?? 0, [cart]);
  const itemCount = cart?.itemCount ?? 0;

  if (!cart || cart.items.length === 0) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell cart-empty-layout">
          <EmptyState
            description={
              language === 'tr'
                ? 'Katalogdan bir urun secerek sepeti doldurabilir, kalp ikonuyla kendi favori listenizi de kurabilirsiniz.'
                : 'Pick a product from the catalog to fill your cart, and build a favorites list with the heart icon.'
            }
            title={language === 'tr' ? 'Sepet bos' : 'Your cart is empty'}
          />
          <PurchaseProcessPanel showLoginStep={!isAuthenticated} />
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
                ? 'Odeme oncesinde urunler, toplam tutar, teslimat bilgileri ve siparis ozeti net bicimde gorunur.'
                : 'Products, total price, delivery information, and the order summary are shown clearly before payment.'}
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
  const { cart, token, syncCart, isAuthenticated } = useSession();
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

  if (!isAuthenticated || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell cart-empty-layout">
          <EmptyState
            description={language === 'tr' ? 'Checkout ekranina gecmeden once giris yapmaniz gerekir. Bu adim sonrasinda teslimat ve siparis bilgileri formu acilir.' : 'You need to log in before entering checkout. After that, the delivery and order form becomes available.'}
            title={language === 'tr' ? 'Giris gerekli' : 'Login required'}
          />
          <PurchaseProcessPanel />
        </div>
      </section>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell cart-empty-layout">
          <EmptyState
            description={language === 'tr' ? 'Checkout oncesi sepetinizde en az bir urun bulunmalidir.' : 'Your cart must contain at least one item before checkout.'}
            title={language === 'tr' ? 'Checkout hazir degil' : 'Checkout is not ready'}
          />
          <PurchaseProcessPanel showLoginStep={false} />
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
              <h2>{language === 'tr' ? 'Teslimat ve Siparis Bilgileri' : 'Delivery and Order Details'}</h2>
              <p>{language === 'tr' ? 'Odeme adimina gecmeden once teslimat bilgileri, adres ve siparis notlari bu ekranda toplanir.' : 'Before payment, delivery details, address, and order notes are collected on this screen.'}</p>
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
              <h2>{language === 'tr' ? 'Odeme Oncesi Ozet' : 'Pre-payment Summary'}</h2>
              <p>{language === 'tr' ? 'Secilen urunler, toplam tutar ve teslim bilgisi bu alanda son kez gorunur.' : 'Selected items, total amount, and delivery info are shown one last time here.'}</p>
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
          <div className="cart-summary-note">
            {language === 'tr'
              ? 'Gercek odeme entegrasyonunda bu adimdan sonra kart odemesi ve banka guvenlik onayi ekranina gecilir.'
              : 'In the real payment integration, the next step leads to card payment and bank security approval.'}
          </div>
        </div>
      </div>
    </section>
  );
}
