import { Button, EmptyState, InputField, SelectField, TextareaField } from '@bora/ui';
import {
  PRODUCT_MEDIA_IMAGE_MIME_TYPES,
  PRODUCT_MEDIA_LIMITS,
  PRODUCT_MEDIA_VIDEO_MIME_TYPES,
  type AdminUploadKind,
  type Category,
  type Product,
  type ProductMediaInput,
} from '@bora/types';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api, ApiError } from '../../shared/api/client';

interface AdminMediaDraft extends ProductMediaInput {
  id: string;
}

interface SpecDraft {
  id: string;
  name: string;
  value: string;
}

function createEmptyMedia(kind: 'image' | 'video' = 'image'): AdminMediaDraft {
  return {
    id: crypto.randomUUID(),
    url: '',
    alt: '',
    isPrimary: false,
    kind,
    thumbnailUrl: '',
    mimeType: '',
  };
}

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function validateMediaFile(file: File, kind: AdminUploadKind) {
  const allowedMimeTypes = kind === 'video' ? [...PRODUCT_MEDIA_VIDEO_MIME_TYPES] : [...PRODUCT_MEDIA_IMAGE_MIME_TYPES];
  const maxBytes =
    kind === 'video' ? PRODUCT_MEDIA_LIMITS.videoBytes : kind === 'poster' ? PRODUCT_MEDIA_LIMITS.posterBytes : PRODUCT_MEDIA_LIMITS.imageBytes;

  if (!allowedMimeTypes.includes(file.type as never)) {
    throw new Error(kind === 'video' ? 'Yalnızca MP4 veya WEBM yükleyebilirsiniz.' : 'Yalnızca JPG, PNG, WEBP veya AVIF yükleyebilirsiniz.');
  }

  if (file.size > maxBytes) {
    throw new Error(`Dosya ${formatMegabytes(maxBytes)} sınırını aşamaz.`);
  }
}

async function readFileAsBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });

  const [, base64 = ''] = dataUrl.split(',');
  return base64;
}

const emptyForm = (categoryId: string) => ({
  name: '',
  brand: 'DJI',
  slug: '',
  categoryId,
  shortDescription: '',
  description: '',
  sku: '',
  badge: '',
  heroTag: '',
  price: '',
  discountPercent: '0',
  stock: '1',
  isPublished: true,
  isPurchasable: true,
  media: [] as AdminMediaDraft[],
  specs: [{ id: crypto.randomUUID(), name: '', value: '' }] as SpecDraft[],
});

