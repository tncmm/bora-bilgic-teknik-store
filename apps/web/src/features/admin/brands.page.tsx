import { Button, EmptyState } from '@bora/ui';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';

interface BrandSummary {
  brand: string;
  productCount: number;
}

export function AdminBrandsPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadBrands() {
    if (!token) return;
    const items = await api.getAdminBrands(token).catch(() => [] as BrandSummary[]);
    setBrands(items);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadBrands());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleRename(from: string) {
    if (!token || busy || !newName.trim()) return;

    setBusy(true);
    try {
      await api.renameAdminBrand(token, { from, to: newName.trim() });
      setRenamingId(null);
      setNewName('');
      await loadBrands();
      showToast({ tone: 'success', title: 'Marka guncellendi', description: `${from} -> ${newName.trim()}` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Marka guncellenemedi', description: (error as Error).message });
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
            Markalar urun kartlarindaki serbest metin alanindan turer; burada listelenen her marka, o markayi tasiyan urun
            sayisiyla birlikte gelir. Yeniden adlandirma tum urunlerde markayi degistirir.
          </p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2>Mevcut Markalar</h2>
          <p>Yeni marka eklemek icin yeni urun formunda Marka alanina istediginiz adi yazmaniz yeterlidir.</p>
        </div>
        {brands.length === 0 ? (
          <EmptyState description="Henuz urun eklenmemis." title="Marka yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Marka</th>
                  <th style={{ textAlign: 'center' }}>Urun Sayisi</th>
                  <th style={{ textAlign: 'right' }}>Islemler</th>
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
                            <Button onClick={() => setRenamingId(null)} variant="ghost">Vazgec</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{item.brand}</strong></td>
                        <td style={{ textAlign: 'center' }}>{item.productCount}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Button onClick={() => { setRenamingId(item.brand); setNewName(item.brand); }} variant="secondary">
                            Yeniden Adlandir
                          </Button>
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
