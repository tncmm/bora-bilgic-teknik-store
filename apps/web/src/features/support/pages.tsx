import { Button, InputField } from '@bora/ui';
import type { SupportTicket } from '@bora/types';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { Seo } from '../../shared/components/Seo';
import { formatDate } from '../../shared/lib/format';
import { translateTicketStatus } from '../../shared/lib/i18n';

const TICKET_CATEGORIES = [
  { value: 'siparis', label: 'Siparişim hakkında' },
  { value: 'kargo', label: 'Kargo / teslimat' },
  { value: 'teknik', label: 'Teknik destek' },
  { value: 'fatura', label: 'Fatura / ödeme' },
  { value: 'diger', label: 'Diğer' },
];

const CONTACT_FALLBACK = {
  contactPhone: '+90 552 355 79 83',
  contactEmail: 'destek@borabilgicteknik.com',
  contactHoursDays: 'Pazartesi - Cumartesi',
  contactHoursTime: '09:00 - 19:00',
};

function useContactInfo() {
  const [contact, setContact] = useState(CONTACT_FALLBACK);

  useEffect(() => {
    void api
      .getContactInfo()
      .then((info) => {
        setContact({
          contactPhone: info.contactPhone ?? CONTACT_FALLBACK.contactPhone,
          contactEmail: info.contactEmail ?? CONTACT_FALLBACK.contactEmail,
          contactHoursDays: info.contactHoursDays ?? CONTACT_FALLBACK.contactHoursDays,
          contactHoursTime: info.contactHoursTime ?? CONTACT_FALLBACK.contactHoursTime,
        });
      })
      .catch(() => undefined);
  }, []);

  return contact;
}

