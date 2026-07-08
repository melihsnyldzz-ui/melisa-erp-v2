import React, { useEffect, useMemo, useState } from 'react';
import { createCatalogDraft, fetchCatalogOverview } from '../../services/catalogApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';
import { API_BASE_URL } from '../../config/apiConfig.js';

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

function resolveImageUrl(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath) || imagePath.startsWith('data:')) return imagePath;
  return `${API_BASE_URL}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
}

function buildCatalogShareText(catalog, items = []) {
  const header = catalog
    ? `${catalog.catalogNo} - ${catalog.name}`
    : 'Melisa Bebe Katalog';
  const visibleItems = items.slice(0, 24);
  const lines = visibleItems.map((item, index) => (
    `${index + 1}. ${item.stockCode} - ${item.productName}`
  ));

  return [
    `Merhaba, ${header} hazır.`,
    '',
    ...lines,
    items.length > visibleItems.length ? `... ve ${items.length - visibleItems.length} ürün daha` : '',
    '',
    'Sipariş vermek istediğiniz ürün kodlarını yazabilirsiniz.',
    'Fiyat ve stok bilgisi satış ekibi tarafından teyit edilir.',
  ].filter(Boolean).join('\n');
}

function readinessText(product) {
  if (product?.hasImage) return 'Görsel var';
  return 'Görsel eksik';
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
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const candidates = overview?.productCandidates || [];
  const catalogs = overview?.catalogs || [];
  const items = overview?.items || [];
  const customers = overview?.customers || [];
  const summary = overview?.summary || {};
  const filterOptions = overview?.filterOptions || {};
  const selectedCatalog = catalogs.find((catalog) => Number(catalog.id) === Number(overview?.selectedCatalogId)) || catalogs[0] || null;
  const selectedCustomer = customers.find((customer) => Number(customer.id) === Number(selectedCustomerId))
    || customers.find((customer) => Number(customer.id) === Number(selectedCatalog?.customerId))
    || null;
  const catalogShareText = useMemo(() => buildCatalogShareText(selectedCatalog, items), [items, selectedCatalog]);
  const previewItems = items.slice(0, 6);

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
      setErrorMessage(`${error.message || 'Katalog verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedCatalog?.customerId && !selectedCustomerId) {
      setSelectedCustomerId(String(selectedCatalog.customerId));
    }
  }, [selectedCatalog?.customerId, selectedCustomerId]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function searchCatalogs() {
    loadOverview(filters);
  }

  function searchProducts() {
    loadOverview(filters);
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
        customerId: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        productIds: selectedProductIds,
      });
      setSuccessMessage(`${response.data.catalogNo} katalog taslağı oluşturuldu.`);
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
      setErrorMessage(`${error.message || 'Katalog taslağı oluşturulamadı.'} (${error.code || 'API_ERROR'})`);
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
        { label: 'Ürün', key: 'productName' },
        { label: 'Marka', key: 'brand' },
        { label: 'Stok', key: 'stockQuantity' },
        { label: 'Fiyat', key: 'price' },
        { label: 'PB', key: 'currency' },
        { label: 'Görsel', value: (row) => (row.hasImage ? 'Var' : 'Eksik') },
      ],
    });
  }

  async function copyCatalogText() {
    if (!catalogShareText || !navigator.clipboard) return;
    await navigator.clipboard.writeText(catalogShareText);
    setSuccessMessage('Katalog WhatsApp metni kopyalandı.');
  }

  function openWhatsappShare() {
    const url = `https://wa.me/?text=${encodeURIComponent(catalogShareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="work-area catalog-builder-screen">
      <section className="dashboard-toolbar catalog-builder-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Katalog Hazırlama</strong>
          <span>Ürün seç, taslak oluştur, WhatsApp veya çıktı için hazırla</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={() => onOpenScreen('whatsapp-planner')}>Mesaj Planı</button>
          <button
            type="button"
            onClick={() => onOpenScreen('whatsapp-web-queue', {
              catalogId: selectedCatalog?.id,
              catalogNo: selectedCatalog?.catalogNo,
              customerName: selectedCustomer?.customerName || selectedCatalog?.customerName || '',
              customerPhone: selectedCustomer?.phone || selectedCatalog?.customerPhone || '',
            })}
            disabled={!selectedCatalog || items.length === 0}
          >
            Görselli Gönderim Kuyruğu
          </button>
          <button type="button" onClick={copyCatalogText} disabled={items.length === 0}>Metni Kopyala</button>
          <button type="button" onClick={openWhatsappShare} disabled={items.length === 0}>Metinle WhatsApp Aç</button>
          <button type="button" onClick={exportCatalogItems} disabled={items.length === 0}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Katalog')}>Yazdır/PDF</button>
          <button type="button" onClick={() => loadOverview()}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Katalog verisi API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

      <section className="catalog-flow-strip">
        <article className="catalog-flow-card">
          <span>1. Ürün Seç</span>
          <strong>{selectedProductIds.length}</strong>
          <small>{candidates.length} ürün adayı listede</small>
        </article>
        <article className="catalog-flow-card">
          <span>2. Taslak Oluştur</span>
          <strong>{summary.catalogCount || 0}</strong>
          <small>{summary.catalogItemCount || 0} toplam katalog satırı</small>
        </article>
        <article className="catalog-flow-card">
          <span>3. Paylaş</span>
          <strong>{items.length}</strong>
          <small>{selectedCatalog ? selectedCatalog.catalogNo : 'Katalog seçilmedi'}</small>
        </article>
      </section>

      <section className="catalog-builder-layout">
        <section className="erp-panel catalog-builder-products">
          <div className="panel-title">
            <strong>Ürün Seçimi</strong>
            <span>Barkod, stok kodu, ürün adı, marka, kategori ve görsel durumuna göre süz</span>
          </div>

          <div className="catalog-filter-grid">
            <label className="catalog-filter-wide">
              Ürün / barkod
              <input
                value={filters.productSearch}
                onChange={(event) => updateFilter('productSearch', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') searchProducts();
                }}
                placeholder="Barkod / stok kodu / ürün adı / marka"
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
              PB
              <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
                <option value="">Tümü</option>
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
                <option value="">Tümü</option>
                <option value="withImage">Görseli olan</option>
                <option value="withoutImage">Görseli eksik</option>
              </select>
            </label>
            <label>
              Min
              <input type="number" min="0" value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} />
            </label>
            <label>
              Max
              <input type="number" min="0" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} />
            </label>
            <button type="button" onClick={searchProducts}>Ürün Ara</button>
            <button type="button" onClick={clearProductFilters}>Temizle</button>
            <button type="button" onClick={selectVisibleProducts} disabled={candidates.length === 0}>Görünenleri Seç</button>
          </div>

          {!isLoading && candidates.length === 0 && <div className="list-state">Filtreye uygun ürün bulunamadı.</div>}
          <div className="table-shell catalog-product-table-shell">
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
                {candidates.slice(0, 80).map((product) => (
                  <tr key={product.productId} className={selectedProductIds.includes(product.productId) ? 'selected-row' : ''}>
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
                      <span className={`status-pill ${product.hasImage ? 'good' : 'warn'}`}>
                        {readinessText(product)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="catalog-builder-side">
          <section className="erp-panel catalog-selected-panel">
            <div className="panel-title">
              <strong>Taslak Sepeti</strong>
              <span>{selectedProducts.length} ürün seçili</span>
            </div>
            <input
              className="catalog-draft-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Katalog adı: Örn. Haziran Toptan"
            />
            {selectedProducts.length === 0 && <div className="list-state">Taslak için ürün seçilmedi.</div>}
            {selectedProducts.length > 0 && (
              <div className="catalog-selected-list">
                {selectedProducts.slice(0, 16).map((product) => (
                  <article className="catalog-selected-item" key={`selected-${product.productId}`}>
                    <div>
                      <strong>{product.stockCode}</strong>
                      <span>{product.productName}</span>
                    </div>
                    <b>{formatMoney(product.salePrice, product.currency)}</b>
                    <button type="button" className="mini-button danger" onClick={() => toggleProduct(product)}>Çıkar</button>
                  </article>
                ))}
                {selectedProducts.length > 16 && (
                  <div className="list-state">+{selectedProducts.length - 16} ürün daha seçili.</div>
                )}
              </div>
            )}
            <label className="catalog-customer-select">
              Müşteri
              <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                <option value="">Müşteri seç</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customerName} / {customer.customerCode} {customer.phone ? ` / ${customer.phone}` : ' / telefon yok'}
                  </option>
                ))}
              </select>
            </label>
            {selectedCustomer ? (
              <div className="catalog-customer-card">
                <strong>{selectedCustomer.customerName}</strong>
                <span>{selectedCustomer.customerCode} / {selectedCustomer.phone || 'Telefon yok'}</span>
                <small>{selectedCustomer.city || '-'} / {selectedCustomer.currency}</small>
              </div>
            ) : (
              <div className="list-state">Katalog gönderimi için müşteri seçin.</div>
            )}
            <div className="catalog-side-actions">
              <button type="button" disabled={isSaving || selectedProducts.length === 0} onClick={handleCreateDraft}>
                {isSaving ? 'Kaydediliyor' : 'Taslak Oluştur'}
              </button>
              <button type="button" disabled={selectedProducts.length === 0} onClick={clearSelectedProducts}>Seçimi Temizle</button>
            </div>
          </section>

          <section className="erp-panel catalog-share-box">
            <div className="panel-title">
              <strong>Paylaşım</strong>
              <span>{selectedCatalog ? `${selectedCatalog.catalogNo} / ${items.length} ürün` : 'Katalog seç'}</span>
            </div>
            {items.length === 0 && <div className="list-state">Paylaşım için katalog seçin veya taslak oluşturun.</div>}
            {items.length > 0 && (
              <>
                <div className="catalog-preview-grid">
                  {previewItems.map((item) => (
                    <article className="catalog-preview-card" key={`preview-${item.id}`}>
                      {item.imagePath ? (
                        <img alt={item.productName || item.stockCode || 'Ürün'} src={resolveImageUrl(item.imagePath)} />
                      ) : (
                        <span>Görsel yok</span>
                      )}
                      <strong>{item.stockCode}</strong>
                      <small>Fiyat satış teyidine bağlı</small>
                    </article>
                  ))}
                </div>
                <textarea className="catalog-share-textarea" readOnly value={catalogShareText} />
                <div className="catalog-side-actions">
                  <button type="button" onClick={copyCatalogText}>Metni Kopyala</button>
                  <button type="button" onClick={openWhatsappShare}>Metinle WhatsApp Aç</button>
                </div>
              </>
            )}
          </section>
        </aside>
      </section>

      <section className="catalog-bottom-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Kataloglar</strong>
            <span>{catalogs.length} satır</span>
          </div>
          <div className="catalog-list-filter-row">
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') searchCatalogs();
              }}
              placeholder="Katalog no, ad veya müşteri ara"
            />
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Tüm durumlar</option>
              <option value="draft">Taslak</option>
              <option value="published">Yayında</option>
              <option value="archived">Arşiv</option>
            </select>
            <button type="button" onClick={searchCatalogs}>Ara</button>
          </div>
          {!isLoading && catalogs.length === 0 && <div className="list-state">Katalog bulunamadı.</div>}
          {catalogs.length > 0 && (
            <div className="table-shell catalog-bottom-table-shell">
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
                      className={Number(overview?.selectedCatalogId) === Number(catalog.id) ? 'selected-row' : 'clickable-row'}
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
            <strong>Seçili Katalog Ürünleri</strong>
            <span>{selectedCatalog ? selectedCatalog.name : 'Katalog seçin'}</span>
          </div>
          {items.length === 0 && <div className="list-state">Seçili katalogda ürün satırı yok.</div>}
          {items.length > 0 && (
            <div className="table-shell catalog-bottom-table-shell">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
