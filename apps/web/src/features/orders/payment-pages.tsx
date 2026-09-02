import { Button, EmptyState } from '@bora/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { ApiError, api } from '../../shared/api/client';

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2500;

function useMerchantOid() {
  const [searchParams] = useSearchParams();
  return useMemo(() => searchParams.get('merchant_oid') ?? window.sessionStorage.getItem('bora-pending-merchant-oid'), [searchParams]);
}

export function PaymentSuccessPage() {
  const { token, isAuthenticated } = useSession();
  const navigate = useNavigate();
  const merchantOid = useMerchantOid();
  const [message, setMessage] = useState('Ödeme onayı bekleniyor; siparişiniz birkaç saniye içinde hazırlanacak.');
  const [timedOut, setTimedOut] = useState(() => !merchantOid);
  const [trackingUrl] = useState(() => window.sessionStorage.getItem('bora-pending-tracking-url'));
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!merchantOid || timedOut) return;

    let cancelled = false;
    let attempts = 0;
    const trackingToken = window.sessionStorage.getItem('bora-pending-tracking-token');
    const oid = merchantOid;

    async function poll() {
      if (cancelled) return;
      attempts += 1;
      try {
        const status = await api.getPaymentStatus(oid, token, trackingToken);
        if (cancelled) return;

        if (status.status === 'completed') {
          window.sessionStorage.removeItem('bora-pending-merchant-oid');
          window.sessionStorage.removeItem('bora-pending-tracking-token');
          window.sessionStorage.removeItem('bora-pending-tracking-url');
          window.localStorage.removeItem('bora-guest-cart');
          if (isAuthenticated && status.orderId) {
            navigate(`/siparislerim/${status.orderId}`, { replace: true, state: { justPlaced: true } });
            return;
          }
          navigate(trackingUrl ?? status.trackingUrl ?? '/', { replace: true });
          return;
        }

        if (status.status === 'failed' || status.status === 'expired') {
          navigate('/odeme/basarisiz', { replace: true });
          return;
        }

        setMessage('Ödeme alındı; PayTR onayı bekleniyor. Bu genelde birkaç saniye sürer.');
      } catch (error) {
        if (!cancelled) {
          // Eski oturumlarda tracking token bulunmaz ve status çağrısı 404 döner; bunu zaman aşımı olarak ele al.
          if (!trackingToken || (error instanceof ApiError && error.status === 404)) {
            setTimedOut(true);
            return;
          }
          setMessage((error as Error).message);
          return;
        }
      }

      if (!cancelled) {
        if (attempts < MAX_POLL_ATTEMPTS) {
          timeoutRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setTimedOut(true);
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isAuthenticated, merchantOid, navigate, timedOut, token, trackingUrl]);

  if (timedOut) {
    return (
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          <div className="profile-card profile-card--full">
            <EmptyState
              description="Ödemenin sonucunu şu anda doğrulayamadık. Banka ekstrenizden ödemeyi kontrol edebilirsiniz; ödemeniz tamamlandıysa siparişiniz kısa süre içinde takip linkinize düşer. Sorun sürerse sepetiniz korunur, ödemeyi tekrar deneyebilirsiniz."
              title="Ödeme sonucu doğrulanamadı"
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
              <Link to={trackingUrl ?? '/'}>
                <Button>{trackingUrl ? 'Sipariş Takibine Git' : 'Ana Sayfaya Dön'}</Button>
              </Link>
              <Link to="/sepet">
                <Button variant="secondary">Sepete Dön ve Tekrar Dene</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState description={message} title="Ödeme Alındı" />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to={isAuthenticated ? '/siparislerim' : '/'}>
              <Button>{isAuthenticated ? 'Siparişlerime Git' : 'Ana Sayfaya Dön'}</Button>
            </Link>
            <Link to="/katalog">
              <Button variant="secondary">Alışverişe Devam Et</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PaymentFailPage() {
  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState
            description="Ödeme tamamlanamadı. Sepetiniz aynen duruyor ve stok rezervi kaldırıldı; dilediğinizde yeniden deneyebilirsiniz."
            title="Ödeme Tamamlanamadı"
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/sepet">
              <Button>Sepete Dön ve Tekrar Dene</Button>
            </Link>
            <Link to="/katalog">
              <Button variant="secondary">Alışverişe Dön</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
