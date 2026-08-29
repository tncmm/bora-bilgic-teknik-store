import { Button, EmptyState, InputField, SelectField, TextareaField, Badge } from '@bora/ui';
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

function validateMediaFile(file: File, kind: AdminUploadKind) {
  const allowedMimeTypes = kind === 'video' ? [...PRODUCT_MEDIA_VIDEO_MIME_TYPES] : [...PRODUCT_MEDIA_IMAGE_MIME_TYPES];
  const maxBytes =
    kind === 'video' ? PRODUCT_MEDIA_LIMITS.videoBytes : kind === 'poster' ? PRODUCT_MEDIA_LIMITS.posterBytes : PRODUCT_MEDIA_LIMITS.imageBytes;

  if (!allowedMimeTypes.includes(file.type as never)) {
    throw new Error(kind === 'video' ? 'Yalnizca MP4 veya WEBM yukleyebilirsiniz.' : 'Yalnizca JPG, PNG, WEBP veya AVIF yukleyebilirsiniz.');
  }

  if (file.size > maxBytes) {
    throw new Error(`Dosya ${formatMegabytes(maxBytes)} sinirini asamaz.`);
  }
}

async function readFileAsBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Dosya okunamadi.'));
    reader.readAsDataURL(file);
  });

  const [, base64 = ''] = dataUrl.split(',');
  return base64;
}

function parseSpecs(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(':');
      return { name: name.trim(), value: rest.join(':').trim() };
    })
    .filter((item) => item.name && item.value);
}

