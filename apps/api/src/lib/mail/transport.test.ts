import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mail transport saglayici secimi testleri. env.ts import aninda okunur;
 * her test, modulu taze import ederek istenen env kombinasyonunu kurar.
 */

const originalEnv = { ...process.env };

async function importTransport(envOverrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of ['MAIL_PROVIDER', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    delete process.env[key];
  }
  Object.assign(process.env, envOverrides);
  return import('./transport.js');
}

describe('mail transport — saglayici secimi', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it('MAIL_PROVIDER=resend iken Resend APIsinde dogru govde ile POST eder', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) =>
      new Response(JSON.stringify({ id: 'mail-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { sendMail, isMailConfigured } = await importTransport({
      MAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      SMTP_FROM: 'Bora Bilgiç Teknik <siparis@borabilgicteknik.com>',
    });

    expect(isMailConfigured()).toBe(true);
    await sendMail({ to: 'musteri@example.com', subject: 'Siparis', html: '<p>x</p>', text: 'x' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.resend.com/emails');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    const body = JSON.parse(String(init?.body));
    expect(body.from).toBe('Bora Bilgiç Teknik <siparis@borabilgicteknik.com>');
    expect(body.to).toEqual(['musteri@example.com']);
    expect(body.subject).toBe('Siparis');
  });

  it('Resend hatasini anlamlı mesajla iletir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"domain not verified"}', { status: 403 })),
    );

    const { sendMail } = await importTransport({
      MAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
    });

    await expect(
      sendMail({ to: 'musteri@example.com', subject: 's', html: '<p>x</p>', text: 'x' }),
    ).rejects.toThrow(/domain not verified/);
  });

  it('MAIL_PROVIDER=resend + key yokken mail console a dusup hicbir sey gondermez', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { sendMail, isMailConfigured } = await importTransport({
      MAIL_PROVIDER: 'resend',
      RESEND_API_KEY: undefined,
    });

    expect(isMailConfigured()).toBe(false);
    await sendMail({ to: 'musteri@example.com', subject: 's', html: '<p>x</p>', text: 'x' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });
});
