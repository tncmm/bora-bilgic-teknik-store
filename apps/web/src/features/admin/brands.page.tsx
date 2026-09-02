import { Button, EmptyState } from '@bora/ui';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api, type AdminBrand } from '../../shared/api/client';

export function AdminBrandsPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadBrands() {
    if (!token) return;
    try {
      const items = await api.getAdminBrands(token);
      setBrands(items);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
      showToast({ tone: 'error', title: 'Markalar yüklenemedi', description: (error as Error).message });
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadBrands());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate() {
    if (!token || busy || !brandName.trim()) return;

    setBusy(true);
    try {
      await api.createAdminBrand(token, { name: brandName.trim() });
      setBrandName('');
      await loadBrands();
      showToast({ tone: 'success', title: 'Marka eklendi', description: `${brandName.trim()} artık ürün formunda seçilebilir.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Marka eklenemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(from: string) {
    if (!token || busy || !newName.trim()) return;

    setBusy(true);
    try {
      await api.renameAdminBrand(token, { from, to: newName.trim() });
      setRenamingId(null);
      setNewName('');
      await loadBrands();
      showToast({ tone: 'success', title: 'Marka güncellendi', description: `${from} -> ${newName.trim()}` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Marka güncellenemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(name: string) {
    if (!token || busy) return;

    const confirmed = window.confirm(`${name} markası silinsin mi? Bu işlem yalnızca ürünü olmayan markalarda yapılabilir.`);
    if (!confirmed) return;

    setBusy(true);
    try {
      await api.deleteAdminBrand(token, name);
      await loadBrands();
      showToast({ tone: 'success', title: 'Marka silindi', description: name });
    } catch (error) {
      showToast({ tone: 'error', title: 'Marka silinemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Markalar</h1>
          <p>
            Markalar ürün kartlarındaki serbest metin alanından türer; burada listelenen her marka, o markayı taşıyan ürün
            sayısıyla birlikte gelir. Yeniden adlandırma tüm ürünlerde markayı değiştirir.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Yeni Marka</h2>
          <p>Buradan eklediğiniz marka, ürün formundaki marka önerileri içinde görünür.</p>
        </div>
        <div className="admin-inline-form">
          <input
            className="ui-input"
            onChange={(event) => setBrandName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Örn. DJI, GoPro, Insta360"
            value={brandName}
          />
          <Button disabled={busy || !brandName.trim()} onClick={() => void handleCreate()}>
            Marka Ekle
          </Button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Mevcut Markalar</h2>
          <p>Yeniden adlandırma o markayı taşıyan tüm ürünleri günceller. Ürünü olmayan markalar silinebilir.</p>
        </div>
        {loadError ? (
          <>
            <EmptyState description={loadError} title="Veriler yüklenemedi" />
            <div style={{ paddingBottom: '1.5rem', textAlign: 'center' }}>
              <Button onClick={() => void loadBrands()}>Tekrar Dene</Button>
            </div>
          </>
        ) : brands.length === 0 ? (
          <EmptyState description="Henüz ürün eklenmemiş." title="Marka yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Marka</th>
                  <th style={{ textAlign: 'center' }}>Ürün Sayısı</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((item) => (
                  <tr key={item.brand}>
                    {renamingId === item.brand ? (
                      <>
                        <td>
                          <input className="ui-input" onChange={(event) => setNewName(event.target.value)} value={newName} />
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.productCount}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="admin-table__actions" style={{ justifyContent: 'flex-end' }}>
                            <Button disabled={busy || !newName.trim()} onClick={() => void handleRename(item.brand)}>Kaydet</Button>
                            <Button onClick={() => setRenamingId(null)} variant="ghost">Vazgeç</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{item.brand}</strong></td>
                        <td style={{ textAlign: 'center' }}>{item.productCount}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Button onClick={() => { setRenamingId(item.brand); setNewName(item.brand); }} variant="secondary">
                            Yeniden Adlandır
                          </Button>
                          {item.productCount === 0 ? (
                            <Button disabled={busy} onClick={() => void handleDelete(item.brand)} variant="ghost">
                              Sil
                            </Button>
                          ) : null}
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
