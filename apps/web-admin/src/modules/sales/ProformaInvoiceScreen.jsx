import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileDown, FileText, RefreshCcw, Save, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { fetchVegaCustomers } from '../../services/customerApi.js';
import {
  fetchVegaCustomerStockExitDocument,
  fetchVegaSalesStockExits,
} from '../../services/movementApi.js';
import { printProformaInvoice } from '../../utils/proformaPrint.js';

const sellerDefaults = {
  name: 'Melisa Bebe Tekstil San. ve Tic. Ltd. Şti.',
  address: 'Mühürdar Eminpaşa Sk. Mercan Mah. No:22/A',
  cityCountry: 'Fatih, İstanbul, Türkiye',
  phone: '+90 212 595 02 09',
  fax: '+90 212 511 19 18',
  taxOffice: 'Hocapaşa',
  taxNumber: '6140585769',
  mersis: '0614058576900012',
  tradeRegistry: '922791',
};

const bankDefaults = {
  name: 'Kuveyt Türk Katılım Bankası',
  tryIban: 'TR85 0020 5000 0910 7244 6000 01',
  usdIban: 'TR04 0020 5000 0910 7244 6001 01',
  eurIban: 'TR74 0020 5000 0910 7244 6001 02',
  swift: 'KTEFTRISXXX',
};

function mergeSeller(value) {
  const overrides = value && typeof value === 'object' ? value : {};
  return { ...sellerDefaults, ...overrides };
}

function mergeBank(value) {
  const overrides = value && typeof value === 'object' ? value : {};
  return {
    ...bankDefaults,
    ...overrides,
    usdIban: overrides.usdIban || String(overrides.iban || '').replace(/^USD IBAN:\s*/i, '') || bankDefaults.usdIban,
  };
}

function isoDate(value = new Date()) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

