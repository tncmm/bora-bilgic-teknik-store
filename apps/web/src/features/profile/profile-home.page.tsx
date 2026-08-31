import { Button } from '@bora/ui';
import type { Address, Order } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';

const navCards = [
  {
    to: '/siparislerim',
    icon: 'package_2',
    title: 'Siparişlerim',
    description: 'Geçmiş ve aktif siparişlerini takip et',
  },
  {
    to: '/favoriler',
    icon: 'favorite',
    title: 'Favorilerim',
    description: 'Kaydettiğin ürünlere hızla dön',
  },
  {
    to: '/profil/adresler',
    icon: 'location_on',
    title: 'Adreslerim',
    description: 'Teslimat adreslerini yönet',
  },
];

export function ProfilePage() {
  const { user, isAdmin, token, favoritesCount, logout } = useSession();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.getMyOrders(token).then(setOrders).catch(() => undefined);
    void api.listAddresses(token).then(setAddresses).catch(() => undefined);
  }, [token]);

  if (!user || !token) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <div className="profile-card profile-card--full">
            <p className="text-muted">Profilini görmek için giriş yapmalısın.</p>
          </div>
        </div>
      </section>
    );
  }

  const initials = `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase();

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell account-layout">
        <div className="account-hero">
          <div className="account-hero__avatar">{initials}</div>
          <div className="account-hero__body">
            <h1>
              {user.firstName} {user.lastName}
            </h1>
            <p>
              {user.email} · {isAdmin ? 'Yönetici' : 'Müşteri'}
            </p>
          </div>
          <div className="auth-actions">
            {isAdmin ? (
              <Link to="/admin">
                <Button variant="secondary">Admin Paneli</Button>
              </Link>
            ) : null}
            <Button
              onClick={() => {
                logout();
                navigate('/');
              }}
              variant="ghost"
            >
              Çıkış Yap
            </Button>
          </div>
        </div>

        <div className="account-stats">
          <div className="account-stat">
            <strong>{orders.length}</strong>
            <span>Sipariş</span>
          </div>
          <div className="account-stat">
            <strong>{favoritesCount}</strong>
            <span>Favori</span>
          </div>
          <div className="account-stat">
            <strong>{addresses.length}</strong>
            <span>Adres</span>
          </div>
        </div>

        <div className="account-nav-grid">
          {navCards.map((card) => (
            <Link className="account-nav-card" key={card.to} to={card.to}>
              <span className="material-symbols-outlined account-nav-card__icon">{card.icon}</span>
              <div>
                <strong>{card.title}</strong>
                <p>{card.description}</p>
              </div>
              <span className="material-symbols-outlined account-nav-card__arrow">arrow_forward</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
