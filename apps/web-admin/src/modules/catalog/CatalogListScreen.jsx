import React, { useEffect, useMemo, useState } from 'react';
import { createCatalogDraft, fetchCatalogOverview } from '../../services/catalogApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function statusLabel(status) {
  const labels = {
    draft: 'Taslak',
    published: 'Yayinda',
    archived: 'Arsiv',
  };

  return labels[status] || status || '-';
}

function Kpi({ label, value, detail, tone = 'info' }) {
  return (
    <article className={`dashboard-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function CatalogListScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [overview, setOverview] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [draftName, setDraftName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const candidates = overview?.productCandidates || [];
  const catalogs = overview?.catalogs || [];
  const items = overview?.items || [];
  const summary = overview?.summary || {};

  const selectedProducts = useMemo(
    () => candidates.filter((product) => selectedProductIds.includes(product.productId)),
    [candidates, selectedProductIds],
  );

  async function loadOverview() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchCatalogOverview(filters);
      setOverview(response.data);
    } catch (error) {
      setOverview(null);
      setErrorMessage(`${error.message || 'Katalog verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleProduct(productId) {
    setSelectedProductIds((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ));
  }

  async function handleCreateDraft() {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await createCatalogDraft({
        name: draftName || undefined,
        productIds: selectedProductIds,
      });
      setSuccessMessage(`${response.data.catalogNo} katalog taslagi olusturuldu.`);
      setSelectedProductIds([]);
      setDraftName('');
      await loadOverview();
    } catch (error) {
      setErrorMessage(`${error.message || 'Katalog taslagi olusturulamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function exportCatalogItems() {
    exportRowsToCsv({
      filename: 'katalog-urunleri',
      rows: items,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcode' },
        { label: 'Urun', key: 'productName' },
        { label: 'Marka', key: 'brand' },
        { label: 'Stok', key: 'stockQuantity' },
        { label: 'Fiyat', key: 'price' },
        { label: 'PB', key: 'currency' },
        { label: 'Gorsel', value: (row) => (row.hasImage ? 'Var' : 'Eksik') },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen catalog-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Katalog Listesi</strong>
          <span>SQL urunleri, katalog taslaklari ve gorsel hazirlik kontrolu</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={() => onOpenScreen('whatsapp-planner')}>WhatsApp Planla</button>
          <button type="button" onClick={exportCatalogItems}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Katalog Listesi')}>Yazdir</button>
          <button type="button" onClick={loadOverview}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Katalog verisi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="Katalog" value={summary.catalogCount || 0} detail="SQL katalog kaydi" tone="info" />
        <Kpi label="Yayinda" value={summary.publishedCount || 0} detail="Paylasima hazir" tone="good" />
        <Kpi label="Urun satiri" value={summary.catalogItemCount || 0} detail="Katalog urun toplamı" tone="info" />
        <Kpi label="Gorselli" value={summary.imageReadyCount || 0} detail="Ana gorsel eslesmis" tone="good" />
        <Kpi label="Stokta" value={summary.stockReadyCount || 0} detail="Pozitif stoklu satir" tone="warn" />
        <Kpi label="Secilen" value={selectedProducts.length} detail="Yeni taslak icin" tone="info" />
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Katalog Filtreleri</strong>
          <span>Katalog no, ad, musteri ve durum</span>
        </div>
        <div className="filter-grid">
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Katalog no / ad / musteri" />
          </label>
          <label>
            Durum
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Tum durumlar</option>
              <option value="draft">Taslak</option>
              <option value="published">Yayinda</option>
              <option value="archived">Arsiv</option>
            </select>
          </label>
          <label>
            Yeni katalog adi
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Orn. Haziran Toptan Katalog" />
          </label>
          <button type="button" onClick={loadOverview}>Ara</button>
          <button type="button" disabled={isSaving || selectedProductIds.length === 0} onClick={handleCreateDraft}>
            {isSaving ? 'Kaydediliyor' : 'Taslak Olustur'}
          </button>
        </div>
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Kataloglar</strong>
            <span>{catalogs.length} satir</span>
          </div>
          {!isLoading && catalogs.length === 0 && <div className="list-state">Katalog bulunamadi.</div>}
          {catalogs.length > 0 && (
            <div className="table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Katalog No</th>
                    <th>Ad</th>
                    <th>Musteri</th>
                    <th>Durum</th>
                    <th>Urun</th>
                    <th>Gorsel</th>
                    <th>Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogs.map((catalog) => (
                    <tr key={catalog.id}>
                      <td>{catalog.catalogNo}</td>
                      <td>{catalog.name}</td>
                      <td>{catalog.customerName || 'Genel'}</td>
                      <td><span className="status-pill">{statusLabel(catalog.status)}</span></td>
                      <td>{catalog.itemCount}</td>
                      <td>{catalog.imageReadyCount}/{catalog.itemCount}</td>
                      <td>{formatMoney(catalog.totalSaleValue, catalog.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>Urun Secimi</strong>
            <span>Stokta / gorselli urunler one gelir</span>
          </div>
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Sec</th>
                  <th>Stok Kodu</th>
                  <th>Urun</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Hazirlik</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 40).map((product) => (
                  <tr key={product.productId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.productId)}
                        onChange={() => toggleProduct(product.productId)}
                      />
                    </td>
                    <td>{product.stockCode}</td>
                    <td>{product.productName}</td>
                    <td>{product.stockQuantity}</td>
                    <td>{formatMoney(product.salePrice, product.currency)}</td>
                    <td>
                      <span className={`status-pill ${product.readiness === 'ready' ? 'good' : 'warn'}`}>
                        {product.hasImage ? 'Gorsel var' : 'Gorsel eksik'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Secili Katalog Urunleri</strong>
          <span>Ilk katalog satirlari / gorsel ve stok kontrolu</span>
        </div>
        {items.length === 0 && <div className="list-state">Secili katalogda urun satiri yok.</div>}
        {items.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Barkod</th>
                  <th>Urun</th>
                  <th>Marka</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Gorsel</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.stockCode}</td>
                    <td>{item.barcode || '-'}</td>
                    <td>{item.productName}</td>
                    <td>{item.brand || '-'}</td>
                    <td>{item.stockQuantity}</td>
                    <td>{formatMoney(item.price, item.currency)}</td>
                    <td>{item.hasImage ? 'Var' : 'Eksik'}</td>
                    <td>{item.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
