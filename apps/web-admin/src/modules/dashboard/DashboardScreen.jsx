import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardAlertsPanel } from './DashboardAlertsPanel.jsx';
import { DashboardKpiGrid } from './DashboardKpiGrid.jsx';
import { DashboardOperationsPanel } from './DashboardOperationsPanel.jsx';
import { DashboardRecentTransactions } from './DashboardRecentTransactions.jsx';
import { DashboardReceivablesPanel } from './DashboardReceivablesPanel.jsx';
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
  const melisa = summary?.melisa || {};

  return [
    {
      label: 'Gunluk satis',
      value: formatMoney(patron.todaySalesTry),
      detail: `${formatNumber(patron.finalizedSalesToday)} kesinlesen fis`,
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Gunluk kar',
      value: formatMoney(patron.todayGrossProfitTry),
      detail: `${formatNumber(melisa.todayProfitRate || 0)}% brut oran`,
      tone: Number(patron.todayGrossProfitTry || 0) >= 0 ? 'good' : 'danger',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Acik hesap toplam',
      value: formatMoney(patron.customerReceivablesTry),
      detail: `${formatNumber(melisa.openAccountCustomerCount || 0)} musteri`,
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Romanya acik hesap',
      value: formatMoney(melisa.romaniaReceivablesTry),
      detail: `${formatNumber(melisa.romaniaSalesShare || 0)}% satis payi`,
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Eksi stok uyarisi',
      value: formatNumber(patron.negativeStockCount),
      detail: 'Stok sifirin altinda',
      tone: Number(patron.negativeStockCount || 0) > 0 ? 'danger' : 'good',
      screenId: 'stock-list',
    },
    {
      label: 'WhatsApp donusleri',
      value: formatNumber(operations.whatsappRepliesToday),
      detail: `${formatNumber(operations.whatsappOrdersToday)} siparis adayi`,
      tone: 'info',
      screenId: 'catalog-list',
    },
    {
      label: 'Ilk 20 alacak',
      value: formatMoney(melisa.top20ReceivablesTry),
      detail: `${formatNumber(melisa.top20ReceivableShare || 0)}% yogunluk`,
      tone: 'danger',
      screenId: 'customer-list',
    },
    {
      label: 'Stokta fazla',
      value: formatNumber(melisa.overstockProductCount),
      detail: 'Paylasim/kampanya adayi',
      tone: 'info',
      screenId: 'stock-list',
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
  return (summary?.countryPerformance || []).map((row) => ({
    id: row.country,
    country: row.country,
    sales: formatMoney(row.salesTry),
    receivable: formatMoney(row.receivableTry),
    customers: row.activeCustomers,
    note: row.note,
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
  const countryPerformance = useMemo(() => mapSupplierPerformance(summaryData), [summaryData]);
  const criticalAlerts = useMemo(() => mapAlerts(alertsData), [alertsData]);
  const melisaRows = summaryData?.melisaPanels || {};
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
        <DashboardOperationsPanel
          columns={[
            { key: 'country', label: 'Ulke' },
            { key: 'sales', label: 'Satis', align: 'right' },
            { key: 'receivable', label: 'Alacak', align: 'right' },
            { key: 'customers', label: 'M.' },
            { key: 'note', label: 'Not' },
          ]}
          rows={countryPerformance}
          subtitle="Romanya %50 / Balkan agirlik"
          title="Ulke Bazli Satis / Alacak"
        />
        <DashboardOperationsPanel
          columns={[
            { key: 'group', label: 'Grup' },
            { key: 'plan', label: 'Plan' },
            { key: 'reply', label: 'Donus' },
            { key: 'owner', label: 'Takip' },
          ]}
          rows={melisaRows.whatsapp || []}
          subtitle="Foto paylasim / cevap / siparis adayi"
          title="WhatsApp Grup Takibi"
        />
        <DashboardRecentTransactions rows={recentTransactions} />
        <DashboardTopProducts rows={topProducts} />
        <DashboardReceivablesPanel rows={receivables} />
        <DashboardOperationsPanel
          columns={[
            { key: 'customer', label: 'Musteri' },
            { key: 'country', label: 'Ulke' },
            { key: 'amount', label: 'Bekleyen', align: 'right' },
            { key: 'action', label: 'Aksiyon' },
          ]}
          rows={melisaRows.collections || []}
          subtitle="Acil tahsilat / acik hesap"
          title="Tahsilat Bekleyenler"
        />
        <DashboardOperationsPanel
          columns={[
            { key: 'product', label: 'Urun' },
            { key: 'type', label: 'Tip' },
            { key: 'stock', label: 'Stok' },
            { key: 'country', label: 'Ulke' },
          ]}
          rows={melisaRows.productFocus || []}
          subtitle="Yeni gelen / cok satan / stokta fazla"
          title="Urun Odak Listesi"
        />
        <DashboardOperationsPanel
          columns={[
            { key: 'customer', label: 'Musteri' },
            { key: 'share', label: 'Pay' },
            { key: 'risk', label: 'Risk' },
            { key: 'note', label: 'Not' },
          ]}
          rows={melisaRows.topReceivableFocus || []}
          subtitle="Ilk 20 musteri yogunlugu"
          title="Alacak Yogunlugu"
        />
        <DashboardOperationsPanel
          columns={[
            { key: 'country', label: 'Ulke' },
            { key: 'category', label: 'Kategori' },
            { key: 'reason', label: 'Firsat' },
          ]}
          rows={melisaRows.countryOpportunities || []}
          subtitle="Bugun one cikarilacak pazarlar"
          title="Ulke Bazli Firsatlar"
        />
      </section>
      <section className="screen-summary dashboard-summary">
        <span>{summary}</span>
        <span>Kaynak: MELISA_ERP_V2 SELECT aggregate</span>
        <span>30 sn auto-refresh aktif</span>
      </section>
    </main>
  );
}
