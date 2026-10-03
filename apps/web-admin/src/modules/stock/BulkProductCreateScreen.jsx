import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  CopyPlus,
  ExternalLink,
  LoaderCircle,
  PackagePlus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { SuggestedTextInput } from '../../components/forms/SuggestedTextInput.jsx';
import {
  applyProductBulkCreate,
  checkProductIdentityAvailability,
  fetchProductOptions,
  previewProductBulkCreate,
} from '../../services/productDetailApi.js';

let rowSequence = 0;

/** @param {Partial<Record<'id' | 'stockCode' | 'barcode' | 'productName' | 'brand' | 'category' | 'supplier' | 'currency' | 'purchasePrice' | 'salePrice' | 'openingStock', string>>} overrides */
function createRow(overrides = {}) {
  rowSequence += 1;
  const safeOverrides = { ...overrides };
  delete safeOverrides.id;
  return {
    id: `bulk-product-${rowSequence}`,
    stockCode: '',
    barcode: '',
    productName: '',
    brand: '',
    category: '',
    supplier: '',
    currency: 'TRY',
    purchasePrice: '',
    salePrice: '',
    openingStock: '0',
    ...safeOverrides,
  };
}

function createBlankRows(defaults = {}) {
  return [createRow(defaults), createRow(defaults), createRow(defaults)];
}

function hasRowContent(row) {
  return Boolean(
    row.stockCode
    || row.barcode
    || row.productName
    || row.brand
    || row.category
    || row.supplier
    || row.purchasePrice
    || row.salePrice,
  );
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR');
}

function findCanonicalOption(value, optionList) {
  const normalizedValue = normalizeIdentity(value);
  if (!normalizedValue) return '';
  return (optionList || []).find((option) => normalizeIdentity(option) === normalizedValue) || '';
}

function getDefinitionIssue(row, options, isLoadingOptions) {
  if (isLoadingOptions) return null;
  if (row.brand && !findCanonicalOption(row.brand, options.brands)) {
    return { field: 'brand', message: 'Markayı alttaki mevcut seçeneklerden seçin.' };
  }
  if (row.category && !findCanonicalOption(row.category, options.categories)) {
    return { field: 'category', message: 'Kategoriyi alttaki mevcut seçeneklerden seçin.' };
  }
  if (row.supplier && !findCanonicalOption(row.supplier, options.suppliers)) {
    return { field: 'supplier', message: 'Ana tedarikçiyi alttaki mevcut seçeneklerden seçin.' };
  }
  return null;
}

function getDuplicateValues(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    if (!hasRowContent(row)) return;
    const value = normalizeIdentity(row[key]);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value));
}

function getLocalRowState(row, duplicateStockCodes, duplicateBarcodes, definitionIssue) {
  if (!hasRowContent(row)) return { tone: 'empty', label: 'Boş satır', message: '' };
  if (!row.stockCode || !row.barcode || !row.productName || !row.brand || !row.category || !row.supplier) {
    return { tone: 'error', label: 'Eksik alan', message: 'Zorunlu alanları tamamlayın.' };
  }
  if (definitionIssue) {
    return { tone: 'error', label: 'Listeden seçin', message: definitionIssue.message };
  }
  if (
    row.purchasePrice === ''
    || row.salePrice === ''
    || Number(row.purchasePrice) < 0
    || Number(row.salePrice) < 0
    || Number(row.openingStock) < 0
  ) {
    return { tone: 'error', label: 'Rakam hatası', message: 'Alış, satış ve açılış değerlerini kontrol edin.' };
  }
  if (duplicateStockCodes.has(normalizeIdentity(row.stockCode))) {
    return { tone: 'error', label: 'Stok kodu tekrar', message: 'Bu stok kodu listede birden fazla kullanılmış.' };
  }
  if (duplicateBarcodes.has(normalizeIdentity(row.barcode))) {
    return { tone: 'error', label: 'Barkod tekrar', message: 'Bu barkod listede birden fazla kullanılmış.' };
  }
  return { tone: 'pending', label: 'Kontrol bekliyor', message: 'Veritabanı kontrolü yapılmadı.' };
}

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toRequestRows(rows) {
  return rows.filter(hasRowContent).map((row) => ({
    rowId: row.id,
    stockCode: row.stockCode,
    barcode: row.barcode,
    productName: row.productName,
    brand: row.brand,
    category: row.category,
    supplierName: row.supplier,
    currency: row.currency,
    purchasePrice: row.purchasePrice,
    salePrice: row.salePrice,
    purchaseDiscountRate: 0,
    openingStock: row.openingStock,
  }));
}

