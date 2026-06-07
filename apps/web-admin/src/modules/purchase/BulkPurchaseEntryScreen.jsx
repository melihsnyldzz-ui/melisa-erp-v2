import React, { useEffect, useMemo, useState } from 'react';
import { createPurchaseDraft, finalizePurchaseDraft } from '../../services/invoiceDraftApi.js';
import { fetchCurrencyRates, rateValueForCurrency } from '../../services/currencyRateApi.js';
import { fetchProducts } from '../../services/productApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function exchangeRateFor(currencyRates, currency) {
  const nextCurrency = String(currency || 'TRY').toUpperCase();
  if (nextCurrency === 'TRY') {
    return 1;
  }

  return rateValueForCurrency(currencyRates, nextCurrency);
}

function convertAmount(amount, sourceCurrency, targetCurrency, currencyRates) {
  const sourceRate = exchangeRateFor(currencyRates, sourceCurrency);
  const targetRate = exchangeRateFor(currencyRates, targetCurrency);

  if (sourceRate === null || targetRate === null || !Number.isFinite(Number(sourceRate)) || !Number.isFinite(Number(targetRate))) {
    return null;
  }

  return Math.round(((Number(amount || 0) * Number(sourceRate)) / Number(targetRate)) * 10000) / 10000;
}

function supplierLabel(supplier) {
  if (!supplier) {
    return '-';
  }

  return `${supplier.supplierCode || supplier.code || supplier.id} / ${supplier.supplierName || supplier.name}`;
}

function productLabel(product) {
  if (!product) {
    return '-';
  }

  return `${product.stockCode} / ${product.productName}`;
}

function groupRowsBySupplier(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = String(row.supplierId);
    const current = grouped.get(key) || {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      supplierCode: row.supplierCode,
      supplierCurrency: row.supplierCurrency,
      supplierDiscountRate: Number(row.supplierDiscountRate || 0),
      exchangeRate: Number(row.exchangeRate || 1),
      rows: [],
      total: 0,
      totalTry: 0,
    };

    current.rows.push(row);
    current.total += Number(row.lineTotal || 0);
    current.totalTry += Number(row.lineTotalTry || 0);
    grouped.set(key, current);
  });

  return Array.from(grouped.values());
}

function makeDraftPayload(group, documentDate) {
  return {
    documentNo: '',
    documentDate,
    supplierId: group.supplierId,
    supplierName: group.supplierName,
    supplierCurrency: group.supplierCurrency,
    documentCurrency: group.supplierCurrency,
    exchangeRate: group.exchangeRate || 1,
    description: `Toplu alis girisi - ${group.rows.length} satir`,
    invoiceDiscountRate: 0,
    supplierDiscountRate: 0,
    items: group.rows.map((row) => ({
      productId: row.productId,
      stockCode: row.stockCode,
      barcode: row.barcode,
      productName: row.productName,
      quantity: row.quantity,
      currency: row.supplierCurrency,
      purchasePrice: row.purchasePrice,
      lineDiscountRate: row.lineDiscountRate,
      stockEffect: `+${row.quantity} taslak`,
      note: `Toplu alis / ${row.supplierCode}`,
    })),
  };
}

