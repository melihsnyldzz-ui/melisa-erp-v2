import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopMenu } from '../navigation/TopMenu.jsx';
import { Sidebar } from '../navigation/Sidebar.jsx';
import { TabBar } from '../workspace/TabBar.jsx';
import { Workspace } from '../workspace/Workspace.jsx';
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
import { buildScreenDeepLink, readScreenDeepLink } from '../../utils/screenDeepLink.js';
import { invoiceListScope } from '../../modules/shared/invoiceListScope.js';

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
  const [viewOptions, setViewOptions] = useState(readStoredViewOptions);
  const [roleViewId, setRoleViewId] = useState(readStoredRoleView);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const deepLinkHandledRef = useRef(false);
  const pendingDeepLinkScreenRef = useRef('');

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );

  const roleScreenIds = useMemo(() => getRoleScreenIds(roleViewId), [roleViewId]);
  const activeNavigationSection = useMemo(
    () => getNavigationSection(activeTab.screenId ?? activeTab.id),
    [activeTab],
  );

  function createTab(screen, payload = {}) {
    const invoiceScope = invoiceListScope(screen.id, payload);
    const recordId = payload.productId
      ?? payload.customerId
      ?? payload.sourceId
      ?? payload.customerSourceId
      ?? payload.supplierId
      ?? payload.salesDraftId
      ?? payload.purchaseDraftId
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
      id: `${screen.id}:${invoiceScope?.key || recordId}`,
      screenId: screen.id,
      label: `${screen.label}: ${recordLabel}`,
      payload,
      dirty: false,
    };
  }

  function openScreen(screenId, payload = {}) {
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
    if (!deepLink) return;

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
    const nextRoleScreenIds = getRoleScreenIds(nextRoleViewId);
    const activeScreenId = activeTab.screenId ?? activeTab.id;

    setRoleViewId(nextRoleViewId);
    window.localStorage.setItem(roleViewStorageKey, nextRoleViewId);

    if (nextRoleScreenIds && !nextRoleScreenIds.has(activeScreenId)) {
      setActiveTabId('dashboard');
    }
  }, [activeTab]);

  useEffect(() => {
    function handleKeyDown(event) {
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

  return (
    <div className={getShellClassName(isDemoMode, viewOptions)} data-active-screen={activeTab.screenId ?? activeTab.id}>
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
