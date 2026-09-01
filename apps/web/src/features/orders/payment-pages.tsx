import { Button, EmptyState } from '@bora/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { api } from '../../shared/api/client';

function useMerchantOid() {
  const [searchParams] = useSearchParams();
  return useMemo(() => searchParams.get('merchant_oid') ?? window.sessionStorage.getItem('bora-pending-merchant-oid'), [searchParams]);
}

export function PaymentSuccessPage() {
  const { language } = useI18n();
  const { token, isAuthenticated } = useSession();
  const navigate = useNavigate();
  const merchantOid = useMerchantOid();
  const [message, setMessage] = useState('Ödeme onayı bekleniyor; siparişiniz birkaç saniye içinde hazırlanacak.');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!merchantOid) return;

    let cancelled = false;
    let attempts = 0;
    const trackingUrl = window.sessionStorage.getItem('bora-pending-tracking-url');
    const oid = merchantOid;

    async function poll() {
      if (cancelled) return;
      attempts += 1;
      try {
        const status = await api.getPaymentStatus(oid, token);
        if (cancelled) return;

        if (status.status === 'completed') {
          window.sessionStorage.removeItem('bora-pending-merchant-oid');
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
          setMessage((error as Error).message);
          return;
        }
      }

      if (!cancelled && attempts < 20) {
        timeoutRef.current = window.setTimeout(poll, 2500);
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
  }, [isAuthenticated, merchantOid, navigate, token]);

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState description={message} title={language === 'tr' ? 'Ödeme Alındı' : 'Payment Received'} />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to={isAuthenticated ? '/siparislerim' : '/'}>
              <Button>{isAuthenticated ? 'Siparişlerime Git' : 'Ana Sayfaya Dön'}</Button>
            </Link>
            <Link to="/katalog">
              <Button variant="secondary">{language === 'tr' ? 'Alışverişe Devam Et' : 'Continue Shopping'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PaymentFailPage() {
  const { language } = useI18n();

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState
            description={
              language === 'tr'
                ? 'Ödeme tamamlanamadı. Sepetiniz aynen duruyor ve stok rezervi kaldırıldı; dilediğinizde yeniden deneyebilirsiniz.'
                : 'The payment could not be completed. Your cart is preserved and the stock reservation was released; you can retry whenever you like.'
            }
            title={language === 'tr' ? 'Ödeme Tamamlanamadı' : 'Payment Not Completed'}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/sepet">
              <Button>{language === 'tr' ? 'Sepete Dön ve Tekrar Dene' : 'Back to Cart and Retry'}</Button>
            </Link>
            <Link to="/katalog">
              <Button variant="secondary">{language === 'tr' ? 'Alışverişe Dön' : 'Back to Shopping'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