export function BulkPurchaseEntryScreen({ permissions = [], onDirtyChange, onOpenScreen }) {
  const [documentDate, setDocumentDate] = useState(todayIsoDate());
  const [supplierQuery, setSupplierQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [lineDiscountRate, setLineDiscountRate] = useState(0);
  const [rows, setRows] = useState([]);
  const [currencyRates, setCurrencyRates] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('Farkli tedarikcilerden satir ekleyin; sistem kayitta tedarikciye gore ayri alis fisleri olusturur.');
  const [isLoadingLookup, setIsLoadingLookup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState([]);
  const canCreate = permissions.includes('purchase.create');
  const canFinalize = permissions.includes('purchase.finalize');
  const selectedSupplier = useMemo(
    () => suppliers.find((item) => String(item.id) === String(supplierId)) || null,
    [supplierId, suppliers],
  );
  const selectedProduct = useMemo(
    () => products.find((item) => String(item.productId) === String(productId)) || null,
    [productId, products],
  );
  const supplierProducts = useMemo(() => {
    if (!selectedSupplier) {
      return [];
    }

    return products.filter((product) => String(product.supplierId || '') === String(selectedSupplier.id));
  }, [products, selectedSupplier]);
  const groupedRows = useMemo(() => groupRowsBySupplier(rows), [rows]);
  const totals = useMemo(() => rows.reduce((summary, row) => ({
    quantity: summary.quantity + Number(row.quantity || 0),
    totalTry: summary.totalTry + Number(row.lineTotalTry || 0),
  }), { quantity: 0, totalTry: 0 }), [rows]);

  useEffect(() => {
    onDirtyChange?.(rows.length > 0);
  }, [onDirtyChange, rows.length]);

  useEffect(() => {
    let isMounted = true;

    async function loadRates() {
      try {
        const response = await fetchCurrencyRates({ date: documentDate });
        if (isMounted) {
          setCurrencyRates(response.data);
        }
      } catch (error) {
        if (isMounted) {
          setCurrencyRates(null);
          setErrorMessage(`Kur bilgisi okunamadi: ${error.message || 'API_ERROR'}`);
        }
      }
    }

    loadRates();
    return () => {
      isMounted = false;
    };
  }, [documentDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      setIsLoadingLookup(true);
      try {
        const [supplierResponse, productResponse] = await Promise.all([
          fetchSuppliers({ page: 1, limit: 100, search: supplierQuery, activeOnly: true }),
          fetchProducts({ page: 1, limit: 250, search: productQuery, barcode: productQuery, supplierId, activeOnly: true }),
        ]);

        if (!isMounted) {
          return;
        }

        const nextSuppliers = supplierResponse.data || [];
        const nextProducts = (productResponse.data || []).map((product) => ({
          productId: product.id,
          stockCode: product.stockCode,
          supplierId: product.supplierId || null,
          supplierCode: product.supplierCode || null,
          supplierName: product.supplierName || null,
          barcode: product.matchedBarcode || product.barcodeMasked || '-',
          productName: product.productName,
          currency: product.currency || 'TRY',
          purchasePrice: Number(product.purchasePrice || 0),
          lineDiscountRate: Number(product.purchaseDiscountRate || 0),
          isPassive: Boolean(product.isPassive),
        }));

        setSuppliers(nextSuppliers);
        setProducts(nextProducts);
        setSupplierId((current) => (current && nextSuppliers.some((item) => String(item.id) === String(current)) ? current : String(nextSuppliers[0]?.id ?? '')));
        setProductId('');
        setErrorMessage('');
      } catch (error) {
        if (isMounted) {
          setSuppliers([]);
          setProducts([]);
          setErrorMessage(`${error.message || 'Lookup verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
        }
      } finally {
        if (isMounted) {
          setIsLoadingLookup(false);
        }
      }
    }

    loadLookups();
    return () => {
      isMounted = false;
    };
  }, [productQuery, supplierId, supplierQuery]);

  useEffect(() => {
    if (!selectedSupplier) {
      setProductId('');
      return;
    }

    setProductId((current) => (
      current && supplierProducts.some((item) => String(item.productId) === String(current))
        ? current
        : String(supplierProducts[0]?.productId ?? '')
    ));
  }, [selectedSupplier, supplierProducts]);

  useEffect(() => {
    if (!selectedProduct) {
      setPurchasePrice('');
      setLineDiscountRate(0);
      return;
    }

    const targetCurrency = selectedSupplier?.currency || selectedProduct.currency || 'TRY';
    const convertedPrice = convertAmount(selectedProduct.purchasePrice, selectedProduct.currency, targetCurrency, currencyRates);
    setPurchasePrice(convertedPrice === null ? selectedProduct.purchasePrice : convertedPrice);
    setLineDiscountRate(Number(selectedSupplier?.purchaseDiscountRate ?? selectedProduct.lineDiscountRate ?? 0));
  }, [currencyRates, selectedProduct, selectedSupplier]);

  function addRow() {
    if (!selectedSupplier) {
      setErrorMessage('Satir eklemek icin tedarikci secin.');
      return;
    }

    if (!selectedProduct) {
      setErrorMessage('Bu tedarikciye bagli urun bulunamadi veya urun secilmedi.');
      return;
    }

    if (String(selectedProduct.supplierId || '') !== String(selectedSupplier.id)) {
      setErrorMessage('Secilen urun bu tedarikciye bagli degil. Once dogru tedarikciyi secin.');
      return;
    }

    if (Number(quantity) <= 0 || Number(purchasePrice) <= 0) {
      setErrorMessage('Miktar ve alis fiyati 0 veya negatif olamaz.');
      return;
    }

    if (Number(lineDiscountRate) < 0 || Number(lineDiscountRate) > 100) {
      setErrorMessage('Satir iskonto orani 0-100 arasinda olmali.');
      return;
    }

    const supplierCurrency = selectedSupplier.currency || 'TRY';
    const supplierRate = exchangeRateFor(currencyRates, supplierCurrency);
    if (supplierRate === null) {
      setErrorMessage(`${supplierCurrency} kuru tanimli degil. Doviz Kurlari ekranindan kur girin.`);
      return;
    }

    const gross = Number(quantity) * Number(purchasePrice);
    const lineTotal = gross - gross * (Number(lineDiscountRate || 0) / 100);
    const lineTotalTry = lineTotal * Number(supplierRate || 1);
    const nextId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setRows((current) => [
      ...current,
      {
        id: nextId,
        supplierId: selectedSupplier.id,
        supplierCode: selectedSupplier.supplierCode || selectedSupplier.code || String(selectedSupplier.id),
        supplierName: selectedSupplier.supplierName || selectedSupplier.name,
        supplierCurrency,
        supplierDiscountRate: Number(selectedSupplier.purchaseDiscountRate || 0),
        exchangeRate: Number(supplierRate || 1),
        productId: selectedProduct.productId,
        stockCode: selectedProduct.stockCode,
        barcode: selectedProduct.barcode,
        productName: selectedProduct.productName,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
        lineDiscountRate: Number(lineDiscountRate || 0),
        lineTotal,
        lineTotalTry,
      },
    ]);
    setErrorMessage('');
    setResults([]);
    setStatusMessage('Satir eklendi. Kayitta tedarikciye gore ayri alis taslaklari olusacak.');
  }

  function handleEntryKeyDown(event) {
    if (event.key !== 'Enter') {
      return;
    }

    const tagName = String(event.target?.tagName || '').toLowerCase();
    if (!['input', 'select'].includes(tagName)) {
      return;
    }

    event.preventDefault();
    addRow();
  }

  function deleteRow(rowId) {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setResults([]);
  }

  async function createGroupedDrafts({ finalize = false } = {}) {
    if (!canCreate) {
      setErrorMessage('Bu islem icin purchase.create yetkisi gerekli.');
      return;
    }

    if (finalize && !canFinalize) {
      setErrorMessage('Kesinlestirme icin purchase.finalize yetkisi gerekli.');
      return;
    }

    if (rows.length === 0) {
      setErrorMessage('Once en az bir alis satiri ekleyin.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setResults([]);

    const nextResults = [];

    try {
      for (const group of groupedRows) {
        const payload = makeDraftPayload(group, documentDate);
        const draftResponse = await createPurchaseDraft(payload);
        let finalResponse = null;

        if (finalize) {
          finalResponse = await finalizePurchaseDraft(draftResponse.data.id);
        }

        const savedData = finalResponse?.data || draftResponse.data;
        nextResults.push({
          ok: true,
          supplierName: group.supplierName,
          rowCount: group.rows.length,
          draftId: savedData.id,
          documentNo: savedData.documentNo,
          status: savedData.status,
          message: finalize ? 'Kesinlesti' : 'Taslak olustu',
        });
      }

      setResults(nextResults);
      setRows([]);
      setStatusMessage(`${nextResults.length} tedarikci icin ${nextResults.length} alis fisi ${finalize ? 'olusturuldu ve kesinlesti' : 'taslak olarak olusturuldu'}.`);
    } catch (error) {
      nextResults.push({
        ok: false,
        supplierName: 'Islem durdu',
        message: `${error.message || 'Alis fisleri olusturulamadi.'} (${error.code || 'API_ERROR'})`,
      });
      setResults(nextResults);
      setErrorMessage(nextResults[nextResults.length - 1].message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="work-area bulk-purchase-screen">
      <section className="purchase-invoice-toolbar">
        <div className="purchase-toolbar-title">
          <strong>Toplu Alis Girisi</strong>
          <span>Tek ekrandan cok tedarikcili satir gir, sistem resmi fisleri tedarikciye gore ayirsin.</span>
        </div>
        <div className="purchase-toolbar-actions">
          <button type="button" onClick={() => setRows([])} disabled={isSaving || rows.length === 0}>Sepeti Temizle</button>
          <button type="button" onClick={() => createGroupedDrafts()} disabled={isSaving || rows.length === 0 || !canCreate}>
            {isSaving ? 'Kaydediliyor' : 'Taslaklari Olustur'}
          </button>
          <button type="button" className="primary" onClick={() => createGroupedDrafts({ finalize: true })} disabled={isSaving || rows.length === 0 || !canCreate || !canFinalize}>
            Olustur ve Kesinlestir
          </button>
          <button type="button" onClick={() => onOpenScreen?.('purchase-invoice-list')}>Alis Fisleri</button>
        </div>
      </section>

      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {statusMessage && <div className="list-state list-state-success">{statusMessage}</div>}

      <section className="bulk-purchase-layout">
        <section className="erp-panel bulk-purchase-entry-panel">
          <div className="panel-title">
            <strong>Satir Ekle</strong>
            <span>Her satir kendi tedarikcisiyle kaydedilir</span>
          </div>
          <div className="bulk-purchase-entry-grid" onKeyDown={handleEntryKeyDown}>
            <label>
              <span>Tarih</span>
              <input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </label>
            <label>
              <span>Tedarikci ara</span>
              <input value={supplierQuery} onChange={(event) => setSupplierQuery(event.target.value)} placeholder="Ad / telefon / sehir" />
            </label>
            <label>
              <span>Tedarikci sec</span>
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplierLabel(supplier)} / Isk %{Number(supplier.purchaseDiscountRate || 0)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Urun ara</span>
              <input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Barkod / stok kodu / urun adi" />
            </label>
            <label>
              <span>Urun sec</span>
              <select value={productId} onChange={(event) => setProductId(event.target.value)}>
                {supplierProducts.length === 0 && (
                  <option value="">Bu tedarikciye bagli urun yok</option>
                )}
                {supplierProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>{productLabel(product)} / {formatMoney(product.purchasePrice, product.currency)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Miktar</span>
              <input min="0.001" step="0.001" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label>
              <span>Alis fiyat</span>
              <input min="0.01" step="0.01" type="number" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
            </label>
            <label>
              <span>Satir isk %</span>
              <input min="0" max="100" step="0.01" type="number" value={lineDiscountRate} onChange={(event) => setLineDiscountRate(event.target.value)} />
            </label>
            <button type="button" onClick={addRow} disabled={isLoadingLookup || isSaving}>Satir Ekle</button>
          </div>
          <div className="purchase-supplier-snapshot bulk-purchase-snapshot">
            <span><b>Tedarikci</b>{selectedSupplier ? supplierLabel(selectedSupplier) : '-'}</span>
            <span><b>PB</b>{selectedSupplier?.currency || '-'}</span>
            <span><b>Bakiye</b>{selectedSupplier ? formatMoney(selectedSupplier.balance, selectedSupplier.currency) : '-'}</span>
            <span><b>Kur</b>{selectedSupplier ? `${selectedSupplier.currency} ${Number(exchangeRateFor(currencyRates, selectedSupplier.currency) || 0).toFixed(4)}` : '-'}</span>
          </div>
        </section>

        <aside className="erp-panel bulk-purchase-summary-panel">
          <div className="panel-title">
            <strong>Olusacak Fis Ozeti</strong>
            <span>Tedarikci bazli resmi fisler</span>
          </div>
          <div className="entity-360-grid bulk-purchase-summary-grid">
            <div className="entity-360-card">
              <span>Tedarikci</span>
              <strong>{groupedRows.length}</strong>
              <small>Olusacak fis sayisi</small>
            </div>
            <div className="entity-360-card stock-card">
              <span>Satir</span>
              <strong>{rows.length}</strong>
              <small>{totals.quantity} adet</small>
            </div>
            <div className="entity-360-card price-card">
              <span>TRY karsilik</span>
              <strong>{formatMoney(totals.totalTry, 'TRY')}</strong>
              <small>Kur snapshot ile</small>
            </div>
          </div>
          <div className="bulk-purchase-group-list">
            {groupedRows.length === 0 ? <span>Sepet bos.</span> : groupedRows.map((group) => (
              <button key={group.supplierId} type="button" onClick={() => setSupplierId(String(group.supplierId))}>
                <b>{group.supplierCode}</b>
                <span>{group.rows.length} satir / {formatMoney(group.total, group.supplierCurrency)}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="erp-panel bulk-purchase-lines-panel">
        <div className="panel-title">
          <strong>Toplu Alis Satirlari</strong>
          <span>Farkli tedarikci satirlari burada birlikte gorunur; kayitta ayrilir.</span>
        </div>
        {rows.length === 0 ? (
          <div className="list-state">Henuz satir yok. Tedarikci ve urun secip satir ekleyin.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tedarikci</th>
                  <th>Stok kodu</th>
                  <th>Barkod</th>
                  <th>Urun</th>
                  <th>Miktar</th>
                  <th>PB</th>
                  <th>Alis fiyat</th>
                  <th>Isk %</th>
                  <th>Toplam</th>
                  <th>TRY</th>
                  <th>Islem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.supplierCode}</b><br /><small>{row.supplierName}</small></td>
                    <td className="code-cell">{row.stockCode}</td>
                    <td>{row.barcode}</td>
                    <td>{row.productName}</td>
                    <td className="in-cell">+{row.quantity}</td>
                    <td>{row.supplierCurrency}</td>
                    <td className="money-cell">{formatMoney(row.purchasePrice, row.supplierCurrency)}</td>
                    <td>%{row.lineDiscountRate}</td>
                    <td className="money-cell">{formatMoney(row.lineTotal, row.supplierCurrency)}</td>
                    <td className="money-cell purchase-cost-try">{formatMoney(row.lineTotalTry, 'TRY')}</td>
                    <td><button type="button" onClick={() => deleteRow(row.id)}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {results.length > 0 && (
        <section className="erp-panel bulk-purchase-results-panel">
          <div className="panel-title">
            <strong>Olusan Fisler</strong>
            <span>Her satir tedarikci bazli resmi alis fisine donustu</span>
          </div>
          <div className="bulk-purchase-result-list">
            {results.map((result, index) => (
              <button
                key={`${result.draftId || index}-${result.supplierName}`}
                type="button"
                className={result.ok ? 'success-result' : 'error-result'}
                onClick={() => result.draftId && onOpenScreen?.('purchase-invoice', { purchaseDraftId: result.draftId, invoiceNo: result.documentNo })}
              >
                <b>{result.supplierName}</b>
                <span>{result.message} {result.documentNo ? `/ ${result.documentNo}` : ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
