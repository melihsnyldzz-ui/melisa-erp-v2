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
  today: 'Bugün',
  week: 'Bu hafta',
  month: 'Bu ay',
};

const emptyDashboardSummary = {
  patron: {},
  accounting: {
    recentSalesInvoices: [],
    recentPurchaseInvoices: [],
  },
  operations: {},
  melisa: {},
  masterCounts: {},
  topProducts: [],
  receivables: [],
  countryPerformance: [],
  melisaPanels: {},
};

const dashboardLayoutStorageKey = 'melisa.dashboard.layout.v1';

const dashboardWidgetDefaults = [
  { key: 'alerts', label: 'Kritik uyarılar', size: 'medium', visible: true },
  { key: 'country', label: 'Ülke bazlı satış / alacak', size: 'medium', visible: true },
  { key: 'whatsapp', label: 'WhatsApp grup takibi', size: 'small', visible: true },
  { key: 'recent', label: 'Son satışlar / alışlar', size: 'wide', visible: true },
  { key: 'topProducts', label: 'En çok satan ürünler', size: 'wide', visible: true },
  { key: 'receivables', label: 'Cari borç / ekstre özeti', size: 'medium', visible: true },
  { key: 'collections', label: 'Tahsilat bekleyenler', size: 'medium', visible: true },
  { key: 'productFocus', label: 'Ürün odak listesi', size: 'small', visible: true },
  { key: 'topReceivableFocus', label: 'Alacak yoğunluğu', size: 'small', visible: false },
  { key: 'countryOpportunities', label: 'Ülke bazlı fırsatlar', size: 'small', visible: false },
];

const dashboardSizeOptions = [
  { value: 'small', label: 'Küçük' },
  { value: 'medium', label: 'Orta' },
  { value: 'wide', label: 'Geniş' },
  { value: 'full', label: 'Tam satır' },
];

function buildDefaultDashboardLayout() {
  return dashboardWidgetDefaults.map((widget) => ({ ...widget }));
}

function normalizeDashboardLayout(savedLayout) {
  const defaults = buildDefaultDashboardLayout();
  if (!Array.isArray(savedLayout)) {
    return defaults;
  }

  const defaultMap = new Map(defaults.map((widget) => [widget.key, widget]));
  const normalized = savedLayout
    .filter((widget) => widget && defaultMap.has(widget.key))
    .map((widget) => ({
      ...defaultMap.get(widget.key),
      visible: typeof widget.visible === 'boolean' ? widget.visible : defaultMap.get(widget.key).visible,
      size: dashboardSizeOptions.some((option) => option.value === widget.size)
        ? widget.size
        : defaultMap.get(widget.key).size,
    }));

  defaults.forEach((widget) => {
    if (!normalized.some((savedWidget) => savedWidget.key === widget.key)) {
      normalized.push(widget);
    }
  });

  return normalized;
}

function loadDashboardLayout() {
  try {
    return normalizeDashboardLayout(JSON.parse(window.localStorage.getItem(dashboardLayoutStorageKey) || 'null'));
  } catch (_error) {
    return buildDefaultDashboardLayout();
  }
}

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
  if (!value) return '-';

  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function buildPatronKpis(summary = emptyDashboardSummary) {
  const patron = summary.patron || {};
  const operations = summary.operations || {};
  const melisa = summary.melisa || {};
  const masterCounts = summary.masterCounts || {};

  return [
    {
      label: 'Toplam müşteri',
      value: formatNumber(masterCounts.totalCustomers),
      detail: 'Cari kart sayısı',
      tone: 'info',
      screenId: 'customer-list',
    },
    {
      label: 'Toplam ürün',
      value: formatNumber(masterCounts.totalProducts),
      detail: 'Aktif barkodlu ürünler',
      tone: 'info',
      screenId: 'stock-list',
    },
    {
      label: 'Günlük satış',
      value: formatMoney(patron.todaySalesTry),
      detail: `${formatNumber(patron.finalizedSalesToday)} kesinleşen fiş`,
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Günlük kâr',
      value: formatMoney(patron.todayGrossProfitTry),
      detail: `${formatNumber(melisa.todayProfitRate || 0)}% brüt oran`,
      tone: Number(patron.todayGrossProfitTry || 0) >= 0 ? 'good' : 'danger',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Açık hesap toplam',
      value: formatMoney(patron.customerReceivablesTry),
      detail: `${formatNumber(melisa.openAccountCustomerCount || 0)} müşteri`,
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Romanya açık hesap',
      value: formatMoney(melisa.romaniaReceivablesTry),
      detail: `${formatNumber(melisa.romaniaSalesShare || 0)}% satış payı`,
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Eksi stok uyarısı',
      value: formatNumber(patron.negativeStockCount),
      detail: 'Stok sıfırın altında',
      tone: Number(patron.negativeStockCount || 0) > 0 ? 'danger' : 'good',
      screenId: 'stock-list',
    },
    {
      label: 'WhatsApp dönüşleri',
      value: formatNumber(operations.whatsappRepliesToday),
      detail: `${formatNumber(operations.whatsappOrdersToday)} sipariş adayı`,
      tone: 'info',
      screenId: 'catalog-list',
    },
    {
      label: 'İlk 20 alacak',
      value: formatMoney(melisa.top20ReceivablesTry),
      detail: `${formatNumber(melisa.top20ReceivableShare || 0)}% yoğunluk`,
      tone: 'danger',
      screenId: 'customer-list',
    },
    {
      label: 'Stokta fazla',
      value: formatNumber(melisa.overstockProductCount),
      detail: 'Paylaşım/kampanya adayı',
      tone: 'info',
      screenId: 'stock-list',
    },
  ];
}