export function SupportPage() {
  const { user } = useSession();
  const { showToast } = useToast();
  const contact = useContactInfo();
  const [form, setForm] = useState({ name: '', email: '', orderNumber: '', subject: '', category: 'siparis', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ ticketNumber: string; trackingUrl: string } | null>(null);

  // Girişli kullanıcı için ad/e-posta bir kez seed edilir; alan düzenlenebilir kalır.
  useEffect(() => {
    if (!user) return;
    // React Compiler kurali: effect govdesinde senkron setState yerine
    // mikro-gorev deferral (codebase'in mevcut deseni).
    void Promise.resolve().then(() => {
      setForm((current) => ({
        ...current,
        name: current.name || `${user.firstName} ${user.lastName}`.trim(),
        email: current.email || user.email,
      }));
    });
  }, [user]);

  const canSubmit =
    form.name.trim().length >= 2 && form.email.includes('@') && form.subject.trim().length >= 3 && form.message.trim().length >= 10 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      showToast({
        tone: 'error',
        title: 'Form eksik',
        description: 'Ad, geçerli e-posta, konu ve en az 10 karakterlik mesaj gerekir.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createSupportTicket({
        name: form.name.trim(),
        email: form.email.trim(),
        orderNumber: form.orderNumber.trim() || undefined,
        subject: form.subject.trim(),
        category: form.category,
        message: form.message.trim(),
      });
      setCreated({ ticketNumber: result.ticketNumber, trackingUrl: result.trackingUrl });
      setForm((current) => ({ ...current, subject: '', orderNumber: '', message: '' }));
    } catch (error) {
      showToast({ tone: 'error', title: 'Destek talebi gönderilemedi', description: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Seo
        description="Sipariş, kargo, teknik destek ve fatura sorularınız için destek talebi oluşturun; talebinizi çevrimiçi takip edin."
        path="/destek"
        title="Destek"
      />
      <section className="dji-contact-hero">
        <div className="ui-shell">
          <div className="dji-breadcrumbs">
            <Link to="/">Anasayfa</Link>
            <span>›</span>
            <span>Destek</span>
          </div>
          <h1>DESTEK</h1>
          <p>Sorunuzu buradan iletin; ekibimiz talebinizi takip numarasıyla yanıtlayarak size e-posta ile döner.</p>
        </div>
      </section>

      <section className="dji-section">
        <div className="ui-shell">
          {created ? (
            <div className="profile-card profile-card--full support-success">
              <h2>Talebiniz alındı</h2>
              <p>
                Talep numaranız: <strong>{created.ticketNumber}</strong>
              </p>
              <p>Durumunu ve ekibimizin cevabını takip bağlantısından görebilirsiniz; ayrıca e-posta olarak da gönderdik.</p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                <a href={created.trackingUrl}>
                  <Button>Talebimi Takip Et</Button>
                </a>
                <Button
                  onClick={() => {
                    setCreated(null);
                  }}
                  variant="secondary"
                >
                  Yeni Talep Oluştur
                </Button>
              </div>
            </div>
          ) : (
            <div className="support-grid">
              <div className="profile-card support-form-card">
                <h2>Destek Talebi Oluştur</h2>
                <div className="support-form-fields">
                  <InputField label="Ad Soyad" onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} value={form.name} />
                  <InputField label="E-posta" onChange={(event) => setForm((v) => ({ ...v, email: event.target.value }))} type="email" value={form.email} />
                  <InputField
                    label="Sipariş Numarası (opsiyonel)"
                    onChange={(event) => setForm((v) => ({ ...v, orderNumber: event.target.value }))}
                    placeholder="Örn: BBT-MUG0FG4VBCF4A8"
                    value={form.orderNumber}
                  />
                  <InputField label="Konu" onChange={(event) => setForm((v) => ({ ...v, subject: event.target.value }))} value={form.subject} />
                  <label className="admin-field">
                    <span>Kategori</span>
                    <select className="ui-select" onChange={(event) => setForm((v) => ({ ...v, category: event.target.value }))} value={form.category}>
                      {TICKET_CATEGORIES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field">
                    <span>Mesajınız</span>
                    <textarea
                      className="ui-textarea"
                      onChange={(event) => setForm((v) => ({ ...v, message: event.target.value }))}
                      placeholder="Sorununuzu kısaca açıklayın."
                      rows={5}
                      value={form.message}
                    />
                  </label>
                  <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
                    {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
                  </Button>
                </div>
              </div>

              <aside className="support-side">
                <div className="profile-card compact-info-card">
                  <h3>İletişim Bilgileri</h3>
                  <p>{contact.contactPhone}</p>
                  <p>{contact.contactEmail}</p>
                  <p>
                    {contact.contactHoursDays} · {contact.contactHoursTime}
                  </p>
                  <Link to="/iletisim">Tüm iletişim bilgileri</Link>
                </div>
                <div className="profile-card compact-info-card">
                  <h3>Ne kadar hızlı dönüş yapıyoruz?</h3>
                  <p>Destek talepleriniz iş saatleri içinde değerlendirilir; yanıtı talep takip sayfanızdan ve e-postanızdan izleyebilirsiniz.</p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function SupportTrackingPage() {
  const { token = '' } = useParams();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTicket = useCallback(() => {
    if (!token) return;
    void api
      .getSupportTicketByToken(token)
      .then(setTicket)
      .catch(() => setError('Destek talebi bulunamadı.'));
  }, [token]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(loadTicket, 20_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadTicket();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadTicket, token]);

  return (
    <>
      <Seo noindex path="/destek-takip" title="Destek Talebi Takibi" />
      <section className="page-section" style={{ paddingTop: '140px' }}>
        <div className="ui-shell">
          {error ? (
            <div className="profile-card profile-card--full">
              <h2 style={{ textAlign: 'center' }}>Destek talebi bulunamadı</h2>
              <p style={{ textAlign: 'center' }}>
                Bağlantı eksik veya hatalı olabilir. Talep numaranız ve takip bağlantınız e-posta olarak gönderilmiştir.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <Link to="/destek">
                  <Button>Destek Sayfasına Dön</Button>
                </Link>
              </div>
            </div>
          ) : !ticket ? (
            <div className="profile-card profile-card--full">
              <h3 style={{ textAlign: 'center' }}>Lütfen bekleyin</h3>
              <p style={{ textAlign: 'center' }}>Destek talebi yükleniyor.</p>
            </div>
          ) : (
            <div className="profile-card profile-card--full">
              <div className="section-header">
                <div>
                  <div className="detail-chip">Destek Talebi</div>
                  <h2>{ticket.ticketNumber}</h2>
                  <p>
                    {ticket.subject} · <span className={`order-badge order-badge--payment-${ticket.status === 'closed' ? 'refunded' : ticket.status === 'in_progress' ? 'paid' : 'pending'}`}>{translateTicketStatus(ticket.status)}</span>
                  </p>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>{formatDate(ticket.createdAt, 'tr')}</small>
              </div>

              <div className="support-ticket-body">
                <h3>Talebiniz</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
              </div>

              {ticket.adminReply ? (
                <div className="support-ticket-reply">
                  <h3>Ekibimizin Yanıtı</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.adminReply}</p>
                  {ticket.repliedAt ? <small>{formatDate(ticket.repliedAt, 'tr')} tarihinde yanıtlandı</small> : null}
                </div>
              ) : (
                <div className="support-ticket-reply support-ticket-reply--pending">
                  <p>Talebiniz ekibimiz tarafından inceleniyor; yanıt e-posta olarak da iletilecektir.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
