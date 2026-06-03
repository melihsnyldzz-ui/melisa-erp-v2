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

function TablePanel({ title, subtitle, columns, rows, emptyText = 'Kayit yok.' }) {
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

export function ManagementReportsScreen() {
  const [report, setReport] = useState(null);
  const [periodicReport, setPeriodicReport] = useState(null);
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
      setErrorMessage(`${error.message || 'Yonetim raporu okunamadi.'} (${error.code || 'API_ERROR'})`);
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
    const widgets = report?.widgets || {};
    const sales = report?.dailySales || {};
    const purchases = report?.dailyPurchases || {};

    return [
      { label: 'Bugun satis', value: formatMoney(widgets.todaySalesTry), detail: `${formatNumber(sales.salesCount)} fis`, tone: 'good' },
      { label: 'Bugun alis', value: formatMoney(widgets.todayPurchasesTry), detail: `${formatNumber(purchases.purchaseCount)} fis`, tone: 'info' },
      { label: 'Stok degeri', value: formatMoney(widgets.totalStockValueTry), detail: 'Kart stogu x ortalama maliyet', tone: 'info' },
      { label: 'Musteri bakiye', value: formatMoney(widgets.customerBalanceTry), detail: 'Cari kart toplam bakiye', tone: 'warn' },
      { label: 'Tedarikci bakiye', value: formatMoney(widgets.supplierBalanceTry), detail: 'Tedarikci kart toplam bakiye', tone: 'warn' },
      { label: 'Kritik uyari', value: formatNumber((report?.criticalWarnings || []).length), detail: `${formatNumber(widgets.negativeStockCount)} eksi stok`, tone: Number(widgets.negativeStockCount || 0) > 0 ? 'danger' : 'good' },
    ];
  }, [report]);

  const periodicKpis = useMemo(() => {
    const widgets = periodicReport?.widgets || {};
    return [
      { label: 'Donem satis', value: formatMoney(widgets.salesTry), detail: `${periodicReport?.dateFrom || '-'} / ${periodicReport?.dateTo || '-'}`, tone: 'good' },
      { label: 'Donem alis', value: formatMoney(widgets.purchasesTry), detail: 'Kesinlesen alis toplami', tone: 'info' },
      { label: 'Tahsilat', value: formatMoney(widgets.collections), detail: 'Musteri tahsilatlari', tone: 'good' },
      { label: 'Odeme', value: formatMoney(widgets.payments), detail: 'Tedarikci odemeleri', tone: 'danger' },
      { label: 'Net kasa', value: formatMoney(widgets.netCash), detail: 'Tahsilat eksi odeme', tone: Number(widgets.netCash || 0) >= 0 ? 'good' : 'danger' },
      { label: 'Kasa/banka TRY', value: formatMoney(widgets.cashBankTry), detail: 'Aktif hesap bakiyesi', tone: 'info' },
    ];
  }, [periodicReport]);

  const salesRows = report ? [{
    metric: 'Gunluk satis',
    count: formatNumber(report.dailySales.salesCount),
    amount: formatMoney(report.dailySales.salesAmountTry),
    extra: formatMoney(report.dailySales.grossProfitTry),
  }, {
    metric: 'Iptal satis',
    count: formatNumber(report.dailySales.cancelledSalesCount),
    amount: formatMoney(report.dailySales.cancelledSalesAmountTry),
    extra: '-',
  }] : [];

  const purchaseRows = report ? [{
    metric: 'Gunluk alis',
    count: formatNumber(report.dailyPurchases.purchaseCount),
    amount: formatMoney(report.dailyPurchases.purchaseAmountTry),
    extra: '-',
  }, {
    metric: 'Iptal alis',
    count: formatNumber(report.dailyPurchases.cancelledPurchaseCount),
    amount: formatMoney(report.dailyPurchases.cancelledPurchaseAmountTry),
    extra: '-',
  }] : [];

  const currencyRows = [
    ...((periodicReport?.salesByCurrency || []).map((row) => ({
      id: `sales-${row.currency}`,
      type: 'Satis',
      currency: row.currency,
      count: formatNumber(row.count),
      amount: formatMoney(row.amount, row.currency),
      amountTry: formatMoney(row.amountTry),
    }))),
    ...((periodicReport?.purchasesByCurrency || []).map((row) => ({
      id: `purchase-${row.currency}`,
      type: 'Alis',
      currency: row.currency,
      count: formatNumber(row.count),
      amount: formatMoney(row.amount, row.currency),
      amountTry: formatMoney(row.amountTry),
    }))),
    ...((periodicReport?.financeByCurrency || []).map((row) => ({
      id: `finance-${row.currency}`,
      type: 'Finans net',
      currency: row.currency,
      count: formatNumber(row.count),
      amount: formatMoney(row.amount, row.currency),
      amountTry: formatMoney(row.amountTry),
    }))),
  ];

  const cashRows = (periodicReport?.dailyCash || []).map((row, index) => ({
    id: `cash-${row.date}-${row.currency}-${index}`,
    date: formatDate(row.date),
    currency: row.currency,
    collections: formatMoney(row.collections, row.currency),
    payments: formatMoney(row.payments, row.currency),
    net: formatMoney(row.net, row.currency),
  }));

  const balanceRows = [
    ...((periodicReport?.customerBalances || []).map((row) => ({
      id: `customer-${row.currency}`,
      type: 'Musteri',
      currency: row.currency,
      count: formatNumber(row.partyCount),
      debit: formatMoney(row.debit, row.currency),
      credit: formatMoney(row.credit, row.currency),
      balance: formatMoney(row.balance, row.currency),
    }))),
    ...((periodicReport?.supplierBalances || []).map((row) => ({
      id: `supplier-${row.currency}`,
      type: 'Tedarikci',
      currency: row.currency,
      count: formatNumber(row.partyCount),
      debit: formatMoney(row.debit, row.currency),
      credit: formatMoney(row.credit, row.currency),
      balance: formatMoney(row.balance, row.currency),
    }))),
  ];

  const topProductRows = (report?.topProducts || []).map((row) => ({
    id: row.productId,
    product: `${row.stockCode} / ${row.productName}`,
    quantity: formatNumber(row.quantity),
    revenue: formatMoney(row.revenueTry),
    profit: formatMoney(row.grossProfitTry),
  }));

  const customerRows = (report?.customerAnalysis || []).map((row) => ({
    id: row.customerId,
    customer: `${row.customerCode} / ${row.customerName}`,
    sales: formatMoney(row.totalSalesTry),
    balance: formatMoney(row.balanceTry),
    lastSale: formatDate(row.lastSaleDate),
  }));

  const supplierRows = (report?.supplierAnalysis || []).map((row) => ({
    id: row.supplierId,
    supplier: `${row.supplierCode} / ${row.supplierName}`,
    purchases: formatMoney(row.totalPurchasesTry),
    balance: formatMoney(row.balanceTry),
    lastPurchase: formatDate(row.lastPurchaseDate),
  }));

  const warningRows = (report?.criticalWarnings || []).map((row, index) => ({
    id: `${row.type}-${index}`,
    type: row.type,
    subject: row.subject,
    value: formatNumber(row.value),
    severity: row.severity,
  }));

  const reportExportRows = [
    ...kpis.map((row) => ({
      section: 'Anlik KPI',
      metric: row.label,
      value: row.value,
      detail: row.detail,
    })),
    ...periodicKpis.map((row) => ({
      section: 'Donem KPI',
      metric: row.label,
      value: row.value,
      detail: row.detail,
    })),
    ...currencyRows.map((row) => ({
      section: 'Para Birimi Ozeti',
      metric: `${row.type} ${row.currency}`,
      value: row.amountTry,
      detail: `${row.count} adet / ${row.amount}`,
    })),
    ...balanceRows.map((row) => ({
      section: 'Cari Bakiye',
      metric: `${row.type} ${row.currency}`,
      value: row.balance,
      detail: `${row.count} cari / borc ${row.debit} / alacak ${row.credit}`,
    })),
    ...topProductRows.map((row) => ({
      section: 'En Cok Satan Urun',
      metric: row.product,
      value: row.revenue,
      detail: `${row.quantity} adet / kar ${row.profit}`,
    })),
    ...customerRows.map((row) => ({
      section: 'Musteri Analizi',
      metric: row.customer,
      value: row.sales,
      detail: `Bakiye ${row.balance} / son satis ${row.lastSale}`,
    })),
    ...supplierRows.map((row) => ({
      section: 'Tedarikci Analizi',
      metric: row.supplier,
      value: row.purchases,
      detail: `Bakiye ${row.balance} / son alis ${row.lastPurchase}`,
    })),
    ...warningRows.map((row) => ({
      section: 'Kritik Uyari',
      metric: row.subject,
      value: row.value,
      detail: `${row.type} / ${row.severity}`,
    })),
  ];

  const reportExportColumns = [
    { label: 'Bolum', key: 'section' },
    { label: 'Metrik', key: 'metric' },
    { label: 'Deger', key: 'value' },
    { label: 'Detay', key: 'detail' },
  ];

  function exportManagementReport() {
    exportRowsToExcel({
      filename: `yonetim-raporu-${periodFilters.dateFrom}-${periodFilters.dateTo}`,
      title: 'Yonetim Raporu',
      rows: reportExportRows,
      columns: reportExportColumns,
    });
  }

  function printManagementReport() {
    printRowsReport({
      title: 'Melisa ERP - Yonetim Raporu',
      subtitle: `${periodFilters.dateFrom} - ${periodFilters.dateTo} / ${reportExportRows.length} satir`,
      rows: reportExportRows,
      columns: reportExportColumns,
    });
  }

  return (
    <main className="work-area dashboard-screen management-reports-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Yonetim Raporlari</strong>
          <span>Gunluk satis, alis, stok, cari, tedarikci ve donemsel muhasebe gorunumu</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportManagementReport}>Excel</button>
          <button type="button" onClick={printManagementReport}>Yazdir</button>
          <button type="button" onClick={() => loadReport(periodFilters)}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yonetim raporlari API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="erp-panel periodic-report-panel">
        <div className="panel-title">
          <strong>Donemsel Muhasebe Raporlari</strong>
          <span>Satis, alis, kasa ve cari borc/alacak ozetleri</span>
        </div>
        <form className="filter-grid" onSubmit={applyPeriodFilters}>
          <label>
            Baslangic
            <input type="date" value={periodFilters.dateFrom} onChange={(event) => updatePeriodFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitis
            <input type="date" value={periodFilters.dateTo} onChange={(event) => updatePeriodFilter('dateTo', event.target.value)} />
          </label>
          <button className="primary" type="submit">Donemi Getir</button>
        </form>
      </section>

      <section className="dashboard-kpi-grid">
        {periodicKpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="dashboard-main-grid">
        <TablePanel
          columns={[
            { key: 'type', label: 'Rapor' },
            { key: 'currency', label: 'PB' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Orijinal Tutar', align: 'right' },
            { key: 'amountTry', label: 'TRY Karsiligi', align: 'right' },
          ]}
          rows={currencyRows}
          subtitle="Satis, alis ve finans neti para birimi bazinda"
          title="Para Birimi Bazli Donem Ozeti"
        />
        <TablePanel
          columns={[
            { key: 'date', label: 'Tarih' },
            { key: 'currency', label: 'PB' },
            { key: 'collections', label: 'Tahsilat', align: 'right' },
            { key: 'payments', label: 'Odeme', align: 'right' },
            { key: 'net', label: 'Net', align: 'right' },
          ]}
          rows={cashRows}
          subtitle="Gunluk kasa/banka giris cikis ozeti"
          title="Gunluk Kasa Raporu"
        />
        <TablePanel
          columns={[
            { key: 'type', label: 'Cari Turu' },
            { key: 'currency', label: 'PB' },
            { key: 'count', label: 'Cari Sayisi', align: 'right' },
            { key: 'debit', label: 'Borc', align: 'right' },
            { key: 'credit', label: 'Alacak', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
          ]}
          rows={balanceRows}
          subtitle="Musteri ve tedarikci kartlarinin anlik bakiyesi"
          title="Cari Borc / Alacak Raporu"
        />
      </section>

      <section className="dashboard-main-grid">
        <TablePanel
          columns={[
            { key: 'metric', label: 'Metrik' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Tutar', align: 'right' },
            { key: 'extra', label: 'Brut kar', align: 'right' },
          ]}
          rows={salesRows}
          subtitle="Kesinlesen ve iptal edilen satislar ayrilir"
          title="Gunluk Satis Ozeti"
        />
        <TablePanel
          columns={[
            { key: 'metric', label: 'Metrik' },
            { key: 'count', label: 'Adet', align: 'right' },
            { key: 'amount', label: 'Tutar', align: 'right' },
            { key: 'extra', label: 'Ek' },
          ]}
          rows={purchaseRows}
          subtitle="Kesinlesen ve iptal edilen alislar ayrilir"
          title="Gunluk Alis Ozeti"
        />
        <TablePanel
          columns={[
            { key: 'product', label: 'Urun' },
            { key: 'quantity', label: 'Miktar', align: 'right' },
            { key: 'revenue', label: 'Ciro', align: 'right' },
            { key: 'profit', label: 'Kar', align: 'right' },
          ]}
          rows={topProductRows}
          subtitle="Kesinlesen satis satirlari"
          title="En Cok Satan Urunler"
        />
        <TablePanel
          columns={[
            { key: 'customer', label: 'Cari' },
            { key: 'sales', label: 'Toplam satis', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
            { key: 'lastSale', label: 'Son satis' },
          ]}
          rows={customerRows}
          subtitle="Kesinlesen satis ve kart bakiyesi"
          title="Musteri Analizi"
        />
        <TablePanel
          columns={[
            { key: 'supplier', label: 'Tedarikci' },
            { key: 'purchases', label: 'Toplam alis', align: 'right' },
            { key: 'balance', label: 'Bakiye', align: 'right' },
            { key: 'lastPurchase', label: 'Son alis' },
          ]}
          rows={supplierRows}
          subtitle="Kesinlesen alis ve tedarikci bakiyesi"
          title="Tedarikci Analizi"
        />
        <TablePanel
          columns={[
            { key: 'type', label: 'Tip' },
            { key: 'subject', label: 'Konu' },
            { key: 'value', label: 'Deger', align: 'right' },
            { key: 'severity', label: 'Seviye' },
          ]}
          rows={warningRows}
          subtitle="Eksi stok ve yuksek bakiye uyarilari"
          title="Kritik Uyarilar"
        />
      </section>

      <section className="screen-summary dashboard-summary">
        <span>Kaynak: Yonetim raporu / canli SQL</span>
        <span>Uretim zamani: {formatDate(report?.generatedAt)}</span>
        <span>Yetki: dashboard.view</span>
      </section>
    </main>
  );
}
