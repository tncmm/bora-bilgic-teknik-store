import { Button, EmptyState, InputField } from '@bora/ui';
import { PRODUCT_MEDIA_LIMITS, type Order, type Refund } from '@bora/types';
import { useEffect, useMemo, useState } from 'react';

import { useSession } from '../../app/providers/SessionProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { api } from '../../shared/api/client';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { translateCargoStatus, translatePaymentStatus } from '../../shared/lib/i18n';

type AdminOrder = Order & { customer: string; email: string };

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Beklemede' },
  { value: 'PROCESSING', label: 'Hazırlanıyor' },
  { value: 'SHIPPED', label: 'Kargoda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
] as const;

function getOrderStatusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status.toUpperCase())?.label ?? status;
}

function getOrderItemRefundLabel(item: Order['items'][number]) {
  if (item.refundedQuantity >= item.quantity) return 'İade edildi';
  if (item.pendingRefundQuantity > 0) return 'İade talebi var';
  if (item.refundedQuantity > 0) return 'Kısmi iade';
  return null;
}

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
  const [shipmentBusyOrderId, setShipmentBusyOrderId] = useState<string | null>(null);
  const [returnCodeBusyId, setReturnCodeBusyId] = useState<string | null>(null);
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
  // Modal açıkken kargo oluşturma/sorgulama loadOrders'ı tazeler; detay da
  // listenin en güncel kopyasından okunmalı, aksi halde bayat barkod görünür.
  const detailOrderLive = detailOrder ? (orders.find((order) => order.id === detailOrder.id) ?? detailOrder) : null;

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

  async function handleCreateShipment(order: AdminOrder) {
    if (!token) return;

    const confirmed = window.confirm(
      `${order.orderNumber} için Yurtiçi Kargo gönderi kaydı oluşturulacak. Onaylıyor musunuz?`,
    );
    if (!confirmed) return;

    setShipmentBusyOrderId(order.id);
    try {
      await api.createAdminOrderShipment(token, order.id);
      await loadOrders();
      showToast({
        tone: 'success',
        title: 'Kargo kaydı oluşturuldu',
        description: `${order.orderNumber} için Yurtiçi Kargo barkodu alındı.`,
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kargo kaydı oluşturulamadı', description: (error as Error).message });
    } finally {
      setShipmentBusyOrderId(null);
    }
  }

  async function handleSyncShipment(order: AdminOrder) {
    if (!token) return;

    setShipmentBusyOrderId(order.id);
    try {
      await api.syncAdminOrderShipment(token, order.id);
      await loadOrders();
      showToast({
        tone: 'success',
        title: 'Kargo durumu güncellendi',
        description: `${order.orderNumber} için takip bilgileri Yurtiçi Kargo'dan yenilendi.`,
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kargo durumu sorgulanamadı', description: (error as Error).message });
    } finally {
      setShipmentBusyOrderId(null);
    }
  }

  async function handleCancelShipment(order: AdminOrder) {
    if (!token) return;

    const confirmed = window.confirm(
      `${order.orderNumber} (${order.cargoBarcode}) için Yurtiçi Kargo kaydı iptal edilecek. Onaylıyor musunuz?`,
    );
    if (!confirmed) return;

    setShipmentBusyOrderId(order.id);
    try {
      await api.cancelAdminOrderShipment(token, order.id);
      await loadOrders();
      showToast({
        tone: 'success',
        title: 'Kargo kaydı iptal edildi',
        description: `${order.orderNumber} gönderisi Yurtiçi Kargo tarafında iptal edildi.`,
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'Kargo kaydı iptal edilemedi', description: (error as Error).message });
    } finally {
      setShipmentBusyOrderId(null);
    }
  }

  async function handleCreateReturnCode(refund: Refund) {
    if (!token) return;

    setReturnCodeBusyId(refund.id);
    try {
      const result = await api.createAdminRefundReturnCode(token, refund.id);
      await loadOrders();
      showToast({
        tone: 'success',
        title: 'İade kargo kodu oluşturuldu',
        description: `${result.returnCode} — kodu müşteriyle paylaşın; müşteri ürünü Yurtiçi Kargo şubesine bu kodla ücretsiz gönderir.`,
      });
    } catch (error) {
      showToast({ tone: 'error', title: 'İade kargo kodu oluşturulamadı', description: (error as Error).message });
    } finally {
      setReturnCodeBusyId(null);
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
          <div className="admin-order-card-list">
            {visibleOrders.map((order) => {
              const pendingRefunds = order.refunds?.filter((refund) => refund.status === 'pending') ?? [];
              return (
                <article className="admin-order-card" key={order.id}>
                  <div className="admin-order-card__main">
                    <div className="admin-order-card__identity">
                      <span className="admin-order-card__eyebrow">{formatDate(order.createdAt, 'tr')}</span>
                      <strong>
                        {order.orderNumber}
                        {order.isAttemptReview ? ' · İNCELEME' : ''}
                      </strong>
                      <span>{order.customer}</span>
                      <small>{order.email}</small>
                    </div>

                    <div className="admin-order-card__total">
                      <span className={`order-badge order-badge--payment-${order.paymentStatus}`}>
                        {translatePaymentStatus('tr', order.paymentStatus)}
                      </span>
                      <strong>{formatCurrency(order.total, 'tr')}</strong>
                      {order.refundedAmount > 0 || pendingRefunds.length > 0 ? (
                        <small>
                          {order.refundedAmount > 0 ? `${formatCurrency(order.refundedAmount, 'tr')} iade` : ''}
                          {pendingRefunds.length > 0 ? `${order.refundedAmount > 0 ? ' · ' : ''}${pendingRefunds.length} talep bekliyor` : ''}
                        </small>
                      ) : (
                        <small>İade yok</small>
                      )}
                    </div>
                  </div>

                  <div className="admin-order-card__sections">
                    <section className="admin-order-card__section">
                      <span>Durum</span>
                      {order.isAttemptReview ? (
                        <>
                          <span className="order-badge order-badge--payment-pending">İnceleme</span>
                          <small>Ödeme alındı; sipariş oluşmadı. PayTR panelinden iade edin.</small>
                        </>
                      ) : (
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
                      )}
                    </section>

                    <section className="admin-order-card__section">
                      <span>Fatura</span>
                      {order.isAttemptReview ? (
                        <small>Sipariş oluşmadığından fatura kesilmez.</small>
                      ) : (
                        <>
                          <strong>{order.invoicePdfUrl ? 'PDF yüklendi' : 'PDF bekliyor'}</strong>
                          <small>{order.invoiceSentAt ? 'Müşteriye gönderildi' : order.invoiceUploadedAt ? 'Mail bekliyor' : 'PDF max 10 MB'}</small>
                          {order.invoicePdfUrl ? (
                            <a className="admin-table-action" href={order.invoicePdfUrl} rel="noreferrer" target="_blank">
                              PDF Aç
                            </a>
                          ) : null}
                        </>
                      )}
                    </section>

                    <section className="admin-order-card__section">
                      <span>Kargo</span>
                      {order.isAttemptReview ? (
                        <small>Gönderi oluşturulamaz.</small>
                      ) : order.cargoBarcode ? (
                        <>
                          <strong>{order.cargoBarcode}</strong>
                          <small>{translateCargoStatus(order.cargoStatus) ?? 'Sorgulanmadı'}</small>
                          <div className="admin-order-card__inline-actions">
                            <button
                              className="admin-table-action"
                              disabled={shipmentBusyOrderId === order.id}
                              onClick={() => void handleSyncShipment(order)}
                              type="button"
                            >
                              {shipmentBusyOrderId === order.id ? 'Sorgulanıyor...' : 'Sorgula'}
                            </button>
                            {order.cargoStatus !== 'DELIVERED' && order.cargoStatus !== 'CANCELLED' ? (
                              <button
                                className="admin-table-action"
                                disabled={shipmentBusyOrderId === order.id}
                                onClick={() => void handleCancelShipment(order)}
                                type="button"
                              >
                                İptal
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : order.paymentStatus === 'paid' && !order.isAttemptReview ? (
                        <>
                          <strong>Kargo bekliyor</strong>
                          <small>Yurtiçi kaydı henüz yok</small>
                          <button
                            className="admin-table-action"
                            disabled={shipmentBusyOrderId === order.id}
                            onClick={() => void handleCreateShipment(order)}
                            type="button"
                          >
                            {shipmentBusyOrderId === order.id ? 'Oluşturuluyor...' : 'Kargo Oluştur'}
                          </button>
                        </>
                      ) : (
                        <>
                          <strong>Hazır değil</strong>
                          <small>Ödeme bekliyor</small>
                        </>
                      )}
                    </section>

                    <section className="admin-order-card__section admin-order-card__section--actions">
                      <span>Aksiyon</span>
                      <div className="admin-order-card__actions">
                        <button className="admin-table-action" onClick={() => setDetailOrder(order)} type="button">
                          Detay
                        </button>
                        {order.isAttemptReview ? null : (
                        <>
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
                        <button
                          className="admin-table-action"
                          disabled={order.refundableAmount <= 0 || order.paymentStatus === 'refunded'}
                          onClick={() => openRefundModal(order)}
                          type="button"
                        >
                          İade Et
                        </button>
                        {pendingRefunds.map((refund) => (
                          <button className="admin-table-action admin-table-action--danger" key={refund.id} onClick={() => openRefundModal(order, refund)} type="button">
                            Talebi Onayla
                          </button>
                        ))}
                        </>
                        )}
                      </div>
                    </section>
                  </div>
                </article>
              );
            })}
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
              {(refundRequest || pendingRefundRequests.length > 0) ? (
                <div className="full refund-history-list">
                  <div className="refund-admin-note">
                    <strong>İade Kargo Kodu (RMA)</strong>
                    <p>Müşteri, ürünü Yurtiçi Kargo şubesine bu kodla ücretsiz gönderir; kod sipariş detayında müşteriye de görünür.</p>
                  </div>
                  {(refundRequest ? [refundRequest] : pendingRefundRequests).map((refund) => (
                    <div className="refund-history-item" key={refund.id}>
                      <div>
                        <strong>{refund.returnCode ? `Kod: ${refund.returnCode}` : 'Kod oluşturulmadı'}</strong>
                        <span>{refund.returnCodeValidUntil ? `Geçerlilik: ${formatDate(refund.returnCodeValidUntil, 'tr')}` : 'Üretim bekliyor'}</span>
                      </div>
                      {refund.returnCode ? null : (
                        <button
                          className="admin-table-action"
                          disabled={returnCodeBusyId === refund.id}
                          onClick={() => void handleCreateReturnCode(refund)}
                          type="button"
                        >
                          {returnCodeBusyId === refund.id ? 'Oluşturuluyor...' : 'İade Kodu Oluştur'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
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
                <p>Fatura, teslimat, kargo ve ürün kalemleri tek ekranda sadeleştirildi.</p>
              </div>
              <button className="admin-table-action" onClick={() => setDetailOrder(null)} type="button">
                Kapat
              </button>
            </div>

            <div className="admin-order-detail-hero">
              <div>
                <span>Sipariş No</span>
                <strong>{detailOrder.orderNumber}</strong>
                <p>{detailOrder.customer} · {detailOrder.email}</p>
              </div>
              <div className="admin-order-detail-hero__facts">
                <div>
                  <span>Sipariş Durumu</span>
                  <strong>{getOrderStatusLabel(detailOrder.status)}</strong>
                </div>
                <div>
                  <span>Ödeme</span>
                  <strong>{translatePaymentStatus('tr', detailOrder.paymentStatus)}</strong>
                </div>
                <div>
                  <span>Toplam</span>
                  <strong>{formatCurrency(detailOrder.total, 'tr')}</strong>
                </div>
              </div>
            </div>

            <div className="admin-order-detail-grid">
              <section className="admin-order-detail-block">
                <h3>Müşteri ve Fatura</h3>
                <dl>
                  <div><dt>Ad Soyad</dt><dd>{detailOrder.customer}</dd></div>
                  <div><dt>E-posta</dt><dd>{detailOrder.email}</dd></div>
                  <div><dt>Telefon</dt><dd>{detailOrder.shippingPhone}</dd></div>
                  <div><dt>Sipariş Tarihi</dt><dd>{formatDate(detailOrder.createdAt, 'tr')}</dd></div>
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
                <h3>Ödeme ve İade</h3>
                <dl>
                  <div><dt>Durum</dt><dd>{translatePaymentStatus('tr', detailOrder.paymentStatus)}</dd></div>
                  <div><dt>Toplam</dt><dd>{formatCurrency(detailOrder.total, 'tr')}</dd></div>
                  <div><dt>İade Edilen</dt><dd>{formatCurrency(detailOrder.refundedAmount, 'tr')}</dd></div>
                  <div><dt>Kalan İade</dt><dd>{formatCurrency(detailOrder.refundableAmount, 'tr')}</dd></div>
                </dl>
              </section>

              <section className="admin-order-detail-block">
                <h3>Kargo</h3>
                <dl>
                  <div><dt>Firma</dt><dd>{detailOrderLive?.cargoCompany ?? 'Yurtiçi Kargo'}</dd></div>
                  <div><dt>Barkod</dt><dd>{detailOrderLive?.cargoBarcode ?? '-'}</dd></div>
                  <div>
                    <dt>Takip Linki</dt>
                    <dd>
                      {detailOrderLive?.cargoTrackingUrl ? (
                        <a href={detailOrderLive.cargoTrackingUrl} rel="noreferrer" target="_blank">Aç</a>
                      ) : (
                        '-'
                      )}
                    </dd>
                  </div>
                  <div><dt>Durum</dt><dd>{translateCargoStatus(detailOrderLive?.cargoStatus) ?? 'Sorgulanmadı'}</dd></div>
                  <div><dt>Son Hareket</dt><dd>{detailOrderLive?.cargoLastEvent ?? '-'}</dd></div>
                  <div>
                    <dt>Son Sorgu</dt>
                    <dd>{detailOrderLive?.cargoLastSyncedAt ? formatDate(detailOrderLive.cargoLastSyncedAt, 'tr') : '-'}</dd>
                  </div>
                </dl>
                {detailOrderLive?.cargoBarcode ? (
                  <>
                    <button
                      className="admin-table-action"
                      disabled={shipmentBusyOrderId === detailOrderLive.id}
                      onClick={() => void handleSyncShipment(detailOrderLive)}
                      type="button"
                    >
                      {shipmentBusyOrderId === detailOrderLive.id ? 'Sorgulanıyor...' : 'Durumu Sorgula'}
                    </button>
                    {detailOrderLive.cargoStatus !== 'DELIVERED' && detailOrderLive.cargoStatus !== 'CANCELLED' ? (
                      <button
                        className="admin-table-action"
                        disabled={shipmentBusyOrderId === detailOrderLive.id}
                        onClick={() => void handleCancelShipment(detailOrderLive)}
                        type="button"
                      >
                        Kargo İptal
                      </button>
                    ) : null}
                  </>
                ) : detailOrderLive && detailOrderLive.paymentStatus === 'paid' ? (
                  <button
                    className="admin-table-action"
                    disabled={shipmentBusyOrderId === detailOrderLive.id}
                    onClick={() => void handleCreateShipment(detailOrderLive)}
                    type="button"
                  >
                    {shipmentBusyOrderId === detailOrderLive.id ? 'Oluşturuluyor...' : 'Kargo Oluştur'}
                  </button>
                ) : null}
              </section>
            </div>

            <div className="admin-order-detail-block">
              <h3>Ürün Kalemleri</h3>
              <div className="admin-order-lines">
                {detailOrder.items.map((item) => {
                  const refundLabel = getOrderItemRefundLabel(item);
                  return (
                    <div className="admin-order-line" key={item.id}>
                      <div className="admin-order-line__product">
                        <strong>{item.productName}</strong>
                        <span>{item.quantity} adet × {formatCurrency(item.unitPrice, 'tr')}</span>
                        {item.packageLabel ? <small>{item.packageLabel}</small> : null}
                      </div>
                      <div className="admin-order-line__meta">
                        <span>Satır Toplamı</span>
                        <strong>{formatCurrency(item.lineTotal, 'tr')}</strong>
                      </div>
                      <div className="admin-order-line__meta">
                        <span>İade Durumu</span>
                        {refundLabel ? (
                          <strong className="admin-order-line__refund">{refundLabel}</strong>
                        ) : (
                          <strong>İade yok</strong>
                        )}
                        {item.pendingRefundQuantity > 0 ? <small>{item.pendingRefundQuantity} adet onay bekliyor</small> : null}
                        {item.refundedQuantity > 0 ? <small>{item.refundedQuantity} adet tamamlandı</small> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
