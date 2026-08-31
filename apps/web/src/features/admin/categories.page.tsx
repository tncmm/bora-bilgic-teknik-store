import { Button, EmptyState, InputField } from '@bora/ui';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api, type AdminCategory } from '../../shared/api/client';

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

export function AdminCategoriesPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', slug: '', sortOrder: '0' });
  const [busy, setBusy] = useState(false);

  async function loadCategories() {
    if (!token) return;
    const items = await api.getAdminCategories(token).catch(() => [] as AdminCategory[]);
    setCategories(items);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadCategories());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate() {
    if (!token || !newName.trim() || busy) return;

    setBusy(true);
    try {
      await api.createAdminCategory(token, { name: newName.trim(), slug: slugify(newName), sortOrder: categories.length + 1 });
      setNewName('');
      await loadCategories();
      showToast({ tone: 'success', title: 'Kategori eklendi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kategori eklenemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(category: AdminCategory) {
    setEditingId(category.id);
    setEditDraft({ name: category.name, slug: category.slug, sortOrder: String(category.sortOrder ?? 0) });
  }

  async function handleUpdate(categoryId: string) {
    if (!token || busy) return;

    setBusy(true);
    try {
      await api.updateAdminCategory(token, categoryId, {
        name: editDraft.name.trim(),
        slug: editDraft.slug.trim(),
        sortOrder: Number(editDraft.sortOrder) || 0,
      });
      setEditingId(null);
      await loadCategories();
      showToast({ tone: 'success', title: 'Kategori güncellendi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kategori güncellenemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(category: AdminCategory) {
    if (!token) return;
    if (!window.confirm(`"${category.name}" kategorisini silmek istediğinize emin misiniz?`)) return;

    try {
      await api.deleteAdminCategory(token, category.id);
      await loadCategories();
      showToast({ tone: 'success', title: 'Kategori silindi' });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Kategori silinemedi',
        description: (error as Error).message,
      });
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Kategoriler</h1>
          <p>Gereksiz kategori karmaşası olmadan, mağazanın kategori omurgasını buradan yönetin.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Yeni Kategori</h2>
        </div>
        <div className="spec-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto' }}>
          <InputField
            label="Kategori Adı"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Örneğin: Aksesuarlar"
            value={newName}
          />
          <div>
            <label className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              Slug (otomatik)
            </label>
            <code className="text-muted">/{slugify(newName) || '...'}</code>
          </div>
          <Button disabled={busy || !newName.trim()} onClick={() => void handleCreate()} style={{ alignSelf: 'end' }}>
            Ekle
          </Button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Mevcut Kategoriler</h2>
        </div>
        {categories.length === 0 ? (
          <EmptyState description="Henüz kategori eklenmemiş." title="Kategori yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Slug</th>
                  <th style={{ textAlign: 'center' }}>Ürün</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    {editingId === category.id ? (
                      <>
                        <td>
                          <input className="ui-input" onChange={(event) => setEditDraft((v) => ({ ...v, name: event.target.value }))} value={editDraft.name} />
                        </td>
                        <td>
                          <input className="ui-input" onChange={(event) => setEditDraft((v) => ({ ...v, slug: event.target.value }))} value={editDraft.slug} />
                        </td>
                        <td style={{ textAlign: 'center' }}>{category._count?.products ?? 0}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="admin-table__actions" style={{ justifyContent: 'flex-end' }}>
                            <Button disabled={busy} onClick={() => void handleUpdate(category.id)}>Kaydet</Button>
                            <Button onClick={() => setEditingId(null)} variant="ghost">Vazgeç</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{category.name}</strong></td>
                        <td><code className="text-muted">/{category.slug}</code></td>
                        <td style={{ textAlign: 'center' }}>{category._count?.products ?? 0}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="admin-table__actions" style={{ justifyContent: 'flex-end' }}>
                            <Button onClick={() => startEdit(category)} variant="secondary">Düzenle</Button>
                            <Button onClick={() => void handleDelete(category)} variant="ghost">Sil</Button>
                          </div>
                        </td>
                      </>
                    )}
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
