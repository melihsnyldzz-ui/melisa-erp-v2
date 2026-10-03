import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, ArrowUpRight, PackageOpen, ShoppingBag, Boxes, Users, Building2, Wallet, ClipboardList, BarChart3, Settings, Menu, X, LogOut, ChevronRight, LockKeyhole, ScanBarcode } from 'lucide-react';
import { apiConfig } from '../../config/apiConfig.js';
import { canOpenVegaScreen } from '../../modules/vega/vegaReadModel.js';
import { TopMenu } from '../navigation/TopMenu.jsx';
import { Sidebar } from '../navigation/Sidebar.jsx';
import { TabBar } from '../workspace/TabBar.jsx';
import { Workspace } from '../workspace/WorkspaceEntry.jsx';
import { StatusBar } from './StatusBar.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { SmartInsightsPanel } from './SmartInsightsPanel.jsx';
import { getNavigationSection, initialTabs, screenRegistry } from '../../data/mockNavigationData.js';
import {
  defaultViewOptions,
  detailedViewPreset,
  readStoredViewOptions,
  simpleViewPreset,
  viewOptionsStorageKey,
} from '../../config/viewOptions.js';
import { getRoleScreenIds, readStoredRoleView, roleViewStorageKey } from '../../config/roleViews.js';
import { getDemoRoleScreenIds } from '../../config/demoRolePolicy.js';
import { buildScreenDeepLink, readScreenDeepLink } from '../../utils/screenDeepLink.js';

const testReadOnly = import.meta.env.VITE_TEST_READ_ONLY === 'true';
const useModernShell = testReadOnly || apiConfig.demoMode;
const testScreens = new Set(['dashboard', 'stock-list', 'product-card', 'sales-invoice-list', 'inventory-receipt-list', 'purchase-invoice-list', 'customer-list', 'supplier-list', 'stock-count', 'collections-overview', 'reports-overview', 'cash-bank-ledger']);
const testScreenPermissions = {
  dashboard: 'dashboard.view',
  'stock-list': 'product.view',
  'product-card': 'product.view',
  'sales-invoice-list': 'sales.view',
  'purchase-invoice-list': 'purchase.view',
  'inventory-receipt-list': 'purchase.view',
  'customer-list': 'customer.view',
  'supplier-list': 'supplier.view',
  'stock-count': 'stock.adjust',
  'reports-overview': 'dashboard.view',
  'cash-register': 'finance.view',
  'cash-bank-ledger': 'finance.view',
  'settings-overview': 'settings.manage',
};