const emptyForm = (categoryId: string) => ({
  name: '',
  slug: '',
  categoryId,
  shortDescription: '',
  description: '',
  sku: '',
  badge: '',
  heroTag: '',
  price: '',
  stock: '1',
  isPublished: true,
  isPurchasable: true,
  media: [createEmptyMedia('image')] as AdminMediaDraft[],
  specsText: '',
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
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
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
        setForm({
          name: found.name,
          slug: found.slug,
          categoryId: found.categoryId,
          shortDescription: found.shortDescription,
          description: found.description,
          sku: found.sku,
          badge: found.badge ?? '',
          heroTag: found.heroTag ?? '',
          price: String(found.price),
          stock: String(found.stock),
          isPublished: found.isPublished,
          isPurchasable: found.isPurchasable,
          media:
            found.images.length > 0
              ? found.images.map((item) => ({
                  id: item.id,
                  url: item.url,
                  alt: item.alt,
                  isPrimary: item.isPrimary,
                  kind: item.kind,
                  thumbnailUrl: item.thumbnailUrl ?? '',
                  mimeType: item.mimeType ?? '',
                }))
              : [createEmptyMedia('image')],
          specsText: found.specs.map((spec) => `${spec.name}: ${spec.value}`).join('\n'),
        });
      }
    })().finally(() => setLoading(false));
  }, [token, productId]);

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

      return { ...value, media: remaining.length > 0 ? remaining : [createEmptyMedia('image')] };
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
          kind: uploadKind === 'video' ? 'video' : 'image',
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          thumbnailUrl: uploadKind === 'image' ? uploaded.url : media.thumbnailUrl,
          isPrimary: uploadKind === 'image' ? media.isPrimary : false,
        };
      });

      showToast({ tone: 'success', title: 'Medya yuklendi', description: 'Dosya Cloudflare R2 uzerine yuklendi.' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Yukleme basarisiz', description: (error as Error).message });
    } finally {
      setUploadingMediaId(null);
    }
  }

  function buildProductPayload() {
    const normalizedMedia = form.media
      .map((item) => ({ ...item, alt: item.alt.trim(), url: item.url.trim(), thumbnailUrl: item.thumbnailUrl?.trim() ?? '' }))
      .filter((item) => item.url);

    const images = normalizedMedia.filter((item) => item.kind === 'image');

    if (images.length === 0) {
      throw new Error('En az bir gorsel eklemelisiniz.');
    }

    if (normalizedMedia.some((item) => !item.alt)) {
      throw new Error('Tum medya kayitlari icin ALT metni zorunludur.');
    }

    if (normalizedMedia.some((item) => item.kind === 'video' && !item.thumbnailUrl)) {
      throw new Error('Her video icin poster gorseli zorunludur.');
    }

    const primaryId = images.find((item) => item.isPrimary)?.id ?? images[0]?.id;

    return {
      name: form.name,
      slug: form.slug,
      categoryId: form.categoryId,
      shortDescription: form.shortDescription,
      description: form.description,
      sku: form.sku,
      badge: form.badge || null,
      heroTag: form.heroTag || null,
      price: Number(form.price),
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
      specs: parseSpecs(form.specsText),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting) return;

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const payload = buildProductPayload();

      if (isEdit && productId) {
        await api.updateAdminProduct(token, productId, payload);
      } else {
        await api.createAdminProduct(token, payload);
      }

      showToast({
        tone: 'success',
        title: isEdit ? 'Urun guncellendi' : 'Urun olusturuldu',
        description: 'Degisiklikler katalogda hemen gorunur.',
      });
      navigate('/admin/urunler');
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
      }
      setFormError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <p className="text-muted" style={{ padding: '2rem 0' }}>
          Urun bilgileri yukleniyor...
        </p>
      </div>
    );
  }

  if (isEdit && !product) {
    return (
      <div className="admin-page">
        <EmptyState description="Bu urun artik mevcut degil veya baska bir hesaptan kaldirilmis olabilir." title="Urun bulunamadi" />
        <Link to="/admin/urunler">
          <Button variant="secondary">Urun Listesine Don</Button>
        </Link>
      </div>
    );
  }

  const descriptionFieldError = fieldErrors.description?.[0] ?? fieldErrors.images?.[0] ?? null;

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>{isEdit ? 'Urunu Duzenle' : 'Yeni Urun'}</h1>
          <p>{isEdit ? `${product?.name ?? ''} urununun bilgilerini guncelleyin.` : 'Yeni bir DJI urununu kataloga ekleyin.'}</p>
        </div>
        <div className="admin-headline__actions">
          <Link to="/admin/urunler">
            <Button variant="secondary">Vazgec</Button>
          </Link>
        </div>
      </div>

      <form className="admin-form-stack" onSubmit={handleSubmit}>
        <div className="admin-card">
          <div className="admin-card__head">
            <h2>Temel Bilgiler</h2>
            <p>Urunun vitrinde gorunecek adi, kategorisi ve fiyat bilgileri.</p>
          </div>
          <div className="admin-form-grid">
            <InputField label="Urun Adi" onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} value={form.name} />
            <InputField label="Slug" onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))} value={form.slug} />
            <SelectField label="Kategori" onChange={(event) => setForm((value) => ({ ...value, categoryId: event.target.value }))} value={form.categoryId}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            <InputField label="SKU" onChange={(event) => setForm((value) => ({ ...value, sku: event.target.value }))} value={form.sku} />
            <InputField label="Fiyat (TL)" onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} value={form.price} />
            <InputField label="Stok Adedi" onChange={(event) => setForm((value) => ({ ...value, stock: event.target.value }))} value={form.stock} />
            <InputField label="Rozet (opsiyonel)" onChange={(event) => setForm((value) => ({ ...value, badge: event.target.value }))} value={form.badge} />
            <InputField label="Hero Etiketi (opsiyonel)" onChange={(event) => setForm((value) => ({ ...value, heroTag: event.target.value }))} value={form.heroTag} />
            <div className="full">
              <InputField
                label="Kisa Aciklama"
                onChange={(event) => setForm((value) => ({ ...value, shortDescription: event.target.value }))}
                value={form.shortDescription}
              />
            </div>
            <div className="full">
              <TextareaField
                label="Detayli Aciklama"
                onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                value={form.description}
              />
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__head">
            <h2>Medya</h2>
            <p>
              Gorseller JPG/PNG/WEBP/AVIF (maks. {formatMegabytes(PRODUCT_MEDIA_LIMITS.imageBytes)}), videolar MP4/WEBM (maks.{' '}
              {formatMegabytes(PRODUCT_MEDIA_LIMITS.videoBytes)}). Birden fazla medya ekleyebilirsiniz.
            </p>
          </div>
          <div className="admin-media-stack">
            {form.media.map((media, index) => (
              <div className="admin-media-card" key={media.id}>
                <div className="admin-media-card__head">
                  <Badge>{media.kind === 'video' ? `Video ${index + 1}` : `Gorsel ${index + 1}`}</Badge>
                  <Button onClick={() => removeMedia(media.id)} type="button" variant="ghost">
                    Kaldir
                  </Button>
                </div>
                <div className="admin-form-grid">
                  {media.kind === 'image' ? (
                    <label className="admin-primary-toggle">
                      <input checked={media.isPrimary} onChange={() => setPrimaryImage(media.id)} type="radio" />
                      <span>Kapak gorseli olarak kullan</span>
                    </label>
                  ) : null}
                  <div className="full">
                    <InputField
                      label="Medya URL"
                      onChange={(event) => updateMedia(media.id, (value) => ({ ...value, url: event.target.value }))}
                      value={media.url}
                    />
                  </div>
                  {media.kind === 'video' ? (
                    <div className="full">
                      <InputField
                        label="Poster URL"
                        onChange={(event) => updateMedia(media.id, (value) => ({ ...value, thumbnailUrl: event.target.value }))}
                        value={media.thumbnailUrl ?? ''}
                      />
                    </div>
                  ) : null}
                  <div className="full">
                    <InputField
                      label="ALT Metni (erisebilirlik)"
                      onChange={(event) => updateMedia(media.id, (value) => ({ ...value, alt: event.target.value }))}
                      value={media.alt}
                    />
                  </div>
                  <div className="full admin-upload-grid">
                    <label className="admin-upload-field">
                      <span>{media.kind === 'video' ? 'Video Yukle' : 'Gorsel Yukle'}</span>
                      <input
                        accept={media.kind === 'video' ? PRODUCT_MEDIA_VIDEO_MIME_TYPES.join(',') : PRODUCT_MEDIA_IMAGE_MIME_TYPES.join(',')}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void handleMediaUpload(media.id, media.kind === 'video' ? 'video' : 'image', file);
                          event.currentTarget.value = '';
                        }}
                        type="file"
                      />
                      <small>
                        {media.kind === 'video'
                          ? `MP4 veya WEBM, maksimum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.videoBytes)}`
                          : `JPG, PNG, WEBP veya AVIF, maksimum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.imageBytes)}`}
                      </small>
                    </label>
                    {media.kind === 'video' ? (
                      <label className="admin-upload-field">
                        <span>Poster Yukle</span>
                        <input
                          accept={PRODUCT_MEDIA_IMAGE_MIME_TYPES.join(',')}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void handleMediaUpload(media.id, 'poster', file);
                            event.currentTarget.value = '';
                          }}
                          type="file"
                        />
                        <small>{`JPG, PNG, WEBP veya AVIF, maksimum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.posterBytes)}`}</small>
                      </label>
                    ) : null}
                  </div>
                  {uploadingMediaId === media.id ? <p className="text-muted full">Yukleme suruyor...</p> : null}
                </div>
              </div>
            ))}
            <div className="auth-actions">
              <Button onClick={() => addMedia('image')} type="button" variant="secondary">
                + Gorsel Ekle
              </Button>
              <Button onClick={() => addMedia('video')} type="button" variant="ghost">
                + Video Ekle
              </Button>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__head">
            <h2>Teknik Ozellikler</h2>
            <p>Her satira &quot;Ozellik: Deger&quot; formatinda bir teknik ozellik yazin.</p>
          </div>
          <TextareaField
            label={'Ornek:\nSensor: 1 inch CMOS\nVideo: 4K/120fps'}
            onChange={(event) => setForm((value) => ({ ...value, specsText: event.target.value }))}
            value={form.specsText}
          />
        </div>

        <div className="admin-card">
          <div className="admin-card__head">
            <h2>Yayin Durumu</h2>
            <p>Urunun magazada nasil gorunecegini belirleyin.</p>
          </div>
          <div className="admin-toggle-row">
            <label className="admin-primary-toggle">
              <input checked={form.isPublished} onChange={(event) => setForm((value) => ({ ...value, isPublished: event.target.checked }))} type="checkbox" />
              <span>Vitrinde yayinda</span>
            </label>
            <label className="admin-primary-toggle">
              <input checked={form.isPurchasable} onChange={(event) => setForm((value) => ({ ...value, isPurchasable: event.target.checked }))} type="checkbox" />
              <span>Satin alinabilir (kapaliysa teklif modunda gorunur)</span>
            </label>
          </div>
        </div>

        {descriptionFieldError ? <p className="form-feedback form-feedback--error">{descriptionFieldError}</p> : null}
        {formError && !descriptionFieldError ? <p className="form-feedback form-feedback--error">{formError}</p> : null}

        <div className="auth-actions">
          <Button disabled={submitting} type="submit">
            {submitting ? 'Kaydediliyor...' : isEdit ? 'Degisiklikleri Kaydet' : 'Urunu Olustur'}
          </Button>
          <Link to="/admin/urunler">
            <Button variant="secondary">Vazgec</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
