import { Button, EmptyState, InputField, SelectField, StatCard, TextareaField } from '@bora/ui';
import {
  PRODUCT_MEDIA_IMAGE_MIME_TYPES,
  PRODUCT_MEDIA_LIMITS,
  PRODUCT_MEDIA_VIDEO_MIME_TYPES,
  type AdminUploadKind,
  type Category,
  type Order,
  type Product,
  type ProductImage,
  type ProductMediaInput,
  type User,
} from '@bora/types';
import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateCategoryName, translateOrderStatus, translatePaymentStatus } from '../../shared/lib/i18n';

function parseSpecs(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(':');
      return {
        name: name.trim(),
        value: rest.join(':').trim(),
      };
    })
    .filter((item) => item.name && item.value);
}

interface AdminMediaDraft extends ProductMediaInput {
  id: string;
}

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
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

function buildMediaValidationMessage(language: 'tr' | 'en', kind: AdminUploadKind) {
  if (kind === 'video') {
    return language === 'tr' ? 'Yalnizca MP4 veya WEBM yukleyebilirsiniz' : 'Only MP4 or WEBM files are allowed';
  }

  return language === 'tr' ? 'Yalnizca JPG, PNG, WEBP veya AVIF yukleyebilirsiniz' : 'Only JPG, PNG, WEBP, or AVIF files are allowed';
}

function buildMediaSizeMessage(language: 'tr' | 'en', kind: AdminUploadKind) {
  if (kind === 'video') {
    return language === 'tr' ? 'Video boyutu 100 MB sinirini asamaz' : 'Video size cannot exceed 100 MB';
  }

  if (kind === 'poster') {
    return language === 'tr' ? 'Poster boyutu 3 MB sinirini asamaz' : 'Poster size cannot exceed 3 MB';
  }

  return language === 'tr' ? 'Gorsel boyutu 5 MB sinirini asamaz' : 'Image size cannot exceed 5 MB';
}

