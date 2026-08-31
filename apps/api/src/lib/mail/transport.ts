import nodemailer from 'nodemailer';

import { env } from '../../config/env.js';

let transporter: nodemailer.Transporter | null = null;

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
  return getTransporter() !== null;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    console.log('[MAIL] SMTP not configured — logging email instead.');
    console.log(`[MAIL] To: ${options.to}`);
    console.log(`[MAIL] Subject: ${options.subject}`);
    console.log(`[MAIL] Body (text):\n${options.text}`);
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