function addDays(dateText, days) {
  const date = dateText ? new Date(`${dateText}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function monthRange() {
  const today = new Date();
  return { dateFrom: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: isoDate(today) };
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '-';
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function proformaStorageKey(sourceId) {
  return `melisa.proformaDraft.vega.${sourceId}`;
}

function sourceFingerprint(receipt, detail, customer) {
  return JSON.stringify({
    sourceId: Number(receipt?.sourceId || 0),
    customerSourceId: Number(receipt?.customerSourceId || 0),
    documentNo: String(detail?.documentNo || receipt?.documentNo || '').trim(),
    documentDate: String(detail?.documentDate || receipt?.documentDate || '').slice(0, 10),
    currency: String(detail?.currency || receipt?.currency || '').trim(),
    totalAmount: Number(detail?.totalAmount || receipt?.totalAmount || 0),
    customer: {
      code: String(customer?.customerCode || receipt?.customerCode || '').trim(),
      name: String(customer?.legalTitle || customer?.customerName || receipt?.customerName || '').trim(),
      address: String(customer?.address || '').trim(),
      city: String(customer?.city || '').trim(),
      country: String(customer?.country || '').trim(),
      contactName: String(customer?.contactName || '').trim(),
      phone: String(customer?.phoneMasked || '').trim(),
      email: String(customer?.email || '').trim(),
    },
    lines: (detail?.lines || []).map((line) => ({
      id: String(line.id || ''),
      stockSourceId: Number(line.stockSourceId || 0),
      stockCode: String(line.stockCode || '').trim(),
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      lineTotal: Number(line.lineTotal || 0),
      gtipCode: String(line.gtipCode || '').trim(),
      gtipStatus: String(line.gtipStatus || '').trim(),
    })),
  });
}

function defaultHeader(receipt) {
  const issueDate = isoDate();
  const sourceNo = receipt?.documentNo || '';
  return {
    proformaNo: sourceNo ? `PF-${issueDate.slice(0, 4)}-${sourceNo}` : `PF-${issueDate.replaceAll('-', '')}`,
    sourceDocumentNo: sourceNo,
    issueDate,
    validUntil: addDays(issueDate, 7),
    currency: receipt?.currency || 'USD',
  };
}

function defaultBuyer(receipt, customer) {
  const cityCountry = [customer?.city, customer?.country].filter(Boolean).join(', ');
  return {
    name: customer?.legalTitle || customer?.customerName || receipt?.customerName || '',
    customerCode: customer?.customerCode || receipt?.customerCode || '',
    address: customer?.address || '',
    cityCountry,
    contactName: customer?.contactName || '',
    phone: customer?.phoneMasked || '',
    email: customer?.email || '',
    taxNumber: '',
  };
}

function defaultShipment(customer) {
  return {
    incoterm: '',
    paymentTerms: '',
    transportMode: 'Karayolu',
    deliveryPlace: [customer?.city, customer?.country].filter(Boolean).join(', '),
    packageCount: '',
    netWeight: '',
    grossWeight: '',
    freightAmount: 0,
    originCountry: 'Türkiye',
    notes: 'KDV %0 - ihracat teslimi. Kullanımdan önce teslim ve ödeme koşullarını doğrulayın.',
  };
}

function mapLines(detail) {
  return (detail?.lines || []).map((line) => ({
    id: line.id,
    included: true,
    stockCode: line.stockCode || '',
    description: line.productName || '',
    barcode: line.barcode || '',
    gtipCode: line.gtipCode || '',
    gtipStatus: line.gtipStatus || '',
    gtipConfidence: line.gtipConfidence || '',
    gtipMaterialBasis: line.gtipMaterialBasis || '',
    gtipNote: line.gtipNote || '',
    gtipSource: line.gtipSource || '',
    gtipRuleId: line.gtipRuleId || '',
    gtipRequiresReview: line.gtipRequiresReview !== false,
    quantity: Number(line.quantity || 0),
    unitName: line.unitName || 'ADET',
    unitPrice: Number(line.unitPrice || 0),
  }));
}

function gtipStatusText(line) {
  if (line.gtipStatus === 'verified') return 'Doğrulandı';
  if (!line.gtipCode) return 'Eksik';
  if (line.gtipSource === 'automatic-rule') {
    const confidence = line.gtipConfidence === 'medium' ? 'orta güven' : 'düşük güven';
    return `Otomatik taslak · ${confidence}`;
  }
  if (line.gtipSource === 'manual') return 'Elle düzenlendi · teyit gerekli';
  return 'Kayıtlı taslak';
}

export function ProformaInvoiceScreen({ initialPayload = {}, onDirtyChange }) {
  const initialRange = useMemo(monthRange, []);
  const [search, setSearch] = useState(initialPayload?.documentNo || '');
  const [dateFrom, setDateFrom] = useState(initialPayload?.documentDate?.slice?.(0, 10) || initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialPayload?.documentDate?.slice?.(0, 10) || initialRange.dateTo);
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(initialPayload?.sourceId ? initialPayload : null);
  const [detail, setDetail] = useState(null);
  const [header, setHeader] = useState(defaultHeader(initialPayload));
  const [seller, setSeller] = useState(sellerDefaults);
  const [buyer, setBuyer] = useState(defaultBuyer(initialPayload, null));
  const [shipment, setShipment] = useState(defaultShipment(null));
  const [bank, setBank] = useState(bankDefaults);
  const [lines, setLines] = useState([]);
  const [loadedSourceFingerprint, setLoadedSourceFingerprint] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(Boolean(initialPayload?.sourceId));
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const includedLines = useMemo(() => lines.filter((line) => line.included), [lines]);
  const totals = useMemo(() => {
    const goodsAmount = includedLines.reduce(
      (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
      0,
    );
    const freightAmount = Math.max(0, Number(shipment.freightAmount || 0));
    return {
      lineCount: includedLines.length,
      quantity: includedLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
      goodsAmount,
      freightAmount,
      grandTotal: goodsAmount + freightAmount,
      missingGtip: includedLines.filter((line) => !String(line.gtipCode || '').trim()).length,
      automaticGtip: includedLines.filter((line) => line.gtipSource === 'automatic-rule').length,
      gtipNeedsReview: includedLines.filter((line) => line.gtipStatus !== 'verified').length,
    };
  }, [includedLines, shipment.freightAmount]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  async function searchReceipts() {
    setIsSearching(true);
    setErrorMessage('');
    setMessage('');
    try {
      const response = await fetchVegaSalesStockExits({ page: 1, limit: 100, search, dateFrom, dateTo, currency: 'ALL' });
      setReceipts(response.data || []);
      if (!(response.data || []).length) setMessage('Bu kriterlerde satış fişi bulunamadı.');
    } catch (error) {
      setReceipts([]);
      setErrorMessage(error.message || 'Satış fişleri okunamadı.');
    } finally {
      setIsSearching(false);
    }
  }

  async function loadReceipt(receipt) {
    if (!receipt?.sourceId || !receipt?.customerSourceId) return;
    setSelectedReceipt(receipt);
    setIsLoadingDocument(true);
    setErrorMessage('');
    setMessage('');
    try {
      const [detailResponse, customerResponse] = await Promise.all([
        fetchVegaCustomerStockExitDocument(receipt.customerSourceId, receipt.sourceId),
        fetchVegaCustomers({ page: 1, limit: 50, search: receipt.customerCode || receipt.customerName || '' }),
      ]);
      const nextDetail = detailResponse.data;
      const customer = (customerResponse.data || []).find((item) => Number(item.sourceId) === Number(receipt.customerSourceId))
        || (customerResponse.data || []).find((item) => item.customerCode === receipt.customerCode)
        || null;
      const nextHeader = defaultHeader(receipt);
      const nextBuyer = defaultBuyer(receipt, customer);
      const nextShipment = defaultShipment(customer);
      const nextLines = mapLines(nextDetail);
      const nextSourceFingerprint = sourceFingerprint(receipt, nextDetail, customer);
      let savedDraft = null;
      try {
        savedDraft = JSON.parse(window.localStorage.getItem(proformaStorageKey(receipt.sourceId)) || 'null');
      } catch {
        savedDraft = null;
      }
      const savedDraftIsCurrent = Boolean(
        savedDraft?.sourceFingerprint
        && savedDraft.sourceFingerprint === nextSourceFingerprint,
      );
      setDetail(nextDetail);
      setLoadedSourceFingerprint(nextSourceFingerprint);
      setHeader(savedDraftIsCurrent ? savedDraft.header : nextHeader);
      setSeller(mergeSeller(savedDraftIsCurrent ? savedDraft.seller : null));
      setBuyer(savedDraftIsCurrent ? savedDraft.buyer : nextBuyer);
      setShipment(savedDraftIsCurrent && savedDraft.shipment ? { ...nextShipment, ...savedDraft.shipment } : nextShipment);
      setBank(mergeBank(savedDraftIsCurrent ? savedDraft.bank : null));
      setLines(savedDraftIsCurrent && savedDraft.lines?.length ? savedDraft.lines : nextLines);
      setIsDirty(false);
      setMessage(savedDraftIsCurrent
        ? 'Bu fişin güncel kaynak verisiyle eşleşen proforma taslağı açıldı.'
        : savedDraft
          ? 'Kaynak fiş değiştiği için eski taslak kullanılmadı; güncel Vega bilgileri yüklendi.'
          : 'Fiş proformaya aktarıldı. Teslim, ödeme ve GTİP bilgilerini kontrol edin.');
    } catch (error) {
      setDetail(null);
      setLoadedSourceFingerprint('');
      setLines([]);
      setErrorMessage(error.message || 'Fiş içeriği proformaya aktarılamadı.');
    } finally {
      setIsLoadingDocument(false);
    }
  }

  useEffect(() => {
    if (initialPayload?.sourceId && initialPayload?.customerSourceId) {
      loadReceipt(initialPayload);
    }
    // The opening payload is intentionally consumed only once per workspace tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSection(setter, field, value) {
    setter((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
    setMessage('');
  }

  function updateLine(lineId, field, value) {
    setLines((current) => current.map((line) => (
      line.id === lineId
        ? field === 'gtipCode'
          ? {
              ...line,
              gtipCode: value,
              gtipStatus: value ? 'draft' : '',
              gtipConfidence: '',
              gtipSource: value ? 'manual' : '',
              gtipRuleId: '',
              gtipRequiresReview: true,
              gtipNote: value ? 'Kullanıcı tarafından düzenlendi; sevk öncesinde doğrulanmalıdır.' : '',
            }
          : { ...line, [field]: ['quantity', 'unitPrice'].includes(field) ? Number(value || 0) : value }
        : line
    )));
    setIsDirty(true);
    setMessage('');
  }

  function saveDraft() {
    if (!selectedReceipt?.sourceId) {
      setErrorMessage('Önce bir satış fişi seçin.');
      return;
    }
    const payload = {
      header,
      seller,
      buyer,
      shipment,
      bank,
      lines,
      sourceFingerprint: loadedSourceFingerprint,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(proformaStorageKey(selectedReceipt.sourceId), JSON.stringify(payload));
    setIsDirty(false);
    setErrorMessage('');
    setMessage('Proforma taslağı bu cihazda kaydedildi. Vega verisine yazılmadı.');
  }

  function resetDraft() {
    if (!selectedReceipt) return;
    window.localStorage.removeItem(proformaStorageKey(selectedReceipt.sourceId));
    loadReceipt(selectedReceipt);
  }

  function savePdfDocument() {
    if (!detail || !includedLines.length) {
      setErrorMessage('PDF hazırlamak için fiş seçin ve en az bir ürün satırı bırakın.');
      return;
    }
    if (!header.proformaNo || !buyer.name) {
      setErrorMessage('Proforma numarası ve alıcı unvanı zorunludur.');
      return;
    }
    setErrorMessage('');
    try {
      printProformaInvoice({ header, seller, buyer, shipment, bank, lines });
      setMessage('PDF kaydetme penceresi açıldı. Hedef bölümünden “PDF olarak kaydet” seçeneğini seçin.');
    } catch (error) {
      setErrorMessage(error.message || 'PDF kaydetme penceresi açılamadı.');
    }
  }

  return (
    <main className="work-area proforma-screen">
      <section className="proforma-toolbar">
        <div className="proforma-title">
          <span className="proforma-title-icon"><FileText size={20} /></span>
          <div><strong>Proforma Hazırlama</strong><small>Vega satış fişinden düzenlenebilir proforma ve PDF çıktısı</small></div>
        </div>
        <div className="proforma-toolbar-actions">
          <button type="button" onClick={resetDraft} disabled={!selectedReceipt}><RefreshCcw size={15} /> Fişten Yenile</button>
          <button type="button" onClick={saveDraft} disabled={!detail}><Save size={15} /> Taslağı Kaydet</button>
          <button type="button" className="primary" onClick={savePdfDocument} disabled={!detail}><FileDown size={15} /> PDF Kaydet</button>
        </div>
      </section>

      <section className="proforma-source-panel">
        <div className="proforma-section-heading"><div><strong>1. Kaynak satış fişini seçin</strong><span>Fiş ve satırlar Vega’dan salt okunur alınır.</span></div><span className="proforma-readonly-pill"><ShieldCheck size={14} /> Vega salt okunur</span></div>
        <div className="proforma-source-search">
          <label className="wide"><span>Fiş no / cari / ürün ara</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Örn. ANG100217 veya müşteri adı" /></label>
          <label><span>Başlangıç</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>Bitiş</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          <button type="button" className="primary" onClick={searchReceipts} disabled={isSearching}><Search size={15} /> {isSearching ? 'Aranıyor…' : 'Fişleri Getir'}</button>
        </div>
        {receipts.length > 0 && <div className="proforma-receipt-list table-shell"><table className="erp-table"><thead><tr><th>Tarih</th><th>Fiş No</th><th>Cari</th><th>PB</th><th>Toplam</th><th></th></tr></thead><tbody>{receipts.map((receipt) => <tr className={selectedReceipt?.sourceId === receipt.sourceId ? 'selected' : ''} key={receipt.id}><td>{formatDate(receipt.documentDate)}</td><td className="code-cell">{receipt.documentNo}</td><td>{receipt.customerName}</td><td>{receipt.currency}</td><td className="money-cell">{formatMoney(receipt.totalAmount, receipt.currency)}</td><td><button type="button" onClick={() => loadReceipt(receipt)}>Proformaya Al</button></td></tr>)}</tbody></table></div>}
      </section>

      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {message && <div className="proforma-message"><CheckCircle2 size={16} /> {message}</div>}
      {isLoadingDocument && <div className="list-state">Fiş, cari ve GTİP kayıtları hazırlanıyor…</div>}

      {detail && !isLoadingDocument && <>
        <section className="proforma-summary-strip">
          <div><span>Kaynak fiş</span><strong>{header.sourceDocumentNo}</strong><small>{selectedReceipt?.customerName}</small></div>
          <div><span>Ürün satırı</span><strong>{totals.lineCount}</strong><small>{formatNumber(totals.quantity)} adet</small></div>
          <div className={totals.missingGtip || totals.gtipNeedsReview ? 'warning' : 'success'}><span>GTİP kontrolü</span><strong>{totals.missingGtip ? `${totals.missingGtip} eksik` : totals.gtipNeedsReview ? `${totals.gtipNeedsReview} taslak` : 'Tamam'}</strong><small>{totals.missingGtip ? 'Çıktıda teyit uyarısı görünür' : totals.automaticGtip ? `${totals.automaticGtip} kod otomatik üretildi; sevk öncesi teyit gerekir` : 'Kayıtlı kodlar yüklendi'}</small></div>
          <div><span>Proforma toplamı</span><strong>{formatMoney(totals.grandTotal, header.currency)}</strong><small>Mal + nakliye bedeli</small></div>
        </section>

        <section className="proforma-editor-grid">
          <section className="erp-panel proforma-card">
            <div className="panel-title"><strong>2. Belge bilgileri</strong><span>Proforma kimliği ve geçerlilik</span></div>
            <div className="proforma-form-grid two">
              <label><span>Proforma no *</span><input value={header.proformaNo} onChange={(event) => updateSection(setHeader, 'proformaNo', event.target.value)} /></label>
              <label><span>Para birimi</span><select value={header.currency} onChange={(event) => updateSection(setHeader, 'currency', event.target.value)}><option>USD</option><option>EUR</option><option>TRY</option></select></label>
              <label><span>Düzenleme tarihi</span><input type="date" value={header.issueDate} onChange={(event) => updateSection(setHeader, 'issueDate', event.target.value)} /></label>
              <label><span>Geçerlilik tarihi</span><input type="date" value={header.validUntil} min={header.issueDate || undefined} onChange={(event) => updateSection(setHeader, 'validUntil', event.target.value)} /></label>
            </div>
          </section>

          <section className="erp-panel proforma-card">
            <div className="panel-title"><strong>3. Alıcı bilgileri</strong><span>Cari karttan geldi, eksikleri tamamlayın</span></div>
            <div className="proforma-form-grid two">
              <label className="span-two"><span>Firma / unvan *</span><input value={buyer.name} onChange={(event) => updateSection(setBuyer, 'name', event.target.value)} /></label>
              <label className="span-two"><span>Adres</span><textarea rows="2" value={buyer.address} onChange={(event) => updateSection(setBuyer, 'address', event.target.value)} /></label>
              <label><span>Şehir / ülke</span><input value={buyer.cityCountry} onChange={(event) => updateSection(setBuyer, 'cityCountry', event.target.value)} /></label>
              <label><span>Vergi numarası</span><input value={buyer.taxNumber} onChange={(event) => updateSection(setBuyer, 'taxNumber', event.target.value)} /></label>
              <label><span>Yetkili</span><input value={buyer.contactName} onChange={(event) => updateSection(setBuyer, 'contactName', event.target.value)} /></label>
              <label><span>Telefon</span><input value={buyer.phone} onChange={(event) => updateSection(setBuyer, 'phone', event.target.value)} /></label>
              <label className="span-two"><span>E-posta</span><input type="email" value={buyer.email} onChange={(event) => updateSection(setBuyer, 'email', event.target.value)} /></label>
            </div>
          </section>

          <section className="erp-panel proforma-card proforma-shipment-card">
            <div className="panel-title"><strong>4. Teslimat ve ödeme</strong><span>Her proformada teyit edilmesi gereken ticari koşullar</span></div>
            <div className="proforma-form-grid four">
              <label><span>Teslim şekli</span><select value={shipment.incoterm} onChange={(event) => updateSection(setShipment, 'incoterm', event.target.value)}><option value="">Seçin</option><option>EXW</option><option>FCA</option><option>CPT</option><option>CIP</option><option>DAP</option><option>DDP</option><option>FOB</option></select></label>
              <label><span>Ödeme şekli</span><input value={shipment.paymentTerms} onChange={(event) => updateSection(setShipment, 'paymentTerms', event.target.value)} placeholder="Örn. %50 peşin, %50 sevk öncesi" /></label>
              <label><span>Taşıma türü</span><select value={shipment.transportMode} onChange={(event) => updateSection(setShipment, 'transportMode', event.target.value)}><option>Karayolu</option><option>Havayolu</option><option>Denizyolu</option><option>Kurye / Ekspres</option></select></label>
              <label><span>Teslim yeri</span><input value={shipment.deliveryPlace} onChange={(event) => updateSection(setShipment, 'deliveryPlace', event.target.value)} /></label>
              <label><span>Koli sayısı</span><input value={shipment.packageCount} onChange={(event) => updateSection(setShipment, 'packageCount', event.target.value)} placeholder="Örn. 4 koli" /></label>
              <label><span>Net ağırlık</span><input value={shipment.netWeight} onChange={(event) => updateSection(setShipment, 'netWeight', event.target.value)} placeholder="Örn. 220 kg" /></label>
              <label><span>Brüt ağırlık</span><input value={shipment.grossWeight} onChange={(event) => updateSection(setShipment, 'grossWeight', event.target.value)} placeholder="Örn. 240 kg" /></label>
              <label><span>Nakliye bedeli ({header.currency})</span><input min="0" step="0.01" type="number" value={shipment.freightAmount ?? 0} onChange={(event) => updateSection(setShipment, 'freightAmount', Math.max(0, Number(event.target.value || 0)))} /></label>
              <label><span>Menşe</span><input value={shipment.originCountry} onChange={(event) => updateSection(setShipment, 'originCountry', event.target.value)} /></label>
              <label className="span-four"><span>Açıklama</span><textarea rows="2" value={shipment.notes} onChange={(event) => updateSection(setShipment, 'notes', event.target.value)} /></label>
            </div>
            {!shipment.incoterm && <div className="proforma-inline-warning"><TriangleAlert size={15} /> Teslim şeklini seçmeden alınan çıktı “teyit edilecek” olarak işaretlenir.</div>}
          </section>

          <section className="erp-panel proforma-card proforma-corporate-card">
            <div className="panel-title"><strong>5. Kurumsal ve banka bilgileri</strong><span>Referans faturadaki onaylı sabit bilgiler PDF çıktısına eklenir</span></div>
            <div className="proforma-corporate-grid">
              <div><span>Satıcı</span><strong>{seller.name}</strong><small>VKN {seller.taxNumber} · MERSİS {seller.mersis} · Sicil {seller.tradeRegistry}</small></div>
              <div><span>Banka</span><strong>{bank.name}</strong><small>SWIFT {bank.swift}</small></div>
              <div><span>TRY IBAN</span><strong>{bank.tryIban}</strong></div>
              <div><span>USD IBAN</span><strong>{bank.usdIban}</strong></div>
              <div><span>EUR IBAN</span><strong>{bank.eurIban}</strong></div>
            </div>
          </section>
        </section>

        <section className="erp-panel proforma-lines-panel">
          <div className="panel-title"><strong>6. Ürünler ve GTİP</strong><span>Kayıtlı kod korunur; boş kod ürün adına göre otomatik taslak üretilir</span></div>
          {totals.automaticGtip > 0 && <div className="proforma-inline-warning"><TriangleAlert size={15} /> {totals.automaticGtip} GTİP otomatik taslaktır. Ürün etiketi, malzeme, örme/dokuma yapısı ve bebek ölçü sınıfı sevk öncesinde doğrulanmalıdır.</div>}
          <div className="table-shell"><table className="erp-table proforma-lines-table"><thead><tr><th>Dahil</th><th>Stok Kodu</th><th>Ürün açıklaması</th><th>GTİP</th><th>Miktar</th><th>Birim</th><th>Birim fiyat</th><th>Tutar</th></tr></thead><tbody>{lines.map((line) => <tr className={!line.included ? 'excluded' : ''} key={line.id}><td><input aria-label={`${line.stockCode} satırını dahil et`} type="checkbox" checked={line.included} onChange={(event) => updateLine(line.id, 'included', event.target.checked)} /></td><td className="code-cell">{line.stockCode}</td><td><input value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} /></td><td><input className={!line.gtipCode ? 'field-warning' : ''} value={line.gtipCode} onChange={(event) => updateLine(line.id, 'gtipCode', event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12 haneli GTİP" /><small title={[line.gtipMaterialBasis, line.gtipNote].filter(Boolean).join(' · ')}>{gtipStatusText(line)}</small></td><td><input min="0" step="0.01" type="number" value={line.quantity} onChange={(event) => updateLine(line.id, 'quantity', event.target.value)} /></td><td>{line.unitName}</td><td><input min="0" step="0.01" type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, 'unitPrice', event.target.value)} /></td><td className="money-cell">{formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0), header.currency)}</td></tr>)}</tbody><tfoot><tr><th colSpan="4">Proforma toplamı (mal + nakliye)</th><th>{formatNumber(totals.quantity)}</th><th></th><th></th><th>{formatMoney(totals.grandTotal, header.currency)}</th></tr></tfoot></table></div>
        </section>

        <section className="proforma-bottom-bar">
          <div><strong>{header.proformaNo}</strong><span>{isDirty ? 'Kaydedilmemiş değişiklik var' : 'Taslak güncel'}</span></div>
          <button type="button" onClick={saveDraft}><Save size={15} /> Taslağı Kaydet</button>
          <button type="button" className="primary" onClick={savePdfDocument}><FileDown size={15} /> Proformayı PDF Kaydet</button>
        </section>
      </>}
    </main>
  );
}