function getApiErrorMessage(error) {
  return error?.payload?.error?.message || error?.message || 'İşlem tamamlanamadı.';
}

export function BulkProductCreateScreen({ onDirtyChange, onOpenScreen }) {
  const [rows, setRows] = useState(() => createBlankRows());
  const [options, setOptions] = useState({
    brands: [],
    brandCurrencies: {},
    brandDefaults: {},
    categories: [],
    suppliers: [],
    supplierCurrencies: {},
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [defaults, setDefaults] = useState({
    brand: '',
    category: '',
    supplier: '',
    currency: 'TRY',
  });
  const [preview, setPreview] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('Satırları doldurun; sistem stok kodu, barkod ve tedarikçiyi veritabanından kontrol eder.');
  const [noticeTone, setNoticeTone] = useState('info');
  const [createdRows, setCreatedRows] = useState([]);
  const [identityChecks, setIdentityChecks] = useState({});
  const identityTimersRef = useRef(new Map());
  const identityVersionsRef = useRef(new Map());

  const duplicateStockCodes = useMemo(() => getDuplicateValues(rows, 'stockCode'), [rows]);
  const duplicateBarcodes = useMemo(() => getDuplicateValues(rows, 'barcode'), [rows]);
  const previewByRowId = useMemo(() => new Map(
    (preview?.rows || []).map((row) => [row.rowId, row]),
  ), [preview]);
  const rowStates = useMemo(() => rows.map((row) => {
    const definitionIssue = getDefinitionIssue(row, options, isLoadingOptions);
    const localState = getLocalRowState(row, duplicateStockCodes, duplicateBarcodes, definitionIssue);
    const identityState = identityChecks[row.id] || {};
    const stockCodeCheck = identityState.stockCode;
    const barcodeCheck = identityState.barcode;
    const stockCodeDuplicate = (
      stockCodeCheck?.checkedValue === normalizeIdentity(row.stockCode)
      && stockCodeCheck?.available === false
    );
    const barcodeDuplicate = (
      barcodeCheck?.checkedValue === normalizeIdentity(row.barcode)
      && barcodeCheck?.available === false
    );
    if (stockCodeDuplicate || barcodeDuplicate) {
      const duplicateProduct = stockCodeDuplicate
        ? stockCodeCheck.duplicateProduct
        : barcodeCheck.duplicateProduct;
      return {
        tone: 'error',
        label: stockCodeDuplicate ? 'Stok kodu mevcut' : 'Barkod mevcut',
        message: stockCodeDuplicate
          ? 'Bu stok kodu başka bir ürün kartında kullanılıyor.'
          : 'Bu barkod başka bir ürün kartında kullanılıyor.',
        duplicateProduct,
      };
    }
    const serverState = previewByRowId.get(row.id);
    if (!serverState) return localState;
    return {
      tone: serverState.status === 'ready' ? 'ready' : 'error',
      label: serverState.status === 'ready' ? 'Kayda hazır' : 'Kontrol gerekli',
      message: serverState.message || '',
      duplicateProduct: serverState.duplicateProduct || null,
    };
  }), [duplicateBarcodes, duplicateStockCodes, identityChecks, isLoadingOptions, options, previewByRowId, rows]);
  const summary = useMemo(() => rowStates.reduce((total, state) => ({
    total: total.total + (state.tone === 'empty' ? 0 : 1),
    ready: total.ready + (state.tone === 'ready' ? 1 : 0),
    error: total.error + (state.tone === 'error' ? 1 : 0),
    pending: total.pending + (state.tone === 'pending' ? 1 : 0),
  }), { total: 0, ready: 0, error: 0, pending: 0 }), [rowStates]);
  const canSave = Boolean(preview?.canApply) && !isChecking && !isSaving && createdRows.length === 0;

  useEffect(() => {
    let isMounted = true;

    fetchProductOptions()
      .then((response) => {
        if (!isMounted) return;
        setOptions({
          brands: response.data?.brands || [],
          brandCurrencies: response.data?.brandCurrencies || {},
          brandDefaults: response.data?.brandDefaults || {},
          categories: response.data?.categories || [],
          suppliers: response.data?.suppliers || [],
          supplierCurrencies: response.data?.supplierCurrencies || {},
        });
      })
      .catch(() => {
        if (isMounted) setNotice('Marka, kategori ve tedarikçi seçenekleri yüklenemedi.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => () => {
    identityTimersRef.current.forEach((timer) => clearTimeout(timer));
    identityTimersRef.current.clear();
  }, []);

  function invalidatePreview() {
    setPreview(null);
    setCreatedRows([]);
  }

  function markDirty() {
    onDirtyChange?.(true);
  }

  function updateRow(rowId, key, value) {
    setRows((current) => current.map((row) => (
      row.id === rowId ? { ...row, [key]: value } : row
    )));
    invalidatePreview();
    setNotice('');
    markDirty();
  }

  function queueIdentityCheck(row) {
    const rowId = row.id;
    const stockCode = String(row.stockCode || '').trim();
    const barcode = String(row.barcode || '').trim();
    const currentTimer = identityTimersRef.current.get(rowId);
    if (currentTimer) clearTimeout(currentTimer);

    const version = (identityVersionsRef.current.get(rowId) || 0) + 1;
    identityVersionsRef.current.set(rowId, version);
    setIdentityChecks((current) => ({
      ...current,
      [rowId]: {
        stockCode: stockCode ? { checking: true, checkedValue: normalizeIdentity(stockCode) } : null,
        barcode: barcode ? { checking: true, checkedValue: normalizeIdentity(barcode) } : null,
      },
    }));

    if (!stockCode && !barcode) return;

    const timer = setTimeout(async () => {
      try {
        const response = await checkProductIdentityAvailability({ stockCode, barcode });
        if (identityVersionsRef.current.get(rowId) !== version) return;
        setIdentityChecks((current) => ({
          ...current,
          [rowId]: {
            stockCode: stockCode ? {
              checking: false,
              checkedValue: normalizeIdentity(stockCode),
              available: response.data?.stockCode?.available !== false,
              duplicateProduct: response.data?.stockCode?.duplicateProduct || null,
            } : null,
            barcode: barcode ? {
              checking: false,
              checkedValue: normalizeIdentity(barcode),
              available: response.data?.barcode?.available !== false,
              duplicateProduct: response.data?.barcode?.duplicateProduct || null,
            } : null,
          },
        }));
      } catch {
        if (identityVersionsRef.current.get(rowId) !== version) return;
        setIdentityChecks((current) => ({
          ...current,
          [rowId]: {
            stockCode: stockCode ? {
              checking: false,
              checkedValue: normalizeIdentity(stockCode),
              available: null,
            } : null,
            barcode: barcode ? {
              checking: false,
              checkedValue: normalizeIdentity(barcode),
              available: null,
            } : null,
          },
        }));
      }
    }, 400);
    identityTimersRef.current.set(rowId, timer);
  }

  function updateIdentityField(rowId, key, value) {
    const currentRow = rows.find((row) => row.id === rowId);
    if (!currentRow) return;
    const nextRow = { ...currentRow, [key]: value };
    setRows((current) => current.map((row) => (row.id === rowId ? nextRow : row)));
    queueIdentityCheck(nextRow);
    invalidatePreview();
    setNotice('');
    markDirty();
  }

  function updateRowBrand(rowId, brand) {
    const canonicalBrand = findCanonicalOption(brand, options.brands);
    const preferred = canonicalBrand ? options.brandDefaults[canonicalBrand] : null;
    const supplierCurrency = preferred?.supplier ? options.supplierCurrencies[preferred.supplier] : '';
    setRows((current) => current.map((row) => (
      row.id === rowId ? {
        ...row,
        brand: canonicalBrand || brand,
        category: preferred?.category || row.category,
        supplier: preferred?.supplier || row.supplier,
        currency: supplierCurrency || preferred?.currency || row.currency,
      } : row
    )));
    invalidatePreview();
    setNotice(preferred
      ? `${canonicalBrand} için kategori, ana tedarikçi ve para birimi mevcut kartlardan getirildi.`
      : '');
    setNoticeTone('info');
    markDirty();
  }

  function updateDefaultBrand(brand) {
    const canonicalBrand = findCanonicalOption(brand, options.brands);
    const preferred = canonicalBrand ? options.brandDefaults[canonicalBrand] : null;
    const supplierCurrency = preferred?.supplier ? options.supplierCurrencies[preferred.supplier] : '';
    setDefaults((current) => ({
      ...current,
      brand: canonicalBrand || brand,
      category: preferred?.category || current.category,
      supplier: preferred?.supplier || current.supplier,
      currency: supplierCurrency || preferred?.currency || current.currency,
    }));
    setNotice(preferred
      ? `${canonicalBrand} için ortak kategori, ana tedarikçi ve para birimi getirildi.`
      : '');
    setNoticeTone('info');
  }

  function updateRowSupplier(rowId, supplier) {
    const canonicalSupplier = findCanonicalOption(supplier, options.suppliers);
    const supplierCurrency = canonicalSupplier ? options.supplierCurrencies[canonicalSupplier] : '';
    setRows((current) => current.map((row) => (
      row.id === rowId ? {
        ...row,
        supplier: canonicalSupplier || supplier,
        currency: supplierCurrency || row.currency,
      } : row
    )));
    invalidatePreview();
    setNotice(supplierCurrency ? `${canonicalSupplier} para birimi uygulandı: ${supplierCurrency}` : '');
    setNoticeTone('info');
    markDirty();
  }

  function updateDefaultSupplier(supplier) {
    const canonicalSupplier = findCanonicalOption(supplier, options.suppliers);
    const supplierCurrency = canonicalSupplier ? options.supplierCurrencies[canonicalSupplier] : '';
    setDefaults((current) => ({
      ...current,
      supplier: canonicalSupplier || supplier,
      currency: supplierCurrency || current.currency,
    }));
    setNotice(supplierCurrency ? `${canonicalSupplier} ortak para birimi uygulandı: ${supplierCurrency}` : '');
    setNoticeTone('info');
  }

  function addRow() {
    setRows((current) => [...current, createRow(defaults)]);
    invalidatePreview();
    setNotice('Yeni boş satır eklendi.');
    setNoticeTone('info');
    markDirty();
  }

  function copyRow(row) {
    setRows((current) => [...current, createRow({ ...row, stockCode: '', barcode: '' })]);
    invalidatePreview();
    setNotice('Satır kopyalandı; stok kodu ve barkod güvenlik için boş bırakıldı.');
    setNoticeTone('info');
    markDirty();
  }

  function deleteRow(rowId) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createRow(defaults)];
    });
    invalidatePreview();
    const timer = identityTimersRef.current.get(rowId);
    if (timer) clearTimeout(timer);
    identityTimersRef.current.delete(rowId);
    identityVersionsRef.current.delete(rowId);
    setIdentityChecks((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    setNotice('Satır kaldırıldı.');
    setNoticeTone('info');
    markDirty();
  }

  function clearRows() {
    identityTimersRef.current.forEach((timer) => clearTimeout(timer));
    identityTimersRef.current.clear();
    identityVersionsRef.current.clear();
    setIdentityChecks({});
    setRows(createBlankRows(defaults));
    invalidatePreview();
    setNotice('Liste temizlendi; üç boş giriş satırı hazır.');
    setNoticeTone('info');
    markDirty();
  }

  function applyDefaults() {
    setRows((current) => current.map((row) => {
      const appliesDefaultSupplier = !row.supplier && Boolean(defaults.supplier);
      return {
        ...row,
        brand: row.brand || defaults.brand,
        category: row.category || defaults.category,
        supplier: row.supplier || defaults.supplier,
        currency: appliesDefaultSupplier ? defaults.currency : row.currency || defaults.currency,
      };
    }));
    invalidatePreview();
    setNotice('Ortak bilgiler yalnızca boş alanlara uygulandı.');
    setNoticeTone('info');
    markDirty();
  }

  async function runDatabaseCheck() {
    const requestRows = toRequestRows(rows);
    if (requestRows.length === 0) {
      setNotice('Kontrol edilecek dolu bir satır yok.');
      setNoticeTone('error');
      return null;
    }

    setIsChecking(true);
    setPreview(null);
    setCreatedRows([]);
    try {
      const response = await previewProductBulkCreate({
        documentDate: todayIsoDate(),
        rows: requestRows,
      });
      const nextPreview = response.data;
      setPreview(nextPreview);
      if (nextPreview.canApply) {
        setNotice(`${nextPreview.readyCount} kart veritabanı kontrolünden geçti. Artık güvenle kaydedebilirsiniz.`);
        setNoticeTone('success');
      } else {
        setNotice(`${nextPreview.errorCount} satırda sorun var. Hiçbir kart kaydedilmedi.`);
        setNoticeTone('error');
      }
      return nextPreview;
    } catch (error) {
      setNotice(getApiErrorMessage(error));
      setNoticeTone('error');
      return null;
    } finally {
      setIsChecking(false);
    }
  }

  async function saveCards() {
    if (!preview?.canApply) return;
    setIsSaving(true);
    try {
      const response = await applyProductBulkCreate({
        documentDate: preview.documentDate,
        confirmationCode: preview.confirmationCode,
        rows: toRequestRows(rows),
      });
      const result = response.data;
      setCreatedRows(result.rows || []);
      setNotice(`${result.createdCount} stok kartı ve varsa açılış stok hareketleri başarıyla kaydedildi.`);
      setNoticeTone('success');
      onDirtyChange?.(false);
    } catch (error) {
      setPreview(null);
      setNotice(`${getApiErrorMessage(error)} Veritabanına kısmi kayıt yapılmadı.`);
      setNoticeTone('error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="work-area bulk-product-create-screen">
      <section className="bulk-product-create-toolbar">
        <div className="bulk-product-create-title">
          <span className="bulk-product-create-icon"><PackagePlus aria-hidden="true" size={20} /></span>
          <div>
            <strong>Toplu Stok Kartı</strong>
            <span>Satırları kontrol edin, ardından kartları tek işlemde kaydedin</span>
          </div>
          <b className="is-live">Canlı kayıt</b>
        </div>
        <div className="bulk-product-create-actions">
          <button type="button" onClick={addRow}><Plus aria-hidden="true" size={15} />Yeni Satır</button>
          <button type="button" onClick={clearRows}><Trash2 aria-hidden="true" size={15} />Satırları Temizle</button>
          <button disabled={isChecking || isSaving} type="button" onClick={runDatabaseCheck}>
            {isChecking ? <LoaderCircle className="bulk-product-spin" aria-hidden="true" size={15} /> : <ClipboardCheck aria-hidden="true" size={15} />}
            {isChecking ? 'Kontrol Ediliyor' : 'Veritabanını Kontrol Et'}
          </button>
          <button className="primary" disabled={!canSave} title={canSave ? 'Kontrol edilen kartları kaydet' : 'Önce veritabanı kontrolünü tamamlayın'} type="button" onClick={saveCards}>
            {isSaving ? <LoaderCircle className="bulk-product-spin" aria-hidden="true" size={15} /> : <Save aria-hidden="true" size={15} />}
            {isSaving ? 'Kaydediliyor' : 'Kartları Kaydet'}
          </button>
        </div>
      </section>

      <section className="erp-panel bulk-product-defaults-panel">
        <div className="bulk-product-defaults-heading">
          <div>
            <strong>Ortak Bilgiler</strong>
            <span>{isLoadingOptions ? 'Tanımlar yükleniyor...' : 'Yazarak arayın, alttaki mevcut seçeneklerden seçin'}</span>
          </div>
          <button type="button" onClick={applyDefaults}>Boş Alanlara Uygula</button>
        </div>
        <div className="bulk-product-defaults-grid">
          <label>
            <span>Marka</span>
            <SuggestedTextInput ariaLabel="Ortak marka" maxOptions={300} name="bulk-product-default-brand" options={options.brands} placeholder="Yazın ve marka seçin" portal value={defaults.brand} onChange={updateDefaultBrand} />
          </label>
          <label>
            <span>Kategori</span>
            <SuggestedTextInput ariaLabel="Ortak kategori" maxOptions={300} name="bulk-product-default-category" options={options.categories} placeholder="Yazın ve kategori seçin" portal value={defaults.category} onChange={(value) => setDefaults((current) => ({ ...current, category: value }))} />
          </label>
          <label>
            <span>Ana tedarikçi</span>
            <SuggestedTextInput ariaLabel="Ortak ana tedarikçi" maxOptions={300} name="bulk-product-default-supplier" options={options.suppliers} placeholder="Yazın ve tedarikçi seçin" portal value={defaults.supplier} onChange={updateDefaultSupplier} />
          </label>
          <label>
            <span>Para birimi</span>
            <select value={defaults.currency} onChange={(event) => setDefaults((current) => ({ ...current, currency: event.target.value }))}>
              <option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option>
            </select>
          </label>
        </div>
      </section>

      <section className="bulk-product-summary">
        <div><span>Dolu satır</span><strong>{summary.total}</strong><small>Hazırlanan kart</small></div>
        <div className="is-ready"><span>Kayda hazır</span><strong>{summary.ready}</strong><small>Veritabanından geçen</small></div>
        <div className={summary.error > 0 ? 'has-error' : ''}><span>Kontrol gerekli</span><strong>{summary.error + summary.pending}</strong><small>Eksik, tekrar veya bekleyen</small></div>
        <div><span>Açılış stoğu</span><strong>{rows.reduce((total, row) => total + Number(row.openingStock || 0), 0)}</strong><small>Toplam adet</small></div>
      </section>

      {notice ? (
        <div className={`bulk-product-notice is-${noticeTone}`} role={noticeTone === 'error' ? 'alert' : 'status'}>
          {noticeTone === 'error' ? <AlertTriangle aria-hidden="true" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
          <span>{notice}</span>
        </div>
      ) : null}

      {createdRows.length > 0 ? (
        <section className="bulk-product-created-list" aria-label="Oluşturulan stok kartları">
          <strong>Oluşturulan kartlar</strong>
          {createdRows.map((row) => (
            <button key={row.productId} type="button" onClick={() => onOpenScreen?.('product-card', { productId: row.productId, stockCode: row.stockCode })}>
              <span>{row.stockCode} · {row.productName}</span>
              <small>Stok: {row.openingStock}</small>
              <ExternalLink aria-hidden="true" size={14} />
            </button>
          ))}
        </section>
      ) : null}

      <section className="erp-panel bulk-product-grid-panel">
        <div className="panel-title">
          <strong>Stok Kartı Satırları</strong>
          <span>Tüm satırlar uygunsa birlikte kaydedilir; bir sorun varsa hiçbir satır yazılmaz</span>
        </div>
        <div className="table-wrap bulk-product-table-wrap">
          <table className="bulk-product-create-table">
            <thead>
              <tr>
                <th>#</th><th>Stok kodu *</th><th>Barkod *</th><th>Ürün adı *</th><th>Marka *</th><th>Kategori *</th>
                <th>Ana tedarikçi *</th><th>PB</th><th>Alış *</th><th>Satış *</th><th>Açılış</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const state = rowStates[index];
                const definitionIssue = getDefinitionIssue(row, options, isLoadingOptions);
                const identityState = identityChecks[row.id] || {};
                const stockCodeCheck = identityState.stockCode;
                const barcodeCheck = identityState.barcode;
                const stockCodeDuplicate = (
                  duplicateStockCodes.has(normalizeIdentity(row.stockCode))
                  || (
                    stockCodeCheck?.checkedValue === normalizeIdentity(row.stockCode)
                    && stockCodeCheck?.available === false
                  )
                );
                const barcodeDuplicate = (
                  duplicateBarcodes.has(normalizeIdentity(row.barcode))
                  || (
                    barcodeCheck?.checkedValue === normalizeIdentity(row.barcode)
                    && barcodeCheck?.available === false
                  )
                );
                return (
                  <tr className={`bulk-product-row is-${state.tone}`} key={row.id}>
                    <td className="bulk-product-row-number">{index + 1}</td>
                    <td>
                      <div className={`bulk-product-identity-field ${stockCodeDuplicate ? 'is-duplicate' : ''}`}>
                        <input aria-invalid={stockCodeDuplicate} aria-label={`${index + 1}. satır stok kodu`} maxLength={50} value={row.stockCode} onChange={(event) => updateIdentityField(row.id, 'stockCode', event.target.value)} placeholder="STK-0001" />
                        {stockCodeCheck?.checking ? <small>Kontrol ediliyor...</small> : null}
                        {stockCodeDuplicate ? <small>Bu stok kodu mevcut</small> : null}
                      </div>
                    </td>
                    <td>
                      <div className={`bulk-product-identity-field ${barcodeDuplicate ? 'is-duplicate' : ''}`}>
                        <input aria-invalid={barcodeDuplicate} aria-label={`${index + 1}. satır barkod`} maxLength={80} value={row.barcode} onChange={(event) => updateIdentityField(row.id, 'barcode', event.target.value)} placeholder="869..." />
                        {barcodeCheck?.checking ? <small>Kontrol ediliyor...</small> : null}
                        {barcodeDuplicate ? <small>Bu barkod mevcut</small> : null}
                      </div>
                    </td>
                    <td><input aria-label={`${index + 1}. satır ürün adı`} value={row.productName} onChange={(event) => updateRow(row.id, 'productName', event.target.value)} placeholder="Ürün adı" /></td>
                    <td><SuggestedTextInput ariaLabel={`${index + 1}. satır marka`} invalid={definitionIssue?.field === 'brand'} maxOptions={300} name={`bulk-product-brand-${row.id}`} options={options.brands} placeholder="Marka yazın" portal value={row.brand} onChange={(value) => updateRowBrand(row.id, value)} /></td>
                    <td><SuggestedTextInput ariaLabel={`${index + 1}. satır kategori`} invalid={definitionIssue?.field === 'category'} maxOptions={300} name={`bulk-product-category-${row.id}`} options={options.categories} placeholder="Kategori yazın" portal value={row.category} onChange={(value) => updateRow(row.id, 'category', value)} /></td>
                    <td><SuggestedTextInput ariaLabel={`${index + 1}. satır ana tedarikçi`} invalid={definitionIssue?.field === 'supplier'} maxOptions={300} name={`bulk-product-supplier-${row.id}`} options={options.suppliers} placeholder="Tedarikçi yazın" portal value={row.supplier} onChange={(value) => updateRowSupplier(row.id, value)} /></td>
                    <td><select aria-label={`${index + 1}. satır para birimi`} value={row.currency} onChange={(event) => updateRow(row.id, 'currency', event.target.value)}><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></td>
                    <td><input aria-label={`${index + 1}. satır alış fiyatı`} min="0" step="0.01" type="number" value={row.purchasePrice} onChange={(event) => updateRow(row.id, 'purchasePrice', event.target.value)} /></td>
                    <td><input aria-label={`${index + 1}. satır satış fiyatı`} min="0" step="0.01" type="number" value={row.salePrice} onChange={(event) => updateRow(row.id, 'salePrice', event.target.value)} /></td>
                    <td><input aria-label={`${index + 1}. satır açılış stoğu`} min="0" step="1" type="number" value={row.openingStock} onChange={(event) => updateRow(row.id, 'openingStock', event.target.value)} /></td>
                    <td>
                      <span className={`bulk-product-status is-${state.tone}`} title={state.message}>{state.label}</span>
                      {state.tone === 'error' && state.message ? (
                        <small className="bulk-product-status-message">{state.message}</small>
                      ) : null}
                      {state.duplicateProduct ? (
                        <button className="bulk-product-open-duplicate" type="button" onClick={() => onOpenScreen?.('product-card', { productId: state.duplicateProduct.productId, stockCode: state.duplicateProduct.stockCode })}>
                          Mevcut kartı aç
                        </button>
                      ) : null}
                    </td>
                    <td><div className="bulk-product-row-actions">
                      <button aria-label={`${index + 1}. satırı kopyala`} title="Satırı kopyala" type="button" onClick={() => copyRow(row)}><CopyPlus aria-hidden="true" size={14} /></button>
                      <button aria-label={`${index + 1}. satırı sil`} title="Satırı sil" type="button" onClick={() => deleteRow(row.id)}><Trash2 aria-hidden="true" size={14} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="bulk-product-grid-footer">
          <span>* Zorunlu alan</span>
          <b>{summary.ready} hazır · {summary.error + summary.pending} kontrol bekliyor</b>
          <span>Açılış stoğu, ürün kartıyla aynı işlemde denetlenebilir stok hareketi oluşturur.</span>
        </footer>
      </section>
    </main>
  );
}
