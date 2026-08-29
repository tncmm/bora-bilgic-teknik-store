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
                ? 'Odemeniz alindi. Onay birkaç saniye icinde sunucumuza ulasir ve siparisiniz otomatik olusur; Siparislerim sayfasinda belirecektir.'
                : 'Your payment has been received. Confirmation reaches our server within a few seconds and your order is created automatically; it will appear under My Orders.'
            }
            title={language === 'tr' ? 'Odeme Alindi' : 'Payment Received'}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/siparislerim">
              <Button>{language === 'tr' ? 'Siparislerime Git' : 'Go to My Orders'}</Button>
            </Link>
            <Link to="/katalog">
              <Button variant="secondary">{language === 'tr' ? 'Alisverise Devam Et' : 'Continue Shopping'}</Button>
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
                ? 'Odeme tamamlanamadi. Sepetiniz aynen duruyor ve stok rezervi kaldirildi; dilediginizde yeniden deneyebilirsiniz.'
                : 'The payment could not be completed. Your cart is preserved and the stock reservation was released; you can retry whenever you like.'
            }
            title={language === 'tr' ? 'Odeme Tamamlanamadi' : 'Payment Not Completed'}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/sepet">
              <Button>{language === 'tr' ? 'Sepete Don ve Tekrar Dene' : 'Back to Cart and Retry'}</Button>
            </Link>
            <Link to="/katalog">
              <Button variant="secondary">{language === 'tr' ? 'Alisverise Don' : 'Back to Shopping'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
