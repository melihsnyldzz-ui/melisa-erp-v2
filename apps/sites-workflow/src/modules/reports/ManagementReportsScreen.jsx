import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchManagementReporting, fetchPeriodicAccounting } from '../../services/dashboardApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatMoney(amount, currency = 'TRY') {
  if (!['TRY','USD','EUR'].includes(currency) || amount == null || amount === '') return 'Doğrulanmadı';
  const match=String(amount).match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if(!match)return 'Doğrulanmadı';
  const rounded=BigInt(match[2])+((match[3]||'0')[0]>='5'?1n:0n);
  const whole=String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return `${match[1]&&rounded!==0n?'-':''}${{TRY:'₺',USD:'$',EUR:'€'}[currency]}${whole}`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Doğrulanmadı';
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
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

function TablePanel({ title, subtitle, columns, rows, complete = true, emptyText = 'Kayıt yok.' }) {
  return (
    <details className="erp-panel dashboard-table-panel report-table-details">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <b>{complete ? `${rows.length} satır` : rows.length ? `${rows.length} satır · kapsam eksik` : 'Veri doğrulanmadı'}</b>
      </summary>
      <div className="table-wrap dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length}>{complete ? emptyText : 'Bu bölümün verisi yanıtta bulunmuyor; kayıt yok sonucu çıkarılamaz.'}</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.id || `${title}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'right' ? 'money-cell' : ''}>
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function formatBalanceGroups(rows) {
  if (!Array.isArray(rows)) return 'Doğrulanmadı';
  if (!rows.length) return 'Kayıt yok';
  return rows.map(row => row.currency ? formatMoney(row.balance,row.currency) : 'Döviz doğrulanmadı').join(' · ');
}

function NotesPanel({ title, notes }) {
  const visibleNotes = (notes || []).filter(Boolean);

  if (visibleNotes.length === 0) return null;

  return (
    <details className="erp-panel report-notes-panel report-note-details">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>Salt okunur raporlama sınırı</small>
        </span>
        <b>{visibleNotes.length}</b>
      </summary>
      <ul>
        {visibleNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  );
}

export function ManagementReportsScreen() {
  const [report, setReport] = useState({});
  const [periodicReport, setPeriodicReport] = useState({});
  const [periodFilters, setPeriodFilters] = useState({ dateFrom: monthStart(), dateTo: today() });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const requestSequence = useRef(0);
  const [loadedFilters, setLoadedFilters] = useState(null);
  const canUseReport = !isLoading && !errorMessage && loadedFilters !== null;
  const renderedRequest = requestSequence.current;

  async function loadReport(nextFilters = periodFilters) {
    const request = ++requestSequence.current;
    const requestedFilters = { ...nextFilters };
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [managementResponse, periodicResponse] = await Promise.all([
        fetchManagementReporting(),
        fetchPeriodicAccounting(requestedFilters),
      ]);
      if (request !== requestSequence.current) return;
      if (managementResponse?.success!==true || periodicResponse?.success!==true
        || !managementResponse?.data || !periodicResponse?.data
        || typeof managementResponse.data!=='object' || typeof periodicResponse.data!=='object'
        || Array.isArray(managementResponse.data) || Array.isArray(periodicResponse.data))
        throw new Error('Rapor yanıtı boş veya başarısız; veri doğrulanmadı.');
      for(const [data,keys] of [[managementResponse.data,['topProducts','customerAnalysis','supplierAnalysis','criticalWarnings']],
        [periodicResponse.data,['salesByCurrency','purchasesByCurrency','financeByCurrency','dailyCash','customerBalances','supplierBalances']]]) {
        for(const key of keys)if(data[key]!=null&&(!Array.isArray(data[key])
          ||data[key].some(row=>!row||typeof row!=='object'||Array.isArray(row))))
          throw new Error('Rapor liste alanları doğrulanamadı.');
      }
      if (periodicResponse.data.dateFrom !== requestedFilters.dateFrom || periodicResponse.data.dateTo !== requestedFilters.dateTo)
        throw new Error('Rapor yanıtının tarih kapsamı istenen dönemle eşleşmiyor.');
      setReport(managementResponse.data);
      setPeriodicReport(periodicResponse.data);
      setLoadedFilters(requestedFilters);
    } catch (error) {
      if (request !== requestSequence.current) return;
      setErrorMessage(`${error.message || 'Yönetim raporu okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if (request === requestSequence.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    return () => { requestSequence.current += 1; };
  }, []);

  function updatePeriodFilter(key, value) {
    setPeriodFilters((current) => ({ ...current, [key]: value }));
  }

  function applyPeriodFilters(event) {
    event.preventDefault();
    loadReport(periodFilters);
  }

  const kpis = useMemo(() => {
    const widgets = report.widgets || {};
    const sales = report.dailySales || {};
    const purchases = report.dailyPurchases || {};

    return [
      { label: 'Bugün satış', value: formatMoney(widgets.todaySalesTry), detail: `${formatNumber(sales.salesCount)} fiş`, tone: 'good' },
      { label: 'Bugün alış', value: formatMoney(widgets.todayPurchasesTry), detail: `${formatNumber(purchases.purchaseCount)} fiş`, tone: 'info' },
      { label: 'Stok değeri', value: formatMoney(widgets.totalStockValueTry), detail: 'Kart stoğu × ortalama maliyet', tone: 'info' },
      { label: 'Müşteri bakiyesi', value: formatBalanceGroups(widgets.customerBalances), detail: 'Güncel kart bakiyesi · dövizler ayrı · mutabakat doğrulanmadı', tone: 'warn' },
      { label: 'Tedarikçi bakiyesi', value: formatBalanceGroups(widgets.supplierBalances), detail: 'Güncel kart bakiyesi · dövizler ayrı · mutabakat doğrulanmadı', tone: 'warn' },
      { label: 'Kritik uyarı', value: formatNumber(Array.isArray(report.criticalWarnings) ? report.criticalWarnings.length : null), detail: `${formatNumber(widgets.negativeStockCount)} eksi stok`, tone: Number(widgets.negativeStockCount || 0) > 0 ? 'danger' : 'good' },
    ];
  }, [report]);

  const periodicKpis = useMemo(() => {
    const widgets = periodicReport.widgets || {};
    return [
      { label: 'Dönem satış', value: formatMoney(widgets.salesTry), detail: `${periodicReport.dateFrom || '-'} / ${periodicReport.dateTo || '-'}`, tone: 'good' },
      { label: 'Dönem alış', value: formatMoney(widgets.purchasesTry), detail: 'Kesinleşen alış toplamı', tone: 'info' },
      { label: 'Tahsilat', value: formatMoney(widgets.collections), detail: 'Müşteri tahsilatları', tone: 'good' },
      { label: 'Ödeme', value: formatMoney(widgets.payments), detail: 'Tedarikçi ödemeleri', tone: 'danger' },
      { label: 'Net kasa', value: formatMoney(widgets.netCash), detail: 'Tahsilat eksi ödeme', tone: Number(widgets.netCash || 0) >= 0 ? 'good' : 'danger' },
      { label: 'Kasa/banka TRY', value: formatMoney(widgets.cashBankTry), detail: 'Aktif hesap bakiyesi', tone: 'info' },
    ];
  }, [periodicReport]);

  const dailySales = report.dailySales || {};
  const dailyPurchases = report.dailyPurchases || {};

  const salesRows = report ? [{
    metric: 'Günlük satış',
    count: formatNumber(dailySales.salesCount),
    amount: formatMoney(dailySales.salesAmountTry),
    extra: formatMoney(dailySales.grossProfitTry),
  }, {
    metric: 'İptal satış',
    count: formatNumber(dailySales.cancelledSalesCount),
    amount: formatMoney(dailySales.cancelledSalesAmountTry),
    extra: '-',
  }] : [];

  const purchaseRows = report ? [{
    metric: 'Günlük alış',
    count: formatNumber(dailyPurchases.purchaseCount),
    amount: formatMoney(dailyPurchases.purchaseAmountTry),
    extra: '-',
  }, {
    metric: 'İptal alış',
    count: formatNumber(dailyPurchases.cancelledPurchaseCount),
    amount: formatMoney(dailyPurchases.cancelledPurchaseAmountTry),
    extra: '-',
  }] : [];

  const currencyRows = [
    ...((periodicReport.salesByCurrency || []).map((row) => ({
      id: `sales-${row.currency}`,
      type: 'Satış',
      currency: row.currency,
      count: formatNumber(row.count),
      amount: formatMoney(row.amount, row.currency),
      amountTry: formatMoney(row.amountTry),
    }))),
    ...((periodicReport.purchasesByCurrency || []).map((row) => ({
      id: `purchase-${row.currency}`,
      type: 'Alış',
      currency: row.currency,
      count: formatNumber(row.count),
      amount: formatMoney(row.amount, row.currency),
      amountTry: formatMoney(row.amountTry),
    }))),
    ...((periodicReport.financeByCurrency || []).map((row) => ({
      id: `finance-${row.currency}`,
      type: 'Finans net',
      currency: row.currency,
      count: formatNumber(row.count),
      amount: formatMoney(row.amount, row.currency),
      amountTry: formatMoney(row.amountTry),
    }))),
  ];

  const cashRows = (periodicReport.dailyCash || []).map((row, index) => ({
    id: `cash-${row.date}-${row.currency}-${index}`,
    date: formatDate(row.date),
    currency: row.currency,
    collections: formatMoney(row.collections, row.currency),
    payments: formatMoney(row.payments, row.currency),
    net: formatMoney(row.net, row.currency),
  }));

  const balanceRows = [
    ...((periodicReport.customerBalances || []).map((row) => ({
      id: `customer-${row.currency}`,
      type: 'Müşteri',
      currency: row.currency,
      count: formatNumber(row.partyCount),
      debit: formatMoney(row.debit, row.currency),
      credit: formatMoney(row.credit, row.currency),
      balance: formatMoney(row.balance, row.currency),
    }))),
    ...((periodicReport.supplierBalances || []).map((row) => ({
      id: `supplier-${row.currency}`,
      type: 'Tedarikçi',
      currency: row.currency,
      count: formatNumber(row.partyCount),
      debit: formatMoney(row.debit, row.currency),
      credit: formatMoney(row.credit, row.currency),
      balance: formatMoney(row.balance, row.currency),
    }))),
  ];

  const topProductRows = (report.topProducts || []).map((row) => ({
    id: row.productId,
    product: `${row.stockCode} / ${row.productName}`,
    quantity: formatNumber(row.quantity),
    revenue: formatMoney(row.revenueTry),
    profit: formatMoney(row.grossProfitTry),
  }));

  const customerRows = (report.customerAnalysis || []).map((row) => ({
    id: row.customerId,
    customer: `${row.customerCode} / ${row.customerName}`,
    sales: formatMoney(row.totalSalesTry),
    balance: row.currency ? formatMoney(row.balance,row.currency) : 'Döviz doğrulanmadı',
    lastSale: formatDate(row.lastSaleDate),
  }));

  const supplierRows = (report.supplierAnalysis || []).map((row) => ({
    id: row.supplierId,
    supplier: `${row.supplierCode} / ${row.supplierName}`,
    purchases: formatMoney(row.totalPurchasesTry),
    balance: row.currency ? formatMoney(row.balance,row.currency) : 'Döviz doğrulanmadı',
    lastPurchase: formatDate(row.lastPurchaseDate),
  }));

  const warningRows = (report.criticalWarnings || []).map((row, index) => ({
    id: `${row.type}-${index}`,
    type: row.type,
    subject: row.subject,
    value: formatNumber(row.value),
    severity: row.severity,
  }));

  const reportAssumptionRows = [
    ...((report.assumptions || []).map((note) => ({
      section: 'Yönetim varsayımı',
      metric: 'Rapor sınırı',
      value: note,
      detail: report.dataQuality?.source || 'Salt okunur özet',
    }))),
    ...((report.dataQuality?.reviewRequired || []).map((note) => ({
      section: 'Veri kalitesi',
      metric: 'İnsan kontrolü gerekli',
      value: note,
      detail: 'Karardan önce insan kontrolü',
    }))),
    ...((report.dataQuality?.approvalBoundaries || []).map((note) => ({
      section: 'Onay sınırı',
      metric: 'Raporun yapamayacağı işlem',
      value: note,
      detail: 'Riskli adımlar için şirket yetkilisinin onayı gerekir',
    }))),
    ...((periodicReport.assumptions || []).map((note) => ({
      section: 'Dönem varsayımı',
      metric: 'Rapor sınırı',
      value: note,
      detail: periodicReport.dataQuality?.source || 'Salt okunur özet',
    }))),
    ...((periodicReport.dataQuality?.reviewRequired || []).map((note) => ({
      section: 'Dönem veri kalitesi',
      metric: 'İnsan kontrolü gerekli',
      value: note,
      detail: 'Görünür tarih filtreleri gerekli',
    }))),
  ];

  const datasetScopeRows = [
    ['En Çok Satan Ürünler',report.topProducts],['Müşteri Analizi',report.customerAnalysis],
    ['Tedarikçi Analizi',report.supplierAnalysis],['Kritik Uyarılar',report.criticalWarnings],
    ['Dönem Satış Dövizleri',periodicReport.salesByCurrency],['Dönem Alış Dövizleri',periodicReport.purchasesByCurrency],
    ['Dönem Finans Dövizleri',periodicReport.financeByCurrency],['Günlük Kasa',periodicReport.dailyCash],
    ['Müşteri Bakiye Dövizleri',periodicReport.customerBalances],['Tedarikçi Bakiye Dövizleri',periodicReport.supplierBalances],
  ].map(([label,rows])=>({section:'Veri kapsamı',metric:label,
    value:Array.isArray(rows)?rows.length?'Veri alındı':'Boş liste alındı':'Doğrulanmadı',
    detail:Array.isArray(rows)?`${rows.length} yanıt satırı; tüm kayıt kapsamı ayrıca doğrulanmalıdır.`:'Bölüm yanıtta yok; sıfır veya kayıt yok sonucu çıkarılamaz.'}));
  const hasMissingDatasets=datasetScopeRows.some(row=>row.value==='Doğrulanmadı');
  const reportExportRows = [
    ...datasetScopeRows,
    ...reportAssumptionRows,
    ...kpis.map((row) => ({
      section: 'Anlık KPI',
      metric: row.label,
      value: row.value,
      detail: row.detail,
    })),
    ...periodicKpis.map((row) => ({
      section: 'Dönem KPI',
      metric: row.label,
      value: row.value,
      detail: row.detail,
    })),
    ...currencyRows.map((row) => ({
      section: 'Para Birimi Özeti',
      metric: `${row.type} ${row.currency}`,
      value: row.amountTry,
      detail: `${row.count} adet / ${row.amount}`,
    })),
    ...balanceRows.map((row) => ({
      section: 'Cari Bakiye',
      metric: `${row.type} ${row.currency}`,
      value: row.balance,
      detail: `${row.count} cari / borç ${row.debit} / alacak ${row.credit}`,
    })),
    ...topProductRows.map((row) => ({
      section: 'En Çok Satan Ürün',
      metric: row.product,
      value: row.revenue,
      detail: `${row.quantity} adet / kâr ${row.profit}`,
    })),
    ...customerRows.map((row) => ({
      section: 'Müşteri Analizi',
      metric: row.customer,
      value: row.sales,
      detail: `Bakiye ${row.balance} / son satış ${row.lastSale}`,
    })),
    ...supplierRows.map((row) => ({
      section: 'Tedarikçi Analizi',
      metric: row.supplier,
      value: row.purchases,
      detail: `Bakiye ${row.balance} / son alış ${row.lastPurchase}`,
    })),
    ...warningRows.map((row) => ({
      section: 'Kritik Uyarı',
      metric: row.subject,
      value: row.value,
      detail: `${row.type} / ${row.severity}`,
    })),
  ];

  const reportExportColumns = [
    { label: 'Bölüm', key: 'section' },
    { label: 'Metrik', key: 'metric' },
    { label: 'Değer', key: 'value' },
    { label: 'Detay', key: 'detail' },
  ];

  function exportManagementReport() {
    if (!canUseReport || renderedRequest !== requestSequence.current) return;
    exportRowsToExcel({
      filename: `yonetim-raporu-${loadedFilters.dateFrom}-${loadedFilters.dateTo}`,
      title: `${report.synthetic ? 'DEMO — ' : ''}Yönetim Raporu${hasMissingDatasets?' — Veri kapsamı eksik':''}`,
      rows: reportExportRows,
      columns: reportExportColumns,
    });
  }

  function printManagementReport() {
    if (!canUseReport || renderedRequest !== requestSequence.current) return;
    printRowsReport({
      title: `${report.synthetic ? 'DEMO — ' : ''}Melisa ERP - Yönetim Raporu`,
      subtitle: `${loadedFilters.dateFrom} - ${loadedFilters.dateTo} / ${reportExportRows.length} çıktı satırı${hasMissingDatasets?' / Veri kapsamı eksik':''}`,
      rows: reportExportRows,
      columns: reportExportColumns,
    });
  }

  return (
    <main className="work-area dashboard-screen management-reports-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Yönetim Raporları</strong>
          <span>Günlük satış, alış, stok, cari, tedarikçi ve dönemsel muhasebe görünümü</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <details className="report-export-menu">
            <summary aria-label="Rapor çıktı seçenekleri" title="Rapor çıktı seçenekleri">...</summary>
            <div>
          <button type="button" disabled={!canUseReport} onClick={exportManagementReport}>Excel</button>
          <button type="button" disabled={!canUseReport} onClick={printManagementReport}>Yazdır</button>
            </div>
          </details>
          <button type="button" className="primary" onClick={() => loadReport(periodFilters)}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yönetim raporları API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {canUseReport && report.fieldScope && <div className="list-state" role="status">
        Yanıt kapsamı: satış {report.fieldScope.sales ? 'izinli' : 'yetki yok'}, alış {report.fieldScope.purchase ? 'izinli' : 'yetki yok'}, finans {report.fieldScope.finance ? 'izinli' : 'yetki yok'}.
        Maliyet/kâr ve kritik uyarı kapsamı doğrulanmadı; gösterilmeyen alanlar sıfır veya kayıt yok anlamına gelmez.
      </div>}

      <section className="erp-panel periodic-report-panel">
        <div className="panel-title">
          <strong>Dönemsel Muhasebe Raporları</strong>
          <span>Satış, alış, kasa ve cari borç/alacak özetleri</span>
        </div>
        <form className="filter-grid" onSubmit={applyPeriodFilters}>
          <label>
            Başlangıç
            <input type="date" value={periodFilters.dateFrom} onChange={(event) => updatePeriodFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" value={periodFilters.dateTo} onChange={(event) => updatePeriodFilter('dateTo', event.target.value)} />
          </label>
          <button className="primary" type="submit">Dönemi Getir</button>
        </form>
      </section>

      {canUseReport && <>
      <details className="erp-panel report-boundary-details">
        <summary>
          <span>
            <strong>Rapor notları ve veri sınırları</strong>
            <small>Karar vermeden önce incelenmesi gereken açıklamalar</small>
          </span>
        </summary>
        <section className="dashboard-main-grid report-boundary-grid">
        <NotesPanel title="Rapor Varsayımları" notes={report.assumptions} />
        <NotesPanel title="Veri Kalitesi Kontrolleri" notes={report.dataQuality?.reviewRequired} />
        <NotesPanel title="Onay Sınırları" notes={report.dataQuality?.approvalBoundaries} />
        </section>
      </details>

      <section className="dashboard-kpi-grid">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </section>



      <section className="dashboard-kpi-grid">
        {periodicKpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="dashboard-main-grid report-detail-grid">
        <NotesPanel title="Dönem Varsayımları" notes={periodicReport.assumptions} />
        <NotesPanel title="Dönem Veri Kalitesi" notes={periodicReport.dataQuality?.reviewRequired} />
      </section>

      <section className="dashboard-main-grid report-detail-grid">
        <TablePanel
          columns={[
            { key: 'type', label: 'Rapor' },
            { key: 'currency', label: 'Para Birimi' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Orijinal Tutar', align: 'right' },
            { key: 'amountTry', label: 'TRY Karşılığı', align: 'right' },
          ]}
          rows={currencyRows}
          complete={['salesByCurrency','purchasesByCurrency','financeByCurrency'].every(k=>Array.isArray(periodicReport[k]))}
          subtitle="Satış, alış ve finans neti para birimi bazında"
          title="Para Birimi Bazlı Dönem Özeti"
        />
        <TablePanel
          columns={[
            { key: 'date', label: 'Tarih' },
            { key: 'currency', label: 'Para Birimi' },
            { key: 'collections', label: 'Tahsilat', align: 'right' },
            { key: 'payments', label: 'Ödeme', align: 'right' },
            { key: 'net', label: 'Net', align: 'right' },
          ]}
          rows={cashRows}
          complete={Array.isArray(periodicReport.dailyCash)}
          subtitle="Günlük kasa/banka giriş çıkış özeti"
          title="Günlük Kasa Raporu"
        />
        <TablePanel
          columns={[
            { key: 'type', label: 'Cari Türü' },
            { key: 'currency', label: 'Para Birimi' },
            { key: 'count', label: 'Cari Sayısı', align: 'right' },
            { key: 'debit', label: 'Borç', align: 'right' },
            { key: 'credit', label: 'Alacak', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
          ]}
          rows={balanceRows}
          complete={['customerBalances','supplierBalances'].every(k=>Array.isArray(periodicReport[k]))}
          subtitle="Müşteri ve tedarikçi kartlarının anlık bakiyesi"
          title="Cari Borç / Alacak Raporu"
        />
      </section>

      <section className="dashboard-main-grid report-detail-grid">
        <TablePanel
          columns={[
            { key: 'metric', label: 'Metrik' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Tutar', align: 'right' },
            { key: 'extra', label: 'Brüt kâr', align: 'right' },
          ]}
          rows={salesRows}
          complete={!!report.dailySales && typeof report.dailySales==='object'}
          subtitle="Kesinleşen ve iptal edilen satışlar ayrılır"
          title="Günlük Satış Özeti"
        />
        <TablePanel
          columns={[
            { key: 'metric', label: 'Metrik' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Tutar', align: 'right' },
            { key: 'extra', label: 'Ek' },
          ]}
          rows={purchaseRows}
          complete={!!report.dailyPurchases && typeof report.dailyPurchases==='object'}
          subtitle="Kesinleşen ve iptal edilen alışlar ayrılır"
          title="Günlük Alış Özeti"
        />
        <TablePanel
          columns={[
            { key: 'product', label: 'Ürün' },
            { key: 'quantity', label: 'Miktar', align: 'right' },
            { key: 'revenue', label: 'Ciro', align: 'right' },
            { key: 'profit', label: 'Kâr', align: 'right' },
          ]}
          rows={topProductRows}
          complete={Array.isArray(report.topProducts)}
          subtitle="Kesinleşen satış satırları"
          title="En Çok Satan Ürünler"
        />
        <TablePanel
          columns={[
            { key: 'customer', label: 'Cari' },
            { key: 'sales', label: 'Toplam satış', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
            { key: 'lastSale', label: 'Son satış' },
          ]}
          rows={customerRows}
          complete={Array.isArray(report.customerAnalysis)}
          subtitle="Kesinleşen satış ve kart bakiyesi"
          title="Müşteri Analizi"
        />
        <TablePanel
          columns={[
            { key: 'supplier', label: 'Tedarikçi' },
            { key: 'purchases', label: 'Toplam alış', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
            { key: 'lastPurchase', label: 'Son alış' },
          ]}
          rows={supplierRows}
          complete={Array.isArray(report.supplierAnalysis)}
          subtitle="Kesinleşen alış ve tedarikçi bakiyesi"
          title="Tedarikçi Analizi"
        />
        <TablePanel
          columns={[
            { key: 'type', label: 'Tip' },
            { key: 'subject', label: 'Konu' },
            { key: 'value', label: 'Değer', align: 'right' },
            { key: 'severity', label: 'Seviye' },
          ]}
          rows={warningRows}
          complete={Array.isArray(report.criticalWarnings)}
          subtitle="Eksi stok ve yüksek bakiye uyarıları"
          title="Kritik Uyarılar"
        />
      </section>

      <section className="screen-summary dashboard-summary">
        <span>Kaynak: {report.synthetic ? 'Sentetik örnek veriler — gerçek şirket kaydı değildir' : 'Yönetim raporu / salt okunur şirket verisi'}</span>
        <span>Üretim zamanı: {formatDate(report.generatedAt)}</span>
        <span>Yetki: dashboard.view</span>
        <span>Sınır: Resmî muhasebe raporu değildir</span>
      </section>
      </>}
    </main>
  );
}
