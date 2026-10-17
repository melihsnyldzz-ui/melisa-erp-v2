import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiConfig } from '../../config/apiConfig.js';
import { DashboardAlertsPanel } from './DashboardAlertsPanel.jsx';
import { OperationalQueuePanel } from './OperationalQueuePanel.jsx';
import { DashboardKpiGrid } from './DashboardKpiGrid.jsx';
import { DashboardOperationsPanel } from './DashboardOperationsPanel.jsx';
import { DashboardRecentTransactions } from './DashboardRecentTransactions.jsx';
import { DashboardReceivablesPanel } from './DashboardReceivablesPanel.jsx';
import { DashboardToolbar } from './DashboardToolbar.jsx';
import { DashboardTopProducts } from './DashboardTopProducts.jsx';
import { fetchDashboardAlerts, fetchDashboardSummary } from '../../services/dashboardApi.js';
import { DashboardLayoutEditor, DashboardWidgetFrame } from './DashboardLayoutControls.jsx';
import { DashboardQuickActions } from './DashboardQuickActions.jsx';
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
  periodLabels,
} from './dashboardMetrics.js';

function ExistingDashboardScreen({ onOpenScreen, permissions = [], roleViewId = 'yonetici' }) {
  const [activeView, setActiveView] = useState('patron');
  const [dashboardLayout, setDashboardLayout] = useState(loadDashboardLayout);
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const dashboardDeskRef = useRef(null);
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
      <DashboardQuickActions onOpenScreen={onOpenScreen} permissions={permissions} roleViewId={roleViewId} />
      {!isLoading && !errorMessage && summaryData && <>
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
      <section className="screen-summary dashboard-summary inline-summary">
        <span>{summary}</span>
        <span>{visibleDashboardWidgets.length} bölüm açık</span>
      </section>
      </>}
    </main>
  );
}


export function DashboardScreen(props) {
  return import.meta.env.VITE_TEST_READ_ONLY === 'true' ? <ReadOnlyDashboard {...props} /> : <ExistingDashboardScreen {...props} />;
}

