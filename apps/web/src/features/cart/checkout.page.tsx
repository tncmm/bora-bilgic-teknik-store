import type { Address } from '@bora/types';
import { Button, EmptyState, InputField, TextareaField } from '@bora/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api, type CheckoutPayload } from '../../shared/api/client';
import { PaytrIframe } from '../../shared/components/PaytrIframe';
import { formatCurrency } from '../../shared/lib/format';

type CheckoutForm = Omit<CheckoutPayload, 'items'> & { notes: string };

const emptyForm: CheckoutForm = {
  email: '',
  shippingName: '',
  shippingPhone: '',
  shippingCity: '',
  shippingDistrict: '',
  shippingAddressLine: '',
  billingSameAsShipping: true,
  billingType: 'individual',
  billingName: '',
  billingPhone: '',
  billingCity: '',
  billingDistrict: '',
  billingAddressLine: '',
  companyName: '',
  taxOffice: '',
  taxNumber: '',
  identityNumber: '',
  notes: '',
};

export function CheckoutPage() {
  const { cart, token, user, isAuthenticated } = useSession();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(!isAuthenticated);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;

    void api
      .listAddresses(token)
      .then((items) => {
        setAddresses(items);
        if (items.length > 0) {
          setSelectedAddressId(items[0].id);
        } else {
          setManualMode(true);
        }
      })
      .catch(() => setManualMode(true));
  }, [token]);

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;
  const shipping = selectedAddress && !manualMode
    ? {
        shippingName: user ? `${user.firstName} ${user.lastName}` : form.shippingName,
        shippingPhone: selectedAddress.phone,
        shippingCity: selectedAddress.city,
        shippingDistrict: selectedAddress.district,
        shippingAddressLine: selectedAddress.line1,
      }
    : {
        shippingName: form.shippingName,
        shippingPhone: form.shippingPhone,
        shippingCity: form.shippingCity,
        shippingDistrict: form.shippingDistrict,
        shippingAddressLine: form.shippingAddressLine,
      };

  const billing = form.billingSameAsShipping
    ? {
        billingName: shipping.shippingName,
        billingPhone: shipping.shippingPhone,
        billingCity: shipping.shippingCity,
        billingDistrict: shipping.shippingDistrict,
        billingAddressLine: shipping.shippingAddressLine,
      }
    : {
        billingName: form.billingName ?? '',
        billingPhone: form.billingPhone ?? '',
        billingCity: form.billingCity ?? '',
        billingDistrict: form.billingDistrict ?? '',
        billingAddressLine: form.billingAddressLine ?? '',
      };

  const formReady = Boolean(
    (isAuthenticated || form.email?.trim()) &&
      shipping.shippingName.trim() &&
      shipping.shippingPhone.trim() &&
      shipping.shippingCity.trim() &&
      shipping.shippingDistrict.trim() &&
      shipping.shippingAddressLine.trim() &&
      billing.billingName.trim() &&
      billing.billingPhone.trim() &&
      billing.billingCity.trim() &&
      billing.billingDistrict.trim() &&
      billing.billingAddressLine.trim() &&
      /^\d{11}$/.test(form.identityNumber.trim()),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || !formReady || submitting) return;

    setSubmitting(true);
    try {
      const payload: CheckoutPayload = {
        email: isAuthenticated ? undefined : form.email,
        items: isAuthenticated ? undefined : cart.items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        ...shipping,
        billingSameAsShipping: form.billingSameAsShipping,
        billingType: form.billingType,
        ...billing,
        companyName: form.billingType === 'corporate' ? form.companyName : undefined,
        taxOffice: form.billingType === 'corporate' ? form.taxOffice : undefined,
        taxNumber: form.billingType === 'corporate' ? form.taxNumber : undefined,
        identityNumber: form.identityNumber,
        notes: form.notes,
      };
      const session = await api.startPayment(token, payload);
      window.sessionStorage.setItem('bora-pending-merchant-oid', session.merchantOid);
      if (session.trackingUrl) {
        window.sessionStorage.setItem('bora-pending-tracking-url', session.trackingUrl);
      }
      setIframeToken(session.iframeToken);
    } catch (error) {
      showToast({ tone: 'error', title: 'Ödeme başlatılamadı', description: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <EmptyState description="Sepetin boş; ödeme öncesi en az bir ürün eklemelisin." title="Sepet boş" />
          <Link to="/katalog">
            <Button>Kataloğa Dön</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (iframeToken) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Güvenli Ödeme</h2>
              <p>Kart bilgilerin yalnızca PayTR tarafından işlenir. Ödeme onaylandığında siparişin otomatik oluşur.</p>
            </div>
            <PaytrIframe token={iframeToken} />
          </div>
        </div>
      </section>
    );
  }

  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="admin-headline">
          <div>
            <h1>Teslimat ve Ödeme</h1>
            <p>Giriş yapmadan da sipariş verebilirsin; takip linkin e-posta ile gönderilir.</p>
          </div>
        </div>

        <form className="checkout-grid" onSubmit={handleSubmit}>
          <div className="checkout-grid__main">
            {!isAuthenticated ? (
              <div className="admin-card">
                <div className="checkout-step-head">
                  <span className="checkout-step-no">1</span>
                  <div>
                    <h2>İletişim</h2>
                    <p>Sipariş takip linkini gönderebilmemiz için e-posta adresin gerekli.</p>
                  </div>
                </div>
                <InputField label="E-posta" onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} type="email" value={form.email} />
              </div>
            ) : null}

            <div className="admin-card">
              <div className="checkout-step-head">
                <span className="checkout-step-no">{isAuthenticated ? 1 : 2}</span>
                <div>
                  <h2>Teslimat Adresi</h2>
                  <p>Kayıtlı adreslerinden seç veya bu sipariş için yeni adres gir.</p>
                </div>
              </div>

              {addresses.length > 0 ? (
                <div className="address-pick-grid">
                  {addresses.map((address) => (
                    <button
                      className={['address-pick-card', selectedAddressId === address.id && !manualMode ? 'is-active' : ''].filter(Boolean).join(' ')}
                      key={address.id}
                      onClick={() => {
                        setSelectedAddressId(address.id);
                        setManualMode(false);
                      }}
                      type="button"
                    >
                      <strong>{address.title}</strong>
                      <span>{address.line1}</span>
                      <span className="text-muted">
                        {address.district} / {address.city} · {address.phone}
                      </span>
                    </button>
                  ))}
                  <button className={['address-pick-card', 'address-pick-card--new', manualMode ? 'is-active' : ''].filter(Boolean).join(' ')} onClick={() => setManualMode(true)} type="button">
                    <strong>+ Yeni adres gir</strong>
                    <span className="text-muted">Bu sipariş için bir defalık adres</span>
                  </button>
                </div>
              ) : null}

              {manualMode || addresses.length === 0 ? (
                <div className="admin-form-grid" style={{ marginTop: '1rem' }}>
                  <InputField label="Ad Soyad" onChange={(e) => setForm((v) => ({ ...v, shippingName: e.target.value }))} value={form.shippingName} />
                  <InputField label="Telefon" onChange={(e) => setForm((v) => ({ ...v, shippingPhone: e.target.value }))} value={form.shippingPhone} />
                  <InputField label="Şehir" onChange={(e) => setForm((v) => ({ ...v, shippingCity: e.target.value }))} value={form.shippingCity} />
                  <InputField label="İlçe" onChange={(e) => setForm((v) => ({ ...v, shippingDistrict: e.target.value }))} value={form.shippingDistrict} />
                  <div className="full">
                    <TextareaField label="Açık Adres" onChange={(e) => setForm((v) => ({ ...v, shippingAddressLine: e.target.value }))} value={form.shippingAddressLine} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="admin-card">
              <div className="checkout-step-head">
                <span className="checkout-step-no">{isAuthenticated ? 2 : 3}</span>
                <div>
                  <h2>Fatura Bilgileri</h2>
                  <p>TC kimlik numarası şifrelenerek saklanır ve ekranda tam gösterilmez.</p>
                </div>
              </div>
              <label className="checkout-check">
                <input checked={form.billingSameAsShipping} onChange={(e) => setForm((v) => ({ ...v, billingSameAsShipping: e.target.checked }))} type="checkbox" />
                <span>Teslimat adresiyle aynı adresi kullan</span>
              </label>
              <div className="admin-form-grid" style={{ marginTop: '1rem' }}>
                <label className="admin-field">
                  <span>Fatura Tipi</span>
                  <select className="ui-select" onChange={(e) => setForm((v) => ({ ...v, billingType: e.target.value as CheckoutForm['billingType'] }))} value={form.billingType}>
                    <option value="individual">Bireysel</option>
                    <option value="corporate">Kurumsal</option>
                  </select>
                </label>
                <InputField label="TC Kimlik No" maxLength={11} onChange={(e) => setForm((v) => ({ ...v, identityNumber: e.target.value.replace(/\D/g, '') }))} value={form.identityNumber} />
                {!form.billingSameAsShipping ? (
                  <>
                    <InputField label="Fatura Ad Soyad" onChange={(e) => setForm((v) => ({ ...v, billingName: e.target.value }))} value={form.billingName} />
                    <InputField label="Fatura Telefon" onChange={(e) => setForm((v) => ({ ...v, billingPhone: e.target.value }))} value={form.billingPhone} />
                    <InputField label="Fatura Şehir" onChange={(e) => setForm((v) => ({ ...v, billingCity: e.target.value }))} value={form.billingCity} />
                    <InputField label="Fatura İlçe" onChange={(e) => setForm((v) => ({ ...v, billingDistrict: e.target.value }))} value={form.billingDistrict} />
                    <div className="full">
                      <TextareaField label="Fatura Açık Adres" onChange={(e) => setForm((v) => ({ ...v, billingAddressLine: e.target.value }))} value={form.billingAddressLine} />
                    </div>
                  </>
                ) : null}
                {form.billingType === 'corporate' ? (
                  <>
                    <InputField label="Firma Ünvanı" onChange={(e) => setForm((v) => ({ ...v, companyName: e.target.value }))} value={form.companyName} />
                    <InputField label="Vergi Dairesi" onChange={(e) => setForm((v) => ({ ...v, taxOffice: e.target.value }))} value={form.taxOffice} />
                    <InputField label="Vergi No" onChange={(e) => setForm((v) => ({ ...v, taxNumber: e.target.value }))} value={form.taxNumber} />
                  </>
                ) : null}
              </div>
            </div>

            <div className="admin-card">
              <div className="checkout-step-head">
                <span className="checkout-step-no">{isAuthenticated ? 3 : 4}</span>
                <div>
                  <h2>Sipariş Notu ve Ödeme</h2>
                  <p>Not opsiyonel; kart bilgilerin PayTR tarafından alınır.</p>
                </div>
              </div>
              <TextareaField label="Sipariş Notu" onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} placeholder="Örn: Kapıya bırakılabilir." value={form.notes} />
              <div className="checkout-pay-info" style={{ marginTop: '1rem' }}>
                <span className="material-symbols-outlined">credit_card</span>
                <div>
                  <strong>Kart bilgilerin bizde saklanmaz</strong>
                  <p>Ödeme formu PayTR tarafından sunulur; onay sonrası siparişin otomatik oluşur.</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="checkout-grid__aside">
            <div className="admin-card">
              <div className="admin-card__head">
                <h2>Sipariş Özeti</h2>
                <p>{itemCount} ürün</p>
              </div>
              <div className="checkout-lines">
                {cart.items.map((item) => (
                  <div className="checkout-line" key={item.id}>
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                    <strong>{formatCurrency(item.lineTotal, 'tr')}</strong>
                  </div>
                ))}
                <div className="checkout-line checkout-line--muted">
                  <span>Kargo</span>
                  <span>Dahil</span>
                </div>
                <div className="checkout-line checkout-line--total">
                  <span>Toplam</span>
                  <strong>{formatCurrency(cart.subtotal, 'tr')}</strong>
                </div>
              </div>

              <Button disabled={!formReady || submitting} style={{ width: '100%', marginTop: '1rem' }} type="submit">
                {submitting ? 'Ödeme Hazırlanıyor...' : 'Güvenli Ödemeye Geç'}
              </Button>
              {!formReady ? <p className="admin-field-hint">Devam için iletişim, teslimat, fatura ve TC kimlik bilgilerini tamamla.</p> : null}
            </div>
          </aside>
        </form>
      </div>
    </section>
  );
}
