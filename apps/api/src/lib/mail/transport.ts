import nodemailer from 'nodemailer';

import { env } from '../../config/env.js';

let transporter: nodemailer.Transporter | null = null;

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Resend (https://resend.com) uzerinden gonderim: HTTPS 443 API cagrisi ile
 * calisir; SMTP portlari engellenmis aglarda bile mail gidebilir. Alan adi
 * Resend panelinde dogrulanir (SPF+DKIM), spam deliverability SMTP+freemail
 * kombinasyonundan belirgin olarak iyidir.
 */
async function sendViaResend(options: MailOptions): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.SMTP_FROM ?? 'Bora Bilgiç Teknik <onboarding@resend.dev>',
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend API hatasi (HTTP ${response.status}). ${detail.slice(0, 200)}`);
  }
}

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export function isMailConfigured(): boolean {
  if (env.MAIL_PROVIDER === 'resend') {
    return Boolean(env.RESEND_API_KEY);
  }
  return getTransporter() !== null;
}

export async function sendMail(options: MailOptions): Promise<void> {
  if (env.MAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY) {
      console.log('[MAIL] MAIL_PROVIDER=resend ama RESEND_API_KEY bos — mail loga dusuyor.');
      logMail(options);
      return;
    }
    await sendViaResend(options);
    return;
  }

  const transport = getTransporter();

  if (!transport) {
    logMail(options);
    return;
  }

  await transport.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

/** Saglayici tanimli degilken mailleri kaybolmasin diye console'a yazar. */
function logMail(options: MailOptions) {
  console.log('[MAIL] Mail saglayicisi tanimli degil — mail loga dusuyor.');
  console.log(`[MAIL] To: ${options.to}`);
  console.log(`[MAIL] Subject: ${options.subject}`);
  console.log(`[MAIL] Body (text):\n${options.text}`);
}
