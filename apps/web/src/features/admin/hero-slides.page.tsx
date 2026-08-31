import { Button, EmptyState, InputField } from '@bora/ui';
import type { HeroSlide } from '@bora/types';
import { PRODUCT_MEDIA_IMAGE_MIME_TYPES } from '@bora/types';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';

interface SlideDraft {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
}

const emptyDraft: SlideDraft = {
  title: '',
  subtitle: '',
  ctaText: '',
  ctaLink: '',
  imageUrl: '',
  sortOrder: '0',
  isActive: true,
};

export function AdminHeroSlidesPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [draft, setDraft] = useState<SlideDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  async function handleImageUpload(file: File) {
    if (!token) return;

    try {
      setImageUploading(true);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Dosya okunamadı.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await api.uploadAdminMedia(token, { kind: 'image', fileName: file.name, mimeType: file.type, base64 });
      setDraft((v) => ({ ...v, imageUrl: uploaded.url }));
      showToast({ tone: 'success', title: 'Görsel yüklendi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Yükleme başarısız', description: (error as Error).message });
    } finally {
      setImageUploading(false);
    }
  }

  async function loadSlides() {
    if (!token) return;
    const items = await api.listAdminHeroSlides(token).catch(() => [] as HeroSlide[]);
    setSlides(items);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadSlides());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function startEdit(slide: HeroSlide) {
    setEditingId(slide.id);
    setDraft({
      title: slide.title,
      subtitle: slide.subtitle ?? '',
      ctaText: slide.ctaText ?? '',
      ctaLink: slide.ctaLink ?? '',
      imageUrl: slide.imageUrl ?? '',
      sortOrder: String(slide.sortOrder),
      isActive: slide.isActive,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy || !draft.title.trim() || !draft.imageUrl.trim()) return;

    setBusy(true);
    try {
      const payload = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim() || null,
        ctaText: draft.ctaText.trim() || null,
        ctaLink: draft.ctaLink.trim() || null,
        imageUrl: draft.imageUrl.trim(),
        sortOrder: Number(draft.sortOrder) || 0,
        isActive: draft.isActive,
      };

      if (editingId) {
        await api.updateAdminHeroSlide(token, editingId, payload);
      } else {
        await api.createAdminHeroSlide(token, payload);
      }

      setDraft(emptyDraft);
      setEditingId(null);
      await loadSlides();
      showToast({ tone: 'success', title: editingId ? 'Slayt güncellendi' : 'Slayt eklendi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kaydedilemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(slide: HeroSlide) {
    if (!token) return;
    await api.updateAdminHeroSlide(token, slide.id, { isActive: !slide.isActive }).catch(() => undefined);
    await loadSlides();
  }

  async function handleDelete(slide: HeroSlide) {
    if (!token) return;
    if (!window.confirm(`"${slide.title}" slaytını silmek istediğinize emin misiniz?`)) return;
    await api.deleteAdminHeroSlide(token, slide.id).catch(() => undefined);
    await loadSlides();
    showToast({ tone: 'info', title: 'Slayt silindi' });
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Ana Görsel Yönetimi</h1>
          <p>Ana sayfadaki hero slider buradan yönetilir. Aktif slaytlar vitrine çıkar.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>{editingId ? 'Slaytı Düzenle' : 'Yeni Slayt'}</h2>
        </div>
        <form className="admin-form-grid" onSubmit={handleSubmit}>
          <InputField label="Başlık *" onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} value={draft.title} />
          <InputField label="Alt başlık" onChange={(e) => setDraft((v) => ({ ...v, subtitle: e.target.value }))} value={draft.subtitle} />
          <InputField label="CTA metni" onChange={(e) => setDraft((v) => ({ ...v, ctaText: e.target.value }))} value={draft.ctaText} />
          <InputField label="CTA link (/katalog, /kategori/drone...)" onChange={(e) => setDraft((v) => ({ ...v, ctaLink: e.target.value }))} value={draft.ctaLink} />
          <div className="full">
            <InputField label="Görsel URL *" onChange={(e) => setDraft((v) => ({ ...v, imageUrl: e.target.value }))} value={draft.imageUrl} />
            <label className="media-tile__upload" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
              {imageUploading ? 'Yükleniyor...' : 'Görsel Yükle (R2)'}
              <input
                accept={PRODUCT_MEDIA_IMAGE_MIME_TYPES.join(',')}
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void handleImageUpload(file);
                  event.currentTarget.value = '';
                }}
                type="file"
              />
            </label>
            {draft.imageUrl ? <img alt="Önizleme" src={draft.imageUrl} style={{ display: 'block', marginTop: '0.5rem', maxHeight: 90, borderRadius: 8 }} /> : null}
          </div>
          <InputField label="Sıra" onChange={(e) => setDraft((v) => ({ ...v, sortOrder: e.target.value }))} type="number" value={draft.sortOrder} />
          <label className="dji-check-row full" style={{ padding: '0.5rem 0' }}>
            <input checked={draft.isActive} onChange={(e) => setDraft((v) => ({ ...v, isActive: e.target.checked }))} type="checkbox" />
            <span>Aktif</span>
          </label>
          <div className="full auth-actions">
            <Button disabled={busy} type="submit">{editingId ? 'Güncelle' : 'Ekle'}</Button>
            {editingId ? (
              <Button onClick={() => { setEditingId(null); setDraft(emptyDraft); }} type="button" variant="ghost">
                Vazgeç
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Slayt Listesi</h2>
        </div>
        {slides.length === 0 ? (
          <EmptyState description="Henüz slayt eklenmemiş." title="Slayt yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Başlık</th>
                  <th>Alt Başlık</th>
                  <th>Sıra</th>
                  <th style={{ textAlign: 'center' }}>Aktif</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {slides.map((slide) => (
                  <tr key={slide.id}>
                    <td>
                      <strong>{slide.title}</strong>
                      {slide.ctaText ? <div className="text-muted">CTA: {slide.ctaText} → {slide.ctaLink}</div> : null}
                    </td>
                    <td>{slide.subtitle ?? '—'}</td>
                    <td>{slide.sortOrder}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="admin-switch-wrap" onClick={() => void toggleActive(slide)} type="button" aria-pressed={slide.isActive}>
                        <span className={slide.isActive ? 'order-badge order-badge--payment-paid' : 'order-badge'}>{slide.isActive ? 'Aktif' : 'Pasif'}</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button onClick={() => startEdit(slide)} variant="secondary">Düzenle</Button>
                        <Button onClick={() => void handleDelete(slide)} variant="ghost">Sil</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
