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
    published: 'Yayında',
    archived: 'Arşiv',
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
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    catalogId: '',
    productSearch: '',
    brand: '',
    category: '',
    currency: '',
    stockMode: '',
    imageMode: '',
    minPrice: '',
    maxPrice: '',
  });
  const [overview, setOverview] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedProductMap, setSelectedProductMap] = useState({});
  const [draftName, setDraftName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const candidates = overview?.productCandidates || [];
  const catalogs = overview?.catalogs || [];
  const items = overview?.items || [];
  const summary = overview?.summary || {};
  const filterOptions = overview?.filterOptions || {};

  const selectedProducts = useMemo(() => (
    selectedProductIds
      .map((productId) => selectedProductMap[productId])
      .filter(Boolean)
  ), [selectedProductIds, selectedProductMap]);

  async function loadOverview(nextFilters = filters) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchCatalogOverview(nextFilters);
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

  function clearProductFilters() {
    const nextFilters = {
      ...filters,
      productSearch: '',
      brand: '',
      category: '',
      currency: '',
      stockMode: '',
      imageMode: '',
      minPrice: '',
      maxPrice: '',
    };
    setFilters(nextFilters);
    loadOverview(nextFilters);
  }

  function selectCatalog(catalogId) {
    const nextFilters = { ...filters, catalogId: String(catalogId || '') };
    setFilters(nextFilters);
    loadOverview(nextFilters);
  }

  function toggleProduct(product) {
    const productId = product.productId;
    setSelectedProductIds((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ));
    setSelectedProductMap((current) => {
      if (current[productId]) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: product };
    });
  }

  function selectVisibleProducts() {
    const visibleIds = candidates.map((product) => product.productId);
    setSelectedProductIds((current) => [...new Set([...current, ...visibleIds])]);
    setSelectedProductMap((current) => {
      const next = { ...current };
      candidates.forEach((product) => {
        next[product.productId] = product;
      });
      return next;
    });
  }

  function clearSelectedProducts() {
    setSelectedProductIds([]);
    setSelectedProductMap({});
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
      setSuccessMessage(`${response.data.catalogNo} katalog tasla?? olu?turuldu.`);
      setSelectedProductIds([]);
      setSelectedProductMap({});
      setDraftName('');
      const nextFilters = {
        ...filters,
        catalogId: String(response.data.catalogId || ''),
      };
      setFilters(nextFilters);
      await loadOverview(nextFilters);
    } catch (error) {
      setErrorMessage(`${error.message || 'Katalog tasla?? olu?turulamad?.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function exportCatalogItems() {
    exportRowsToCsv({
      filename: 'katalog-ürünleri',
      rows: items,
      columns: [
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Barkod', key: 'barcode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Marka', key: 'brand' },
        { label: 'Stok', key: 'stockQuantity' },
        { label: 'Fiyat', key: 'price' },
        { label: 'PB', key: 'currency' },
        { label: 'G?rsel', value: (row) => (row.hasImage ? 'Var' : 'Eksik') },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen catalog-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Katalog Listesi</strong>
          <span>SQL Ürünleri, katalog taslakları ve görsel hazırlık kontrolü</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={() => onOpenScreen('whatsapp-planner')}>WhatsApp Planla</button>
          <button type="button" onClick={exportCatalogItems}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Katalog Listesi')}>Yazdır</button>
          <button type="button" onClick={loadOverview}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Katalog verisi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

      <section className="dashboard-kpi-grid">
        <Kpi label="Katalog" value={summary.catalogCount || 0} detail="SQL katalog kaydı" tone="info" />
        <Kpi label="Yayında" value={summary.publishedCount || 0} detail="Paylaşıma hazır" tone="good" />
        <Kpi label="Ürün satırı" value={summary.catalogItemCount || 0} detail="Katalog ürün toplamı" tone="info" />
        <Kpi label="Görselli" value={summary.imageReadyCount || 0} detail="Ana görsel eşleşmiş" tone="good" />
        <Kpi label="Stokta" value={summary.stockReadyCount || 0} detail="Pozitif stoklu satır" tone="warn" />
        <Kpi label="Seçilen" value={selectedProductIds.length} detail="Yeni taslak için" tone="info" />
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Katalog Filtreleri</strong>
          <span>Katalog no, ad, müşteri ve durum</span>
        </div>
        <div className="filter-grid catalog-main-filter-grid">
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Katalog no / ad / müşteri" />
          </label>
          <label>
            Durum
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Tüm durumlar</option>
              <option value="draft">Taslak</option>
              <option value="published">Yayında</option>
              <option value="archived">Arşiv</option>
            </select>
          </label>
          <label>
            Yeni katalog adı
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Örn. Haziran Toptan Katalog" />
          </label>
          <button type="button" onClick={() => loadOverview()}>Ara</button>
        </div>
        <div className="catalog-draft-actions">
          <span>{selectedProductIds.length} Ürün seçili</span>
          <button type="button" disabled={isSaving || selectedProductIds.length === 0} onClick={handleCreateDraft}>
            {isSaving ? 'Kaydediliyor' : 'Taslak Oluştur'}
          </button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Ürün Seçim Filtreleri</strong>
          <span>Barkod, stok kodu, Ürün adı, marka, kategori, para birimi ve hazırlık durumu</span>
        </div>
        <div className="filter-grid catalog-product-filter-grid">
          <label>
            Ürün / barkod
            <input
              value={filters.productSearch}
              onChange={(event) => updateFilter('productSearch', event.target.value)}
              placeholder="Barkod / stok kodu / Ürün adı / marka"
            />
          </label>
          <label>
            Marka
            <select value={filters.brand} onChange={(event) => updateFilter('brand', event.target.value)}>
              <option value="">Tüm markalar</option>
              {(filterOptions.brands || []).map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </label>
          <label>
            Kategori
            <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
              <option value="">Tüm kategoriler</option>
              {(filterOptions.categories || []).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Para birimi
            <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
              <option value="">Tüm PB</option>
              {(filterOptions.currencies || ['TRY', 'USD', 'EUR']).map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </label>
          <label>
            Stok
            <select value={filters.stockMode} onChange={(event) => updateFilter('stockMode', event.target.value)}>
              <option value="">Tüm stoklar</option>
              <option value="inStock">Stokta olan</option>
              <option value="zero">Sıfır stok</option>
              <option value="negative">Eksi stok</option>
            </select>
          </label>
          <label>
            Görsel
            <select value={filters.imageMode} onChange={(event) => updateFilter('imageMode', event.target.value)}>
              <option value="">Tüm görseller</option>
              <option value="withImage">Görseli olan</option>
              <option value="withoutImage">Görseli eksik</option>
            </select>
          </label>
          <label>
            Min fiyat
            <input type="number" min="0" value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} />
          </label>
          <label>
            Max fiyat
            <input type="number" min="0" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} />
          </label>
          <button type="button" onClick={() => loadOverview()}>Ürün Ara</button>
          <button type="button" onClick={clearProductFilters}>Filtre Temizle</button>
          <button type="button" onClick={selectVisibleProducts} disabled={candidates.length === 0}>Görünenleri Seç</button>
          <button type="button" onClick={clearSelectedProducts} disabled={selectedProductIds.length === 0}>Seçimi Temizle</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Taslak Sepeti</strong>
          <span>{selectedProductIds.length} Ürün seçili / filtre değişse de seçim korunur</span>
        </div>
        {selectedProducts.length === 0 && <div className="list-state">Taslak için henüz Ürün seçilmedi.</div>}
        {selectedProducts.length > 0 && (
          <div className="table-shell compact-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Barkod</th>
                  <th>Ürün</th>
                  <th>Marka</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map((product) => (
                  <tr key={`selected-${product.productId}`}>
                    <td>{product.stockCode}</td>
                    <td>{product.barcode || '-'}</td>
                    <td>{product.productName}</td>
                    <td>{product.brand || '-'}</td>
                    <td>{product.stockQuantity}</td>
                    <td>{formatMoney(product.salePrice, product.currency)}</td>
                    <td>
                      <button className="mini-button danger" type="button" onClick={() => toggleProduct(product)}>Çıkar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedProducts.length > 0 && (
          <div className="catalog-draft-actions">
            <span>{selectedProducts.length} ürün katalog taslagi icin hazir.</span>
            <button type="button" disabled={isSaving} onClick={handleCreateDraft}>
              {isSaving ? 'Kaydediliyor' : 'Seçilenlerle Taslak Oluştur'}
            </button>
          </div>
        )}
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Kataloglar</strong>
            <span>{catalogs.length} satır</span>
          </div>
          {!isLoading && catalogs.length === 0 && <div className="list-state">Katalog bulunamadı.</div>}
          {catalogs.length > 0 && (
            <div className="table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Katalog No</th>
                    <th>Ad</th>
                    <th>Müşteri</th>
                    <th>Durum</th>
                    <th>Ürün</th>
                    <th>Görsel</th>
                    <th>Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogs.map((catalog) => (
                    <tr
                      className={Number(overview.selectedCatalogId) === Number(catalog.id) ? 'selected-row' : 'clickable-row'}
                      key={catalog.id}
                      onClick={() => selectCatalog(catalog.id)}
                    >
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
            <strong>Ürün Seçimi</strong>
            <span>{candidates.length} aday / {selectedProductIds.length} seçili</span>
          </div>
          {!isLoading && candidates.length === 0 && <div className="list-state">Filtreye uygun Ürün bulunamadı.</div>}
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Seç</th>
                  <th>Stok Kodu</th>
                  <th>Barkod</th>
                  <th>Ürün</th>
                  <th>Marka</th>
                  <th>Kategori</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Hazırlık</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 40).map((product) => (
                  <tr key={product.productId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.productId)}
                        onChange={() => toggleProduct(product)}
                      />
                    </td>
                    <td>{product.stockCode}</td>
                    <td>{product.barcode || '-'}</td>
                    <td>{product.productName}</td>
                    <td>{product.brand || '-'}</td>
                    <td>{product.category || '-'}</td>
                    <td>{product.stockQuantity}</td>
                    <td>{formatMoney(product.salePrice, product.currency)}</td>
                    <td>
                      <span className={`status-pill ${product.readiness === 'ready' ? 'good' : 'warn'}`}>
                        {product.hasImage ? 'Görsel var' : 'Görsel eksik'}
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
          <strong>Seçili Katalog Ürünleri</strong>
          <span>Ilk katalog satırlari / görsel ve stok kontrolü</span>
        </div>
        {items.length === 0 && <div className="list-state">Seçili katalogda ürün satıri yok.</div>}
        {items.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Stok Kodu</th>
                  <th>Barkod</th>
                  <th>Ürün</th>
                  <th>Marka</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Görsel</th>
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
