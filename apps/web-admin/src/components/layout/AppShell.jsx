import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TopMenu } from '../navigation/TopMenu.jsx';
import { Sidebar } from '../navigation/Sidebar.jsx';
import { TabBar } from '../workspace/TabBar.jsx';
import { Workspace } from '../workspace/Workspace.jsx';
import { StatusBar } from './StatusBar.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { SmartInsightsPanel } from './SmartInsightsPanel.jsx';
import { initialTabs, screenRegistry } from '../../data/mockNavigationData.js';
import { defaultViewOptions, readStoredViewOptions, viewOptionsStorageKey } from '../../config/viewOptions.js';
import { getRoleScreenIds, readStoredRoleView, roleViewStorageKey } from '../../config/roleViews.js';

function getShellClassName(isDemoMode, viewOptions) {
  return [
    'erp-shell',
    isDemoMode ? 'demo-mode-shell' : '',
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
  ].filter(Boolean).join(' ');
}

export function AppShell({ user, permissions, isDemoMode = false, onLogout }) {
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState(initialTabs[0].id);
  const [viewOptions, setViewOptions] = useState(readStoredViewOptions);
  const [roleViewId, setRoleViewId] = useState(readStoredRoleView);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );

  const roleScreenIds = useMemo(() => getRoleScreenIds(roleViewId), [roleViewId]);

  function createTab(screen, payload = {}) {
    const recordId = payload.productId ?? payload.customerId ?? payload.salesDraftId ?? payload.purchaseDraftId;
    const recordLabel = payload.tabLabel
      ?? payload.stockCode
      ?? payload.customerCode
      ?? payload.invoiceNo
      ?? (recordId ? `#${recordId}` : '');

    if (!recordId) {
      return {
        ...screen,
        screenId: screen.id,
        payload,
      };
    }

    return {
      ...screen,
      id: `${screen.id}:${recordId}`,
      screenId: screen.id,
      label: `${screen.label}: ${recordLabel}`,
      payload,
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

  function closeTab(tabId) {
    const closingTab = tabs.find((tab) => tab.id === tabId);

    if (!closingTab || closingTab.pinned) {
      return;
    }

    if (closingTab.dirty) {
      const shouldClose = window.confirm(`${closingTab.label} ekraninda kaydedilmemis degisiklikler var. Sekme kapatilsin mi?`);

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

  const updateActiveTabDirty = useCallback((isDirty) => {
    setTabs((currentTabs) => {
      let didChange = false;
      const nextTabs = currentTabs.map((tab) => {
        if (tab.id !== activeTabId || tab.dirty === isDirty) {
          return tab;
        }

        didChange = true;
        return { ...tab, dirty: isDirty };
      });

      return didChange ? nextTabs : currentTabs;
    });
  }, [activeTabId]);

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

  const updateRoleView = useCallback((nextRoleViewId) => {
    setRoleViewId(nextRoleViewId);
    window.localStorage.setItem(roleViewStorageKey, nextRoleViewId);
  }, []);

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

  return (
    <div className={getShellClassName(isDemoMode, viewOptions)}>
      {isDemoMode && (
        <div className="demo-mode-banner">
          DEMO MODE: API/SQL kapali, islemler kaydedilmez
        </div>
      )}
      <TopMenu
        activeModule={activeTab.module}
        activeTab={activeTab}
        roleViewId={roleViewId}
        user={user}
        viewOptions={viewOptions}
        onLogout={onLogout}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenScreen={openScreen}
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
          <Workspace
            activeTab={activeTab}
            onDirtyChange={updateActiveTabDirty}
            onOpenScreen={openScreen}
            permissions={permissions}
          />
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
