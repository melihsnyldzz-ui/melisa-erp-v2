import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardAlertsPanel } from './DashboardAlertsPanel.jsx';
import { DashboardKpiGrid } from './DashboardKpiGrid.jsx';
import { DashboardOperationsPanel } from './DashboardOperationsPanel.jsx';
import { DashboardRecentTransactions } from './DashboardRecentTransactions.jsx';
import { DashboardReceivablesPanel } from './DashboardReceivablesPanel.jsx';
import { DashboardToolbar } from './DashboardToolbar.jsx';
import { DashboardTopProducts } from './DashboardTopProducts.jsx';
import { fetchDashboardAlerts, fetchDashboardSummary } from '../../services/dashboardApi.js';
import { DashboardLayoutEditor, DashboardWidgetFrame } from './DashboardLayoutControls.jsx';
import { DashboardQuickActions } from './DashboardQuickActions.jsx';
import { readDashboardSnapshot } from './dashboardSnapshot.js';
import {
  buildDefaultDashboardLayout,
  dashboardFreeLayout,
  dashboardLayoutStorageKey,
  getDashboardWidgetWidth,
  inferDashboardSize,
  loadDashboardLayout,
} from './dashboardLayout.js';
import {
  buildAccountingKpis,
  buildPatronKpis,
  emptyDashboardSummary,
  mapAlerts,
  mapReceivables,
  mapRecentTransactions,
  mapSupplierPerformance,
  mapTopProducts,
} from './dashboardMetrics.js';

