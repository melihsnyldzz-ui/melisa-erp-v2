import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardList, Save, Trash2 } from 'lucide-react';
import { createPurchaseDraft, finalizePurchaseDraft } from '../../services/invoiceDraftApi.js';
import { fetchCurrencyRates, rateValueForCurrency } from '../../services/currencyRateApi.js';
import { fetchProducts } from '../../services/productApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { API_BASE_URL, apiConfig } from '../../config/apiConfig.js';
import { fetchAllPages } from '../../utils/fetchAllPages.js';
import { purchaseProductAvailable, resolvePurchaseProduct, resolveSupplierSelection, supplierSelectionLabel } from '../../utils/purchaseSelection.js';
import { saveBulkPurchaseGroups } from '../../utils/bulkPurchaseSave.js';
import { assignPreparedRowsToSupplier, calculatePreparedPurchaseRow, newPurchasePreparationId, purchasePreparationStorageKey, readPurchasePreparation, sessionPreparationStorage, writePurchasePreparation } from '../../utils/purchasePreparation.js';
import './purchase-preparation.css';

function todayIsoDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatMoney(amount, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

function exchangeRateFor(currencyRates, currency) {
  const nextCurrency = String(currency || 'TRY').toUpperCase();
  if (nextCurrency === 'TRY') {
    return 1;
  }

  if (!currencyRates?.rates?.some((rate) => rate.currency === nextCurrency)) return null;
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
    current.total += Number(row.netLineTotal || 0);
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
    description: `Toplu alış girişi - ${group.rows.length} satır`,
    invoiceDiscountRate: 0,
    supplierDiscountRate: group.supplierDiscountRate,
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
      note: `Toplu alış / ${row.supplierCode}`,
    })),
  };
}

