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
      setErrorMessage(`${error.message || 'Yönetim raporu okunamadı.'} (${error.code || 'API_ERROR'})`);
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
      { label: 'Bugün satış', value: formatMoney(widgets.todaySalesTry), detail: `${formatNumber(sales.salesCount)} fiş`, tone: 'good' },
      { label: 'Bugün alış', value: formatMoney(widgets.todayPurchasesTry), detail: `${formatNumber(purchases.purchaseCount)} fiş`, tone: 'info' },
      { label: 'Stok degeri', value: formatMoney(widgets.totalStockValueTry), detail: 'Kart stogu x ortalama maliyet', tone: 'info' },
      { label: 'Müşteri bakiye', value: formatMoney(widgets.customerBalanceTry), detail: 'Cari kart toplam bakiye', tone: 'warn' },
      { label: 'Tedarikçi bakiye', value: formatMoney(widgets.supplierBalanceTry), detail: 'Tedarikçi kart toplam bakiye', tone: 'warn' },
      { label: 'Kritik uyarı', value: formatNumber((report?.criticalWarnings || []).length), detail: `${formatNumber(widgets.negativeStockCount)} eksi stok`, tone: Number(widgets.negativeStockCount || 0) > 0 ? 'danger' : 'good' },
    ];
  }, [report]);

  const salesRows = report ? [{
    metric: 'Günlük satış',
    count: formatNumber(report.dailySales.salesCount),
    amount: formatMoney(report.dailySales.salesAmountTry),
    extra: formatMoney(report.dailySales.grossProfitTry),
  }, {
    metric: 'İptal satış',
    count: formatNumber(report.dailySales.cancelledSalesCount),
    amount: formatMoney(report.dailySales.cancelledSalesAmountTry),
    extra: '-',
  }] : [];

  const purchaseRows = report ? [{
    metric: 'Günlük alış',
    count: formatNumber(report.dailyPurchases.purchaseCount),
    amount: formatMoney(report.dailyPurchases.purchaseAmountTry),
    extra: '-',
  }, {
    metric: 'İptal alış',
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
          <strong>Yönetim Raporları</strong>
          <span>Günlük satış, alış, stok, cari ve tedarikçi görünümü</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={loadReport}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Yönetim raporları API'den okunuyor...</div>}
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
          subtitle="Kesinleşen ve iptal edilen satışlar ayrı hesaplanır"
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
          subtitle="Kesinleşen ve iptal edilen alışlar ayrı hesaplanır"
          title="Günlük Alış Özeti"
        />
        <TablePanel
          columns={[
            { key: 'product', label: 'Ürün' },
            { key: 'quantity', label: 'Miktar', align: 'right' },
            { key: 'revenue', label: 'Ciro', align: 'right' },
            { key: 'profit', label: 'Kar', align: 'right' },
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
          title="Musteri Analizi"
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
            { key: 'value', label: 'Deger', align: 'right' },
            { key: 'severity', label: 'Seviye' },
          ]}
          rows={warningRows}
          subtitle="Eksi stok ve yüksek bakiye uyarıları"
          title="Kritik Uyarılar"
        />
      </section>

      <section className="screen-summary dashboard-summary">
        <span>Kaynak: Yönetim raporu / canli SQL</span>
        <span>Üretim zamanı: {formatDate(report?.generatedAt)}</span>
        <span>Yetki: dashboard.view</span>
      </section>
    </main>
  );
}
