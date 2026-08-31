import { Button, EmptyState } from '@bora/ui';
import type { Address } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';

export function AddressesPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);

  async function loadAddresses() {
    if (!token) return;
    const items = await api.listAddresses(token).catch(() => [] as Address[]);
    setAddresses(items);
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadAddresses());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleDelete(address: Address) {
    if (!token) return;

    try {
      await api.deleteAddress(token, address.id);
      await loadAddresses();
      showToast({ tone: 'info', title: 'Adres silindi' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Adres silinemedi', description: (error as Error).message });
    }
  }

  if (!token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <EmptyState description="Adreslerini görmek için giriş yapmalısın." title="Giriş gerekli" />
        </div>
      </section>
    );
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell account-layout">
        <div className="admin-headline">
          <div>
            <h1>Adreslerim</h1>
            <p>Teslimat adreslerin burada durur; yeni adres ekleme ayrı ekrandadır.</p>
          </div>
          <div className="admin-headline__actions">
            <Link to="/profil/adresler/ekle">
              <Button>+ Yeni Adres</Button>
            </Link>
          </div>
        </div>

        {addresses.length === 0 ? (
          <div className="admin-card">
            <EmptyState description="İlk teslimat adresini ekleyerek checkout sürecini hızlandır." title="Kayıtlı adres yok" />
          </div>
        ) : (
          <div className="account-address-grid">
            {addresses.map((address) => (
              <article className="account-address-card" key={address.id}>
                <div className="account-address-card__head">
                  <strong>{address.title}</strong>
                  <span className="text-muted">{address.phone}</span>
                </div>
                <p>{address.line1}</p>
                <span className="text-muted">
                  {address.district} / {address.city}
                  {address.postalCode ? ` · ${address.postalCode}` : ''}
                </span>
                <div className="account-address-card__actions">
                  <Link to={`/profil/adresler/${address.id}/duzenle`}>
                    <Button variant="secondary">Düzenle</Button>
                  </Link>
                  <Button onClick={() => void handleDelete(address)} variant="ghost">
                    Sil
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
