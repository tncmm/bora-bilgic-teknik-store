import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Test ortamı için zorunlu vendor/env değerleri. CI'da (GitHub Actions)
    // .env dosyası olmadığından env.ts import anında bu değerleri görmeli;
    // yoksa gerçek transport'ı kullanan SOAP client testleri 503 ile düşer.
    env: {
      YURTICI_KARGO_USERNAME: 'test-user',
      YURTICI_KARGO_PASSWORD: 'test-pass',
      YURTICI_KARGO_CUSTOMER_ID: '12345',
      YURTICI_KARGO_RETURN_FIELD_ID: '53',
    },
  },
});
