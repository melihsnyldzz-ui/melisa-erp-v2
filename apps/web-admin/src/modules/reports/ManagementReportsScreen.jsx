import React, { useEffect, useMemo, useState } from 'react';
import { fetchManagementReporting } from '../../services/dashboardApi.js';

function formatMoney(amount) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return String(value).slice(0, 10);
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadReport() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchManagementReporting();
      setReport(response.data);
    } catch (error) {
      setErrorMessage(`${error.message || 'Yonetim raporu okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

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

  return (
    <main className="work-area dashboard-screen management-reports-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Yonetim Raporlari</strong>
          <span>Gunluk satis / alis / stok / cari / tedarikci</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={loadReport}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yonetim raporlari API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} {...kpi} />
        ))}
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
          subtitle="Finalized ve cancelled satislar ayri hesaplanir"
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
          subtitle="Finalized ve cancelled alislar ayri hesaplanir"
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
          subtitle="Finalized satis satirlari"
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
          subtitle="Finalized satis ve kart bakiyesi"
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
          subtitle="Finalized alis ve tedarikci bakiyesi"
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
        <span>Kaynak: MELISA_ERP_V2 SELECT aggregate</span>
        <span>Generated: {formatDate(report?.generatedAt)}</span>
        <span>Yetki: dashboard.view</span>
      </section>
    </main>
  );
}