export function BulkPurchaseEntryScreen({ permissions = [], onDirtyChange, onOpenScreen, initialPreparation = null, userId }) {
  const storageKey = purchasePreparationStorageKey(apiConfig.baseUrl, userId, initialPreparation?.id);
  const [restored] = useState(() => readPurchasePreparation(sessionPreparationStorage(), storageKey));
  const [documentDate, setDocumentDate] = useState(restored?.documentDate || todayIsoDate());
  const [pendingRows, setPendingRows] = useState(restored?.pendingRows ?? initialPreparation?.rows ?? []);
  const [pendingSelection, setPendingSelection] = useState(() => (restored?.pendingRows ?? initialPreparation?.rows ?? []).map((row) => row.id));
  const [isReviewing, setIsReviewing] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const inFlightRef = useRef(false);
  const productInputRef = useRef(null);
  const reviewPanelRef = useRef(null);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [lineDiscountRate, setLineDiscountRate] = useState(0);
  const [rows, setRows] = useState(restored?.rows || []);
  const [currencyRates, setCurrencyRates] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('Ürünleri ve adetleri hazırlayın; alış belgesini kontrol edip kesinleştirdiğinizde stok ve tedarikçi borcu oluşur.');
  const [isLoadingLookup, setIsLoadingLookup] = useState(false);
  const [suppliersReady, setSuppliersReady] = useState(false);
  const [creationNeedsReview, setCreationNeedsReview] = useState(Boolean(restored?.creationNeedsReview));
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState(restored?.results || []);
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

    return products.filter((product) => purchaseProductAvailable(product, selectedSupplier.id, apiConfig.pilotMode));
  }, [products, selectedSupplier]);
  const groupedRows = useMemo(() => groupRowsBySupplier(rows), [rows]);
  const totals = useMemo(() => rows.reduce((summary, row) => ({
    quantity: summary.quantity + Number(row.quantity || 0),
    totalTry: summary.totalTry + Number(row.lineTotalTry || 0),
  }), { quantity: 0, totalTry: 0 }), [rows]);

  useEffect(() => {
    onDirtyChange?.(rows.length > 0 || pendingRows.length > 0 || creationNeedsReview || isSaving);
  }, [onDirtyChange, rows.length, pendingRows.length, creationNeedsReview, isSaving]);

  useEffect(() => {
    if (!isReviewing) return;
    const panel = reviewPanelRef.current;
    const scroller = panel?.closest('.work-area');
    if (panel && scroller) {
      scroller.scrollTop += panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
    }
    reviewPanelRef.current?.focus({ preventScroll: true });
  }, [isReviewing]);

  useEffect(() => {
    const saved = writePurchasePreparation(sessionPreparationStorage(), storageKey, {
      rows, pendingRows, results, documentDate, creationNeedsReview, inFlight: inFlightRef.current,
    });
    setStorageWarning(saved ? '' : 'Bu hazırlık tarayıcı oturumuna kaydedilemiyor. Kayıttan önce oturumun yeniden açılması gerekiyor.');
  }, [storageKey, rows, pendingRows, results, documentDate, creationNeedsReview, isSaving]);

  useEffect(() => {
    let isMounted = true;

    async function loadRates() {
      setCurrencyRates(null);
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
    fetchAllPages(fetchSuppliers, { activeOnly: true })
      .then((allSuppliers) => {
        if (!isMounted) return;
        setSuppliers(allSuppliers);
        setSuppliersReady(true);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(`Tedarikçi listesi tamamlanamadı: ${error.message || 'API_ERROR'}`);
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      setIsLoadingLookup(true);
      try {
        const productResponse = supplierId
          ? await fetchProducts({ page: 1, limit: 250, search: productQuery, barcode: productQuery, supplierId: apiConfig.pilotMode ? undefined : supplierId, activeOnly: true })
          : { data: [] };

        if (!isMounted) {
          return;
        }

        const nextProducts = (productResponse.data || []).map((product) => ({
          productId: product.id,
          stockCode: product.stockCode,
          supplierId: product.supplierId || null,
          supplierCode: product.supplierCode || null,
          supplierName: product.supplierName || null,
          barcode: product.matchedBarcode || product.barcodeMasked || '-',
          productName: product.productName,
          imageUrl: resolveImageUrl(product.imageUrl),
          currency: product.currency || 'TRY',
          purchasePrice: Number(product.purchasePrice || 0),
          lineDiscountRate: Number(product.purchaseDiscountRate || 0),
          isPassive: Boolean(product.isPassive),
        }));

        setProducts((currentProducts) => {
          const merged = new Map(currentProducts.map((product) => [String(product.productId), product]));
          nextProducts.forEach((product) => merged.set(String(product.productId), product));
          return Array.from(merged.values());
        });
        setErrorMessage('');
      } catch (error) {
        if (isMounted) {
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
  }, [productQuery, supplierId]);

  useEffect(() => {
    if (!selectedSupplier) {
      setProductId('');
      return;
    }

    const product = resolvePurchaseProduct(supplierProducts, productQuery);
    setProductId(product ? String(product.productId) : '');
  }, [productQuery, selectedSupplier, supplierProducts]);

  useEffect(() => {
    if (!selectedProduct) {
      setPurchasePrice('');
      setLineDiscountRate(0);
      return;
    }

    const targetCurrency = selectedSupplier?.currency || selectedProduct.currency || 'TRY';
    const convertedPrice = convertAmount(selectedProduct.purchasePrice, selectedProduct.currency, targetCurrency, currencyRates);
    setPurchasePrice(convertedPrice === null ? '' : convertedPrice);
    setLineDiscountRate(Number(selectedProduct.lineDiscountRate || 0));
  }, [currencyRates, selectedProduct, selectedSupplier]);

  function addRow() {
    if (isSaving || isLoadingLookup || !suppliersReady || creationNeedsReview) return;
    if (!selectedSupplier) {
      setErrorMessage('Satır eklemek için tedarikçi seçin.');
      return;
    }

    if (!selectedProduct) {
      setErrorMessage('Ürün seçilmedi; barkod veya stok koduyla seçim yapın.');
      return;
    }

    if (!purchaseProductAvailable(selectedProduct, selectedSupplier.id, apiConfig.pilotMode)) {
      setErrorMessage('Seçilen ürün bu tedarikçiye bağlı değil. Önce doğru tedarikçiyi seçin.');
      return;
    }

    if (!Number.isFinite(Number(quantity)) || !Number.isFinite(Number(purchasePrice)) || Number(quantity) <= 0 || Number(purchasePrice) <= 0) {
      setErrorMessage('Miktar ve alış fiyatı 0 veya negatif olamaz.');
      return;
    }

    if (Number(lineDiscountRate) < 0 || Number(lineDiscountRate) > 100) {
      setErrorMessage('Satır iskonto oranı 0-100 arasında olmalı.');
      return;
    }

    const supplierCurrency = selectedSupplier.currency || 'TRY';
    const supplierRate = exchangeRateFor(currencyRates, supplierCurrency);
    if (supplierRate === null) {
      setErrorMessage(`${supplierCurrency} kuru tanımlı değil. Döviz Kurları ekranından kur girin.`);
      return;
    }

    const gross = Number(quantity) * Number(purchasePrice);
    const lineTotal = gross - gross * (Number(lineDiscountRate || 0) / 100);
    const supplierDiscountRate = Number(selectedSupplier.purchaseDiscountRate || 0);
    const supplierDiscountShare = lineTotal * (supplierDiscountRate / 100);
    const netLineTotal = lineTotal - supplierDiscountShare;
    const lineTotalTry = netLineTotal * Number(supplierRate || 1);
    const nextId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setRows((current) => [
      ...current,
      {
        id: nextId,
        supplierId: selectedSupplier.id,
        supplierCode: selectedSupplier.supplierCode || selectedSupplier.code || String(selectedSupplier.id),
        supplierName: selectedSupplier.supplierName || selectedSupplier.name,
        supplierCurrency,
        supplierDiscountRate,
        exchangeRate: Number(supplierRate || 1),
        productId: selectedProduct.productId,
        stockCode: selectedProduct.stockCode,
        barcode: selectedProduct.barcode,
        productName: selectedProduct.productName,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
        lineDiscountRate: Number(lineDiscountRate || 0),
        lineTotal,
        supplierDiscountShare,
        netLineTotal,
        lineTotalTry,
      },
    ]);
    setIsReviewing(false);
    setProductQuery('');
    setProductId('');
    setQuantity(1);
    productInputRef.current?.focus();
    setErrorMessage('');
    setStatusMessage('Satır eklendi. Kayıtta tedarikçiye göre ayrı alış taslakları oluşacak.');
  }

  function updateBulkSupplierQuery(value) {
    setSupplierQuery(value);
    const match = suppliersReady ? resolveSupplierSelection(suppliers, value) : null;

    if (match) {
      setSupplierId(String(match.id));
      setSupplierQuery(supplierSelectionLabel(match));
      setProducts([]);
      setProductQuery('');
      setProductId('');
    } else {
      setSupplierId('');
      setProductId('');
    }
  }

  function updateBulkProductQuery(value) {
    setProductQuery(value);
    const match = resolvePurchaseProduct(supplierProducts, value);
    setProductId(match ? String(match.productId) : '');
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
    setIsReviewing(false);
  }

  function addPreparedRows() {
    if (isSaving || creationNeedsReview || !suppliersReady) return;
    try {
      const selected = pendingRows.filter((row) => pendingSelection.includes(row.id));
      if (selected.length === 0) throw new Error('Alışa eklenecek hazırlık satırlarını seçin.');
      const added = assignPreparedRowsToSupplier(selected, selectedSupplier, (currency) => exchangeRateFor(currencyRates, currency));
      setRows((current) => [...current, ...added]);
      const ids = new Set(selected.map((row) => row.id));
      setPendingRows((current) => current.filter((row) => !ids.has(row.id)));
      setPendingSelection((current) => current.filter((id) => !ids.has(id)));
      setIsReviewing(false);
      setErrorMessage('');
      setStatusMessage(`${added.length} hazırlanmış ürün ${selectedSupplier.supplierName || selectedSupplier.name} alışına eklendi. Stok henüz değişmedi.`);
    } catch (error) { setErrorMessage(error.message); }
  }

  function updatePreparedRow(rowId, field, value, input) {
    try {
      const current = rows.find((row) => row.id === rowId);
      const updated = calculatePreparedPurchaseRow({ ...current, [field]: value });
      setRows((currentRows) => currentRows.map((row) => row.id === rowId ? updated : row));
      setIsReviewing(false);
      setErrorMessage('');
    } catch (error) {
      input.value = rows.find((row) => row.id === rowId)?.[field] ?? '';
      setErrorMessage(error.message);
    }
  }

  function reviewPurchase() {
    try {
      if (rows.length === 0) throw new Error('Önce alış satırlarını hazırlayın.');
      rows.forEach(calculatePreparedPurchaseRow);
      setIsReviewing(true);
      setErrorMessage('');
    } catch (error) { setErrorMessage(error.message); }
  }

  async function createGroupedDrafts({ finalize = false } = {}) {
    if (isSaving || inFlightRef.current || creationNeedsReview || !isReviewing) return;
    if (!canCreate) {
      setErrorMessage('Bu işlem için purchase.create yetkisi gerekli.');
      return;
    }

    if (finalize && !canFinalize) {
      setErrorMessage('Kesinleştirme için purchase.finalize yetkisi gerekli.');
      return;
    }

    if (rows.length === 0) {
      setErrorMessage('Önce en az bir alış satırı ekleyin.');
      return;
    }

    // Persist before sending. A page reload or lost response must never make this
    // batch look safe to submit again.
    if (!writePurchasePreparation(sessionPreparationStorage(), storageKey, { rows, pendingRows, results,
      documentDate, creationNeedsReview: false, inFlight: true })) {
      setErrorMessage('Hazırlık oturuma kaydedilemedi; tekrar kayıt güvenliği için işlem başlatılmadı.');
      return;
    }
    inFlightRef.current = true;
    setIsSaving(true);
    setErrorMessage('');

    try {
      const outcome = await saveBulkPurchaseGroups({
        groups: groupedRows,
        makePayload: (group) => makeDraftPayload(group, documentDate),
        createDraft: createPurchaseDraft,
        finalizeDraft: finalizePurchaseDraft,
        finalize,
        onCreated: (group) => {
          const savedIds = new Set(group.rows.map((row) => row.id));
          setRows((current) => current.filter((row) => !savedIds.has(row.id)));
        },
        onResult: (result) => {
          setResults((current) => [...current, result]);
          if (!result.ok) setErrorMessage(result.message);
        },
      });
      setCreationNeedsReview(outcome.creationNeedsReview);
      setStatusMessage(outcome.stopped
        ? 'İşlem durdu. Oluşan fişler aşağıda korunuyor; kaydı doğrulanan satırlar yeniden gönderilmez.'
        : `${groupedRows.length} tedarikçi için alış fişleri ${finalize ? 'oluşturuldu ve kesinleşti' : 'taslak olarak oluşturuldu'}.`);
    } finally {
      inFlightRef.current = false;
      setIsSaving(false);
      setIsReviewing(false);
    }
  }

  return (
    <main className="work-area bulk-purchase-screen">
      <section className="purchase-invoice-toolbar">
        <div className="purchase-toolbar-title">
          <strong>Alış Hazırlığı</strong>
          <span>Toplu Alış Girişi: ürün ve adetleri tamamlayın, ardından alış belgesini oluşturun.</span>
        </div>
        <div className="purchase-toolbar-actions">
          <button type="button" disabled={isSaving} onClick={() => { const id = newPurchasePreparationId(); onOpenScreen?.('bulk-purchase-entry', { purchasePreparationId: id, tabLabel: 'Yeni hazırlık', preparation: { id, rows: [] } }); }}>Boş Yeni Hazırlık</button>
          <button type="button" onClick={() => { setRows([]); setPendingRows([]); setIsReviewing(false); }} disabled={isSaving || creationNeedsReview || (rows.length === 0 && pendingRows.length === 0)}><Trash2 size={15} />Hazırlığı Temizle</button>
          <button type="button" className="primary" onClick={reviewPurchase} disabled={isSaving || isReviewing || creationNeedsReview || rows.length === 0 || !canCreate}>
            <ClipboardList size={15} />{isSaving ? 'Kaydediliyor' : 'Alış Belgesini İncele'}
          </button>
          <button type="button" onClick={() => onOpenScreen?.('purchase-invoice-list')}><ClipboardList size={15} />Alış Fişleri</button>
        </div>
      </section>

      <div className="purchase-preparation-flow" aria-label="Alış adımları">
        <span><b>1</b> Ürün ve adetleri hazırla</span><span>→</span>
        <span><b>2</b> Belgeyi kontrol et</span><span>→</span>
        <span><b>3</b> Kesinleştir; stok ve cari işlensin</span>
      </div>
      {storageWarning && <div className="purchase-preparation-warning">{storageWarning}</div>}
      {creationNeedsReview && <div className="purchase-preparation-warning"><b>Önceki kayıt sonucu kontrol edilmeli.</b> Aynı hazırlık tekrar gönderime kapalı. Oluşan fişleri aşağıdan veya Alış Fişleri listesinden kontrol edin; yeni hazırlıkla aynı malları tekrar kaydetmeyin.</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {statusMessage && <div className="list-state list-state-success">{statusMessage}</div>}

      {isReviewing && <section ref={reviewPanelRef} tabIndex={-1} className="erp-panel purchase-preparation-review" aria-label="Alış belgesi incelemesi">
        <div className="panel-title"><strong>{groupedRows.length === 1 ? 'Alış Belgesi Kontrolü' : `${groupedRows.length} Ayrı Alış Belgesi`}</strong><span>{documentDate}</span></div>
        <table><thead><tr><th>Tedarikçi</th><th>Satır / adet</th><th>Net tutar</th></tr></thead><tbody>{groupedRows.map((group) => <tr key={group.supplierId}><td>{group.supplierCode} / {group.supplierName}</td><td>{group.rows.length} / {group.rows.reduce((total, row) => total + row.quantity, 0)}</td><td>{formatMoney(group.total, group.supplierCurrency)}</td></tr>)}</tbody></table>
        <div className="preparation-actions">
          <button type="button" className="primary" disabled={isSaving || creationNeedsReview || !canCreate} onClick={() => createGroupedDrafts()}><Save size={15} />{groupedRows.length === 1 ? 'Alış Taslağını Oluştur' : 'Ayrı Alış Taslaklarını Oluştur'}</button>
          <button type="button" disabled={isSaving || creationNeedsReview || !canCreate || !canFinalize} onClick={() => createGroupedDrafts({ finalize: true })}><Check size={15} />Oluştur ve Kesinleştir</button>
          <button type="button" disabled={isSaving} onClick={() => setIsReviewing(false)}>Hazırlığa Dön</button>
        </div>
        <p className="purchase-preparation-note">Taslak kaydı stok ve cari oluşturmaz. Kesinleştirme, hazırlanan adetleri stoğa ve belge tutarını tedarikçi hesabına işler. Belge indirimi veya farklı döviz gerekiyorsa önce taslak oluşturup fişi açın.</p>
        {pendingRows.length > 0 && <p className="purchase-preparation-warning">Tedarikçiye bağlanmamış {pendingRows.length} ürün bu belgelere dahil değil; hazırlıkta kalacak.</p>}
        {groupedRows.map((group) => <div className="purchase-review-products" key={group.supplierId}>
          <strong>{group.supplierName} — belge satırları</strong>
          <table><thead><tr><th>Ürün</th><th>Alış adedi</th><th>Birim alış</th><th>Net satır</th></tr></thead><tbody>{group.rows.map((row) => <tr key={row.id}><td>{row.stockCode} / {row.productName}</td><td>{row.quantity}</td><td>{formatMoney(row.purchasePrice, row.supplierCurrency)}</td><td>{formatMoney(row.netLineTotal, row.supplierCurrency)}</td></tr>)}</tbody></table>
        </div>)}
      </section>}

      {!isReviewing && <>
      <section className="bulk-purchase-layout">
        <section className="erp-panel bulk-purchase-entry-panel">
          <div className="panel-title">
            <strong>Alış Satırı Ekle</strong>
            <span>Her satır kendi tedarikçisiyle kaydedilir</span>
          </div>
          <fieldset className="bulk-purchase-entry-grid" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={isSaving || creationNeedsReview} onKeyDown={handleEntryKeyDown}>
            <label>
              <span>Tarih</span>
              <input type="date" disabled={rows.length > 0} value={documentDate} onChange={(event) => { setDocumentDate(event.target.value); setIsReviewing(false); }} />
            </label>
            <label>
              <span>Tedarikçi</span>
              <input disabled={!suppliersReady} list="bulk-purchase-supplier-suggestions" value={supplierQuery} onChange={(event) => updateBulkSupplierQuery(event.target.value)} placeholder={suppliersReady ? 'Tedarikçi kodu / adı' : 'Tedarikçiler yükleniyor'} />
              <datalist id="bulk-purchase-supplier-suggestions">
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplierSelectionLabel(supplier)} label={`İsk %${Number(supplier.purchaseDiscountRate || 0)}`} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Ürün / barkod</span>
              <input ref={productInputRef} list="bulk-purchase-product-suggestions" value={productQuery} onChange={(event) => updateBulkProductQuery(event.target.value)} placeholder="Barkod / stok kodu / ürün adı" />
              <datalist id="bulk-purchase-product-suggestions">
                {supplierProducts.length === 0 && (
                  <option value="">Ürün bulmak için barkod veya stok kodu yazın</option>
                )}
                {supplierProducts.map((product) => (
                  <option key={product.productId} value={productLabel(product)} label={formatMoney(product.purchasePrice, product.currency)} />
                ))}
              </datalist>
            </label>
            <label>
              <span>Alış adedi</span>
              <input min="0.001" step="0.001" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label>
              <span>Alış fiyatı</span>
              <input min="0.01" step="0.01" type="number" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
            </label>
            <label>
              <span>Satır isk %</span>
              <input min="0" max="100" step="0.01" type="number" value={lineDiscountRate} onChange={(event) => setLineDiscountRate(event.target.value)} />
            </label>
            <button type="button" onClick={addRow} disabled={isLoadingLookup || isSaving || !suppliersReady}>Hazırlığa Ekle</button>
          </fieldset>
          <div className="bulk-purchase-entry-context" aria-live="polite">
            <span className={selectedSupplier ? 'is-ready' : ''}><b>Tedarikçi:</b> {selectedSupplier ? supplierLabel(selectedSupplier) : 'Seçilmedi'}</span>
            <span className={selectedProduct ? 'is-ready' : ''}><b>Ürün:</b> {selectedProduct ? productLabel(selectedProduct) : 'Seçilmedi'}</span>
            <span><b>PB / Kur:</b> {selectedSupplier ? `${selectedSupplier.currency} / ${Number(exchangeRateFor(currencyRates, selectedSupplier.currency) || 0).toFixed(4)}` : '-'}</span>
            <span><b>Bakiye:</b> {selectedSupplier ? formatMoney(selectedSupplier.balance, selectedSupplier.currency) : '-'}</span>
          </div>
        </section>

        <aside className="erp-panel bulk-purchase-summary-panel">
          <div className="panel-title">
            <strong>Oluşacak Fiş Özeti</strong>
            <span>Tedarikçi bazlı alış fişleri</span>
          </div>
          <div className="entity-360-grid bulk-purchase-summary-grid">
            <div className="entity-360-card">
              <span>Tedarikçi</span>
              <strong>{groupedRows.length}</strong>
              <small>Oluşacak fiş sayısı</small>
            </div>
            <div className="entity-360-card stock-card">
              <span>Satır</span>
              <strong>{rows.length}</strong>
              <small>{totals.quantity} adet</small>
            </div>
            <div className="entity-360-card price-card">
              <span>TRY karşılığı</span>
              <strong>{formatMoney(totals.totalTry, 'TRY')}</strong>
              <small>Kur kaydıyla</small>
            </div>
          </div>
          <div className="bulk-purchase-group-list">
            {groupedRows.length === 0 ? <span>Sepet boş.</span> : groupedRows.map((group) => (
              <button key={group.supplierId} disabled={isSaving || creationNeedsReview} type="button" onClick={() => updateBulkSupplierQuery(supplierSelectionLabel(group))}>
                <b>{group.supplierCode}</b>
                <span>{group.rows.length} satır / {formatMoney(group.total, group.supplierCurrency)}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {pendingRows.length > 0 && <section className="erp-panel purchase-preparation-pending">
        <div className="panel-title"><strong>Karttan Gelen Alış Hazırlığı</strong><span>{pendingRows.length} ürün — stok henüz artmadı</span></div>
        <p className="purchase-preparation-note">Yukarıdan alışın gerçek tedarikçisini seçin. Seçili ürünler o firmaya bağlanır; kartın ana tedarikçisi otomatik kullanılmaz.</p>
        <ul>{pendingRows.map((row) => <li key={row.id}>
          <label><input type="checkbox" disabled={isSaving || creationNeedsReview} checked={pendingSelection.includes(row.id)} onChange={(event) => setPendingSelection((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /> {row.stockCode} / {row.productName}</label>
          <label>Adet <input aria-label={`${row.stockCode} hazırlık adedi`} disabled={isSaving || creationNeedsReview} type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => setPendingRows((current) => current.map((item) => item.id === row.id ? { ...item, quantity: event.target.value } : item))} /></label>
          <label>Alış ({row.currency}) <input aria-label={`${row.stockCode} hazırlık fiyatı`} disabled={isSaving || creationNeedsReview} type="number" min="0.01" step="0.01" value={row.purchasePrice} onChange={(event) => setPendingRows((current) => current.map((item) => item.id === row.id ? { ...item, purchasePrice: event.target.value } : item))} /></label>
        </li>)}</ul>
        <div className="preparation-actions"><button className="primary" type="button" disabled={!selectedSupplier || !suppliersReady || isSaving || creationNeedsReview || pendingSelection.length === 0} onClick={addPreparedRows}>Seçilenleri Tedarikçinin Alışına Ekle</button><span>{selectedSupplier ? supplierLabel(selectedSupplier) : 'Önce tedarikçi seçin'}</span></div>
      </section>}

      <section className="erp-panel bulk-purchase-lines-panel">
        <div className="panel-title">
          <strong>Hazırlanan Alış Satırları</strong>
          <span>Aynı tedarikçinin satırları tek belgede toplanır; farklı firmalar ayrı belge olur.</span>
        </div>
        {rows.length === 0 ? (
          <div className="list-state">Henüz satır yok. Tedarikçi ve ürün seçip satır ekleyin.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tedarikçi</th>
                  <th>Ürün</th>
                  <th>Miktar</th>
                  <th>Liste alış</th>
                  <th>Satır isk %</th>
                  <th>Fiş isk %</th>
                  <th>Net satır</th>
                  <th>Net TRY</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.supplierCode}</b><br /><small>{row.supplierName}</small></td>
                    <td className="invoice-product-cell"><strong>{row.productName}</strong><small>{row.stockCode} / {row.barcode} / {row.supplierCurrency}</small></td>
                    <td className="in-cell"><input className="preparation-row-input" aria-label={`${row.stockCode} alış adedi`} disabled={isSaving || creationNeedsReview} type="number" min="0.001" step="0.001" defaultValue={row.quantity} onBlur={(event) => updatePreparedRow(row.id, 'quantity', event.target.value, event.target)} /></td>
                    <td className="money-cell"><input className="preparation-row-input" aria-label={`${row.stockCode} alış fiyatı`} disabled={isSaving || creationNeedsReview} type="number" min="0.01" step="0.01" defaultValue={row.purchasePrice} onBlur={(event) => updatePreparedRow(row.id, 'purchasePrice', event.target.value, event.target)} /></td>
                    <td><input className="preparation-row-input" aria-label={`${row.stockCode} satır iskontosu`} disabled={isSaving || creationNeedsReview} type="number" min="0" max="100" step="0.01" defaultValue={row.lineDiscountRate} onBlur={(event) => updatePreparedRow(row.id, 'lineDiscountRate', event.target.value, event.target)} /></td>
                    <td>%{row.supplierDiscountRate}</td>
                    <td className="money-cell">{formatMoney(row.netLineTotal, row.supplierCurrency)}</td>
                    <td className="money-cell purchase-cost-try">{formatMoney(row.lineTotalTry, 'TRY')}</td>
                    <td><button className="invoice-row-icon-button" disabled={isSaving || creationNeedsReview} aria-label="Satırı sil" title="Satırı sil" type="button" onClick={() => deleteRow(row.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </>}

      {results.length > 0 && (
        <section className="erp-panel bulk-purchase-results-panel">
          <div className="panel-title">
            <strong>Oluşan Fişler</strong>
            <span>Kayıt ve kesinleştirme sonuçları</span>
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
