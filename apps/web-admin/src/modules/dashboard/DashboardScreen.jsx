import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardAlertsPanel } from './DashboardAlertsPanel.jsx';
import { DashboardKpiGrid } from './DashboardKpiGrid.jsx';
import { DashboardRecentTransactions } from './DashboardRecentTransactions.jsx';
import { DashboardReceivablesPanel } from './DashboardReceivablesPanel.jsx';
import { DashboardSupplierPerformance } from './DashboardSupplierPerformance.jsx';
import { DashboardToolbar } from './DashboardToolbar.jsx';
import { DashboardTopProducts } from './DashboardTopProducts.jsx';
import { fetchDashboardAlerts, fetchDashboardSummary } from '../../services/dashboardApi.js';

const periodLabels = {
  today: 'Bugun',
  week: 'Bu hafta',
  month: 'Bu ay',
};

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

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return String(value).slice(0, 10);
}

function buildPatronKpis(summary) {
  const patron = summary?.patron || {};
  const operations = summary?.operations || {};

  return [
    {
      label: 'Gunluk satis',
      value: formatMoney(patron.todaySalesTry),
      detail: `${formatNumber(patron.finalizedSalesToday)} kesinlesen fis`,
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Gunluk brut kar',
      value: formatMoney(patron.todayGrossProfitTry),
      detail: 'Finalized satis satir gross profit',
      tone: Number(patron.todayGrossProfitTry || 0) >= 0 ? 'good' : 'danger',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Toplam stok degeri',
      value: formatMoney(patron.totalStockValueTry),
      detail: 'Stok x average cost TRY',
      tone: 'info',
      screenId: 'stock-list',
    },
    {
      label: 'Musteri borclari',
      value: formatMoney(patron.customerReceivablesTry),
      detail: 'Pozitif cari bakiyeler',
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Tedarikci borclari',
      value: formatMoney(patron.supplierPayablesTry),
      detail: 'Pozitif tedarikci bakiyeleri',
      tone: 'warn',
      screenId: 'purchase-invoice-list',
    },
    {
      label: 'Eksi stok uyarisi',
      value: formatNumber(patron.negativeStockCount),
      detail: 'Stok sifirin altinda',
      tone: Number(patron.negativeStockCount || 0) > 0 ? 'danger' : 'good',
      screenId: 'stock-list',
    },
    {
      label: 'Bugunku alis',
      value: formatNumber(patron.finalizedPurchasesToday),
      detail: `${formatMoney(operations.todayPurchasesTry)} kesinlesen`,
      tone: 'info',
      screenId: 'purchase-invoice-list',
    },
    {
      label: 'Terminal sync uyarisi',
      value: formatNumber(operations.syncWarningCount),
      detail: 'Pending/failed queue',
      tone: Number(operations.syncWarningCount || 0) > 0 ? 'danger' : 'good',
      screenId: 'catalog-list',
    },
  ];
}

