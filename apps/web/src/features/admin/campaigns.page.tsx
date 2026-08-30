import { Button, EmptyState, InputField, TextareaField } from '@bora/ui';
import { PRODUCT_MEDIA_IMAGE_MIME_TYPES, type Campaign } from '@bora/types';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';

interface CampaignDraft {
  title: string;
  badge: string;
  description: string;
  linkUrl: string;
  imageUrl: string;
  sortOrder: string;
}

const emptyDraft: CampaignDraft = { title: '', badge: '', description: '', linkUrl: '', imageUrl: '', sortOrder: '0' };

export function AdminCampaignsPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [draft, setDraft] = useState<CampaignDraft>(emptyDraft);
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
        reader.onerror = () => reject(new Error('Dosya okunamadi.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await api.uploadAdminMedia(token, { kind: 'image', fileName: file.name, mimeType: file.type, base64 });
      setDraft((v) => ({ ...v, imageUrl: uploaded.url }));
      showToast({ tone: 'success', title: 'Gorsel yuklendi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Yukleme basarisiz', description: (error as Error).message });
    } finally {
      setImageUploading(false);
    }
  }

  async function loadCampaigns() {
    if (!token) return;
    const items = await api.listAdminCampaigns(token).catch(() => [] as Campaign[]);
    setCampaigns(items);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadCampaigns());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function startEdit(campaign: Campaign) {
    setEditingId(campaign.id);
    setDraft({
      title: campaign.title,
      badge: campaign.badge ?? '',
      description: campaign.description ?? '',
      linkUrl: campaign.linkUrl ?? '',
      imageUrl: campaign.imageUrl ?? '',
      sortOrder: String(campaign.sortOrder),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy || !draft.title.trim()) return;

    setBusy(true);
    try {
      const payload = {
        title: draft.title.trim(),
        badge: draft.badge.trim() || null,
        description: draft.description.trim() || null,
        linkUrl: draft.linkUrl.trim() || null,
        imageUrl: draft.imageUrl.trim() || null,
        sortOrder: Number(draft.sortOrder) || 0,
      };

      if (editingId) {
        await api.updateAdminCampaign(token, editingId, payload);
      } else {
        await api.createAdminCampaign(token, payload);
      }

      setDraft(emptyDraft);
      setEditingId(null);
      await loadCampaigns();
      showToast({ tone: 'success', title: editingId ? 'Kampanya guncellendi' : 'Kampanya eklendi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kaydedilemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(campaign: Campaign) {
    if (!token) return;
    await api.updateAdminCampaign(token, campaign.id, { isActive: !campaign.isActive }).catch(() => undefined);
    await loadCampaigns();
  }

  async function handleDelete(campaign: Campaign) {
    if (!token) return;
    if (!window.confirm(`"${campaign.title}" kampanyasini silmek istediginize emin misiniz?`)) return;
    await api.deleteAdminCampaign(token, campaign.id).catch(() => undefined);
    await loadCampaigns();
    showToast({ tone: 'info', title: 'Kampanya silindi' });
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Kampanyalar</h1>
          <p>Ana sayfadaki kampanya slider'i buradan beslenir. Aktif olanlar vitrine cikar.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>{editingId ? 'Kampanyayi Duzenle' : 'Yeni Kampanya'}</h2>
        </div>
        <form className="admin-form-grid" onSubmit={handleSubmit}>
          <InputField label="Baslik" onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} value={draft.title} />
          <InputField label="Rozet (orn: %20'ye varan)" onChange={(e) => setDraft((v) => ({ ...v, badge: e.target.value }))} value={draft.badge} />
          <InputField label="Link (opsiyonel, /kategori/...)" onChange={(e) => setDraft((v) => ({ ...v, linkUrl: e.target.value }))} value={draft.linkUrl} />
          <div className="full">
            <InputField label="Arka plan gorseli URL (opsiyonel)" onChange={(e) => setDraft((v) => ({ ...v, imageUrl: e.target.value }))} value={draft.imageUrl} />
            <label className="media-tile__upload" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
              {imageUploading ? 'Yukleniyor...' : 'Gorsel Yukle (R2)'}
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
            {draft.imageUrl ? <img alt="Onizleme" src={draft.imageUrl} style={{ display: 'block', marginTop: '0.5rem', maxHeight: 90, borderRadius: 8 }} /> : null}
          </div>
          <InputField label="Sira" onChange={(e) => setDraft((v) => ({ ...v, sortOrder: e.target.value }))} type="number" value={draft.sortOrder} />
          <div className="full">
            <TextareaField label="Aciklama (opsiyonel)" onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))} value={draft.description} />
          </div>
          <div className="full auth-actions">
            <Button disabled={busy} type="submit">{editingId ? 'Guncelle' : 'Ekle'}</Button>
            {editingId ? (
              <Button onClick={() => { setEditingId(null); setDraft(emptyDraft); }} type="button" variant="ghost">
                Vazgec
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Kampanya Listesi</h2>
        </div>
        {campaigns.length === 0 ? (
          <EmptyState description="Henuz kampanya eklenmemis." title="Kampanya yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Baslik</th>
                  <th>Rozet</th>
                  <th style={{ textAlign: 'center' }}>Aktif</th>
                  <th style={{ textAlign: 'right' }}>Islemler</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <strong>{campaign.title}</strong>
                      {campaign.description ? <div className="text-muted">{campaign.description}</div> : null}
                    </td>
                    <td>{campaign.badge ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="admin-switch-wrap" onClick={() => void toggleActive(campaign)} type="button" aria-pressed={campaign.isActive}>
                        <span className={campaign.isActive ? 'order-badge order-badge--payment-paid' : 'order-badge'}>{campaign.isActive ? 'Aktif' : 'Pasif'}</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button onClick={() => startEdit(campaign)} variant="secondary">Duzenle</Button>
                        <Button onClick={() => void handleDelete(campaign)} variant="ghost">Sil</Button>
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
