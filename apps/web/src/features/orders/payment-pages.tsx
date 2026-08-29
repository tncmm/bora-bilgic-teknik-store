import { Button, EmptyState } from '@bora/ui';
import { Link } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';

/**
 * PayTR redirects the shopper back here once the iframe flow finishes. The
 * definitive confirmation arrives via the server-to-server callback; these
 * pages only reflect what PayTR told the browser.
 */
export function PaymentSuccessPage() {
  const { language } = useI18n();
  const lastOrderId = sessionStorage.getItem('bora-last-order');

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState
            description={
              language === 'tr'
                ? 'PayTR odemenizi aldi. Onay saniyeler icinde sunucumuza ulasir ve siparisiniz isleme alinir. Siparis durumunu Siparislerim sayfasindan takip edebilirsiniz.'
                : 'PayTR has taken your payment. Confirmation reaches our server within seconds and your order moves into processing. You can follow the status on My Orders.'
            }
            title={language === 'tr' ? 'Odeme Alindi' : 'Payment Received'}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            {lastOrderId ? (
              <Link to={`/siparislerim/${lastOrderId}`}>
                <Button>{language === 'tr' ? 'Siparisi Goruntule' : 'View Order'}</Button>
              </Link>
            ) : null}
            <Link to="/siparislerim">
              <Button variant="secondary">{language === 'tr' ? 'Siparislerim' : 'My Orders'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PaymentFailPage() {
  const { language } = useI18n();
  const lastOrderId = sessionStorage.getItem('bora-last-order');

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState
            description={
              language === 'tr'
                ? 'Odeme tamamlanamadi. Yaklasik 30 dakika icinde siparis detay sayfasindan yeniden deneyebilirsiniz; sure dolarsa siparis otomatik iptal olur ve stok iade edilir.'
                : 'The payment could not be completed. You can retry from the order detail page within about 30 minutes; after that the order is cancelled automatically and stock is released.'
            }
            title={language === 'tr' ? 'Odeme Tamamlanamadi' : 'Payment Not Completed'}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            {lastOrderId ? (
              <Link to={`/siparislerim/${lastOrderId}`}>
                <Button>{language === 'tr' ? 'Odemeyi Yeniden Dene' : 'Retry Payment'}</Button>
              </Link>
            ) : null}
            <Link to="/katalog">
              <Button variant="secondary">{language === 'tr' ? 'Alisverise Don' : 'Back to Shopping'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