function buildAccountingKpis(summary) {
  const accounting = summary?.accounting || {};
  const patron = summary?.patron || {};
  const operations = summary?.operations || {};

  return [
    {
      label: 'Gunluk tahsilat',
      value: formatMoney(accounting.todayCollectionsTry),
      detail: 'Tahsilat modulu bekliyor',
      tone: 'info',
      screenId: 'customer-list',
    },
    {
      label: 'Gunluk odeme',
      value: formatMoney(accounting.todayPaymentsTry),
      detail: 'Odeme modulu bekliyor',
      tone: 'info',
      screenId: 'purchase-invoice-list',
    },
    {
      label: 'Borclu cari sayisi',
      value: formatNumber(accounting.customerBalanceCount),
      detail: `${formatMoney(patron.customerReceivablesTry)} toplam`,
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Tedarikci bakiye',
      value: formatNumber(accounting.supplierBalanceCount),
      detail: `${formatMoney(patron.supplierPayablesTry)} toplam`,
      tone: 'warn',
      screenId: 'purchase-invoice-list',
    },
    {
      label: 'Son satis fisleri',
      value: formatNumber(accounting.recentSalesInvoices?.length),
      detail: `${formatNumber(operations.salesDraftCount)} draft acik`,
      tone: 'info',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Son alis fisleri',
      value: formatNumber(accounting.recentPurchaseInvoices?.length),
      detail: `${formatNumber(operations.purchaseDraftCount)} draft acik`,
      tone: 'info',
      screenId: 'purchase-invoice-list',
    },
    {
      label: 'Bugunku toplam satis',
      value: formatMoney(patron.todaySalesTry),
      detail: 'Kesinlesen satis',
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Brut kar snapshot',
      value: formatMoney(patron.todayGrossProfitTry),
      detail: 'Sales item gross_profit_try',
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
  ];
}

function mapRecentTransactions(summary) {
  const sales = summary?.accounting?.recentSalesInvoices || [];
  const purchases = summary?.accounting?.recentPurchaseInvoices || [];
  return [
    ...sales.map((row) => ({
      time: formatDateTime(row.createdAt),
      document: row.invoiceNo,
      account: row.customerName,
      type: 'Satis',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
    ...purchases.map((row) => ({
      time: formatDateTime(row.createdAt),
      document: row.invoiceNo,
      account: row.supplierName,
      type: 'Alis',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
  ].sort((first, second) => String(second.time).localeCompare(String(first.time))).slice(0, 10);
}

function mapTopProducts(summary) {
  return (summary?.topProducts || []).map((row) => ({
    code: row.stockCode,
    name: row.productName,
    quantity: row.quantity,
    sales: formatMoney(row.salesTry),
    stock: row.stockQuantity,
  }));
}

function mapReceivables(summary) {
  return (summary?.receivables || []).map((row) => ({
    customer: row.customerName,
    balance: formatMoney(row.balanceTry),
    lastMove: formatDate(row.lastMove),
    risk: row.risk,
  }));
}

function mapSupplierPerformance(summary) {
  return (summary?.supplierPerformance || []).map((row) => ({
    supplier: row.supplierName,
    openPurchases: row.openPurchases,
    delivery: `${row.finalizedPurchases} kesin`,
    defect: '-',
    debt: formatMoney(row.debtTry),
  }));
}

function mapAlerts(alerts) {
  return (alerts || []).map((alert) => ({
    ...alert,
    value: typeof alert.value === 'number' ? formatNumber(alert.value) : alert.value,
  }));
}

export function DashboardScreen({ onOpenScreen }) {
  const [activeView, setActiveView] = useState('patron');
  const [period, setPeriod] = useState('today');
  const [refreshCount, setRefreshCount] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [alertsData, setAlertsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const kpis = useMemo(
    () => (activeView === 'patron' ? buildPatronKpis(summaryData) : buildAccountingKpis(summaryData)),
    [activeView, summaryData],
  );
  const visibleTitle = activeView === 'patron' ? 'Patron gorunumu' : 'Muhasebe gorunumu';
  const recentTransactions = useMemo(() => mapRecentTransactions(summaryData), [summaryData]);
  const topProducts = useMemo(() => mapTopProducts(summaryData), [summaryData]);
  const receivables = useMemo(() => mapReceivables(summaryData), [summaryData]);
  const supplierPerformance = useMemo(() => mapSupplierPerformance(summaryData), [summaryData]);
  const criticalAlerts = useMemo(() => mapAlerts(alertsData), [alertsData]);
  const summary = useMemo(
    () => `${visibleTitle} / ${periodLabels[period]} / SQL yenileme ${refreshCount}`,
    [period, refreshCount, visibleTitle],
  );
  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [summaryResponse, alertsResponse] = await Promise.all([
        fetchDashboardSummary(),
        fetchDashboardAlerts(),
      ]);
      setSummaryData(summaryResponse.data);
      setAlertsData(alertsResponse.data);
      setRefreshCount((count) => count + 1);
    } catch (error) {
      setErrorMessage(`${error.message || 'Dashboard KPI okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const timerId = window.setInterval(loadDashboard, 30000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [loadDashboard]);

  return (
    <main className="work-area dashboard-screen">
      <DashboardToolbar
        activeView={activeView}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={loadDashboard}
        onViewChange={setActiveView}
      />
      {isLoading && <div className="list-state">Dashboard KPI verileri API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      <DashboardKpiGrid kpis={kpis} onOpenScreen={onOpenScreen} />
      <section className="dashboard-main-grid">
        <DashboardAlertsPanel alerts={criticalAlerts} />
        <DashboardRecentTransactions rows={recentTransactions} />
        <DashboardTopProducts rows={topProducts} />
        <DashboardSupplierPerformance rows={supplierPerformance} />
        <DashboardReceivablesPanel rows={receivables} />
      </section>
      <section className="screen-summary dashboard-summary">
        <span>{summary}</span>
        <span>Kaynak: MELISA_ERP_V2 SELECT aggregate</span>
        <span>30 sn auto-refresh aktif</span>
      </section>
    </main>
  );
}
