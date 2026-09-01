import { env } from '../../config/env.js';

const BRAND = 'Bora Bilgiç';

function wrapEmail(content: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
<!-- Header -->
<tr><td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">${BRAND}</h1>
</td></tr>
<!-- Body -->
<tr><td style="padding:40px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 40px;background-color:#fafafa;text-align:center;border-top:1px solid #eee;">
<p style="margin:0;font-size:12px;color:#888;">&copy; ${new Date().getFullYear()} ${BRAND}. Tüm hakları saklıdır.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function verificationEmail(firstName: string, token: string) {
  const verifyUrl = `${env.WEB_URL}/dogrula?token=${token}`;

  const subject = `E-posta adresinizi doğrulayın — ${BRAND}`;

  const html = wrapEmail(`
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Merhaba ${escapeHtml(firstName)},</h2>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333;">
Hesabınızı oluşturduğunuz için teşekkür ederiz. E-posta adresinizi doğrulamak için aşağıdaki butona tıklayın.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background-color:#1a1a2e;border-radius:6px;">
<a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
E-postamı Doğrula
</a>
</td></tr>
</table>
<p style="margin:0 0 8px;font-size:13px;color:#666;">
Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza yapıştırabilirsiniz:
</p>
<p style="margin:0 0 16px;font-size:13px;color:#1a1a2e;word-break:break-all;">
<a href="${verifyUrl}" style="color:#1a1a2e;text-decoration:underline;">${verifyUrl}</a>
</p>
<p style="margin:0;font-size:12px;color:#999;">
Bu bağlantı 24 saat geçerlidir.
</p>
`);

  const text = `Merhaba ${firstName},\n\nHesabınızı oluşturduğunuz için teşekkür ederiz. E-posta adresinizi doğrulamak için aşağıdaki bağlantıyı kullanın:\n\n${verifyUrl}\n\nBu bağlantı 24 saat geçerlidir.`;

  return { subject, html, text };
}

export function welcomeEmail(firstName: string) {
  const shopUrl = env.WEB_URL;

  const subject = `Aramıza hoş geldiniz — ${BRAND}`;

  const html = wrapEmail(`
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Hoş geldiniz ${escapeHtml(firstName)}!</h2>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333;">
${BRAND} ailesine katıldığınız için mutluyuz. Profesyonel görüntüleme teknolojileri ve creator ekipmanlarında en geniş seçeneği sizin için hazırladık.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background-color:#1a1a2e;border-radius:6px;">
<a href="${shopUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
Alışverişe Başla
</a>
</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#666;">
Sorularınız olursa bizimle iletişime geçmekten çekinmeyin.
</p>
`);

  const text = `Hoş geldiniz ${firstName}!\n\n${BRAND} ailesine katıldığınız için mutluyuz. Profesyonel görüntüleme teknolojileri ve creator ekipmanlarında en geniş seçeneği sizin için hazırladık.\n\nAlışverişe başlamak için: ${shopUrl}`;

  return { subject, html, text };
}

export function guestOrderTrackingEmail(input: { name: string; orderNumber: string; trackingUrl: string }) {
  const subject = `Siparişiniz alındı — ${input.orderNumber}`;
  const safeName = escapeHtml(input.name);
  const safeOrderNumber = escapeHtml(input.orderNumber);
  const safeTrackingUrl = escapeHtml(input.trackingUrl);

  const html = wrapEmail(`
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Siparişiniz alındı, ${safeName}</h2>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333;">
${safeOrderNumber} numaralı siparişinizin ödemesi onaylandı. Sipariş durumunu aşağıdaki güvenli bağlantıdan takip edebilirsiniz.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background-color:#1a1a2e;border-radius:6px;">
<a href="${safeTrackingUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
Siparişimi Takip Et
</a>
</td></tr>
</table>
<p style="margin:0 0 8px;font-size:13px;color:#666;">
Buton çalışmıyorsa bu bağlantıyı kullanabilirsiniz:
</p>
<p style="margin:0;font-size:13px;color:#1a1a2e;word-break:break-all;">
<a href="${safeTrackingUrl}" style="color:#1a1a2e;text-decoration:underline;">${safeTrackingUrl}</a>
</p>
`);

  const text = `Merhaba ${input.name},\n\n${input.orderNumber} numaralı siparişinizin ödemesi onaylandı. Siparişinizi bu bağlantıdan takip edebilirsiniz:\n\n${input.trackingUrl}`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