export function DashboardScreen({ onOpenScreen, permissions = [], roleViewId = 'yonetici' }) {
  const [activeView, setActiveView] = useState('patron');
  const [dashboardLayout, setDashboardLayout] = useState(loadDashboardLayout);
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const dashboardDeskRef = useRef(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const loadInFlightRef = useRef(false);
  const [summaryData, setSummaryData] = useState(null);
  const [alertsData, setAlertsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [alertsError, setAlertsError] = useState('');
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
    () => `${visibleTitle} / Bugünkü işlemler / ${lastUpdatedAt ? `Son başarılı okuma: ${new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastUpdatedAt)}` : 'Henüz veri okunmadı'}`,
    [lastUpdatedAt, visibleTitle],
  );
  const widgetMap = useMemo(() => ({
    alerts: {
      node: <DashboardAlertsPanel alerts={criticalAlerts} errorMessage={alertsError} onOpenScreen={onOpenScreen} />,
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
          isAvailable={Array.isArray(summaryData?.countryPerformance)}
          subtitle={countryPerformance.length > 0 ? 'Ülke performansı ve alacak dağılımı' : 'Ülke verisi henüz oluşmadı'}
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
          isAvailable={Array.isArray(melisaRows.whatsapp)}
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
          isAvailable={Array.isArray(melisaRows.collections)}
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
          isAvailable={Array.isArray(melisaRows.productFocus)}
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
          isAvailable={Array.isArray(melisaRows.topReceivableFocus)}
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
          isAvailable={Array.isArray(melisaRows.countryOpportunities)}
          subtitle="Bugün öne çıkarılacak pazarlar"
          title="Ülke Bazlı Fırsatlar"
        />
      ),
    },
  }), [alertsError, countryPerformance, criticalAlerts, melisaRows, onOpenScreen, receivables, recentTransactions, summaryData, topProducts]);
  const visibleDashboardWidgets = useMemo(
    () => dashboardLayout.filter((widget) => widget.visible && widgetMap[widget.key]),
    [dashboardLayout, widgetMap],
  );
  const dashboardDeskHeight = useMemo(() => {
    const bottomEdge = visibleDashboardWidgets.reduce((max, widget) => (
      Math.max(max, Number(widget.y || 0) + Number(widget.h || dashboardFreeLayout.rowHeight))
    ), dashboardFreeLayout.rowHeight);

    return Math.max(bottomEdge + dashboardFreeLayout.gap, 420);
  }, [visibleDashboardWidgets]);

  useEffect(() => {
    window.localStorage.setItem(dashboardLayoutStorageKey, JSON.stringify(dashboardLayout));
  }, [dashboardLayout]);

  const updateDashboardWidget = useCallback((key, patch) => {
    setDashboardLayout((currentLayout) => currentLayout.map((widget) => (
      widget.key === key ? {
        ...widget,
        ...patch,
        w: patch.size ? getDashboardWidgetWidth(patch.size) : (patch.w ?? widget.w),
      } : widget
    )));
  }, []);

  const startDashboardWidgetDrag = useCallback((event, widget) => {
    if (!isLayoutEditorOpen || event.button !== 0) return;

    event.preventDefault();
    const deskWidth = dashboardDeskRef.current?.scrollWidth
      || dashboardDeskRef.current?.getBoundingClientRect().width
      || 1680;
    const maxLeft = Math.max(deskWidth - Number(widget.w || dashboardFreeLayout.minWidth), 0);
    const start = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      x: Number(widget.x || 0),
      y: Number(widget.y || 0),
    };

    function handleMouseMove(moveEvent) {
      const nextX = Math.max(0, Math.min(maxLeft, start.x + moveEvent.clientX - start.mouseX));
      const nextY = Math.max(0, start.y + moveEvent.clientY - start.mouseY);
      setDashboardLayout((currentLayout) => currentLayout.map((currentWidget) => (
        currentWidget.key === widget.key ? { ...currentWidget, x: Math.round(nextX), y: Math.round(nextY) } : currentWidget
      )));
    }

    function handleMouseUp() {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isLayoutEditorOpen]);

  const startDashboardWidgetResize = useCallback((event, widget) => {
    if (!isLayoutEditorOpen || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    const deskWidth = dashboardDeskRef.current?.scrollWidth
      || dashboardDeskRef.current?.getBoundingClientRect().width
      || 1680;
    const maxWidth = Math.max(deskWidth - Number(widget.x || 0), dashboardFreeLayout.minWidth);
    const start = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      w: Number(widget.w || getDashboardWidgetWidth(widget.size)),
      h: Number(widget.h || dashboardFreeLayout.rowHeight),
    };

    function handleMouseMove(moveEvent) {
      const nextWidth = Math.max(dashboardFreeLayout.minWidth, Math.min(maxWidth, start.w + moveEvent.clientX - start.mouseX));
      const nextHeight = Math.max(dashboardFreeLayout.minHeight, start.h + moveEvent.clientY - start.mouseY);
      setDashboardLayout((currentLayout) => currentLayout.map((currentWidget) => (
        currentWidget.key === widget.key
          ? {
            ...currentWidget,
            w: Math.round(nextWidth),
            h: Math.round(nextHeight),
            size: inferDashboardSize(nextWidth),
          }
          : currentWidget
      )));
    }

    function handleMouseUp() {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isLayoutEditorOpen]);

  const moveDashboardWidget = useCallback((key, direction) => {
    setDashboardLayout((currentLayout) => {
      const index = currentLayout.findIndex((widget) => widget.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentLayout.length) {
        return currentLayout;
      }

      const nextLayout = [...currentLayout];
      const currentWidget = nextLayout[index];
      const targetWidget = nextLayout[nextIndex];
      nextLayout[index] = {
        ...targetWidget,
        x: currentWidget.x,
        y: currentWidget.y,
        w: currentWidget.w,
        h: currentWidget.h,
      };
      nextLayout[nextIndex] = {
        ...currentWidget,
        x: targetWidget.x,
        y: targetWidget.y,
        w: targetWidget.w,
        h: targetWidget.h,
      };
      return nextLayout;
    });
  }, []);

  const resetDashboardLayout = useCallback(() => {
    setDashboardLayout(buildDefaultDashboardLayout());
  }, []);

  const loadDashboard = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setIsLoading(true);
    try {
      const snapshot = await readDashboardSnapshot(fetchDashboardSummary, fetchDashboardAlerts);
      if (snapshot.summary) {
        setSummaryData(snapshot.summary);
        setLastUpdatedAt(new Date());
      }
      if (snapshot.alerts) setAlertsData(snapshot.alerts);
      setErrorMessage(snapshot.summaryError);
      setAlertsError(snapshot.alertsError);
    } finally {
      setIsLoading(false);
      loadInFlightRef.current = false;
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
        onOpenReports={permissions.includes('dashboard.view') ? () => onOpenScreen?.('reports-overview') : undefined}
        onRefresh={loadDashboard}
        onViewChange={setActiveView}
      />
      {isLoading && <div className="list-state" role="status">{summaryData ? 'Günlük özet yenileniyor; son başarılı okuma gösteriliyor.' : 'Günlük özet okunuyor…'}</div>}
      {errorMessage && <div className="list-state list-state-error" role="alert">{errorMessage} {summaryData ? 'Son başarılı okuma gösteriliyor; güncel olduğu doğrulanamadı.' : 'Veri okunamadığı için özet gösterilmiyor.'}</div>}
      {isLayoutEditorOpen && (
        <DashboardLayoutEditor
          layout={dashboardLayout}
          onMoveWidget={moveDashboardWidget}
          onReset={resetDashboardLayout}
          onUpdateWidget={updateDashboardWidget}
        />
      )}
      <DashboardQuickActions onOpenScreen={onOpenScreen} permissions={permissions} roleViewId={roleViewId} />
      {summaryData && <>
      <DashboardKpiGrid kpis={kpis} onOpenScreen={onOpenScreen} />
      <section
        className={`dashboard-main-grid${isLayoutEditorOpen ? ' dashboard-free-desk dashboard-free-desk-editing' : ''}`}
        ref={dashboardDeskRef}
        style={isLayoutEditorOpen ? { minHeight: `${dashboardDeskHeight}px` } : undefined}
      >
        {visibleDashboardWidgets.map((widget, index) => (
          <DashboardWidgetFrame
            index={index}
            isEditing={isLayoutEditorOpen}
            key={widget.key}
            onMoveWidget={moveDashboardWidget}
            onStartDrag={startDashboardWidgetDrag}
            onStartResize={startDashboardWidgetResize}
            onUpdateWidget={updateDashboardWidget}
            total={visibleDashboardWidgets.length}
            widget={widget}
          >
            {widgetMap[widget.key].node}
          </DashboardWidgetFrame>
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
      </>}
      <section className="screen-summary dashboard-summary inline-summary">
        <span>{summary}</span>
        <span>{visibleDashboardWidgets.length} bölüm açık</span>
      </section>
    </main>
  );
}
