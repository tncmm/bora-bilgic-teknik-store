import { useEffect } from 'react';

declare global {
  interface Window {
    iFrameResize?: (options: Record<string, unknown>, target: string) => void;
  }
}

/**
 * PayTR's secure payment iframe for a token issued by
 * POST /api/v1/payments/paytr/token. PayTR resizes it via their
 * iframeResizer helper, which is loaded on demand and removed on unmount.
 * When the payment finishes, PayTR navigates the top window to the
 * merchant_ok_url / merchant_fail_url configured server-side.
 */
export function PaytrIframe({ token }: { token: string }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://www.paytr.com/js/iframeResizer.min.js';
    script.onload = () => window.iFrameResize?.({ checkOrigin: false }, '#paytriframe');
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <iframe
      className="paytr-iframe"
      frameBorder={0}
      id="paytriframe"
      scrolling="no"
      src={`https://www.paytr.com/odeme/guvenli/${token}`}
      title="PayTR güvenli ödeme"
    />
  );
}