function getShellClassName(isDemoMode, viewOptions) {
  const rowDensity = viewOptions.rowDensity || (viewOptions.compactRows ? 'compact' : 'comfortable');

  return [
    'erp-shell',
    isDemoMode ? 'demo-mode-shell' : '',
    viewOptions.darkMode ? 'dark-mode-shell' : '',
    viewOptions.simpleMode ? 'simple-mode-shell' : '',
    viewOptions.focusMode ? 'focus-mode-shell' : '',
    !viewOptions.showSidebar ? 'hide-sidebar' : '',
    !viewOptions.showSmartPanel ? 'hide-smart-panel' : '',
    viewOptions.smartPanelCollapsed ? 'smart-panel-collapsed-shell' : '',
    !viewOptions.showTabs ? 'hide-tabs' : '',
    !viewOptions.showStatusBar ? 'hide-status-bar' : '',
    !viewOptions.showFilters ? 'hide-filters' : '',
    !viewOptions.showKpis ? 'hide-kpis' : '',
    !viewOptions.showSummaries ? 'hide-summaries' : '',
    !viewOptions.showToolbarSubtitles ? 'hide-toolbar-subtitles' : '',
    !viewOptions.showConnectionDetails ? 'hide-connection-details' : '',
    viewOptions.compactRows ? 'compact-rows-shell' : 'comfortable-rows-shell',
    `row-density-${rowDensity}`,
  ].filter(Boolean).join(' ');
}

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.screenId !== this.props.screenId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="work-area">
          <section className="erp-panel">
            <div className="panel-title">
              <strong>Ekran yüklenemedi</strong>
              <span>{this.props.label}</span>
            </div>
            <div className="list-state list-state-error">
              {this.state.error.message}
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export function AppShell({ user, permissions, isDemoMode = false, onLogout }) {
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState(initialTabs[0].id);
  const scrollPositions = useRef(new Map());
  useLayoutEffect(() => {
    if (!useModernShell) return;
    window.scrollTo({ top: scrollPositions.current.get(activeTabId) || 0, left: 0, behavior: 'instant' });
    const remember = () => scrollPositions.current.set(activeTabId, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [activeTabId]);
  const [viewOptions, setViewOptions] = useState(readStoredViewOptions);
  const [roleViewId, setRoleViewId] = useState(readStoredRoleView);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const deepLinkHandledRef = useRef(false);
  const pendingDeepLinkScreenRef = useRef('');

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );

  const roleScreenIds = useMemo(() => apiConfig.demoMode ? getDemoRoleScreenIds(roleViewId) : getRoleScreenIds(roleViewId), [roleViewId]);
  const activeNavigationSection = useMemo(
    () => getNavigationSection(activeTab.screenId ?? activeTab.id),
    [activeTab],
  );

  function createTab(screen, payload = {}) {
    const recordId = payload.vegaSourceId
      ?? payload.productId
      ?? payload.customerId
      ?? payload.sourceId
      ?? payload.customerSourceId
      ?? payload.supplierId
      ?? payload.selectedDocumentId
      ?? payload.salesDraftId
      ?? payload.purchaseDraftId
      ?? payload.receiptId
      ?? payload.workflowTaskId
      ?? (screen.id==='stock-count'?payload.count?.documentId:undefined)
      ?? (screen.id==='collections-overview'&&payload.mode==='cheque'?`cheque:${payload.cheque?.documentId??'list'}`:undefined)
      ?? (screen.id==='collections-overview'&&payload.notice?`notice:${payload.notice.documentId}`:undefined)
      ?? payload.offerId
      ?? payload.orderId;
    const recordLabel = payload.tabLabel
      ?? payload.stockCode
      ?? payload.customerCode
      ?? payload.supplierCode
      ?? payload.invoiceNo
      ?? payload.documentNo
      ?? (recordId ? `#${recordId}` : '');

    if (!recordId) {
      return {
        ...screen,
        screenId: screen.id,
        payload,
        dirty: false,
      };
    }

    return {
      ...screen,
      id: `${screen.id}:${recordId}`,
      screenId: screen.id,
      label: `${screen.label}: ${recordLabel}`,
      payload,
      dirty: false,
    };
  }

  function openScreen(screenId, payload = {}) {
    if (apiConfig.vegaBridgeMode && !canOpenVegaScreen(screenId, permissions)) return;
    if (testReadOnly && !apiConfig.demoMode && !testScreens.has(screenId)) return;
    const screen = screenRegistry[screenId];

    if (!screen) {
      return;
    }

    const nextTab = createTab(screen, payload);

    setTabs((currentTabs) => {
      if (currentTabs.some((tab) => tab.id === nextTab.id)) {
        return currentTabs;
      }

      return [...currentTabs, nextTab];
    });
    setActiveTabId(nextTab.id);
  }

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    const deepLink = readScreenDeepLink(window.location.search, screenRegistry, roleScreenIds);
    if (!deepLink || (testReadOnly && !apiConfig.demoMode && !testScreens.has(deepLink.screenId))) return;

    pendingDeepLinkScreenRef.current = deepLink.screenId;
    openScreen(deepLink.screenId, deepLink.payload);
  }, []);

  useEffect(() => {
    if (!deepLinkHandledRef.current) return;

    const activeScreenId = activeTab.screenId ?? activeTab.id;
    if (pendingDeepLinkScreenRef.current && pendingDeepLinkScreenRef.current !== activeScreenId) {
      return;
    }

    pendingDeepLinkScreenRef.current = '';
    const nextSearch = buildScreenDeepLink(window.location.search, activeScreenId);
    if (nextSearch === window.location.search) return;

    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch}${window.location.hash}`,
    );
  }, [activeTab]);

  function closeTab(tabId) {
    const closingTab = tabs.find((tab) => tab.id === tabId);

    if (!closingTab || closingTab.pinned) {
      return;
    }

    if (closingTab.dirty) {
      const shouldClose = window.confirm(`${closingTab.label} ekranında kaydedilmemiş değişiklikler var. Sekme kapatılsın mı?`);

      if (!shouldClose) {
        return;
      }
    }

    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = tabs.filter((tab) => tab.id !== tabId);

    setTabs(nextTabs);

    if (activeTabId === tabId) {
      const fallbackTab = nextTabs[closingIndex - 1] ?? nextTabs[closingIndex] ?? nextTabs[0];
      setActiveTabId(fallbackTab.id);
    }
  }

  const hasDirtyTabs = useMemo(
    () => tabs.some((tab) => tab.dirty),
    [tabs],
  );

  const updateTabDirty = useCallback((tabId, isDirty) => {
    setTabs((currentTabs) => {
      let didChange = false;
      const nextTabs = currentTabs.map((tab) => {
        if (tab.id !== tabId || tab.dirty === isDirty) {
          return tab;
        }

        didChange = true;
        return { ...tab, dirty: isDirty };
      });

      return didChange ? nextTabs : currentTabs;
    });
  }, []);

  const updateViewOption = useCallback((key, value) => {
    setViewOptions((currentOptions) => {
      const nextOptions = { ...currentOptions, [key]: value };
      window.localStorage.setItem(viewOptionsStorageKey, JSON.stringify(nextOptions));
      return nextOptions;
    });
  }, []);

  const resetViewOptions = useCallback(() => {
    window.localStorage.removeItem(viewOptionsStorageKey);
    setViewOptions(defaultViewOptions);
  }, []);

  const applyViewPreset = useCallback((preset) => {
    setViewOptions((currentOptions) => {
      const nextOptions = {
        ...defaultViewOptions,
        ...preset,
        darkMode: Boolean(currentOptions.darkMode),
      };
      window.localStorage.setItem(viewOptionsStorageKey, JSON.stringify(nextOptions));
      return nextOptions;
    });
  }, []);

  const updateRoleView = useCallback((nextRoleViewId) => {
    const nextRoleScreenIds = apiConfig.demoMode ? getDemoRoleScreenIds(nextRoleViewId) : getRoleScreenIds(nextRoleViewId);
    const activeScreenId = activeTab.screenId ?? activeTab.id;

    setRoleViewId(nextRoleViewId);
    window.localStorage.setItem(roleViewStorageKey, nextRoleViewId);

    if (nextRoleScreenIds && !nextRoleScreenIds.has(activeScreenId)) {
      setActiveTabId('dashboard');
    }
  }, [activeTab]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsNavigationOpen(false);
      if (testReadOnly && !apiConfig.demoMode) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('tr-TR') === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasDirtyTabs) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirtyTabs]);

  if (useModernShell) {
    const labels = { dashboard: 'Ana Sayfa', 'settings-overview': 'Yönetim ve onaylar', 'terminal-overview': 'El terminali', 'stock-list': 'Ürün & Stok', 'product-card': 'Ürün Kartı', 'sales-invoice-list': 'Satış Belgeleri', 'inventory-receipt-list': 'Gelen mal', 'purchase-invoice-list': 'Alış Belgeleri', 'customer-list': apiConfig.vegaBridgeMode ? 'Cari Kartları' : 'Müşteriler', 'supplier-list': 'Tedarikçiler', 'stock-count': 'Stok Sayımı', 'collections-overview': 'Tahsilat / Çek', 'reports-overview': 'Raporlar', 'cash-register': 'Günlük Kasa', 'cash-bank-ledger': 'Kasa / Banka' };
    const activeScreenId = activeTab.screenId ?? activeTab.id;
    const isTask05WriteScreen = activeScreenId === 'product-card';
    const isVegaProductScreen = apiConfig.vegaProductsMode && (activeScreenId === 'stock-list' || (activeScreenId === 'product-card' && activeTab.payload?.vegaSourceId));
    const cashScreenId = apiConfig.demoMode ? 'cash-register' : 'cash-bank-ledger';
    const nav = [['dashboard', 'Ana Sayfa', LayoutDashboard], ...(apiConfig.demoMode ? [['terminal-overview', 'El terminali', ScanBarcode]] : []), ['sales-invoice-list', 'Satış', ArrowUpRight], ['inventory-receipt-list', 'Gelen mal', PackageOpen], ['purchase-invoice-list', 'Alış', ShoppingBag], ['stock-list', 'Ürün & Stok', Boxes], ['customer-list', apiConfig.vegaBridgeMode ? 'Cari Kartları' : 'Müşteriler', Users], ['supplier-list', 'Tedarikçiler', Building2], [cashScreenId, apiConfig.demoMode ? 'Günlük Kasa' : 'Kasa / Banka', Wallet], ['stock-count', 'Sayım', ClipboardList], ['reports-overview', 'Raporlar', BarChart3], ['settings-overview', 'Yönetim', Settings]];
    return <div data-screen={activeScreenId} className={`v17-readonly v17-shell${isNavigationOpen ? ' navigation-open' : ''}`}>
      {isNavigationOpen && <button className="v17-menu-backdrop" aria-label="Menüyü kapat" onClick={() => setIsNavigationOpen(false)} />}
      <aside className="v17-sidebar" id="erp-navigation">
        <div className="v17-brand"><span>m</span><div>melisa<small>İŞLETME YÖNETİMİ</small></div><button className="v17-mobile-close" type="button" aria-label="Gezinmeyi kapat" onClick={() => setIsNavigationOpen(false)}><X size={20} /></button></div>
        <div className="v17-nav-label">Çalışma alanı</div>
        <nav aria-label="Ana menü">{apiConfig.demoMode && <button type="button" onClick={() => { window.location.assign('/is-akisi-taslagi.html'); }}><ClipboardList size={19} aria-hidden="true" /><span>Akış taslağı</span></button>}{nav.map(([id, label, Icon]) => {
          const disabled = apiConfig.vegaBridgeMode ? !canOpenVegaScreen(id, permissions) : !id || (apiConfig.demoMode && roleScreenIds && !roleScreenIds.has(id)) || !(permissions.includes(testScreenPermissions[id]) || (id === 'terminal-overview' && permissions.includes('dashboard.view')) || (id === 'inventory-receipt-list' && permissions.includes('purchase.create')) || (id === 'stock-count' && permissions.includes('terminal.stock_count.create')));
          return <button key={label} type="button" disabled={disabled} title={disabled ? `${label}: bağlantı kapsamı veya kullanıcı yetkisi nedeniyle kapalı` : label} aria-current={id === activeScreenId ? 'page' : undefined} className={id === activeScreenId ? 'active' : ''} onClick={id ? () => { openScreen(id); setIsNavigationOpen(false); } : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span>{disabled && <LockKeyhole size={13} className="v17-nav-lock" aria-hidden="true" />}</button>;
        })}</nav>
        <div className="v17-sidebar-foot"><div className="v17-profile-avatar">MB</div><div><strong>Melisa Baby</strong><small>{user?.displayName || 'Çalışma alanı'}</small></div></div>
      </aside>
      <div className="v17-main">
        <header className="v17-topbar"><div className="v17-context"><button className="v17-mobile-menu" type="button" aria-label="Menüyü aç" aria-expanded={isNavigationOpen} aria-controls="erp-navigation" onClick={() => setIsNavigationOpen(true)}><Menu size={22} /></button><span className="v17-context-root">Melisa ERP</span><ChevronRight size={15} aria-hidden="true" /><strong>{labels[activeScreenId] ?? screenRegistry[activeScreenId]?.label ?? activeTab.label}</strong></div><div className="v17-top-actions">{apiConfig.demoMode && !isVegaProductScreen && <label className="v17-role-picker">Görev görünümü (demo) <select value={roleViewId} onChange={event => updateRoleView(event.target.value)}><option value="yonetici">Yönetici</option><option value="muhasebe">Muhasebe</option><option value="depo">Depo</option><option value="satis">Satış</option></select></label>}<span className="v17-environment-tag">{apiConfig.vegaBridgeMode || isVegaProductScreen ? 'Vega kaynağı · Salt okunur' : isDemoMode ? 'Demo · Örnek veriler' : isTask05WriteScreen ? 'TEST · Sınırlı ürün işlemi' : 'TEST · Salt okunur'}</span><button type="button" onClick={onLogout} aria-label="Oturumu kapat" title="Oturumu kapat"><LogOut size={18} /><span>Çıkış</span></button></div></header>
        <div className="v17-tabs"><TabBar tabs={tabs.map(tab => ({ ...tab, label: tab.id === (tab.screenId ?? tab.id) ? (labels[tab.screenId ?? tab.id] ?? tab.label) : tab.label }))} activeTabId={activeTab.id} onActivateTab={setActiveTabId} onCloseTab={closeTab} /></div>
        <div className="v17-content">{tabs.map(tab => <React.Activity key={tab.id} mode={tab.id === activeTab.id ? 'visible' : 'hidden'}><ScreenErrorBoundary label={tab.label} screenId={tab.id}><Workspace activeTab={tab} onDirtyChange={dirty => updateTabDirty(tab.id, dirty)} onOpenScreen={openScreen} permissions={permissions} roleViewId={roleViewId} user={user} /></ScreenErrorBoundary></React.Activity>)}</div>
        <footer className="v17-footer"><span>Melisa ERP</span><span>{isVegaProductScreen ? 'Ürün verisi: Vega · Bağlantı ve ERP yetkisi gerekir.' : apiConfig.vegaBridgeMode ? 'Vega kaynak kayıtları · Ürün, stok ve cari kartları' : isDemoMode ? 'Örnek veriler · Bağlı işlemler bu tarayıcıda saklanır.' : isTask05WriteScreen ? 'Yalnız izin verilen TEST ürünleri düzenlenebilir.' : 'Salt okunur görünüm · Firma ve dönem doğrulanmadı.'}</span></footer>
      </div>
    </div>;
  }

  return (
    <div className={getShellClassName(isDemoMode, viewOptions)}>
      {isDemoMode && (
        <div className="demo-mode-banner">
          DEMO MODU: Gerçek veri bağlantıları kapalı; işlemler kaydedilmez
        </div>
      )}
      <TopMenu
        activeModule={activeNavigationSection.label}
        activeTab={activeTab}
        roleViewId={roleViewId}
        roleScreenIds={roleScreenIds}
        user={user}
        viewOptions={viewOptions}
        onLogout={onLogout}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenScreen={openScreen}
        onApplyDetailedView={() => applyViewPreset(detailedViewPreset)}
        onApplySimpleView={() => applyViewPreset(simpleViewPreset)}
        onResetViewOptions={resetViewOptions}
        onUpdateRoleView={updateRoleView}
        onUpdateViewOption={updateViewOption}
      />
      <div className="main-layout">
        <Sidebar
          activeTab={activeTab}
          isDemoMode={isDemoMode}
          roleScreenIds={roleScreenIds}
          user={user}
          onOpenScreen={openScreen}
        />
        <section className="content-shell">
          <TabBar tabs={tabs} activeTabId={activeTab.id} onActivateTab={setActiveTabId} onCloseTab={closeTab} />
          {tabs.map((tab) => (
            <React.Activity key={tab.id} mode={tab.id === activeTab.id ? 'visible' : 'hidden'}>
              <ScreenErrorBoundary label={tab.label} screenId={tab.id}>
                <Workspace
                  activeTab={tab}
                  onDirtyChange={(isDirty) => updateTabDirty(tab.id, isDirty)}
                  onOpenScreen={openScreen}
                  permissions={permissions}
                  roleViewId={roleViewId}
                  user={user}
                />
              </ScreenErrorBoundary>
            </React.Activity>
          ))}
        </section>
        <SmartInsightsPanel
          activeTab={activeTab}
          isCollapsed={viewOptions.smartPanelCollapsed}
          roleViewId={roleViewId}
          onOpenScreen={openScreen}
          onToggleCollapsed={() => updateViewOption('smartPanelCollapsed', !viewOptions.smartPanelCollapsed)}
        />
      </div>
      <StatusBar activeTab={activeTab} isDemoMode={isDemoMode} openTabCount={tabs.length} user={user} />
      {viewOptions.focusMode && (
        <button className="focus-mode-exit" onClick={() => updateViewOption('focusMode', false)} type="button">
          Odaktan çık
        </button>
      )}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenScreen={openScreen}
      />
    </div>
  );
}