function validateMediaFile(file: File, kind: AdminUploadKind, language: 'tr' | 'en') {
  const allowedMimeTypes = kind === 'video' ? [...PRODUCT_MEDIA_VIDEO_MIME_TYPES] : [...PRODUCT_MEDIA_IMAGE_MIME_TYPES];
  const maxSize =
    kind === 'video' ? PRODUCT_MEDIA_LIMITS.videoBytes : kind === 'poster' ? PRODUCT_MEDIA_LIMITS.posterBytes : PRODUCT_MEDIA_LIMITS.imageBytes;

  if (!allowedMimeTypes.includes(file.type as never)) {
    throw new Error(buildMediaValidationMessage(language, kind));
  }

  if (file.size > maxSize) {
    throw new Error(buildMediaSizeMessage(language, kind));
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

export function AdminDashboardPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    newOrders: 0,
    activeInventory: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    if (!token) return;
    void api.getAdminDashboard(token).then(setMetrics).catch(() => undefined);
  }, [token]);

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Sistem Gorunumu' : 'System Overview'}</h1>
          <p>{language === 'tr' ? 'Bora Bilgic Teknik icin canli metrikler ve teknik operasyon ozeti.' : 'Live metrics and technical operations for Bora Bilgic Teknik.'}</p>
        </div>
        <div className="admin-headline__actions">
          <Button variant="secondary">{language === 'tr' ? 'Veriyi Disa Aktar' : 'Export Data'}</Button>
          <Button>+ {language === 'tr' ? 'Urun Ekle' : 'Add Product'}</Button>
        </div>
      </div>

      <div className="admin-grid">
        <StatCard hint={language === 'tr' ? 'Seed siparis verilerinden hesaplanir' : 'Calculated from seeded orders'} title={language === 'tr' ? 'Toplam Satis' : 'Total Sales'} value={formatCurrency(metrics.totalSales, language)} />
        <StatCard hint={language === 'tr' ? 'Beklemedeki siparisler' : 'Orders in pending state'} title={language === 'tr' ? 'Yeni Siparisler' : 'New Orders'} value={`${metrics.newOrders}`} />
        <StatCard hint={language === 'tr' ? 'Mevcut stok toplami' : 'Current total stock'} title={language === 'tr' ? 'Aktif Envanter' : 'Active Inventory'} value={`${metrics.activeInventory}`} />
        <StatCard hint={language === 'tr' ? 'Kritik stok esigi' : 'Critical stock threshold'} title={language === 'tr' ? 'Dusuk Stok Uyarilari' : 'Low Stock Alerts'} value={`${metrics.lowStockCount}`} />
      </div>

      <div className="admin-stat-grid">
        <div className="admin-panel admin-panel--chart">
          <h2>{language === 'tr' ? 'Satis Performansi' : 'Sales Performance'}</h2>
          <div className="bar-chart">
            <span style={{ height: '38%' }} />
            <span style={{ height: '62%' }} />
            <span style={{ height: '44%' }} />
            <span style={{ height: '78%' }} />
            <span className="is-active" style={{ height: '90%' }} />
            <span style={{ height: '28%' }} />
            <span style={{ height: '54%' }} />
          </div>
        </div>
        <div className="table-stack">
          <div className="admin-panel">
            <h2>{language === 'tr' ? 'Sunucu Durumu' : 'Server Status'}</h2>
            <p>{language === 'tr' ? 'Birincil Merkez: Istanbul' : 'Primary Hub: Istanbul'}</p>
            <p>{language === 'tr' ? 'Gecikme: 24ms' : 'Latency: 24ms'}</p>
          </div>
          <div className="admin-panel">
            <h2>{language === 'tr' ? 'Stok Uyarilari' : 'Stock Alerts'}</h2>
            <div className="mini-grid">
              <div>
                <div className="text-muted">DJI Inspire 3</div>
                <strong>{language === 'tr' ? 'Dusuk' : 'Low'}</strong>
              </div>
              <div>
                <div className="text-muted">DJI Matrice 400</div>
                <strong>{language === 'tr' ? 'Teklif' : 'Quote'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminProductsPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadingMediaId, setUploadingMediaId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    brand: 'DJI',
    categoryId: '',
    shortDescription: '',
    description: '',
    sku: '',
    badge: '',
    heroTag: '',
    price: '0',
    stock: '0',
    isPublished: true,
    isPurchasable: false,
    media: [createEmptyMedia('image')] as AdminMediaDraft[],
    specsText: 'Sensor: Full Frame\nFlight Time: 20 dakika',
  });

  async function loadData() {
    if (!token) return;
    const [nextProducts, nextCategories] = await Promise.all([
      api.getAdminProducts(token),
      api.getAdminCategories(token),
    ]);
    setProducts(nextProducts);
    setCategories(nextCategories);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [token]);

  useEffect(() => {
    if (!categories.length || form.categoryId) return;

    void Promise.resolve().then(() => {
      setForm((value) => ({ ...value, categoryId: categories[0]?.id ?? '' }));
    });
  }, [categories, form.categoryId]);

  const title = useMemo(
    () => (editingProduct ? (language === 'tr' ? 'Urunu Guncelle' : 'Update Product') : language === 'tr' ? 'Urun Ekle' : 'Add Product'),
    [editingProduct, language],
  );

  function resetForm() {
    setEditingProduct(null);
    setForm({
      name: '',
      slug: '',
      brand: 'DJI',
      categoryId: categories[0]?.id ?? '',
      shortDescription: '',
      description: '',
      sku: '',
      badge: '',
      heroTag: '',
      price: '0',
      stock: '0',
      isPublished: true,
      isPurchasable: false,
      media: [createEmptyMedia('image')],
      specsText: 'Sensor: Full Frame\nFlight Time: 20 dakika',
    });
    setFormError(null);
  }

  function fillForm(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      categoryId: product.categoryId,
      shortDescription: product.shortDescription,
      description: product.description,
      sku: product.sku,
      badge: product.badge ?? '',
      heroTag: product.heroTag ?? '',
      price: String(product.price),
      stock: String(product.stock),
      isPublished: product.isPublished,
      isPurchasable: product.isPurchasable,
      media:
        product.images.length > 0
          ? product.images.map((item) => ({
              id: item.id,
              url: item.url,
              alt: item.alt,
              isPrimary: item.isPrimary,
              kind: item.kind,
              thumbnailUrl: item.thumbnailUrl ?? '',
              mimeType: item.mimeType ?? '',
            }))
          : [createEmptyMedia('image')],
      specsText: product.specs.map((spec) => `${spec.name}: ${spec.value}`).join('\n'),
    });
    setFormError(null);
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
      media: value.media.map((item) => ({
        ...item,
        isPrimary: item.kind === 'image' && item.id === mediaId,
      })),
    }));
  }

  function addMedia(kind: 'image' | 'video') {
    setForm((value) => ({
      ...value,
      media: [...value.media, createEmptyMedia(kind)],
    }));
  }

  function removeMedia(mediaId: string) {
    setForm((value) => {
      const nextMedia = value.media.filter((item) => item.id !== mediaId);
      const remainingImages = nextMedia.filter((item) => item.kind === 'image');

      if (remainingImages.length > 0 && !remainingImages.some((item) => item.isPrimary)) {
        remainingImages[0].isPrimary = true;
      }

      return {
        ...value,
        media: nextMedia.length > 0 ? nextMedia : [createEmptyMedia('image')],
      };
    });
  }

  async function handleMediaUpload(mediaId: string, uploadKind: AdminUploadKind, file: File) {
    if (!token) return;

    try {
      validateMediaFile(file, uploadKind, language);
      setUploadingMediaId(mediaId);
      const base64 = await readFileAsBase64(file);
      const uploaded = await api.uploadAdminMedia(token, {
        kind: uploadKind,
        fileName: file.name,
        mimeType: file.type,
        base64,
      });

      updateMedia(mediaId, (media) => {
        if (uploadKind === 'poster') {
          return {
            ...media,
            thumbnailUrl: uploaded.url,
          };
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

      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Medya yuklendi' : 'Media uploaded',
        description: language === 'tr' ? 'Dosya Cloudflare R2 uzerine yuklendi.' : 'The file was uploaded to Cloudflare R2.',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: language === 'tr' ? 'Yukleme basarisiz' : 'Upload failed',
        description: (error as Error).message,
      });
    } finally {
      setUploadingMediaId(null);
    }
  }

  function buildProductPayload() {
    const normalizedMedia = form.media
      .map((item) => ({
        ...item,
        alt: item.alt.trim(),
        url: item.url.trim(),
        thumbnailUrl: item.thumbnailUrl?.trim() ?? '',
      }))
      .filter((item) => item.url);

    const imageMedia = normalizedMedia.filter((item) => item.kind === 'image');

    if (imageMedia.length === 0) {
      throw new Error(language === 'tr' ? 'En az bir gorsel medyasi eklemelisiniz.' : 'Add at least one image media item.');
    }

    if (normalizedMedia.some((item) => !item.alt)) {
      throw new Error(language === 'tr' ? 'Tum medya kayitlari icin ALT metni zorunludur.' : 'ALT text is required for every media item.');
    }

    const videoWithoutPoster = normalizedMedia.find((item) => item.kind === 'video' && !item.thumbnailUrl);
    if (videoWithoutPoster) {
      throw new Error(language === 'tr' ? 'Video icin poster gorseli zorunludur.' : 'Poster image is required for videos.');
    }

    const primaryImageId = imageMedia.find((item) => item.isPrimary)?.id ?? imageMedia[0]?.id;

    return {
      name: form.name,
      slug: form.slug,
      brand: form.brand,
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
        isPrimary: item.kind === 'image' && item.id === primaryImageId,
        kind: item.kind,
        thumbnailUrl: item.kind === 'video' ? item.thumbnailUrl || null : item.thumbnailUrl || item.url,
        mimeType: item.mimeType || null,
      })),
      specs: parseSpecs(form.specsText),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    try {
      setFormError(null);
      const payload = buildProductPayload();

      if (editingProduct) {
        await api.updateAdminProduct(token, editingProduct.id, payload);
      } else {
        await api.createAdminProduct(token, payload);
      }

      showToast({
        tone: 'success',
        title: language === 'tr' ? 'Urun kaydedildi' : 'Product saved',
        description: language === 'tr' ? 'Medya ve urun bilgileri guncellendi.' : 'The product and media information were updated.',
      });
      resetForm();
      await loadData();
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  const mediaGuide = [
    language === 'tr'
      ? `Gorsel: JPG, PNG, WEBP, AVIF - maksimum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.imageBytes)}`
      : `Image: JPG, PNG, WEBP, AVIF - maximum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.imageBytes)}`,
    language === 'tr'
      ? `Poster: JPG, PNG, WEBP, AVIF - maksimum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.posterBytes)}`
      : `Poster: JPG, PNG, WEBP, AVIF - maximum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.posterBytes)}`,
    language === 'tr'
      ? `Video: MP4, WEBM - maksimum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.videoBytes)}`
      : `Video: MP4, WEBM - maximum ${formatMegabytes(PRODUCT_MEDIA_LIMITS.videoBytes)}`,
  ];

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Urunleri Yonet' : 'Manage Products'}</h1>
          <p>{language === 'tr' ? 'Admin paneli yalnizca DJI katalogunu yonetir; marka sabitlenmistir.' : 'The admin panel manages only the DJI catalog; the brand is fixed.'}</p>
        </div>
      </div>

      <div className="admin-products-layout">
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>{language === 'tr' ? 'Urun' : 'Product'}</th>
                <th>{language === 'tr' ? 'Marka' : 'Brand'}</th>
                <th>{language === 'tr' ? 'Fiyat' : 'Price'}</th>
                <th>{language === 'tr' ? 'Durum' : 'Status'}</th>
                <th>{language === 'tr' ? 'Aksiyonlar' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <div className="text-muted">{product.shortDescription}</div>
                  </td>
                  <td>{product.brand}</td>
                  <td>{formatCurrency(product.price, language)}</td>
                  <td>{product.isPurchasable ? (language === 'tr' ? 'Satista' : 'Live') : language === 'tr' ? 'Sadece Tanitim' : 'Promo Only'}</td>
                  <td>
                    <div className="admin-table__actions">
                      <Button onClick={() => fillForm(product)} variant="secondary">
                        {language === 'tr' ? 'Duzenle' : 'Edit'}
                      </Button>
                      <Button
                        onClick={() => {
                          if (!token) return;
                          void api.updateSaleStatus(token, product.id, !product.isPurchasable).then(loadData);
                        }}
                        variant="ghost"
                      >
                        {product.isPurchasable ? (language === 'tr' ? 'Satisi Kapat' : 'Close Sale') : language === 'tr' ? 'Satisi Ac' : 'Open Sale'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="admin-panel" onSubmit={handleSubmit}>
          <div className="detail-chip">{title}</div>
          <div className="admin-form-grid">
            <InputField label={language === 'tr' ? 'Urun Adi' : 'Product Name'} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} value={form.name} />
            <InputField label="Slug" onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))} value={form.slug} />
            <InputField disabled label={language === 'tr' ? 'Marka' : 'Brand'} onChange={() => undefined} value={form.brand} />
            <SelectField
              label={language === 'tr' ? 'Kategori' : 'Category'}
              onChange={(event) => setForm((value) => ({ ...value, categoryId: event.target.value }))}
              value={form.categoryId}
            >
              <option value="">{language === 'tr' ? 'Seciniz' : 'Select'}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {translateCategoryName(language, category.slug, category.name)}
                </option>
              ))}
            </SelectField>
            <div className="full">
              <InputField
                label={language === 'tr' ? 'Kisa Aciklama' : 'Short Description'}
                onChange={(event) => setForm((value) => ({ ...value, shortDescription: event.target.value }))}
                value={form.shortDescription}
              />
            </div>
            <div className="full">
              <TextareaField
                label={language === 'tr' ? 'Detay Aciklama' : 'Detailed Description'}
                onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                value={form.description}
              />
            </div>
            <InputField label="SKU" onChange={(event) => setForm((value) => ({ ...value, sku: event.target.value }))} value={form.sku} />
            <InputField label="Badge" onChange={(event) => setForm((value) => ({ ...value, badge: event.target.value }))} value={form.badge} />
            <InputField label="Hero Tag" onChange={(event) => setForm((value) => ({ ...value, heroTag: event.target.value }))} value={form.heroTag} />
            <InputField label={language === 'tr' ? 'Fiyat' : 'Price'} onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} value={form.price} />
            <InputField label={language === 'tr' ? 'Stok' : 'Stock'} onChange={(event) => setForm((value) => ({ ...value, stock: event.target.value }))} value={form.stock} />
            <div className="full">
              <div className="admin-media-guide">
                <strong>{language === 'tr' ? 'Medya Yuku Kurallari' : 'Media Upload Rules'}</strong>
                {mediaGuide.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="full admin-media-stack">
              {form.media.map((media, index) => (
                <div className="admin-media-card" key={media.id}>
                  <div className="admin-media-card__head">
                    <strong>
                      {language === 'tr' ? 'Medya' : 'Media'} {index + 1}
                    </strong>
                    <div className="admin-table__actions">
                      <Button onClick={() => removeMedia(media.id)} type="button" variant="ghost">
                        {language === 'tr' ? 'Kaldir' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                  <div className="admin-form-grid">
                    <SelectField
                      label={language === 'tr' ? 'Tur' : 'Type'}
                      onChange={(event) =>
                        updateMedia(media.id, (value) => ({
                          ...value,
                          kind: event.target.value as ProductImage['kind'],
                          isPrimary: event.target.value === 'video' ? false : value.isPrimary,
                          thumbnailUrl: event.target.value === 'image' ? value.url : value.thumbnailUrl,
                        }))
                      }
                      value={media.kind}
                    >
                      <option value="image">{language === 'tr' ? 'Gorsel' : 'Image'}</option>
                      <option value="video">{language === 'tr' ? 'Video' : 'Video'}</option>
                    </SelectField>
                    <InputField
                      label={language === 'tr' ? 'ALT Metni' : 'ALT Text'}
                      onChange={(event) => updateMedia(media.id, (value) => ({ ...value, alt: event.target.value }))}
                      value={media.alt}
                    />
                    <div className="full">
                      <InputField
                        label={language === 'tr' ? 'Medya URL' : 'Media URL'}
                        onChange={(event) => updateMedia(media.id, (value) => ({ ...value, url: event.target.value }))}
                        value={media.url}
                      />
                    </div>
                    {media.kind === 'video' ? (
                      <div className="full">
                        <InputField
                          label={language === 'tr' ? 'Poster URL' : 'Poster URL'}
                          onChange={(event) => updateMedia(media.id, (value) => ({ ...value, thumbnailUrl: event.target.value }))}
                          value={media.thumbnailUrl ?? ''}
                        />
                      </div>
                    ) : null}
                    <div className="full admin-upload-grid">
                      <label className="admin-upload-field">
                        <span>{media.kind === 'video' ? (language === 'tr' ? 'Video Yukle' : 'Upload Video') : language === 'tr' ? 'Gorsel Yukle' : 'Upload Image'}</span>
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
                            ? language === 'tr'
                              ? 'MP4 veya WEBM, maksimum 100 MB'
                              : 'MP4 or WEBM, maximum 100 MB'
                            : language === 'tr'
                              ? 'JPG, PNG, WEBP veya AVIF, maksimum 5 MB'
                              : 'JPG, PNG, WEBP, or AVIF, maximum 5 MB'}
                        </small>
                      </label>
                      {media.kind === 'video' ? (
                        <label className="admin-upload-field">
                          <span>{language === 'tr' ? 'Poster Yukle' : 'Upload Poster'}</span>
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
                          <small>{language === 'tr' ? 'JPG, PNG, WEBP veya AVIF, maksimum 3 MB' : 'JPG, PNG, WEBP, or AVIF, maximum 3 MB'}</small>
                        </label>
                      ) : (
                        <label className="admin-primary-toggle">
                          <input checked={media.isPrimary} onChange={() => setPrimaryImage(media.id)} type="radio" />
                          <span>{language === 'tr' ? 'Birincil gorsel olarak kullan' : 'Use as primary image'}</span>
                        </label>
                      )}
                    </div>
                    {uploadingMediaId === media.id ? (
                      <div className="full">
                        <p className="text-muted">{language === 'tr' ? 'Yukleme suruyor...' : 'Upload in progress...'}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="auth-actions">
                <Button onClick={() => addMedia('image')} type="button" variant="secondary">
                  + {language === 'tr' ? 'Gorsel Ekle' : 'Add Image'}
                </Button>
                <Button onClick={() => addMedia('video')} type="button" variant="ghost">
                  + {language === 'tr' ? 'Video Ekle' : 'Add Video'}
                </Button>
              </div>
            </div>
            <div className="full">
              <TextareaField
                label="Specs"
                onChange={(event) => setForm((value) => ({ ...value, specsText: event.target.value }))}
                value={form.specsText}
              />
            </div>
          </div>
          <div className="auth-actions" style={{ marginTop: '1rem' }}>
            <label>
              <input
                checked={form.isPublished}
                onChange={(event) => setForm((value) => ({ ...value, isPublished: event.target.checked }))}
                type="checkbox"
              />{' '}
              {language === 'tr' ? 'Yayinda' : 'Published'}
            </label>
            <label>
              <input
                checked={form.isPurchasable}
                onChange={(event) => setForm((value) => ({ ...value, isPurchasable: event.target.checked }))}
                type="checkbox"
              />{' '}
              {language === 'tr' ? 'Satin Alinabilir' : 'Purchasable'}
            </label>
          </div>
          {formError ? <p className="form-feedback form-feedback--error">{formError}</p> : null}
          <Button style={{ marginTop: '1rem' }} type="submit">
            {editingProduct ? (language === 'tr' ? 'Guncelle' : 'Update') : language === 'tr' ? 'Olustur' : 'Create'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AdminOrdersPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [orders, setOrders] = useState<Array<Order & { customer: string; email: string }>>([]);

  async function loadOrders() {
    if (!token) return;
    const response = await api.getAdminOrders(token);
    setOrders(response);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadOrders());
  }, [token]);

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Son Siparisler' : 'Recent Orders'}</h1>
          <p>{language === 'tr' ? 'Seed siparisleri burada statu bazli goruntulenir ve guncellenebilir.' : 'Seeded orders are shown here by status and can be updated.'}</p>
        </div>
      </div>
      <div className="admin-table">
        {orders.length === 0 ? (
          <EmptyState description={language === 'tr' ? 'Henuz siparis kaydi bulunmuyor.' : 'There are no order records yet.'} title={language === 'tr' ? 'Siparis yok' : 'No orders'} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{language === 'tr' ? 'Siparis ID' : 'Order ID'}</th>
                <th>{language === 'tr' ? 'Musteri' : 'Client'}</th>
                <th>{language === 'tr' ? 'Tarih' : 'Date'}</th>
                <th>{language === 'tr' ? 'Durum' : 'Status'}</th>
                <th>{language === 'tr' ? 'Odeme' : 'Payment'}</th>
                <th>{language === 'tr' ? 'Tutar' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td>
                    <strong>{order.customer}</strong>
                    <div className="text-muted">{order.email}</div>
                  </td>
                  <td>{formatDate(order.createdAt, language)}</td>
                  <td>
                    <select
                      className="ui-select"
                      onChange={(event) => {
                        if (!token) return;
                        void api.updateAdminOrderStatus(token, order.id, event.target.value).then(loadOrders);
                      }}
                      value={order.status.toUpperCase()}
                    >
                      <option value="PENDING">{translateOrderStatus(language, 'pending')}</option>
                      <option value="PROCESSING">{translateOrderStatus(language, 'processing')}</option>
                      <option value="SHIPPED">{translateOrderStatus(language, 'shipped')}</option>
                      <option value="DELIVERED">{translateOrderStatus(language, 'delivered')}</option>
                    </select>
                  </td>
                  <td>
                    <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>
                      {translatePaymentStatus(language, order.paymentStatus)}
                    </span>
                  </td>
                  <td>
                    <strong>{formatCurrency(order.total, language)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { token } = useSession();
  const { language } = useI18n();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.getAdminUsers(token).then(setUsers).catch(() => undefined);
  }, [token]);

  return (
    <div>
      <div className="admin-headline">
        <div>
          <h1>{language === 'tr' ? 'Kullanicilari Yonet' : 'Manage Users'}</h1>
          <p>{language === 'tr' ? 'Seed hesaplari ile admin kullanici listesi bos gorunmez.' : 'Seed accounts keep the admin user list from appearing empty.'}</p>
        </div>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>{language === 'tr' ? 'Ad Soyad' : 'Full Name'}</th>
              <th>{language === 'tr' ? 'E-posta' : 'Email'}</th>
              <th>{language === 'tr' ? 'Rol' : 'Role'}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>
                    {user.firstName} {user.lastName}
                  </strong>
                </td>
                <td>{user.email}</td>
                <td>{language === 'tr' ? (user.role === 'admin' ? 'Yonetici' : 'Musteri') : user.role === 'admin' ? 'Admin' : 'Customer'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
