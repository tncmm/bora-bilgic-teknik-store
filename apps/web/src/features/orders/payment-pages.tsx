import { Button, EmptyState } from '@bora/ui';
import { Link } from 'react-router-dom';

import { useI18n } from '../../app/providers/I18nProvider';

/**
 * PayTR redirects the shopper back here once the iframe flow finishes. The
 * order itself is created by the server-to-server callback, which can land a
 * few seconds after the redirect — so these pages only acknowledge; they
 * never confirm anything.
 */
export function PaymentSuccessPage() {
  const { language } = useI18n();

  return (
    <section className="page-section" style={{ paddingTop: '140px' }}>
      <div className="ui-shell">
        <div className="profile-card profile-card--full">
          <EmptyState
            description={
              language === 'tr'
                ? 'Ödemeniz alındı. Onay birkaç saniye içinde sunucumuza ulaşır ve siparişiniz otomatik oluşur; Siparişlerim sayfasında belirecektir.'
                : 'Your payment has been received. Confirmation reaches our server within a few seconds and your order is created automatically; it will appear under My Orders.'
            }
            title={language === 'tr' ? 'Ödeme Alındı' : 'Payment Received'}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/siparislerim">
              <Button>{language === 'tr' ? 'Siparişlerime Git' : 'Go to My Orders'}</Button>
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
