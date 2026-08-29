import type { Address } from '@bora/types';
import { Button, EmptyState, InputField, TextareaField } from '@bora/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency } from '../../shared/lib/format';
import { useI18n } from '../../app/providers/I18nProvider';
import { translateCategoryName } from '../../shared/lib/i18n';

const paymentMethods = [
  {
    id: 'card',
    titleTr: 'Kart ile Odeme',
    titleEn: 'Card Payment',
    descriptionTr: 'PayTR iframe odeme altyapisi sonraki asamada bu alana baglanacak.',
    descriptionEn: 'The PayTR iframe payment flow will be connected here in the next phase.',
  },
  {
    id: 'bank-transfer',
    titleTr: 'Havale / EFT',
    titleEn: 'Bank Transfer',
    descriptionTr: 'Kurumsal veya teklifli siparislerde manuel onay icin hazir tutulur.',
    descriptionEn: 'Kept ready for manual approval on corporate or quote-based orders.',
  },
] as const;

function mapAddressToCheckoutForm(address: Address, shippingName: string) {
  return {
    shippingName,
    shippingPhone: address.phone,
    shippingCity: address.city,
    shippingDistrict: address.district,
    shippingAddressLine: address.line1,
  };
}

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
  const { cart, token, syncCart, isAuthenticated, user } = useSession();
  const { showToast } = useToast();
  const { language } = useI18n();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]['id']>('card');
  const [form, setForm] = useState({
    shippingName: '',
    shippingPhone: '',
    shippingCity: '',
    shippingDistrict: '',
    shippingAddressLine: '',
    notes: '',
  });

  useEffect(() => {
    if (!user) return;

    setForm((value) => ({
      ...value,
      shippingName: value.shippingName || `${user.firstName} ${user.lastName}`,
    }));
  }, [user]);

  useEffect(() => {
    if (!token) return;

    void api.listAddresses(token).then((items) => {
      setAddresses(items);

      const firstAddress = items[0];
      if (!firstAddress) return;

      setSelectedAddressId((value) => value || firstAddress.id);
      setForm((value) => ({
        ...value,
        ...mapAddressToCheckoutForm(firstAddress, value.shippingName || (user ? `${user.firstName} ${user.lastName}` : '')),
      }));
    }).catch(() => undefined);
  }, [token, user]);

  function handleSelectAddress(address: Address) {
    setSelectedAddressId(address.id);
    setForm((value) => ({
      ...value,
      ...mapAddressToCheckoutForm(address, value.shippingName),
    }));
  }

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
      const order = await api.createOrder(token, form);
      await syncCart();
      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Siparis olusturuldu' : 'Order created',
        description:
          language === 'tr'
            ? 'Siparisiniz kaydedildi. Odeme entegrasyonu eklendiginde bu adim tahsilata baglanacak.'
            : 'Your order was saved. Once payment integration is added, this step will connect to collection.',
      });
      navigate(`/siparislerim/${order.id}`, { state: { justPlaced: true } });
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
              <div className="detail-chip">{language === 'tr' ? 'Checkout' : 'Checkout'}</div>
              <h2>{language === 'tr' ? 'Teslimat ve Odeme' : 'Delivery and Payment'}</h2>
              <p>{language === 'tr' ? 'Kayitli adresinizi secin, odeme tercihine bakip siparisi onaylayin.' : 'Select a saved address, review payment preference, and confirm the order.'}</p>
            </div>
          </div>

          <div className="checkout-step-card">
            <div className="checkout-step-card__head">
              <span>1</span>
              <div>
                <strong>{language === 'tr' ? 'Teslimat Adresi' : 'Delivery Address'}</strong>
                <p>{language === 'tr' ? 'Profilinizdeki adresleri burada hizlica kullanabilirsiniz.' : 'You can quickly use addresses from your profile here.'}</p>
              </div>
            </div>

            {addresses.length === 0 ? (
              <div className="checkout-empty-note">
                <strong>{language === 'tr' ? 'Kayitli adresiniz yok' : 'No saved address yet'}</strong>
                <p>{language === 'tr' ? 'Asagidaki alanlari doldurarak devam edebilirsiniz. Kalici adres eklemek icin Profil > Adreslerim bolumunu kullanin.' : 'You can continue by filling the fields below. Use Profile > My Addresses to add a permanent address.'}</p>
              </div>
            ) : (
              <div className="checkout-choice-grid">
                {addresses.map((address) => (
                  <button
                    className={['checkout-choice-card', selectedAddressId === address.id ? 'checkout-choice-card--active' : ''].filter(Boolean).join(' ')}
                    key={address.id}
                    onClick={() => handleSelectAddress(address)}
                    type="button"
                  >
                    <strong>{address.title}</strong>
                    <span>{address.line1}</span>
                    <small>
                      {address.district} / {address.city}
                    </small>
                  </button>
                ))}
              </div>
            )}
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

          <div className="checkout-step-card checkout-step-card--compact">
            <div className="checkout-step-card__head">
              <span>2</span>
              <div>
                <strong>{language === 'tr' ? 'Odeme Tercihi' : 'Payment Preference'}</strong>
                <p>{language === 'tr' ? 'Bu bolum su an tahsilat yapmaz; PayTR iframe sonraki asamada buraya eklenecek.' : 'This area does not collect payment yet; PayTR iframe will be added here next.'}</p>
              </div>
            </div>
            <div className="checkout-choice-grid checkout-choice-grid--payment">
              {paymentMethods.map((method) => (
                <button
                  className={['checkout-choice-card', paymentMethod === method.id ? 'checkout-choice-card--active' : ''].filter(Boolean).join(' ')}
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  type="button"
                >
                  <strong>{language === 'tr' ? method.titleTr : method.titleEn}</strong>
                  <span>{language === 'tr' ? method.descriptionTr : method.descriptionEn}</span>
                </button>
              ))}
            </div>
          </div>

          <Button style={{ marginTop: '1.25rem', width: '100%' }} type="submit">
            {language === 'tr' ? 'Siparisi Onayla' : 'Confirm Order'}
          </Button>
        </form>

        <div className="checkout-panel">
          <div className="section-header">
            <div>
              <h2>{language === 'tr' ? 'Odeme Oncesi Ozet' : 'Pre-payment Summary'}</h2>
              <p>{language === 'tr' ? 'Urunler, teslimat adresi ve odeme tercihi son kez burada gorunur.' : 'Products, delivery address, and payment preference are shown one last time here.'}</p>
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
          <div className="checkout-summary-box">
            <strong>{language === 'tr' ? 'Teslimat' : 'Delivery'}</strong>
            <p>
              {form.shippingAddressLine
                ? `${form.shippingAddressLine}, ${form.shippingDistrict} / ${form.shippingCity}`
                : language === 'tr'
                  ? 'Adres secimi bekleniyor.'
                  : 'Address selection pending.'}
            </p>
          </div>
          <div className="checkout-summary-box">
            <strong>{language === 'tr' ? 'Odeme' : 'Payment'}</strong>
            <p>
              {language === 'tr'
                ? paymentMethods.find((method) => method.id === paymentMethod)?.titleTr
                : paymentMethods.find((method) => method.id === paymentMethod)?.titleEn}
            </p>
          </div>
          <div className="cart-summary-note">
            {language === 'tr'
              ? 'Odeme altyapisi henuz tahsilat yapmaz. Siparis kaydi olusur, PayTR iframe entegrasyonu sonraki asamada bu karta baglanir.'
              : 'Payment infrastructure does not collect funds yet. The order is recorded, and PayTR iframe integration will connect to this card next.'}
          </div>
        </div>
      </div>
    </section>
  );
}