export function AdminProductFormPage() {
  const { productId } = useParams();
  const { token } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [form, setForm] = useState(emptyForm(''));
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingMediaId, setUploadingMediaId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(productId);

  useEffect(() => {
    if (!token) return;

    void (async () => {
      const nextCategories = await api.getAdminCategories(token).catch(() => [] as Category[]);
      setCategories(nextCategories);

      if (!productId) {
        setForm((value) => ({ ...value, categoryId: value.categoryId || nextCategories[0]?.id || '' }));
        return;
      }

      const products = await api.getAdminProducts(token).catch(() => [] as Product[]);
      const found = products.find((item) => item.id === productId) ?? null;
      setProduct(found);
      if (found) {
        setSlugTouched(true);
        setForm({
          name: found.name,
          slug: found.slug,
          brand: found.brand,
          categoryId: found.categoryId,
          shortDescription: found.shortDescription,
          description: found.description,
          sku: found.sku,
          badge: found.badge ?? '',
          heroTag: found.heroTag ?? '',
          price: String(found.price),
          discountPercent: String(found.discountPercent ?? 0),
          stock: String(found.stock),
          isPublished: found.isPublished,
          isPurchasable: found.isPurchasable,
          media: found.images.map((item) => ({
            id: item.id,
            url: item.url,
            alt: item.alt,
            isPrimary: item.isPrimary,
            kind: item.kind,
            thumbnailUrl: item.thumbnailUrl ?? '',
            mimeType: item.mimeType ?? '',
          })),
          specs:
            found.specs.length > 0
              ? found.specs.map((spec) => ({ id: spec.id, name: spec.name, value: spec.value }))
              : [{ id: crypto.randomUUID(), name: '', value: '' }],
        });
      }
    })().finally(() => setLoading(false));
  }, [token, productId]);

  function handleNameChange(nextName: string) {
    setForm((value) => ({
      ...value,
      name: nextName,
      slug: slugTouched ? value.slug : slugify(nextName),
    }));
  }

  function updateMedia(mediaId: string, updater: (media: AdminMediaDraft) => AdminMediaDraft) {
    setForm((value) => ({
      ...value,
      media: value.media.map((item) => (item.id === mediaId ? updater(item) : item)),
    }));
  }

  function setPrimaryImage(mediaId: string) {
    setForm((value) => ({
      ...value,
      media: value.media.map((item) => ({ ...item, isPrimary: item.kind === 'image' && item.id === mediaId })),
    }));
  }

  function addMedia(kind: 'image' | 'video') {
    setForm((value) => ({ ...value, media: [...value.media, createEmptyMedia(kind)] }));
  }

  function removeMedia(mediaId: string) {
    setForm((value) => {
      const remaining = value.media.filter((item) => item.id !== mediaId);
      const images = remaining.filter((item) => item.kind === 'image');

      if (images.length > 0 && !images.some((item) => item.isPrimary)) {
        images[0].isPrimary = true;
      }

      return { ...value, media: remaining };
    });
  }

  async function handleMediaUpload(mediaId: string, uploadKind: AdminUploadKind, file: File) {
    if (!token) return;

    try {
      validateMediaFile(file, uploadKind);
      setUploadingMediaId(mediaId);
      const base64 = await readFileAsBase64(file);
      const uploaded = await api.uploadAdminMedia(token, { kind: uploadKind, fileName: file.name, mimeType: file.type, base64 });

      updateMedia(mediaId, (media) => {
        if (uploadKind === 'poster') {
          return { ...media, thumbnailUrl: uploaded.url };
        }

        return {
          ...media,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          thumbnailUrl: uploadKind === 'image' ? uploaded.url : media.thumbnailUrl,
        };
      });

      showToast({ tone: 'success', title: 'Medya yüklendi', description: 'Dosya Cloudflare R2 üzerine yüklendi.' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Yükleme başarısız', description: (error as Error).message });
    } finally {
      setUploadingMediaId(null);
    }
  }

  function updateSpec(specId: string, patch: Partial<SpecDraft>) {
    setForm((value) => ({
      ...value,
      specs: value.specs.map((spec) => (spec.id === specId ? { ...spec, ...patch } : spec)),
    }));
  }

  function addSpec() {
    setForm((value) => ({ ...value, specs: [...value.specs, { id: crypto.randomUUID(), name: '', value: '' }] }));
  }

  function removeSpec(specId: string) {
    setForm((value) => ({ ...value, specs: value.specs.filter((spec) => spec.id !== specId) }));
  }

  function buildProductPayload() {
    const normalizedMedia = form.media
      .map((item) => ({ ...item, alt: (item.alt ?? '').trim(), url: item.url.trim(), thumbnailUrl: item.thumbnailUrl?.trim() ?? '' }))
      .filter((item) => item.url);

    const images = normalizedMedia.filter((item) => item.kind === 'image');

    if (images.length === 0) {
      throw new Error('En az bir görsel eklemelisiniz (yükleyin veya URL yapıştırın).');
    }

    if (normalizedMedia.some((item) => item.kind === 'video' && !item.thumbnailUrl)) {
      throw new Error('Her video için bir poster görseli gereklidir.');
    }

    const specs = form.specs.filter((spec) => spec.name.trim() && spec.value.trim());

    if (specs.length === 0) {
      throw new Error('En az bir teknik özellik girin.');
    }

    const primaryId = images.find((item) => item.isPrimary)?.id ?? images[0]?.id;

    return {
      name: form.name,
      slug: form.slug,
      brand: form.brand || 'DJI',
      categoryId: form.categoryId,
      shortDescription: form.shortDescription,
      description: form.description,
      sku: form.sku,
      badge: form.badge || null,
      heroTag: form.heroTag || null,
      price: Number(form.price),
      discountPercent: Number(form.discountPercent) || 0,
      stock: Number(form.stock),
      isPublished: form.isPublished,
      isPurchasable: form.isPurchasable,
      images: normalizedMedia.map((item) => ({
        url: item.url,
        alt: item.alt || form.name,
        isPrimary: item.kind === 'image' && item.id === primaryId,
        kind: item.kind,
        thumbnailUrl: item.kind === 'video' ? item.thumbnailUrl || null : item.thumbnailUrl || item.url,
        mimeType: item.mimeType || null,
      })),
      specs: specs.map((spec) => ({ name: spec.name.trim(), value: spec.value.trim() })),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = buildProductPayload();

      if (isEdit && productId) {
        await api.updateAdminProduct(token, productId, payload);
      } else {
        await api.createAdminProduct(token, payload);
      }

      showToast({
        tone: 'success',
        title: isEdit ? 'Ürün güncellendi' : 'Ürün oluşturuldu',
        description: 'Değişiklikler katalogda hemen görünür.',
      });
      navigate('/admin/urunler');
    } catch (error) {
      const apiError = error instanceof ApiError && error.fieldErrors ? Object.values(error.fieldErrors).flat()[0] : null;
      setFormError(apiError ?? (error as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <p className="text-muted" style={{ padding: '2rem 0' }}>
          Ürün bilgileri yükleniyor...
        </p>
      </div>
    );
  }

  if (isEdit && !product) {
    return (
      <div className="admin-page">
        <EmptyState description="Bu ürün artık mevcut değil veya başka bir hesaptan kaldırılmış olabilir." title="Ürün bulunamadı" />
        <Link to="/admin/urunler">
          <Button variant="secondary">Ürün Listesine Dön</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>{isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h1>
          <p>{isEdit ? `${product?.name ?? ''} ürününün bilgilerini güncelleyin.` : 'Kataloga yeni ürün ekleyin.'}</p>
        </div>
      </div>

      {formError ? (
        <div className="admin-alert-error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="admin-editor" onSubmit={handleSubmit}>
        <div className="admin-editor__stack">
          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Temel Bilgiler</h2>
            </div>
            <div className="admin-form-grid">
              <div className="full">
                <InputField label="Ürün Adı" onChange={(event) => handleNameChange(event.target.value)} value={form.name} />
              </div>
              <div>
                <InputField
                  label="Slug (URL)"
                  onChange={(event) => {
                    setSlugTouched(true);
                    setForm((value) => ({ ...value, slug: event.target.value }));
                  }}
                  value={form.slug}
                />
                <p className="admin-field-hint">/urun/{form.slug || '...'} adresinde görünür; ada göre otomatik üretilir.</p>
              </div>
              <div>
                <InputField label="Marka" onChange={(event) => setForm((value) => ({ ...value, brand: event.target.value }))} value={form.brand} />
              </div>
              <div>
                <SelectField label="Kategori" onChange={(event) => setForm((value) => ({ ...value, categoryId: event.target.value }))} value={form.categoryId}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <InputField label="SKU" onChange={(event) => setForm((value) => ({ ...value, sku: event.target.value }))} value={form.sku} />
              </div>
              <div className="full admin-price-row">
                <div>
                  <InputField
                    label="Fiyat (TL)"
                    onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))}
                    step="0.01"
                    type="number"
                    value={form.price}
                  />
                </div>
                <div>
                  <InputField
                    label="Stok"
                    onChange={(event) => setForm((value) => ({ ...value, stock: event.target.value }))}
                    min="0"
                    type="number"
                    value={form.stock}
                  />
                </div>
                <div>
                  <InputField
                    label="İndirim (%)"
                    onChange={(event) => setForm((value) => ({ ...value, discountPercent: event.target.value }))}
                    min="0"
                    max="100"
                    type="number"
                    value={form.discountPercent}
                  />
                  {Number(form.discountPercent) > 0 && Number(form.price) > 0 ? (
                    <p className="admin-field-hint">
                      Efektif fiyat: {(Math.round(Number(form.price) * (100 - Number(form.discountPercent))) / 100).toFixed(2)} TL
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Açıklamalar</h2>
            </div>
            <div className="admin-form-grid">
              <div className="full">
                <InputField
                  label="Kısa Açıklama"
                  onChange={(event) => setForm((value) => ({ ...value, shortDescription: event.target.value }))}
                  value={form.shortDescription}
                />
                <p className="admin-field-hint">Katalog kartlarında görünen tek satırlık özet.</p>
              </div>
              <div className="full">
                <TextareaField
                  label="Detaylı Açıklama"
                  onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                  value={form.description}
                />
              </div>
              <div>
                <InputField label="Rozet (opsiyonel)" onChange={(event) => setForm((value) => ({ ...value, badge: event.target.value }))} placeholder="YENİ, ÇOK SATAN..." value={form.badge} />
              </div>
              <div>
                <InputField label="Hero Etiketi (opsiyonel)" onChange={(event) => setForm((value) => ({ ...value, heroTag: event.target.value }))} value={form.heroTag} />
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Medya</h2>
              <p>
                Görseller en fazla {formatMegabytes(PRODUCT_MEDIA_LIMITS.imageBytes)}, videolar {formatMegabytes(PRODUCT_MEDIA_LIMITS.videoBytes)}. İlk görsel kapaktır;
                yıldızla değiştirebilirsiniz.
              </p>
            </div>
            <div className="media-grid">
              {form.media.map((media) => (
                <div className="media-tile" key={media.id}>
                  <div className="media-tile__preview">
                    {media.kind === 'image' && media.url ? (
                      <img alt={form.name || 'Ürün görseli'} src={media.url} />
                    ) : media.kind === 'video' && media.thumbnailUrl ? (
                      <img alt="Video posteri" src={media.thumbnailUrl} />
                    ) : (
                      <span className="media-tile__placeholder">{media.kind === 'video' ? 'VIDEO' : 'Görsel yok'}</span>
                    )}
                    <button className="media-tile__remove" onClick={() => removeMedia(media.id)} type="button" aria-label="Medyayı kaldır">
                      ×
                    </button>
                    {media.kind === 'image' && media.url ? (
                      <button
                        className={['media-tile__cover', media.isPrimary ? 'is-active' : ''].filter(Boolean).join(' ')}
                        onClick={() => setPrimaryImage(media.id)}
                        title="Kapak görseli yap"
                        type="button"
                      >
                        ★
                      </button>
                    ) : null}
                  </div>
                  <div className="media-tile__body">
                    <input
                      className="ui-input media-tile__url"
                      onChange={(event) => updateMedia(media.id, (value) => ({ ...value, url: event.target.value }))}
                      placeholder={media.kind === 'video' ? 'Video URL veya yükleyin' : 'Görsel URL veya yükleyin'}
                      value={media.url}
                    />
                    <label className="media-tile__upload">
                      {uploadingMediaId === media.id ? 'Yükleniyor...' : media.kind === 'video' ? 'Video Yükle' : 'Görsel Yükle'}
                      <input
                        accept={media.kind === 'video' ? PRODUCT_MEDIA_VIDEO_MIME_TYPES.join(',') : PRODUCT_MEDIA_IMAGE_MIME_TYPES.join(',')}
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void handleMediaUpload(media.id, media.kind === 'video' ? 'video' : 'image', file);
                          event.currentTarget.value = '';
                        }}
                        type="file"
                      />
                    </label>
                  </div>
                  {media.kind === 'video' ? (
                    <div className="media-tile__body">
                      <input
                        className="ui-input media-tile__url"
                        onChange={(event) => updateMedia(media.id, (value) => ({ ...value, thumbnailUrl: event.target.value }))}
                        placeholder="Poster URL veya yükleyin"
                        value={media.thumbnailUrl ?? ''}
                      />
                      <label className="media-tile__upload media-tile__upload--soft">
                        Poster Yükle
                        <input
                          accept={PRODUCT_MEDIA_IMAGE_MIME_TYPES.join(',')}
                          hidden
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void handleMediaUpload(media.id, 'poster', file);
                            event.currentTarget.value = '';
                          }}
                          type="file"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="media-tile media-tile--add">
                <button className="media-tile__add" onClick={() => addMedia('image')} type="button">
                  + Görsel
                </button>
                <button className="media-tile__add" onClick={() => addMedia('video')} type="button">
                  + Video
                </button>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Teknik Özellikler</h2>
              <p>Satır satır "özellik / değer" çiftleri ekleyin (örneğin: Sensör / 1 inch CMOS).</p>
            </div>
            <div className="spec-list">
              {form.specs.map((spec) => (
                <div className="spec-row" key={spec.id}>
                  <input
                    className="ui-input"
                    onChange={(event) => updateSpec(spec.id, { name: event.target.value })}
                    placeholder="Özellik (Sensör)"
                    value={spec.name}
                  />
                  <input
                    className="ui-input"
                    onChange={(event) => updateSpec(spec.id, { value: event.target.value })}
                    placeholder="Değer (1 inch CMOS)"
                    value={spec.value}
                  />
                  <button className="spec-row__remove" onClick={() => removeSpec(spec.id)} type="button" aria-label="Özellik satırını sil">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <Button onClick={addSpec} style={{ marginTop: '0.75rem' }} type="button" variant="secondary">
              + Özellik Ekle
            </Button>
          </div>
        </div>

        <aside className="admin-editor__aside">
          <div className="admin-card">
            <div className="admin-card__head">
              <h2>Yayın</h2>
            </div>
            <label className="admin-switch-row">
              <input checked={form.isPublished} onChange={(event) => setForm((value) => ({ ...value, isPublished: event.target.checked }))} type="checkbox" />
              <span className="admin-switch" aria-hidden="true" />
              <span>
                <strong>Vitrinde yayında</strong>
                <small>Kapalıysa ürün katalogda hiç görünmez.</small>
              </span>
            </label>
            <label className="admin-switch-row">
              <input checked={form.isPurchasable} onChange={(event) => setForm((value) => ({ ...value, isPurchasable: event.target.checked }))} type="checkbox" />
              <span className="admin-switch" aria-hidden="true" />
              <span>
                <strong>Satın alınabilir</strong>
                <small>Kapalıysa ürün teklif modunda görünür, sepete eklenemez.</small>
              </span>
            </label>
          </div>

          <div className="admin-card admin-save-card">
            <Button disabled={submitting} style={{ width: '100%' }} type="submit">
              {submitting ? 'Kaydediliyor...' : isEdit ? 'Değişiklikleri Kaydet' : 'Ürünü Oluştur'}
            </Button>
            <Link to="/admin/urunler" style={{ width: '100%' }}>
              <Button style={{ width: '100%' }} variant="secondary">
                Vazgeç
              </Button>
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
