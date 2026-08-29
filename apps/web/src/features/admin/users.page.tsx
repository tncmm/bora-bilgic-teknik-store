import { EmptyState } from '@bora/ui';
import type { User } from '@bora/types';
import { useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';

export function AdminUsersPage() {
  const { token } = useSession();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.getAdminUsers(token).then(setUsers).catch(() => undefined);
  }, [token]);

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Kullanicilar</h1>
          <p>Kayitli tum musteri ve yonetici hesaplari.</p>
        </div>
      </div>

      <div className="admin-card">
        {users.length === 0 ? (
          <EmptyState description="Kayitli hesap bulunamadi." title="Kullanici yok" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Rol</th>
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
                    <td>
                      <span className={user.role === 'admin' ? 'order-badge order-badge--payment-paid' : 'order-badge'}>
                        {user.role === 'admin' ? 'Yonetici' : 'Musteri'}
                      </span>
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