function ReadOnlyDashboard({ onOpenScreen, permissions = [] }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: null });
    fetchDashboardSummary({ signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setState({ loading: false, data: response.data, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, data: null, error });
    });
    return () => controller.abort();
  }, [revision]);
  const number = value => value == null || value === '' || !Number.isFinite(Number(value))
    ? 'Veri doğrulanmadı' : new Intl.NumberFormat('tr-TR').format(value);
  if (apiConfig?.demoMode) {
    const documents = Array.isArray(state.data?.recentDocuments) ? state.data.recentDocuments : [];
    const salesCount = documents.filter(row => row.kind === 'sales').length;
    const purchaseCount = documents.filter(row => row.kind === 'purchase').length;
    return <main className="v17-page v17-demo-home">
      <div className="v17-page-head"><div><div className="v17-eyebrow">ÖRNEK ÇALIŞMA ALANI</div><h1>Melisa ERP</h1><p>Ürünleri ve belge akışını örnek kayıtlarla inceleyin.</p></div></div>
      <div className="v17-demo-notice">Bu ekrandaki bilgiler örnektir. Gerçek stok, satış veya cari kaydı gösterilmez; hiçbir işlem kaydedilmez.</div>
      {state.error && <div role="alert" className="v17-notice error">Örnek kayıtlar yüklenemedi. Sayfayı yenileyin.</div>}
      <section className="v17-demo-overview" aria-label="Örnek kayıt özeti">
        <button type="button" onClick={() => onOpenScreen('stock-list')} disabled={!permissions.includes('product.view')}><span>Ürün kartları</span><strong>{state.loading ? '…' : number(state.data?.totalProducts)}</strong><small>{state.data ? `${number(state.data.activeProducts)} aktif örnek ürün` : 'Örnek ürünler yükleniyor'}</small><em>Ürünleri incele →</em></button>
        <button type="button" onClick={() => onOpenScreen('sales-invoice-list')} disabled={!permissions.includes('sales.view')}><span>Satış belgeleri</span><strong>{state.loading ? '…' : number(state.data && salesCount)}</strong><small>Tüm tarihlerdeki örnekler</small><em>Satışları incele →</em></button>
        <button type="button" onClick={() => onOpenScreen('purchase-invoice-list')} disabled={!permissions.includes('purchase.view')}><span>Alış belgeleri</span><strong>{state.loading ? '…' : number(state.data && purchaseCount)}</strong><small>Tüm tarihlerdeki örnekler</small><em>Alışları incele →</em></button>
      </section>
      <section className="v17-card v17-demo-documents"><div className="v17-card-title"><h2>Örnek belge akışı</h2><span className="v17-muted">Tarihler ve durumlar örnek veri setindendir</span></div>
        {documents.length ? <div className="v17-demo-document-list">{documents.slice(0, 5).map(row => <button type="button" key={`${row.kind}:${row.id}`} onClick={() => onOpenScreen(row.kind === 'sales' ? 'sales-invoice-list' : 'purchase-invoice-list')}><span className="v17-demo-document-kind">{row.label}</span><strong>{row.invoiceNo}</strong><span>{row.documentDate}</span><span>{({ DRAFT: 'Taslak', FINALIZED: 'Onaylı', CANCELLED: 'İptal' })[row.status] || row.status}</span><span aria-hidden="true">→</span></button>)}</div> : <p className="v17-demo-empty">{state.loading ? 'Örnek belgeler yükleniyor…' : 'Bu veri setinde örnek belge bulunmuyor.'}</p>}
      </section>
      <p className="v17-demo-footnote">Demo verileri gerçek Vega veya yerel ERP veritabanından gelmez.</p>
    </main>;
  }
  return <main className="v17-page">
    <div className="v17-page-head"><div><div className="v17-eyebrow">ANA SAYFA</div><h1>Gün özeti</h1><p>Günlük operasyon, belgeler ve kontrol noktaları.</p></div><button type="button" className="v17-button" disabled={state.loading} onClick={() => setRevision(n => n + 1)}>↻ Yenile</button></div>
    {state.error && <div role="alert" className="v17-notice error">{state.error.status === 403 ? 'Bu özeti görüntüleme yetkiniz yok.' : state.error.status === 401 ? 'Oturum süresi doldu. Yeniden giriş yapın.' : 'Özet okunamadı. Önceki değerler güncel veri olarak gösterilmiyor.'}</div>}
    {!state.loading && !state.error && !state.data && <div role="status" className="v17-notice">Özet yanıtı boş. Ürün sayısı doğrulanmadı.</div>}
    <div className="v17-kpis">{[['Satış fişleri', '↗', 'blue', 'salesDocuments'], ['Alış faturaları', '▱', 'purple', 'purchaseDocuments'], ['Yeni ürün kartı', '▦', 'teal', 'newProducts'], ['Kasa hareketleri', '⇄', 'orange', 'cashMovements']].map(([label, icon, color, key]) => <article className="v17-kpi" key={label}><div><span className={'v17-kpi-icon ' + color}>{icon}</span><span>{label}</span></div><strong>{state.loading ? '…' : number(state.data?.dailyCounts?.[key])}</strong><small>{state.data?.dailyCounts?.[key] != null ? `${state.data.businessDate} · ${state.data.synthetic ? 'Örnek kayıtlar' : 'Kayıt kapsamı'}` : 'İş tarihi ve kapsam doğrulaması bekliyor'}</small></article>)}</div>
    <div className="v17-dashboard-grid">
      <OperationalQueuePanel onOpenScreen={onOpenScreen} permissions={permissions} />
      <section className="v17-card"><div className="v17-card-title"><h2>Ürün kartları</h2><span className="v17-tag">Katalog</span></div><div className="v17-catalog-summary"><span>TEST ürün kartları · tüm kayıt tarihleri</span><strong>{state.loading ? 'Yükleniyor…' : state.error ? 'Okunamadı' : number(state.data?.totalProducts)}</strong><p>Aktif kart: {state.loading ? '…' : state.error ? 'Okunamadı' : number(state.data?.activeProducts)}</p><small>Silinmemiş kart sayısıdır. Günlük stok girişi veya stok toplamı değildir.</small><button className="v17-button primary" type="button" disabled={!permissions.includes('product.view')} onClick={() => onOpenScreen('stock-list')}>Ürün & Stok listesi →</button></div></section>
    </div>
    <div className="v17-notice"><strong>Kontrol notu</strong><span>{state.data?.synthetic ? 'Örnek kayıtlar gösterilir. Eksik veri sıfır kabul edilmez; taslaklar kesinleşmiş ciroya katılmaz.' : 'Günlük toplamlar, son ticari hareketler ve firma / dönem kapsamı doğrulanmadı. Farklı para birimleri ve stok birimleri birleştirilmez.'}</span></div>
    <section className="v17-card v17-recent"><div className="v17-card-title"><h2>Son hareketler</h2><span className="v17-muted">Belge akışı</span></div><div className="v17-table-scroll"><table><thead><tr><th>Tarih</th><th>Belge</th><th>İşlem</th><th>Durum</th></tr></thead><tbody>{Array.isArray(state.data?.recentDocuments) ? state.data.recentDocuments.map(row => <tr key={`${row.kind}:${row.id}`}><td>{row.documentDate}</td><td>{row.invoiceNo}</td><td>{row.label}</td><td>{({DRAFT:'Taslak',FINALIZED:'Onaylı',CANCELLED:'İptal'})[row.status] || row.status}</td></tr>) : <tr><td colSpan="4" className="v17-empty-cell">Veri doğrulanmadı · Bu alan boş hareket listesi olarak yorumlanmamalı.</td></tr>}</tbody></table></div></section>
    <p className="v17-read-time">Okuma zamanı: {state.data?.readAt ? new Date(state.data.readAt).toLocaleString('tr-TR') : '—'} · İş tarihi: {state.data?.businessDate || 'doğrulanmadı'}</p>
  </main>;
}
