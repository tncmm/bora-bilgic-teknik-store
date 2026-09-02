import { Button, EmptyState, InputField } from '@bora/ui';
import { PRODUCT_MEDIA_LIMITS, type Order, type Refund } from '@bora/types';
import { useEffect, useMemo, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translatePaymentStatus } from '../../shared/lib/i18n';

type AdminOrder = Order & { customer: string; email: string };

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Beklemede' },
  { value: 'PROCESSING', label: 'Hazırlanıyor' },
  { value: 'SHIPPED', label: 'Kargoda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
] as const;

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const [, base64 = ''] = dataUrl.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AdminOrdersPage() {
  const { token } = useSession();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [detailOrder, setDetailOrder] = useState<AdminOrder | null>(null);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const [refundRequest, setRefundRequest] = useState<Refund | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [refunding, setRefunding] = useState(false);
  const [invoiceUploadingOrderId, setInvoiceUploadingOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const refundAmountNumber = Number(refundAmount);
  const selectedRefundItems = refundOrder
    ? refundOrder.items
        .map((item) => ({ item, quantity: Math.min(refundQuantities[item.id] ?? 0, item.refundableQuantity) }))
        .filter((entry) => entry.quantity > 0)
    : [];
  const selectedRefundTotal = selectedRefundItems.reduce((total, entry) => total + entry.item.unitPrice * entry.quantity, 0);
  const effectiveRefundAmount = refundRequest || selectedRefundItems.length === 0 ? refundAmountNumber : selectedRefundTotal;
  const pendingRefundRequests = refundOrder?.refunds?.filter((refund) => refund.status === 'pending') ?? [];
  const canRestockRefund = Boolean(refundRequest?.items?.length || selectedRefundItems.length || (refundOrder && effectiveRefundAmount === refundOrder.refundableAmount));
  const visibleOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !keyword ||
        order.orderNumber.toLowerCase().includes(keyword) ||
        order.customer.toLowerCase().includes(keyword) ||
        order.email.toLowerCase().includes(keyword);
      const matchesPayment = paymentFilter === 'all' || order.paymentStatus === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [orders, paymentFilter, search]);
  const totalSales = visibleOrders.reduce((total, order) => total + order.total, 0);
  const pendingRefundCount = orders.reduce((total, order) => total + (order.refunds?.filter((refund) => refund.status === 'pending').length ?? 0), 0);

  async function loadOrders() {
    if (!token) return;
    try {
      const response = await api.getAdminOrders(token);
      setOrders(response);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
      showToast({ tone: 'error', title: 'Siparişler yüklenemedi', description: (error as Error).message });
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadOrders());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleStatusChange(order: AdminOrder, nextStatus: string) {
    if (!token) return;

    try {
      await api.updateAdminOrderStatus(token, order.id, nextStatus);
      await loadOrders();
      showToast({
        tone: 'success',
        title: 'Sipariş durumu güncellendi',
        description: `${order.orderNumber} artık "${STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label ?? nextStatus}" olarak işaretli.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Durum güncellenemedi',
        description: (error as Error).message,
      });
      await loadOrders();
    }
  }

  function openRefundModal(order: AdminOrder, request?: Refund) {
    setRefundOrder(order);
    setRefundRequest(request ?? null);
    setRefundAmount(String(request?.amount ?? order.refundableAmount));
    setRefundReason(request?.customerReason ?? request?.reason ?? '');
    setRefundRestock(false);
    setRefundQuantities(
      request?.items?.reduce<Record<string, number>>((acc, item) => {
        acc[item.orderItemId] = item.quantity;
        return acc;
      }, {}) ?? {},
    );
  }

  async function handleRefund() {
    if (!token || !refundOrder) return;

    const amount = effectiveRefundAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ tone: 'error', title: 'İade tutarı geçersiz', description: 'Lütfen pozitif bir tutar girin.' });
      return;
    }

    const confirmed = window.confirm(`${refundOrder.orderNumber} için ${formatCurrency(amount, 'tr')} iade başlatılacak. Onaylıyor musunuz?`);
    if (!confirmed) return;

    setRefunding(true);
    try {
      await api.refundAdminOrder(token, refundOrder.id, {
        refundId: refundRequest?.id,
        manualAmount: refundRequest ? undefined : selectedRefundItems.length ? undefined : amount,
        amount,
        items: refundRequest
          ? undefined
          : selectedRefundItems.length
            ? selectedRefundItems.map((entry) => ({ orderItemId: entry.item.id, quantity: entry.quantity }))
            : undefined,
        reason: refundReason.trim() || undefined,
        restock: refundRestock && canRestockRefund,
      });
      setRefundOrder(null);
      await loadOrders();
      showToast({ tone: 'success', title: 'İade tamamlandı', description: `${refundOrder.orderNumber} için PayTR iadesi başarıyla işlendi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'İade yapılamadı', description: (error as Error).message });
    } finally {
      setRefunding(false);
    }
  }

  async function handleInvoiceUpload(order: AdminOrder, file: File | undefined) {
    if (!token || !file) return;

    if (file.type !== 'application/pdf') {
      showToast({ tone: 'error', title: 'Fatura yüklenemedi', description: 'Fatura yalnızca PDF formatında yüklenebilir.' });
      return;
    }

    if (file.size > PRODUCT_MEDIA_LIMITS.invoicePdfBytes) {
      showToast({ tone: 'error', title: 'Fatura yüklenemedi', description: 'PDF boyutu 10 MB sınırını aşamaz.' });
      return;
    }

    setInvoiceUploadingOrderId(order.id);
    try {
      const base64 = await readFileAsBase64(file);
      await api.uploadAdminOrderInvoice(token, order.id, {
        fileName: file.name,
        mimeType: 'application/pdf',
        base64,
      });
      await loadOrders();
      showToast({ tone: 'success', title: 'Fatura gönderildi', description: `${order.orderNumber} faturası yüklendi ve müşteriye mail gönderildi.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Fatura gönderilemedi', description: (error as Error).message });
      await loadOrders();
    } finally {
      setInvoiceUploadingOrderId(null);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-headline">
        <div>
          <h1>Siparişler</h1>
          <p>Ödenmiş siparişleri, faturaları, durum değişikliklerini ve iade taleplerini buradan yönetin.</p>
        </div>
      </div>

      <div className="admin-order-summary">
        <div>
          <span>Listelenen sipariş</span>
          <strong>{visibleOrders.length}</strong>
        </div>
        <div>
          <span>Listelenen ciro</span>
          <strong>{formatCurrency(totalSales, 'tr')}</strong>
        </div>
        <div>
          <span>Bekleyen iade</span>
          <strong>{pendingRefundCount}</strong>
        </div>
        <div>
          <span>Fatura bekleyen</span>
          <strong>{orders.filter((order) => !order.invoicePdfUrl).length}</strong>
        </div>
      </div>

      {loadError ? (
        <div className="admin-card">
          <EmptyState description={loadError} title="Veriler yüklenemedi" />
          <div style={{ paddingBottom: '1.5rem', textAlign: 'center' }}>
            <Button onClick={() => void loadOrders()}>Tekrar Dene</Button>
          </div>
        </div>
      ) : (
      <div className="admin-card">
        <div className="admin-card__head admin-card__head--row">
          <div>
            <h2>Sipariş Listesi</h2>
            <p>Arama ve ödeme durumuna göre hızlı filtreleme.</p>
          </div>
          <div className="admin-order-filters">
            <input
              className="ui-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Sipariş no, müşteri veya e-posta"
              value={search}
            />
            <select className="ui-select" onChange={(event) => setPaymentFilter(event.target.value)} value={paymentFilter}>
              <option value="all">Tüm ödemeler</option>
              <option value="paid">Ödendi</option>
              <option value="partially_refunded">Kısmi iade</option>
              <option value="refunded">İade edildi</option>
            </select>
          </div>
        </div>
        {orders.length === 0 ? (
          <EmptyState description="Ödenmiş sipariş geldiğinde burada görünecek." title="Henüz sipariş yok" />
        ) : visibleOrders.length === 0 ? (
          <EmptyState description="Arama veya filtreyi değiştirerek tekrar deneyin." title="Sipariş bulunamadı" />
        ) : (
          <div className="admin-table admin-table--flat">
            <table>
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Tarih</th>
                  <th>Ödeme</th>
                  <th style={{ textAlign: 'right' }}>Tutar</th>
                  <th style={{ textAlign: 'right' }}>İade</th>
                  <th style={{ textAlign: 'right' }}>Durum</th>
                  <th>Fatura</th>
                  <th style={{ textAlign: 'right' }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                    </td>
                    <td>
                      <strong>{order.customer}</strong>
                      <div className="text-muted">{order.email}</div>
                    </td>
                    <td>{formatDate(order.createdAt, 'tr')}</td>
                    <td>
                      <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>
                        {translatePaymentStatus('tr', order.paymentStatus)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(order.total, 'tr')}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(order.refundedAmount, 'tr')}</strong>
                      <div className="text-muted">Kalan {formatCurrency(order.refundableAmount, 'tr')}</div>
                      {(order.refunds?.filter((refund) => refund.status === 'pending').length ?? 0) > 0 ? (
                        <div className="text-muted">Bekleyen talep var</div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <select
                        className="ui-select"
                        onChange={(event) => void handleStatusChange(order, event.target.value)}
                        value={order.status.toUpperCase()}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {order.invoicePdfUrl ? (
                        <a className="admin-table-action" href={order.invoicePdfUrl} rel="noreferrer" target="_blank">
                          PDF Aç
                        </a>
                      ) : (
                        <span className="text-muted">Yok</span>
                      )}
                      <div className="text-muted">{order.invoiceSentAt ? 'Mail gönderildi' : order.invoiceUploadedAt ? 'Mail bekliyor' : 'PDF max 10 MB'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="admin-table-action" onClick={() => setDetailOrder(order)} type="button">
                        Detay
                      </button>
                      <label className={`admin-table-action ${invoiceUploadingOrderId === order.id ? 'is-disabled' : ''}`}>
                        {invoiceUploadingOrderId === order.id ? 'Yükleniyor...' : 'Fatura Yükle'}
                        <input
                          accept="application/pdf"
                          hidden
                          onChange={(event) => {
                            void handleInvoiceUpload(order, event.target.files?.[0]);
                            event.currentTarget.value = '';
                          }}
                          type="file"
                        />
                      </label>
                      <button className="admin-table-action" disabled={order.refundableAmount <= 0 || order.paymentStatus === 'refunded'} onClick={() => openRefundModal(order)} type="button">
                        İade Et
                      </button>
                      {order.refunds
                        ?.filter((refund) => refund.status === 'pending')
                        .map((refund) => (
                          <button className="admin-table-action admin-table-action--danger" key={refund.id} onClick={() => openRefundModal(order, refund)} type="button">
                            Talebi Onayla
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
      {refundOrder ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div aria-modal="true" className="admin-modal" role="dialog">
            <div className="admin-card__head">
              <h2>{refundRequest ? 'Müşteri İade Talebi' : 'PayTR İadesi'}</h2>
              <p>
                {refundOrder.orderNumber} için en fazla {formatCurrency(refundOrder.refundableAmount, 'tr')} iade edilebilir.
              </p>
            </div>
            {pendingRefundRequests.length > 0 && !refundRequest ? (
              <div className="refund-history-list">
                {pendingRefundRequests.map((request) => (
                  <button className="refund-admin-request" key={request.id} onClick={() => openRefundModal(refundOrder, request)} type="button">
                    <span>
                      <strong>{request.customerReason ?? 'Müşteri iade talebi'}</strong>
                      <small>{request.customerNote}</small>
                    </span>
                    <strong>{formatCurrency(request.amount, 'tr')}</strong>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="admin-form-grid">
              <InputField
                disabled={Boolean(refundRequest) || selectedRefundItems.length > 0}
                label="İade Tutarı"
                min="1"
                onChange={(e) => setRefundAmount(e.target.value)}
                step="0.01"
                type="number"
                value={selectedRefundItems.length > 0 ? String(selectedRefundTotal) : refundAmount}
              />
              <label className="admin-field">
                <span>Stok</span>
                <label className="checkout-check">
                  <input checked={refundRestock && canRestockRefund} disabled={!canRestockRefund} onChange={(e) => setRefundRestock(e.target.checked)} type="checkbox" />
                  <span>Ürünleri stoka geri ekle</span>
                </label>
                {!canRestockRefund ? <small>Stok geri ekleme için ürün/adet seçimi veya tam iade gerekir.</small> : null}
              </label>
              {!refundRequest ? (
                <div className="full refund-picker-list">
                  {refundOrder.items.map((item) => (
                    <label className={`refund-picker-item ${item.refundableQuantity <= 0 ? 'is-disabled' : ''}`} key={item.id}>
                      <div>
                        <strong>{item.productName}</strong>
                        <span>En fazla {item.refundableQuantity} adet · {formatCurrency(item.unitPrice, 'tr')}</span>
                      </div>
                      <input
                        disabled={item.refundableQuantity <= 0}
                        max={item.refundableQuantity}
                        min="0"
                        onChange={(event) => {
                          setRefundQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }));
                        }}
                        type="number"
                        value={refundQuantities[item.id] ?? 0}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="full refund-history-list">
                  <div className="refund-admin-note">
                    <strong>{refundRequest.customerReason}</strong>
                    <p>{refundRequest.customerNote}</p>
                  </div>
                  {refundRequest.items?.map((item) => {
                    const orderItem = refundOrder.items.find((entry) => entry.id === item.orderItemId);
                    return (
                      <div className="refund-history-item" key={item.id}>
                        <div>
                          <strong>{orderItem?.productName ?? item.productId}</strong>
                          <span>{item.quantity} adet</span>
                        </div>
                        <strong>{formatCurrency(item.lineTotal, 'tr')}</strong>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="full">
                <textarea className="ui-textarea" onChange={(e) => setRefundReason(e.target.value)} placeholder="İade sebebi" value={refundReason} />
              </div>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-table-action" disabled={refunding} onClick={() => setRefundOrder(null)} type="button">
                Vazgeç
              </button>
              <button className="admin-table-action admin-table-action--danger" disabled={refunding} onClick={() => void handleRefund()} type="button">
                {refunding ? 'İade Ediliyor...' : 'İadeyi Onayla'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {detailOrder ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div aria-modal="true" className="admin-modal admin-order-detail-modal" role="dialog">
            <div className="admin-card__head admin-card__head--row">
              <div>
                <h2>Sipariş Detayı</h2>
                <p>{detailOrder.orderNumber} faturası için gerekli müşteri, teslimat, fatura ve ürün bilgileri.</p>
              </div>
              <button className="admin-table-action" onClick={() => setDetailOrder(null)} type="button">
                Kapat
              </button>
            </div>

            <div className="admin-order-detail-grid">
              <section className="admin-order-detail-block">
                <h3>Müşteri</h3>
                <dl>
                  <div><dt>Ad Soyad</dt><dd>{detailOrder.customer}</dd></div>
                  <div><dt>E-posta</dt><dd>{detailOrder.email}</dd></div>
                  <div><dt>Telefon</dt><dd>{detailOrder.shippingPhone}</dd></div>
                  <div><dt>Sipariş Tarihi</dt><dd>{formatDate(detailOrder.createdAt, 'tr')}</dd></div>
                </dl>
              </section>

              <section className="admin-order-detail-block">
                <h3>Fatura Bilgileri</h3>
                <dl>
                  <div><dt>Fatura Tipi</dt><dd>{detailOrder.billing.type === 'corporate' ? 'Kurumsal' : 'Bireysel'}</dd></div>
                  <div><dt>Ad / Ünvan</dt><dd>{detailOrder.billing.companyName || detailOrder.billing.name}</dd></div>
                  <div><dt>TC Kimlik</dt><dd>{detailOrder.billing.identityNumber ?? `***${detailOrder.billing.identityNumberLast4}`}</dd></div>
                  {detailOrder.billing.type === 'corporate' ? (
                    <>
                      <div><dt>Vergi No</dt><dd>{detailOrder.billing.taxNumber || '-'}</dd></div>
                      <div><dt>Vergi Dairesi</dt><dd>{detailOrder.billing.taxOffice || '-'}</dd></div>
                    </>
                  ) : null}
                  <div><dt>Fatura Telefon</dt><dd>{detailOrder.billing.phone}</dd></div>
                  <div><dt>Fatura Adresi</dt><dd>{detailOrder.billing.addressLine}, {detailOrder.billing.district} / {detailOrder.billing.city}</dd></div>
                </dl>
              </section>

              <section className="admin-order-detail-block">
                <h3>Teslimat</h3>
                <dl>
                  <div><dt>Alıcı</dt><dd>{detailOrder.shippingName}</dd></div>
                  <div><dt>Telefon</dt><dd>{detailOrder.shippingPhone}</dd></div>
                  <div><dt>Adres</dt><dd>{detailOrder.shippingAddressLine}, {detailOrder.shippingDistrict} / {detailOrder.shippingCity}</dd></div>
                  <div><dt>Not</dt><dd>{detailOrder.notes || '-'}</dd></div>
                </dl>
              </section>

              <section className="admin-order-detail-block">
                <h3>Ödeme</h3>
                <dl>
                  <div><dt>Durum</dt><dd>{translatePaymentStatus('tr', detailOrder.paymentStatus)}</dd></div>
                  <div><dt>Toplam</dt><dd>{formatCurrency(detailOrder.total, 'tr')}</dd></div>
                  <div><dt>İade Edilen</dt><dd>{formatCurrency(detailOrder.refundedAmount, 'tr')}</dd></div>
                  <div><dt>Kalan İade</dt><dd>{formatCurrency(detailOrder.refundableAmount, 'tr')}</dd></div>
                </dl>
              </section>
            </div>

            <div className="admin-order-detail-block">
              <h3>Ürün Kalemleri</h3>
              <div className="admin-order-lines">
                {detailOrder.items.map((item) => (
                  <div className="admin-order-line" key={item.id}>
                    <strong>{item.productName}</strong>
                    <span>{item.quantity} adet × {formatCurrency(item.unitPrice, 'tr')}</span>
                    <strong>{formatCurrency(item.lineTotal, 'tr')}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
