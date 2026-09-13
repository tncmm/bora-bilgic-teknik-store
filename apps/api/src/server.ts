import dns from 'node:dns';

// VPS'te global IPv6 atanmış ama çıkış yolu çalışmıyor olabilir; Gmail gibi
// AAAA kaydı olan sunucular bu durumda zaman aşımına düşer. Giden tüm
// bağlantılar (SMTP, PayTR, Yurtiçi) IPv4'ü öncelesin.
dns.setDefaultResultOrder('ipv4first');

import { createApp } from './app.js';
import { env } from './config/env.js';
import { isR2Configured } from './lib/r2.js';
import { PaymentsService } from './modules/payments/payments.service.js';

const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  console.log(`API listening on http://${env.HOST}:${env.PORT}`);

  if (!isR2Configured()) {
    // Surface the gap at boot rather than as a failed upload later. Product
    // media upload is the only feature that depends on this, so the API is
    // still fully usable without it.
    console.warn(
      '[r2] Cloudflare R2 is not configured. Media upload will fail until ' +
        'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME ' +
        'and R2_PUBLIC_BASE_URL are set. See apps/api/.env.example.',
    );
  }

  // Abandoned guest checkouts must not lock stock forever: expire stale
  // payment attempts on a fixed interval. unref() keeps the timer from
  // holding the process open; failures are logged and retried next tick.
  const paymentsService = new PaymentsService();
  const staleAttemptSweeper = setInterval(() => {
    paymentsService.sweepStaleAttempts().catch((error) => {
      console.error('[PAYTR] Stale payment attempt sweep failed', { error });
    });
  }, env.SWEEP_INTERVAL_MINUTES * 60 * 1000);
  staleAttemptSweeper.unref();
});
