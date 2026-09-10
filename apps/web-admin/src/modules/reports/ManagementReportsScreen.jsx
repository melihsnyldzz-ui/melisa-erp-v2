import React, { useEffect, useMemo, useState } from 'react';
import { fetchManagementReporting, fetchPeriodicAccounting } from '../../services/dashboardApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatMoney(amount, currency = 'TRY') {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return 'Hesaplanamadı';
  if (!/^[A-Z]{3}$/.test(currency)) return `${formatNumber(amount)} ${currency}`;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatNumber(value) {
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

function TablePanel({ title, subtitle, columns, rows, emptyText = 'Kayıt yok.', className = '' }) {
  return (
    <details className={`erp-panel dashboard-table-panel report-table-details ${className}`}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <b>{rows.length} satır</b>
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
                <td colSpan={columns.length}>{emptyText}</td>
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
  const [report, setReport] = useState(/** @type {import('../../services/reportContracts').ManagementReport} */ ({}));
  const [periodicReport, setPeriodicReport] = useState(/** @type {import('../../services/reportContracts').PeriodicReport} */ ({}));
  const [periodFilters, setPeriodFilters] = useState({ dateFrom: monthStart(), dateTo: today() });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadReport(nextFilters = periodFilters) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [managementResponse, periodicResponse] = await Promise.all([
        fetchManagementReporting(),
        fetchPeriodicAccounting(nextFilters),
      ]);
      setReport(managementResponse.data);
      setPeriodicReport(periodicResponse.data);
    } catch (error) {
      setErrorMessage(`${error.message || 'Yönetim raporu okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
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
      { label: 'Müşteri bakiyesi', value: formatMoney(widgets.customerBalanceTry), detail: 'Cari kart toplam bakiyesi', tone: 'warn' },
      { label: 'Tedarikçi bakiyesi', value: formatMoney(widgets.supplierBalanceTry), detail: 'Tedarikçi kart toplam bakiyesi', tone: 'warn' },
      { label: 'Kritik uyarı', value: formatNumber((report.criticalWarnings || []).length), detail: `${formatNumber(widgets.negativeStockCount)} eksi stok`, tone: Number(widgets.negativeStockCount || 0) > 0 ? 'danger' : 'good' },
    ];
  }, [report]);

  const periodicKpis = useMemo(() => {
    const widgets = periodicReport.widgets || {};
    return [
      { label: 'Dönem satış', value: formatMoney(widgets.salesTry), detail: `${periodicReport.dateFrom || '-'} / ${periodicReport.dateTo || '-'}`, tone: 'good' },
      { label: 'Dönem alış', value: formatMoney(widgets.purchasesTry), detail: 'Kesinleşen alış toplamı', tone: 'info' },
      { label: 'Tahsilat', value: formatMoney(widgets.collections), detail: 'Tarihsel TRY / dövizler aşağıda', tone: 'good' },
      { label: 'Ödeme', value: formatMoney(widgets.payments), detail: 'Tarihsel TRY / dövizler aşağıda', tone: 'danger' },
      { label: 'Net kasa', value: formatMoney(widgets.netCash), detail: 'Tahsilat eksi ödeme', tone: widgets.netCash == null ? 'warn' : widgets.netCash >= 0 ? 'good' : 'danger' },
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
    balance: `${row.currency || '?'} ${formatMoney(row.balance, row.currency)} / TRY: ${formatMoney(row.balanceTry)}`,
    rate: row.currency === 'TRY' ? '1' : `${row.rateToTry ?? (row.balance === 0 ? 'Gerekmiyor' : 'Eksik')} / ${formatDate(row.rateDate)}`,
    lastSale: formatDate(row.lastSaleDate),
  }));

  const supplierRows = (report.supplierAnalysis || []).map((row) => ({
    id: row.supplierId,
    supplier: `${row.supplierCode} / ${row.supplierName}`,
    purchases: formatMoney(row.totalPurchasesTry),
    balance: `${row.currency || '?'} ${formatMoney(row.balance, row.currency)} / TRY: ${formatMoney(row.balanceTry)}`,
    rate: row.currency === 'TRY' ? '1' : `${row.rateToTry ?? (row.balance === 0 ? 'Gerekmiyor' : 'Eksik')} / ${formatDate(row.rateDate)}`,
    lastPurchase: formatDate(row.lastPurchaseDate),
  }));

  const warningRows = (report.criticalWarnings || []).map((row, index) => ({
    id: `${row.type}-${index}`,
    type: row.type,
    subject: row.subject,
    value: row.currency ? formatMoney(row.value, row.currency) : formatNumber(row.value),
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

  const reportExportRows = [
    ...reportAssumptionRows,
    ...((periodicReport.dailyCash || []).map((row) => ({
      section: 'Günlük Kasa',
      metric: `${formatDate(row.date)} / ${row.currency}`,
      value: row.net ?? 'Hesaplanamadı',
      detail: `Tahsilat ${row.collections ?? 'Hesaplanamadı'} ${row.currency} / Ödeme ${row.payments ?? 'Hesaplanamadı'} ${row.currency}`,
    }))),
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
    ...((periodicReport.financeCurrencySummary || []).map(row => ({ section: 'Dönem Tahsilat / Ödeme', metric: row.currency, value: formatMoney(row.collections, row.currency), detail: `Ödeme ${formatMoney(row.payments, row.currency)}` }))),
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
      detail: `Bakiye ${row.balance} / kur ${row.rate} / son satış ${row.lastSale}`,
    })),
    ...supplierRows.map((row) => ({
      section: 'Tedarikçi Analizi',
      metric: row.supplier,
      value: row.purchases,
      detail: `Bakiye ${row.balance} / kur ${row.rate} / son alış ${row.lastPurchase}`,
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
    exportRowsToExcel({
      filename: `yonetim-raporu-${periodicReport.dateFrom}-${periodicReport.dateTo}`,
      title: 'Yönetim Raporu',
      rows: reportExportRows,
      columns: reportExportColumns,
    });
  }

  function printManagementReport() {
    printRowsReport({
      title: 'Melisa ERP - Yönetim Raporu',
      subtitle: `${periodicReport.dateFrom} - ${periodicReport.dateTo} / ${reportExportRows.length} satır`,
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
          <button type="button" disabled={isLoading || Boolean(errorMessage)} onClick={exportManagementReport}>Excel</button>
          <button type="button" disabled={isLoading || Boolean(errorMessage)} onClick={printManagementReport}>Yazdır</button>
            </div>
          </details>
          <button type="button" className="primary" onClick={() => loadReport(periodFilters)}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yönetim raporları API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      {report.conversion && <div className="list-state report-currency-note" role="status">
        Kaynak: Melisa ERP · Güncel bakiye değerleme tarihi: {report.conversion.asOfDate}.
        {report.conversion.status === 'MISSING_RATES' && <> Eksik/geçersiz kur: {report.conversion.missingCurrencies?.join(', ')}. Etkilenen toplam ve yüksek bakiye değerlendirmesi hesaplanamadı.</>}
        <details><summary>Bakiye dövizleri ve kullanılan kurlar</summary>
          {(report.conversion.balancesByCurrency || []).map((row, index) => <div key={index}>
            {row.party === 'customer' ? 'Müşteri' : 'Tedarikçi'} ({row.currency}): {formatMoney(row.balance, row.currency)} → {formatMoney(row.balanceTry)} · Kur: {row.rateToTry ?? (row.balance === 0 ? 'Gerekmiyor' : 'Eksik')} / {row.currency === 'TRY' ? 'TRY' : formatDate(row.rateDate)}
          </div>)}
        </details>
      </div>}
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

      {Boolean(periodicReport.financeConversion?.missingSnapshotCurrencies?.length) && <div className="list-state" role="status">
        Dönem tahsilat/ödemelerinde işlem anı kur kaydı yok: {periodicReport.financeConversion.missingSnapshotCurrencies.join(', ')}. Tarihsel TRY toplamı hesaplanamadı; orijinal tutarlar korundu.
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

      <section className="dashboard-kpi-grid">
        {periodicKpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </section>

      <TablePanel title="Dönem Tahsilat / Ödeme Dövizleri" subtitle="Tüm dönem; farklı dövizler birbirine eklenmez"
        columns={[{ key: 'currency', label: 'Döviz' }, { key: 'collections', label: 'Tahsilat' }, { key: 'payments', label: 'Ödeme' }]}
        rows={(periodicReport.financeCurrencySummary || []).map(row => ({ currency: row.currency, collections: formatMoney(row.collections, row.currency), payments: formatMoney(row.payments, row.currency) }))} />
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
          subtitle="Kesinleşen satış satırları"
          title="En Çok Satan Ürünler"
        />
        <TablePanel
          columns={[
            { key: 'customer', label: 'Cari' },
            { key: 'sales', label: 'Toplam satış', align: 'right' },
            { key: 'balance', label: 'Bakiye / TRY', align: 'right' },
            { key: 'rate', label: 'Kur / Tarih' },
            { key: 'lastSale', label: 'Son satış' },
          ]}
          rows={customerRows}
          className="report-party-analysis"
          subtitle="Kesinleşen satış ve kart bakiyesi"
          title="Müşteri Analizi"
        />
        <TablePanel
          columns={[
            { key: 'supplier', label: 'Tedarikçi' },
            { key: 'purchases', label: 'Toplam alış', align: 'right' },
            { key: 'balance', label: 'Bakiye / TRY', align: 'right' },
            { key: 'rate', label: 'Kur / Tarih' },
            { key: 'lastPurchase', label: 'Son alış' },
          ]}
          rows={supplierRows}
          className="report-party-analysis"
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
          subtitle="Eksi stok ve yüksek bakiye uyarıları"
          title="Kritik Uyarılar"
        />
      </section>

      <section className="screen-summary dashboard-summary">
        <span>Kaynak: Yönetim raporu / salt okunur şirket verisi</span>
        <span>Üretim zamanı: {formatDate(report.generatedAt)}</span>
        <span>Yetki: dashboard.view</span>
        <span>Sınır: Resmî muhasebe raporu değildir</span>
      </section>
    </main>
  );
}
