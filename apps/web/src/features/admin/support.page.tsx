import { Button, EmptyState } from '@bora/ui';
import type { SupportTicket } from '@bora/types';
import { useCallback, useEffect, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatDate } from '../../shared/lib/format';
import { translateTicketStatus } from '../../shared/lib/i18n';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tümü' },
  { value: 'OPEN', label: 'Açık' },
  { value: 'IN_PROGRESS', label: 'İşleniyor' },
  { value: 'CLOSED', label: 'Kapandı' },
];

function statusBadgeClass(status: string) {
  if (status === 'closed') return 'order-badge order-badge--payment-refunded';
  if (status === 'in_progress') return 'order-badge order-badge--payment-paid';
  return 'order-badge order-badge--payment-pending';
}

export function AdminSupportPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState('IN_PROGRESS');
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(
    async (filter: string) => {
      if (!token) return;
      try {
        setTickets(await api.getAdminSupportTickets(token, filter));
        setLoadError(null);
      } catch (error) {
        setLoadError((error as Error).message);
        showToast({ tone: 'error', title: 'Destek talepleri yüklenemedi', description: (error as Error).message });
      }
    },
    [token, showToast],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadTickets(statusFilter));
  }, [loadTickets, statusFilter]);

  function openTicket(ticket: SupportTicket) {
    setSelected(ticket);
    setReply(ticket.adminReply ?? '');
    setNextStatus(ticket.status === 'open' ? 'IN_PROGRESS' : ticket.status.toUpperCase());
  }

  async function handleSave() {
    if (!token || !selected) return;

    setBusy(true);
    try {
      const updated = await api.updateAdminSupportTicket(token, selected.id, {
        status: nextStatus as SupportTicket['status'],
        reply: reply.trim() || undefined,
      });
      setSelected(null);
      await loadTickets(statusFilter);
      showToast({
        tone: 'success',
        title: 'Destek talebi güncellendi',
        description: reply.trim() ? `${updated.ticketNumber} için yanıt müşteriye e-postalandı.` : `${updated.ticketNumber} güncellendi.`,
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'Güncellenemedi', description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Destek Talepleri</h1>
          <p>Müşteri taleplerini görüntüleyin, yanıtlayın ve durumlarını yönetin. Yazılan yanıt müşteriye e-posta iletilir.</p>
        </div>
        <select className="ui-select" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter} style={{ width: 200 }}>
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {loadError ? (
        <div className="admin-card">
          <EmptyState description={loadError} title="Veriler yüklenemedi" />
          <div style={{ paddingBottom: '1.5rem', textAlign: 'center' }}>
            <Button onClick={() => void loadTickets(statusFilter)}>Tekrar Dene</Button>
          </div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="admin-card">
          <EmptyState description="Destek talebi geldiğinde burada görünecek." title="Destek talebi yok" />
        </div>
      ) : (
        <div className="admin-order-card-list">
          {tickets.map((ticket) => (
            <article className="admin-order-card" key={ticket.id}>
              <div className="admin-order-card__main">
                <div className="admin-order-card__identity">
                  <span className="admin-order-card__eyebrow">{formatDate(ticket.createdAt, 'tr')}</span>
                  <strong>
                    {ticket.ticketNumber}
                    {ticket.orderNumber ? ` · ${ticket.orderNumber}` : ''}
                  </strong>
                  <span>{ticket.name}</span>
                  <small>{ticket.email}</small>
                </div>
                <div className="admin-order-card__total">
                  <span className={statusBadgeClass(ticket.status.toLowerCase())}>{translateTicketStatus(ticket.status)}</span>
                  <strong style={{ fontSize: '0.95rem' }}>{ticket.subject}</strong>
                </div>
              </div>
              <div className="admin-order-card__sections">
                <section className="admin-order-card__section admin-order-card__section--actions">
                  <span>Mesaj</span>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.5, margin: 0, maxHeight: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.message}</p>
                  <div className="admin-order-card__inline-actions">
                    <button
                      className="admin-table-action"
                      onClick={() => {
                        openTicket(ticket);
                      }}
                      type="button"
                    >
                      {ticket.adminReply ? 'Yanıtı Düzenle' : 'Yanıtla'}
                    </button>
                    {ticket.status !== 'closed' ? (
                      <button
                        className="admin-table-action"
                        onClick={() => {
                          setSelected(ticket);
                          setNextStatus('CLOSED');
                          setReply(ticket.adminReply ?? '');
                        }}
                        type="button"
                      >
                        Kapandı İşaretle
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div aria-modal="true" className="admin-modal" role="dialog">
            <div className="admin-card__head">
              <h2>
                {selected.ticketNumber} — {selected.subject}
              </h2>
              <p>
                {selected.name} · {selected.email}
                {selected.orderNumber ? ` · Sipariş: ${selected.orderNumber}` : ''}
              </p>
            </div>

            <div className="support-ticket-body">
              <h3>Müşteri Mesajı</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{selected.message}</p>
            </div>

            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Durum</span>
                <select className="ui-select" onChange={(event) => setNextStatus(event.target.value)} value={nextStatus}>
                  <option value="OPEN">Açık</option>
                  <option value="IN_PROGRESS">İşleniyor</option>
                  <option value="CLOSED">Kapandı</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Yanıt (müşteriye e-posta iletilir)</span>
                <textarea
                  className="ui-textarea"
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Müşteriye iletilecek yanıtı yazın."
                  rows={4}
                  value={reply}
                />
                {selected.adminReply ? <small>Önceki yanıt: {selected.adminReply}</small> : null}
              </label>
            </div>

            <div className="admin-modal-actions">
              <button className="admin-table-action" disabled={busy} onClick={() => setSelected(null)} type="button">
                Vazgeç
              </button>
              <button className="admin-table-action admin-table-action--danger" disabled={busy} onClick={() => void handleSave()} type="button">
                {busy ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
