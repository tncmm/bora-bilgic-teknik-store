import { Button, InputField, TextareaField } from '@bora/ui';
import type { AddressPayload } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';

const emptyForm: AddressPayload = {
  title: '',
  line1: '',
  city: '',
  district: '',
  postalCode: '',
  country: 'Türkiye',
  phone: '',
};

export function AddressFormPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { addressId } = useParams();
  const isEdit = Boolean(addressId);
  const [form, setForm] = useState<AddressPayload>(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !addressId) return;

    void api
      .listAddresses(token)
      .then((items) => {
        const found = items.find((item) => item.id === addressId);
        if (found) {
          setForm({
            title: found.title,
            line1: found.line1,
            city: found.city,
            district: found.district,
            postalCode: found.postalCode,
            country: found.country,
            phone: found.phone,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [token, addressId]);

  if (!token) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;

    setSaving(true);
    try {
      if (isEdit && addressId) {
        await api.updateAddress(token, addressId, form);
      } else {
        await api.createAddress(token, form);
      }

      showToast({
        tone: 'success',
        title: isEdit ? 'Adres güncellendi' : 'Adres kaydedildi',
        description: 'Checkout ekranında tek tıkla seçilebilir.',
      });
      navigate('/profil/adresler');
    } catch (error) {
      showToast({ tone: 'error', title: 'Adres kaydedilemedi', description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell account-layout">
        <div className="admin-headline">
          <div>
            <h1>{isEdit ? 'Adresi Düzenle' : 'Yeni Adres'}</h1>
            <p>Teslimat bilgilerini kaydet; checkout anında tek tıkla seç.</p>
          </div>
          <div className="admin-headline__actions">
            <Link to="/profil/adresler">
              <Button variant="secondary">Vazgeç</Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-muted">Adres yükleniyor...</p>
        ) : (
          <div className="admin-card" style={{ maxWidth: 640 }}>
            <form className="admin-form-grid" onSubmit={handleSubmit}>
              <InputField label="Adres Başlığı (Ev, İş...)" onChange={(event) => setForm((v) => ({ ...v, title: event.target.value }))} required value={form.title} />
              <InputField label="Telefon" onChange={(event) => setForm((v) => ({ ...v, phone: event.target.value }))} required value={form.phone} />
              <InputField label="Şehir" onChange={(event) => setForm((v) => ({ ...v, city: event.target.value }))} required value={form.city} />
              <InputField label="İlçe" onChange={(event) => setForm((v) => ({ ...v, district: event.target.value }))} required value={form.district} />
              <InputField label="Posta Kodu (opsiyonel)" onChange={(event) => setForm((v) => ({ ...v, postalCode: event.target.value }))} value={form.postalCode} />
              <InputField label="Ülke" onChange={(event) => setForm((v) => ({ ...v, country: event.target.value }))} required value={form.country} />
              <div className="full">
                <TextareaField label="Açık Adres" onChange={(event) => setForm((v) => ({ ...v, line1: event.target.value }))} required value={form.line1} />
              </div>
              <div className="full auth-actions">
                <Button disabled={saving} type="submit">
                  {saving ? 'Kaydediliyor...' : isEdit ? 'Değişiklikleri Kaydet' : 'Adresi Kaydet'}
                </Button>
                <Link to="/profil/adresler">
                  <Button variant="secondary">Vazgeç</Button>
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
