import { describe, expect, it, vi } from 'vitest';

const maintenanceState = { on: false };

vi.mock('../modules/site-settings/site-settings.service.js', () => ({
  SiteSettingsService: class {
    isMaintenanceMode() {
      return Promise.resolve(maintenanceState.on);
    }
  },
}));

import { maintenanceGate } from './maintenance.js';

/** Gate'i sahte req/res ile calistirir; next'in cagrildigini/503 dondugunu soyler. */
function runGate(path: string) {
  return new Promise<{ forwarded: boolean; status?: number }>((resolve) => {
    const req = { path } as never;
    const res = {
      status(code: number) {
        return { json: () => resolve({ forwarded: false, status: code }) };
      },
    } as never;
    const next = () => resolve({ forwarded: true });
    void maintenanceGate(req, res, next);
  });
}

describe('maintenanceGate', () => {
  it('bakim modu kapaliyken her istegi gecirir', async () => {
    maintenanceState.on = false;
    expect(await runGate('/products')).toEqual({ forwarded: true });
  });

  it('bakim modunda musteriye donuk yollar 503 alir', async () => {
    maintenanceState.on = true;
    expect(await runGate('/products')).toEqual({ forwarded: false, status: 503 });
    expect(await runGate('/cart')).toEqual({ forwarded: false, status: 503 });
  });

  it('bakim modunda bile muaf yollar calisir — odeme bildirimi dahil', async () => {
    maintenanceState.on = true;
    expect(await runGate('/payments/paytr/callback')).toEqual({ forwarded: true });
    expect(await runGate('/payments/paytr/callback/')).toEqual({ forwarded: true });
    expect(await runGate('/admin/orders')).toEqual({ forwarded: true });
    expect(await runGate('/auth/login')).toEqual({ forwarded: true });
    expect(await runGate('/contact-info')).toEqual({ forwarded: true });
    expect(await runGate('/site-status')).toEqual({ forwarded: true });
  });

  it('benzer ama muaf olmayan yollar korunur (prefix bypass yok)', async () => {
    maintenanceState.on = true;
    // "/adminx" /auth ile baslamayan ama "/auth..." iceren tuzak yollar
    expect(await runGate('/payments/paytr/status/XYZ')).toEqual({ forwarded: false, status: 503 });
  });
});
