import { createApp } from './app.js';
import { env } from './config/env.js';
import { isR2Configured } from './lib/r2.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);

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
});
