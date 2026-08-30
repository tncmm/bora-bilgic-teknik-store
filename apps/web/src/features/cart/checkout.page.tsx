import type { Address } from '@bora/types';
import { Button, EmptyState, InputField, TextareaField } from '@bora/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { PaytrIframe } from '../../shared/components/PaytrIframe';
import { formatCurrency } from '../../shared/lib/format';

interface CheckoutForm {
  shippingName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingAddressLine: string;
  notes: string;
}

const emptyForm: CheckoutForm = {
  shippingName: '',
  shippingPhone: '',
  shippingCity: '',
  shippingDistrict: '',
  shippingAddressLine: '',
  notes: '',
};

export function CheckoutPage() {
  const { cart, token, user, isAuthenticated } = useSession();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
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

  const resolved: CheckoutForm =
    selectedAddress && !manualMode
      ? {
          shippingName: user ? `${user.firstName} ${user.lastName}` : '',
          shippingPhone: selectedAddress.phone,
          shippingCity: selectedAddress.city,
          shippingDistrict: selectedAddress.district,
          shippingAddressLine: selectedAddress.line1,
          notes: form.notes,
        }
      : { ...form, shippingName: form.shippingName || (user ? `${user.firstName} ${user.lastName}` : '') };

  const formReady = Boolean(
    resolved.shippingName.trim() &&
      resolved.shippingPhone.trim() &&
      resolved.shippingCity.trim() &&
      resolved.shippingDistrict.trim() &&
      resolved.shippingAddressLine.trim(),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !formReady || submitting) return;

    setSubmitting(true);
    try {
      // The attempt records the order payload; the order itself is created by
      // the verified PayTR callback once the card payment succeeds.
      const session = await api.startPayment(token, resolved);
      setIframeToken(session.iframeToken);
    } catch (error) {
      showToast({ tone: 'error', title: 'Odeme baslatilamadi', description: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <EmptyState description="Odeme adimina gecmek icin once giris yapmalisin." title="Giris gerekli" />
          <Link to="/giris">
            <Button>Giris Yap</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell account-layout">
          <EmptyState description="Sepetin bos; odeme oncesi en az bir urun eklemelisin." title="Sepet bos" />
          <Link to="/katalog">
            <Button>Kataloga Don</Button>
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
              <h2>Guvenli Odeme</h2>
              <p>Kart bilgilerin yalnizca PayTR tarafindan islenir. Odeme onaylandiginda siparisin otomatik olusur.</p>
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
            <h1>Teslimat ve Odeme</h1>
            <p>Uc kisa adim: adres, not, guvenli odeme.</p>
          </div>
        </div>

        <form className="checkout-grid" onSubmit={handleSubmit}>
          <div className="checkout-grid__main">
            <div className="admin-card">
              <div className="checkout-step-head">
                <span className="checkout-step-no">1</span>
                <div>
                  <h2>Teslimat Adresi</h2>
                  <p>Kayitli adreslerinden sec veya yeni bir tane gir.</p>
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
                  <button
                    className={['address-pick-card', 'address-pick-card--new', manualMode ? 'is-active' : ''].filter(Boolean).join(' ')}
                    onClick={() => setManualMode(true)}
                    type="button"
                  >
                    <strong>+ Yeni adres gir</strong>
                    <span className="text-muted">Bu siparis icin bir defalik adres</span>
                  </button>
                </div>
              ) : null}

              {manualMode || addresses.length === 0 ? (
                <div className="admin-form-grid" style={{ marginTop: '1rem' }}>
                  <InputField label="Ad Soyad" onChange={(e) => setForm((v) => ({ ...v, shippingName: e.target.value }))} value={resolved.shippingName} />
                  <InputField label="Telefon" onChange={(e) => setForm((v) => ({ ...v, shippingPhone: e.target.value }))} value={resolved.shippingPhone} />
                  <InputField label="Sehir" onChange={(e) => setForm((v) => ({ ...v, shippingCity: e.target.value }))} value={form.shippingCity} />
                  <InputField label="Ilce" onChange={(e) => setForm((v) => ({ ...v, shippingDistrict: e.target.value }))} value={form.shippingDistrict} />
                  <div className="full">
                    <TextareaField label="Acik Adres" onChange={(e) => setForm((v) => ({ ...v, shippingAddressLine: e.target.value }))} value={form.shippingAddressLine} />
                  </div>
                </div>
              ) : null}

              {addresses.length > 0 ? (
                <p className="admin-field-hint" style={{ marginTop: '0.75rem' }}>
                  Adreslerini <Link to="/profil/adresler">profilindeki adres defterinden</Link> yonetebilirsin.
                </p>
              ) : null}
            </div>

            <div className="admin-card">
              <div className="checkout-step-head">
                <span className="checkout-step-no">2</span>
                <div>
                  <h2>Siparis Notu</h2>
                  <p>Opsiyonel — teslimat ekibi icin bir sey ekleyebilirsin.</p>
                </div>
              </div>
              <TextareaField label="" onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} placeholder="Orn: Kapiya birakilabilir." value={form.notes} />
            </div>

            <div className="admin-card">
              <div className="checkout-step-head">
                <span className="checkout-step-no">3</span>
                <div>
                  <h2>Odeme</h2>
                  <p>Kart ile; guvenli PayTR cercevesinde.</p>
                </div>
              </div>
              <div className="checkout-pay-info">
                <span className="material-symbols-outlined">credit_card</span>
                <div>
                  <strong>Kart bilgilerin bizde saklanmaz</strong>
                  <p>Odeme formu PayTR tarafindan sunulur; onay sonrasi siparisin otomatik olusur.</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="checkout-grid__aside">
            <div className="admin-card">
              <div className="admin-card__head">
                <h2>Siparis Ozeti</h2>
                <p>{itemCount} urun</p>
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
                {submitting ? 'Odeme Hazirlaniyor...' : 'Guvenli Odemeye Gec'}
              </Button>
              {!formReady ? <p className="admin-field-hint">Devam icin teslimat bilgilerini tamamla.</p> : null}
            </div>
          </aside>
        </form>
      </div>
    </section>
  );
}
