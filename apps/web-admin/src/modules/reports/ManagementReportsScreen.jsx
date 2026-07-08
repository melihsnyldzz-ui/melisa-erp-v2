import React, { useEffect, useMemo, useState } from 'react';
import { fetchManagementReporting, fetchPeriodicAccounting } from '../../services/dashboardApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatMoney(amount, currency = 'TRY') {
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

function TablePanel({ title, subtitle, columns, rows, emptyText = 'Kayıt yok.' }) {
  return (
    <section className="erp-panel dashboard-table-panel">
      <div className="panel-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
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
    </section>
  );
}

function NotesPanel({ title, notes }) {
  const visibleNotes = (notes || []).filter(Boolean);

  if (visibleNotes.length === 0) return null;

  return (
    <section className="erp-panel report-notes-panel">
      <div className="panel-title">
        <strong>{title}</strong>
        <span>Read-only reporting boundary</span>
      </div>
      <ul>
        {visibleNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

export function ManagementReportsScreen() {
  const [report, setReport] = useState({});
  const [periodicReport, setPeriodicReport] = useState({});
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
      setErrorMessage(`${error.message || 'Y?netim raporu okunamadi.'} (${error.code || 'API_ERROR'})`);
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
      { label: 'Stok değeri', value: formatMoney(widgets.totalStockValueTry), detail: 'Kart stoğu x ortalama maliyet', tone: 'info' },
      { label: 'Müşteri bakiye', value: formatMoney(widgets.customerBalanceTry), detail: 'Cari kart toplam bakiye', tone: 'warn' },
      { label: 'Tedarikçi bakiye', value: formatMoney(widgets.supplierBalanceTry), detail: 'Tedarikçi kart toplam bakiye', tone: 'warn' },
      { label: 'Kritik uyar', value: formatNumber((report.criticalWarnings || []).length), detail: `${formatNumber(widgets.negativeStockCount)} eksi stok`, tone: Number(widgets.negativeStockCount || 0) > 0 ? 'danger' : 'good' },
    ];
  }, [report]);

  const periodicKpis = useMemo(() => {
    const widgets = periodicReport.widgets || {};
    return [
      { label: 'Dönem satış', value: formatMoney(widgets.salesTry), detail: `${periodicReport.dateFrom || '-'} / ${periodicReport.dateTo || '-'}`, tone: 'good' },
      { label: 'Dönem alış', value: formatMoney(widgets.purchasesTry), detail: 'Kesinleşen alış toplamı', tone: 'info' },
      { label: 'Tahsilat', value: formatMoney(widgets.collections), detail: 'Müşteri tahsilatları', tone: 'good' },
      { label: 'Ödeme', value: formatMoney(widgets.payments), detail: 'Tedarikçi Ödemeleri', tone: 'danger' },
      { label: 'Net kasa', value: formatMoney(widgets.netCash), detail: 'Tahsilat eksi Ödeme', tone: Number(widgets.netCash || 0) >= 0 ? 'good' : 'danger' },
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
    balance: formatMoney(row.balanceTry),
    lastSale: formatDate(row.lastSaleDate),
  }));

  const supplierRows = (report.supplierAnalysis || []).map((row) => ({
    id: row.supplierId,
    supplier: `${row.supplierCode} / ${row.supplierName}`,
    purchases: formatMoney(row.totalPurchasesTry),
    balance: formatMoney(row.balanceTry),
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
      section: 'Management assumption',
      metric: 'Report boundary',
      value: note,
      detail: report.dataQuality?.source || 'Read-only aggregate',
    }))),
    ...((report.dataQuality?.reviewRequired || []).map((note) => ({
      section: 'Data quality',
      metric: 'Review required',
      value: note,
      detail: 'Human review before decision',
    }))),
    ...((report.dataQuality?.approvalBoundaries || []).map((note) => ({
      section: 'Approval boundary',
      metric: 'Not allowed in report',
      value: note,
      detail: 'Melih approval required for risky steps',
    }))),
    ...((periodicReport.assumptions || []).map((note) => ({
      section: 'Period assumption',
      metric: 'Report boundary',
      value: note,
      detail: periodicReport.dataQuality?.source || 'Read-only aggregate',
    }))),
    ...((periodicReport.dataQuality?.reviewRequired || []).map((note) => ({
      section: 'Period data quality',
      metric: 'Review required',
      value: note,
      detail: 'Visible date filters required',
    }))),
  ];

  const reportExportRows = [
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
    exportRowsToExcel({
      filename: `y?netim-raporu-${periodFilters.dateFrom}-${periodFilters.dateTo}`,
      title: 'Yönetim Raporu',
      rows: reportExportRows,
      columns: reportExportColumns,
    });
  }

  function printManagementReport() {
    printRowsReport({
      title: 'Melisa ERP - Yönetim Raporu',
      subtitle: `${periodFilters.dateFrom} - ${periodFilters.dateTo} / ${reportExportRows.length} satır`,
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
          <button type="button" onClick={exportManagementReport}>Excel</button>
          <button type="button" onClick={printManagementReport}>Yazdır</button>
          <button type="button" onClick={() => loadReport(periodFilters)}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Ynetim raporlar API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-main-grid">
        <NotesPanel title="Report Assumptions" notes={report.assumptions} />
        <NotesPanel title="Data Quality Checks" notes={report.dataQuality?.reviewRequired} />
        <NotesPanel title="Approval Boundaries" notes={report.dataQuality?.approvalBoundaries} />
      </section>

      <section className="dashboard-kpi-grid">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </section>

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

      <section className="dashboard-main-grid">
        <NotesPanel title="Period Assumptions" notes={periodicReport.assumptions} />
        <NotesPanel title="Period Data Quality" notes={periodicReport.dataQuality?.reviewRequired} />
      </section>

      <section className="dashboard-main-grid">
        <TablePanel
          columns={[
            { key: 'type', label: 'Rapor' },
            { key: 'currency', label: 'PB' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Orijinal Tutar', align: 'right' },
            { key: 'amountTry', label: 'TRY Karşılığı', align: 'right' },
          ]}
          rows={currencyRows}
          subtitle="Satış, alış ve finans neti para birimi bazında"
          title="Para Birimi Bazl Dönem Özeti"
        />
        <TablePanel
          columns={[
            { key: 'date', label: 'Tarih' },
            { key: 'currency', label: 'PB' },
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
            { key: 'currency', label: 'PB' },
            { key: 'count', label: 'Cari Sayısı', align: 'right' },
            { key: 'debit', label: 'Borç', align: 'right' },
            { key: 'credit', label: 'Alacak', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
          ]}
          rows={balanceRows}
          subtitle="Müşteri ve tedarikçi kartlarının anlık bakiyesi"
          title="Cari Bor / Alacak Raporu"
        />
      </section>

      <section className="dashboard-main-grid">
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
            { key: 'balance', label: 'Bakiye', align: 'right' },
            { key: 'lastSale', label: 'Son satış' },
          ]}
          rows={customerRows}
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
        <span>Kaynak: Yonetim raporu / read-only SQL SELECT</span>
        <span>Uretim zamani: {formatDate(report.generatedAt)}</span>
        <span>Yetki: dashboard.view</span>
        <span>Sinir: resmi muhasebe raporu degildir</span>
      </section>
    </main>
  );
}
