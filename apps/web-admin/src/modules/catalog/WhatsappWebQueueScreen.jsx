import React, { useEffect, useMemo, useState } from 'react';
import { fetchCatalogOverview, fetchWhatsappStatus } from '../../services/catalogApi.js';
import { API_BASE_URL } from '../../config/apiConfig.js';

function resolveImageUrl(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath) || imagePath.startsWith('data:')) return imagePath;
  return `${API_BASE_URL}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');

  if (digits.startsWith('00')) {
    return digits.slice(2);
  }

  if (digits.startsWith('90')) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith('5')) {
    return `90${digits}`;
  }

  return digits;
}

function buildCaption(item) {
  return [
    item.stockCode || item.productCode ? `✨ *${item.stockCode || item.productCode}* ✨` : '',
    item.productName ? `🧸 ${item.productName}` : '',
    'Fiyat ve stok bilgisi için satış ekibinden teyit alınız.',
  ].filter(Boolean).join('\n');
}

function queueStatusLabel(status) {
  if (status === 'sent') return 'Gönderildi';
  if (status === 'skipped') return 'Atlandı';
  if (status === 'failed') return 'Hatalı';
  return 'Bekliyor';
}

export function WhatsappWebQueueScreen({ catalogId: initialCatalogId, customerName: initialCustomerName = '', customerPhone: initialCustomerPhone = '', onOpenScreen }) {
  const [overview, setOverview] = useState(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState(initialCatalogId ? String(initialCatalogId) : '');
  const [phone, setPhone] = useState(initialCustomerPhone || '');
  const [customerName, setCustomerName] = useState(initialCustomerName || '');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentIds, setSentIds] = useState([]);
  const [skippedIds, setSkippedIds] = useState([]);
  const [failedRows, setFailedRows] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const catalogs = overview?.catalogs || [];
  const items = overview?.items || [];
  const selectedCatalog = catalogs.find((catalog) => Number(catalog.id) === Number(overview?.selectedCatalogId)) || catalogs[0] || null;
  const currentItem = items[currentIndex] || null;
  const currentImageUrl = resolveImageUrl(currentItem?.imagePath);
  const currentCaption = currentItem ? buildCaption(currentItem) : '';
  const failedIds = failedRows.map((row) => row.itemId);
  const pendingCount = items.filter((item) => !sentIds.includes(item.id) && !skippedIds.includes(item.id) && !failedIds.includes(item.id)).length;

  const queueRows = useMemo(() => items.map((item, index) => ({
    ...item,
    index,
    status: sentIds.includes(item.id)
      ? 'sent'
      : skippedIds.includes(item.id)
        ? 'skipped'
        : failedIds.includes(item.id)
          ? 'failed'
          : 'pending',
    failedMessage: failedRows.find((row) => row.itemId === item.id)?.message || '',
  })), [items, sentIds, skippedIds, failedRows, failedIds]);

  async function loadQueue(catalogId = selectedCatalogId) {
    setIsLoading(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetchCatalogOverview(catalogId ? { catalogId } : {});
      setOverview(response.data);
      setSelectedCatalogId(response.data.selectedCatalogId ? String(response.data.selectedCatalogId) : '');
      const nextCatalog = (response.data.catalogs || []).find((catalog) => Number(catalog.id) === Number(response.data.selectedCatalogId));
      if (!initialCustomerName && nextCatalog?.customerName) setCustomerName(nextCatalog.customerName);
      if (!initialCustomerPhone && nextCatalog?.customerPhone) setPhone(nextCatalog.customerPhone);
      setCurrentIndex(0);
      setSentIds([]);
      setSkippedIds([]);
      setFailedRows([]);
    } catch (error) {
      setOverview(null);
      setErrorMessage(`${error.message || 'WhatsApp kuyruğu okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProviderStatus() {
    try {
      const response = await fetchWhatsappStatus();
      setProviderStatus(response.data);
    } catch (error) {
      setProviderStatus({
        configured: false,
        missing: [error.message || 'WhatsApp ayarı okunamadı'],
      });
    }
  }

  useEffect(() => {
    loadQueue(initialCatalogId ? String(initialCatalogId) : '');
    loadProviderStatus();
  }, [initialCatalogId]);

  useEffect(() => {
    if (initialCustomerName) setCustomerName(initialCustomerName);
    if (initialCustomerPhone) setPhone(initialCustomerPhone);
  }, [initialCustomerName, initialCustomerPhone]);

  function selectCatalog(catalogId) {
    setSelectedCatalogId(catalogId);
    loadQueue(catalogId);
  }

  function selectRow(index) {
    setCurrentIndex(index);
    setMessage('');
  }

  function findNextIndex(nextSentIds = sentIds, nextSkippedIds = skippedIds, fromIndex = currentIndex + 1) {
    if (items.length === 0) return 0;
    for (let offset = 0; offset < items.length; offset += 1) {
      const index = (fromIndex + offset) % items.length;
      const item = items[index];
      if (!nextSentIds.includes(item.id) && !nextSkippedIds.includes(item.id)) return index;
    }
    return Math.min(currentIndex, items.length - 1);
  }

  async function copyCaption() {
    if (!currentCaption || !navigator.clipboard) return;
    await navigator.clipboard.writeText(currentCaption);
    setMessage('Ürün metni kopyalandı.');
  }

  async function copyImageUrl() {
    if (!currentImageUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(currentImageUrl);
    setMessage('Görsel bağlantısı kopyalandı.');
  }

  function openImage() {
    if (!currentImageUrl) {
      setErrorMessage('Bu ürünün görseli yok.');
      return;
    }
    window.open(currentImageUrl, '_blank', 'noopener,noreferrer');
  }

  function openWhatsapp() {
    const normalizedPhone = normalizePhone(phone);
    const text = encodeURIComponent(currentCaption);
    const url = normalizedPhone
      ? `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${text}`
      : `https://web.whatsapp.com/send?text=${text}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    setMessage('WhatsApp Web açıldı. Görseli ekleyip metni açıklama olarak gönderin.');
  }

  function markSent() {
    if (!currentItem) return;
    const nextSentIds = [...new Set([...sentIds, currentItem.id])];
    const nextSkippedIds = skippedIds.filter((id) => id !== currentItem.id);
    setSentIds(nextSentIds);
    setSkippedIds(nextSkippedIds);
    setCurrentIndex(findNextIndex(nextSentIds, nextSkippedIds));
    setMessage(`${currentItem.stockCode} gönderildi işaretlendi.`);
  }

  function markSkipped() {
    if (!currentItem) return;
    const nextSkippedIds = [...new Set([...skippedIds, currentItem.id])];
    setSkippedIds(nextSkippedIds);
    setCurrentIndex(findNextIndex(sentIds, nextSkippedIds));
    setMessage(`${currentItem.stockCode} atlandı.`);
  }

  function resetQueue() {
    setSentIds([]);
    setSkippedIds([]);
    setFailedRows([]);
    setCurrentIndex(0);
    setMessage('Kuyruk sıfırlandı.');
  }

  return (
    <main className="work-area whatsapp-queue-screen">
      <section className="dashboard-toolbar whatsapp-queue-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>WhatsApp Web Gönderim Kuyruğu</strong>
          <span>Her ürün ayrı görsel mesaj olarak hazırlanır</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={() => onOpenScreen('catalog-list')}>Katalog Listesi</button>
          <button type="button" onClick={() => loadQueue()}>Yenile</button>
          <button type="button" onClick={resetQueue} disabled={items.length === 0}>Kuyruğu Sıfırla</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Katalog kuyruğu okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {message && <div className="list-state list-state-success">{message}</div>}

      <section className="whatsapp-queue-steps">
        <article><strong>1</strong><span>Katalog seç</span></article>
        <article><strong>2</strong><span>Müşteri telefonu yaz</span></article>
        <article><strong>3</strong><span>Görseli aç / metni kopyala</span></article>
        <article><strong>4</strong><span>WhatsApp Web'de gönder</span></article>
      </section>

      <section className="whatsapp-queue-layout">
        <aside className="erp-panel whatsapp-queue-settings">
          <div className="panel-title">
            <strong>Gönderim Ayarı</strong>
            <span>{selectedCatalog ? selectedCatalog.catalogNo : 'Katalog seç'}</span>
          </div>
          <label>
            Katalog
            <select value={selectedCatalogId} onChange={(event) => selectCatalog(event.target.value)}>
              <option value="">Son katalog</option>
              {catalogs.map((catalog) => (
                <option key={catalog.id} value={catalog.id}>
                  {catalog.catalogNo} / {catalog.name} ({catalog.itemCount})
                </option>
              ))}
            </select>
          </label>
          <label>
            Müşteri adı
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Örn. Semih Şenyıldız" />
          </label>
          <label>
            WhatsApp telefon
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="905xxxxxxxxx" />
          </label>
          <button type="button" className="primary" onClick={openWhatsapp} disabled={!currentItem}>
            WhatsApp Web Aç
          </button>
          <div className={`whatsapp-provider-status ${providerStatus?.sendEnabled ? 'ready' : 'missing'}`}>
            <strong>{providerStatus?.sendEnabled ? 'Onaylı gönderim açık' : 'Otomatik gönderim kapalı'}</strong>
            <small>
              {providerStatus?.sendEnabled
                ? `${providerStatus.provider || 'provider'} / ${providerStatus.instance || '-'}`
                : 'Mesaj gönderimi Melih onayı olmadan yapılmaz; bu ekran yalnızca hazırlık ve manuel inceleme kuyruğudur.'}
            </small>
          </div>
          <div className="whatsapp-queue-progress">
            <span>{sentIds.length} / {items.length} ürün gönderildi</span>
            <progress value={sentIds.length} max={items.length || 1} />
            <small>{pendingCount} bekleyen, {failedRows.length} hatalı, {skippedIds.length} atlanan</small>
          </div>
        </aside>

        <section className="erp-panel whatsapp-queue-list-panel">
          <div className="panel-title">
            <strong>Ürün Kuyruğu</strong>
            <span>{items.length} ürün / her satır ayrı mesaj</span>
          </div>
          {items.length === 0 && !isLoading && <div className="list-state">Kuyruk için katalog ürünü bulunamadı.</div>}
          <div className="whatsapp-queue-list">
            {queueRows.map((item) => (
              <button
                type="button"
                className={`whatsapp-queue-row ${item.status} ${item.index === currentIndex ? 'active' : ''}`}
                key={item.id}
                onClick={() => selectRow(item.index)}
              >
                {item.imagePath ? (
                  <img alt={item.productName || item.stockCode || 'Ürün'} src={resolveImageUrl(item.imagePath)} />
                ) : (
                  <span className="whatsapp-queue-empty-image">Görsel yok</span>
                )}
                <span className="whatsapp-queue-row-main">
                  <strong>{item.stockCode}</strong>
                  <small>{item.productName}</small>
                  <b>Fiyat teyitli</b>
                  {item.failedMessage && <small>{item.failedMessage}</small>}
                </span>
                <em>{queueStatusLabel(item.status)}</em>
              </button>
            ))}
          </div>
        </section>

        <aside className="erp-panel whatsapp-message-preview">
          <div className="panel-title">
            <strong>Mesaj Önizleme</strong>
            <span>{currentItem ? `${currentIndex + 1} / ${items.length}` : 'Ürün yok'}</span>
          </div>
          {currentItem ? (
            <>
              <div className="whatsapp-phone-preview">
                <div className="whatsapp-chat-header">
                  <strong>{customerName || 'WhatsApp müşterisi'}</strong>
                  <span>{phone || 'Telefon girilmedi'}</span>
                </div>
                <div className="whatsapp-product-message">
                  {currentImageUrl ? (
                    <img alt={currentItem.productName || currentItem.stockCode || 'Ürün'} src={currentImageUrl} />
                  ) : (
                    <span>Görsel yok</span>
                  )}
                  <pre>{currentCaption}</pre>
                </div>
              </div>
              <div className="whatsapp-preview-actions">
                <button type="button" onClick={openImage} disabled={!currentImageUrl}>Görseli Aç</button>
                <button type="button" onClick={copyImageUrl} disabled={!currentImageUrl}>Görsel Linki Kopyala</button>
                <button type="button" onClick={copyCaption}>Metni Kopyala</button>
                <button type="button" className="primary" onClick={openWhatsapp}>WhatsApp Aç</button>
                <button type="button" className="good" onClick={markSent}>Gönderildi</button>
                <button type="button" className="danger" onClick={markSkipped}>Atla</button>
              </div>
            </>
          ) : (
            <div className="list-state">Önizleme için katalog ürünü yok.</div>
          )}
        </aside>
      </section>
    </main>
  );
}