function buildAccountingKpis(summary = emptyDashboardSummary) {
  const accounting = summary.accounting || {};
  const patron = summary.patron || {};
  const operations = summary.operations || {};
  const masterCounts = summary.masterCounts || {};

  return [
    {
      label: 'Toplam müşteri',
      value: formatNumber(masterCounts.totalCustomers),
      detail: 'Cari kart sayısı',
      tone: 'info',
      screenId: 'customer-list',
    },
    {
      label: 'Toplam ürün',
      value: formatNumber(masterCounts.totalProducts),
      detail: 'Aktif barkodlu ürünler',
      tone: 'info',
      screenId: 'stock-list',
    },
    {
      label: 'Günlük tahsilat',
      value: formatMoney(accounting.todayCollectionsTry),
      detail: 'Tahsilat modülü',
      tone: 'info',
      screenId: 'collections',
    },
    {
      label: 'Günlük ödeme',
      value: formatMoney(accounting.todayPaymentsTry),
      detail: 'Ödeme modülü',
      tone: 'info',
      screenId: 'payments',
    },
    {
      label: 'Borçlu cari sayısı',
      value: formatNumber(accounting.customerBalanceCount),
      detail: `${formatMoney(patron.customerReceivablesTry)} toplam`,
      tone: 'warn',
      screenId: 'customer-list',
    },
    {
      label: 'Tedarikçi bakiye',
      value: formatNumber(accounting.supplierBalanceCount),
      detail: `${formatMoney(patron.supplierPayablesTry)} toplam`,
      tone: 'warn',
      screenId: 'supplier-list',
    },
    {
      label: 'Son satış fişleri',
      value: formatNumber(accounting.recentSalesInvoices.length),
      detail: `${formatNumber(operations.salesDraftCount)} taslak açık`,
      tone: 'info',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Son alış fişleri',
      value: formatNumber(accounting.recentPurchaseInvoices.length),
      detail: `${formatNumber(operations.purchaseDraftCount)} taslak açık`,
      tone: 'info',
      screenId: 'purchase-invoice-list',
    },
    {
      label: 'Bugünkü toplam satış',
      value: formatMoney(patron.todaySalesTry),
      detail: 'Kesinleşen satış',
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
    {
      label: 'Brüt kâr snapshot',
      value: formatMoney(patron.todayGrossProfitTry),
      detail: 'Satış satırı maliyet izi',
      tone: 'good',
      screenId: 'sales-invoice-list',
    },
  ];
}

function mapRecentTransactions(summary = emptyDashboardSummary) {
  const sales = summary.accounting.recentSalesInvoices || [];
  const purchases = summary.accounting.recentPurchaseInvoices || [];
  return [
    ...sales.map((row) => ({
      time: formatDateTime(row.createdAt),
      document: row.invoiceNo,
      account: row.customerName,
      type: 'Satış',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
    ...purchases.map((row) => ({
      time: formatDateTime(row.createdAt),
      document: row.invoiceNo,
      account: row.supplierName,
      type: 'Alış',
      amount: formatMoney(row.totalAmountTry),
      status: row.status,
    })),
  ].sort((first, second) => String(second.time).localeCompare(String(first.time))).slice(0, 10);
}

function mapTopProducts(summary = emptyDashboardSummary) {
  return (summary.topProducts || []).map((row) => ({
    code: row.stockCode,
    name: row.productName,
    quantity: row.quantity,
    sales: formatMoney(row.salesTry),
    stock: row.stockQuantity,
  }));
}

function mapReceivables(summary = emptyDashboardSummary) {
  return (summary.receivables || []).map((row) => ({
    customer: row.customerName,
    balance: formatMoney(row.balanceTry),
    lastMove: formatDate(row.lastMove),
    risk: row.risk,
  }));
}

function mapSupplierPerformance(summary = emptyDashboardSummary) {
  return (summary.countryPerformance || []).map((row) => ({
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

function DashboardLayoutEditor({ layout, onMoveWidget, onReset, onUpdateWidget }) {
  const visibleCount = layout.filter((widget) => widget.visible).length;

  return (
    <section className="erp-panel dashboard-layout-editor">
      <div className="panel-title">
        <strong>Operasyon masası düzeni</strong>
        <span>{visibleCount} bölüm açık / seçimler bu bilgisayarda saklanır</span>
      </div>
      <div className="dashboard-layout-editor-grid">
        {layout.map((widget, index) => (
          <article className={widget.visible ? 'dashboard-layout-row' : 'dashboard-layout-row muted'} key={widget.key}>
            <label className="dashboard-layout-visible">
              <input
                checked={widget.visible}
                type="checkbox"
                onChange={(event) => onUpdateWidget(widget.key, { visible: event.target.checked })}
              />
              <span>{widget.label}</span>
            </label>
            <select
              aria-label={`${widget.label} boyutu`}
              value={widget.size}
              onChange={(event) => onUpdateWidget(widget.key, { size: event.target.value })}
            >
              {dashboardSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="dashboard-layout-order">
              <button type="button" disabled={index === 0} onClick={() => onMoveWidget(widget.key, -1)}>Yukarı</button>
              <button type="button" disabled={index === layout.length - 1} onClick={() => onMoveWidget(widget.key, 1)}>Aşağı</button>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-layout-footer">
        <span>Karışık gelen panelleri kapatabilir, önemli olanları genişletebilir ve sırayı değiştirebilirsin.</span>
        <button type="button" onClick={onReset}>Varsayılana Dön</button>
      </div>
    </section>
  );
}

export function DashboardScreen({ onOpenScreen }) {
  const [activeView, setActiveView] = useState('patron');
  const [dashboardLayout, setDashboardLayout] = useState(loadDashboardLayout);
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const [period, setPeriod] = useState('today');
  const [refreshCount, setRefreshCount] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [alertsData, setAlertsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const kpis = useMemo(
    () => (activeView === 'patron'
      ? buildPatronKpis(summaryData || emptyDashboardSummary)
      : buildAccountingKpis(summaryData || emptyDashboardSummary)),
    [activeView, summaryData],
  );
  const visibleTitle = activeView === 'patron' ? 'Yönetim görünümü' : 'Finans görünümü';
  const recentTransactions = useMemo(() => mapRecentTransactions(summaryData || emptyDashboardSummary), [summaryData]);
  const topProducts = useMemo(() => mapTopProducts(summaryData || emptyDashboardSummary), [summaryData]);
  const receivables = useMemo(() => mapReceivables(summaryData || emptyDashboardSummary), [summaryData]);
  const countryPerformance = useMemo(() => mapSupplierPerformance(summaryData || emptyDashboardSummary), [summaryData]);
  const criticalAlerts = useMemo(() => mapAlerts(alertsData), [alertsData]);
  const melisaRows = (summaryData || emptyDashboardSummary).melisaPanels || {};
  const summary = useMemo(
    () => `${visibleTitle} / ${periodLabels[period]} / SQL yenileme ${refreshCount}`,
    [period, refreshCount, visibleTitle],
  );
  const widgetMap = useMemo(() => ({
    alerts: {
      node: <DashboardAlertsPanel alerts={criticalAlerts} />,
    },
    country: {
      node: (
        <DashboardOperationsPanel
          columns={[
            { key: 'country', label: 'Ülke' },
            { key: 'sales', label: 'Satış', align: 'right' },
            { key: 'receivable', label: 'Alacak', align: 'right' },
            { key: 'customers', label: 'M.' },
            { key: 'note', label: 'Not' },
          ]}
          rows={countryPerformance}
          subtitle="Romanya %50 / Balkan ağırlık"
          title="Ülke Bazlı Satış / Alacak"
        />
      ),
    },
    whatsapp: {
      node: (
        <DashboardOperationsPanel
          columns={[
            { key: 'group', label: 'Grup' },
            { key: 'plan', label: 'Plan' },
            { key: 'reply', label: 'Dönüş' },
            { key: 'owner', label: 'Takip' },
          ]}
          rows={melisaRows.whatsapp || []}
          subtitle="Foto paylaşım / cevap / sipariş adayı"
          title="WhatsApp Grup Takibi"
        />
      ),
    },
    recent: {
      node: <DashboardRecentTransactions rows={recentTransactions} />,
    },
    topProducts: {
      node: <DashboardTopProducts rows={topProducts} />,
    },
    receivables: {
      node: <DashboardReceivablesPanel rows={receivables} />,
    },
    collections: {
      node: (
        <DashboardOperationsPanel
          columns={[
            { key: 'customer', label: 'Müşteri' },
            { key: 'country', label: 'Ülke' },
            { key: 'amount', label: 'Bekleyen', align: 'right' },
            { key: 'action', label: 'Aksiyon' },
          ]}
          rows={melisaRows.collections || []}
          subtitle="Acil tahsilat / açık hesap"
          title="Tahsilat Bekleyenler"
        />
      ),
    },
    productFocus: {
      node: (
        <DashboardOperationsPanel
          columns={[
            { key: 'product', label: 'Ürün' },
            { key: 'type', label: 'Tip' },
            { key: 'stock', label: 'Stok' },
            { key: 'country', label: 'Ülke' },
          ]}
          rows={melisaRows.productFocus || []}
          subtitle="Yeni gelen / çok satan / stokta fazla"
          title="Ürün Odak Listesi"
        />
      ),
    },
    topReceivableFocus: {
      node: (
        <DashboardOperationsPanel
          columns={[
            { key: 'customer', label: 'Müşteri' },
            { key: 'share', label: 'Pay' },
            { key: 'risk', label: 'Risk' },
            { key: 'note', label: 'Not' },
          ]}
          rows={melisaRows.topReceivableFocus || []}
          subtitle="İlk 20 müşteri yoğunluğu"
          title="Alacak Yoğunluğu"
        />
      ),
    },
    countryOpportunities: {
      node: (
        <DashboardOperationsPanel
          columns={[
            { key: 'country', label: 'Ülke' },
            { key: 'category', label: 'Kategori' },
            { key: 'reason', label: 'Fırsat' },
          ]}
          rows={melisaRows.countryOpportunities || []}
          subtitle="Bugün öne çıkarılacak pazarlar"
          title="Ülke Bazlı Fırsatlar"
        />
      ),
    },
  }), [countryPerformance, criticalAlerts, melisaRows, receivables, recentTransactions, topProducts]);
  const visibleDashboardWidgets = useMemo(
    () => dashboardLayout.filter((widget) => widget.visible && widgetMap[widget.key]),
    [dashboardLayout, widgetMap],
  );

  useEffect(() => {
    window.localStorage.setItem(dashboardLayoutStorageKey, JSON.stringify(dashboardLayout));
  }, [dashboardLayout]);

  const updateDashboardWidget = useCallback((key, patch) => {
    setDashboardLayout((currentLayout) => currentLayout.map((widget) => (
      widget.key === key ? { ...widget, ...patch } : widget
    )));
  }, []);

  const moveDashboardWidget = useCallback((key, direction) => {
    setDashboardLayout((currentLayout) => {
      const index = currentLayout.findIndex((widget) => widget.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentLayout.length) {
        return currentLayout;
      }

      const nextLayout = [...currentLayout];
      const [widget] = nextLayout.splice(index, 1);
      nextLayout.splice(nextIndex, 0, widget);
      return nextLayout;
    });
  }, []);

  const resetDashboardLayout = useCallback(() => {
    setDashboardLayout(buildDefaultDashboardLayout());
  }, []);

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
      setErrorMessage(`${error.message || 'Dashboard KPI okunamadı.'} (${error.code || 'API_ERROR'})`);
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
        isLayoutEditorOpen={isLayoutEditorOpen}
        onLayoutEditorToggle={() => setIsLayoutEditorOpen((isOpen) => !isOpen)}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={loadDashboard}
        onViewChange={setActiveView}
      />
      {isLoading && <div className="list-state">Dashboard KPI verileri API'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {isLayoutEditorOpen && (
        <DashboardLayoutEditor
          layout={dashboardLayout}
          onMoveWidget={moveDashboardWidget}
          onReset={resetDashboardLayout}
          onUpdateWidget={updateDashboardWidget}
        />
      )}
      <DashboardKpiGrid kpis={kpis} onOpenScreen={onOpenScreen} />
      <section className="dashboard-main-grid">
        {visibleDashboardWidgets.map((widget) => (
          <div className={`dashboard-widget dashboard-widget-${widget.key} dashboard-widget-size-${widget.size}`} key={widget.key}>
            {widgetMap[widget.key].node}
          </div>
        ))}
        {visibleDashboardWidgets.length === 0 && (
          <section className="erp-panel dashboard-empty-layout">
            <div className="panel-title">
              <strong>Operasyon masası boş</strong>
              <span>Masayı Düzenle ile en az bir bölümü açabilirsin.</span>
            </div>
          </section>
        )}
      </section>
      <section className="screen-summary dashboard-summary inline-summary">
        <span>{summary}</span>
        <span>{visibleDashboardWidgets.length} bölüm açık</span>
      </section>
    </main>
  );
}
