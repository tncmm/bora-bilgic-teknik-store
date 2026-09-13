import { Button, InputField } from '@bora/ui';
import type { SiteSettings } from '@bora/types';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';

/** Formda düzenlenen alanlar; boş string "kartı gizle" anlamına gelir. */
const EMPTY_SETTINGS: SiteSettings = {
  contactHeroTitle: '',
  contactHeroDescription: '',
  contactAddress: '',
  contactPhone: '',
  contactEmail: '',
  contactWhatsapp: '',
  contactMapUrl: '',
  contactHoursDays: '',
  contactHoursTime: '',
  contactRemoteNote: '',
  contactCorporateNote: '',
};

const FIELDS: Array<{ key: keyof SiteSettings; label: string; hint?: string; type?: 'text' | 'textarea' }> = [
  { key: 'contactHeroTitle', label: 'Sayfa Başlığı' },
  { key: 'contactHeroDescription', label: 'Sayfa Açıklaması', type: 'textarea' },
  { key: 'contactAddress', label: 'Adres', type: 'textarea' },
  { key: 'contactPhone', label: 'Telefon' },
  { key: 'contactEmail', label: 'E-posta' },
  { key: 'contactWhatsapp', label: 'WhatsApp Numarası', hint: 'Boşsa WhatsApp bağlantısı gizlenir (örn. +90 5xx...)' },
  { key: 'contactMapUrl', label: 'Harita Embed URL', hint: 'Google Maps iframe adresi; boşsa harita gizlenir' },
  { key: 'contactHoursDays', label: 'Çalışma Günleri' },
  { key: 'contactHoursTime', label: 'Çalışma Saatleri' },
  { key: 'contactRemoteNote', label: 'Uzaktan Destek Notu' },
  { key: 'contactCorporateNote', label: 'Kurumsal Satış Metni', type: 'textarea' },
];

export function AdminSiteSettingsPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [form, setForm] = useState<SiteSettings>(EMPTY_SETTINGS);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api
      .getAdminSiteSettings(token)
      .then((settings) => {
        setForm({ ...EMPTY_SETTINGS, ...settings });
        setLoadError(null);
      })
      .catch((error: Error) => {
        setLoadError(error.message);
        showToast({ tone: 'error', title: 'İletişim bilgileri yüklenemedi', description: error.message });
      });
  }, [token, showToast]);

  function updateField(key: keyof SiteSettings, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!token) return;

    setSaving(true);
    try {
      const saved = await api.updateAdminSiteSettings(token, form);
      setForm({ ...EMPTY_SETTINGS, ...saved });
      showToast({ tone: 'success', title: 'İletişim bilgileri kaydedildi', description: 'Değişiklikler /iletisim sayfasında yayında.' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kaydedilemedi', description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>İletişim Bilgileri</h1>
          <p>/iletisim sayfasındaki adres, telefon, e-posta, çalışma saatleri ve harita bilgilerini buradan yönetin. Boş bırakılan alanlar sayfada gizlenir.</p>
        </div>
      </div>

      {loadError ? (
        <div className="admin-card">
          <p>{loadError}</p>
          <Button onClick={() => window.location.reload()} type="button">
            Tekrar Dene
          </Button>
        </div>
      ) : (
        <div className="admin-card">
          <div className="admin-form-grid">
            {FIELDS.map((field) =>
              field.type === 'textarea' ? (
                <div className={field.key === 'contactAddress' ? 'full' : ''} key={field.key}>
                  <label className="admin-field">
                    <span>{field.label}</span>
                    <textarea
                      className="ui-textarea"
                      onChange={(event) => updateField(field.key, event.target.value)}
                      rows={field.key === 'contactAddress' ? 3 : 2}
                      value={form[field.key] ?? ''}
                    />
                    {field.hint ? <small>{field.hint}</small> : null}
                  </label>
                </div>
              ) : (
                <InputField
                  key={field.key}
                  label={field.label}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  value={form[field.key] ?? ''}
                />
              ),
            )}
          </div>
          <div className="admin-modal-actions">
            <Button disabled={saving} onClick={() => void handleSubmit()} type="button">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
