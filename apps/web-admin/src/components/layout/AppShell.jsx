import React, { useMemo, useState } from 'react';
import { TopMenu } from '../navigation/TopMenu.jsx';
import { Sidebar } from '../navigation/Sidebar.jsx';
import { TabBar } from '../workspace/TabBar.jsx';
import { Workspace } from '../workspace/Workspace.jsx';
import { StatusBar } from './StatusBar.jsx';
import { initialTabs, screenRegistry } from '../../data/mockNavigationData.js';

export function AppShell({ user, permissions, onLogout }) {
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState(initialTabs[0].id);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );

  function createTab(screen, payload = {}) {
    const recordId = payload.productId ?? payload.customerId ?? payload.salesDraftId ?? payload.purchaseDraftId;

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
      label: `${screen.label} #${recordId}`,
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

    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = tabs.filter((tab) => tab.id !== tabId);

    setTabs(nextTabs);

    if (activeTabId === tabId) {
      const fallbackTab = nextTabs[closingIndex - 1] ?? nextTabs[closingIndex] ?? nextTabs[0];
      setActiveTabId(fallbackTab.id);
    }
  }

  return (
    <div className="erp-shell">
      <TopMenu activeModule={activeTab.module} user={user} onLogout={onLogout} />
      <div className="main-layout">
        <Sidebar activeTab={activeTab} user={user} onOpenScreen={openScreen} />
        <section className="content-shell">
          <TabBar tabs={tabs} activeTabId={activeTab.id} onActivateTab={setActiveTabId} onCloseTab={closeTab} />
          <Workspace activeTab={activeTab} onOpenScreen={openScreen} permissions={permissions} />
        </section>
      </div>
      <StatusBar activeTab={activeTab} openTabCount={tabs.length} user={user} />
    </div>
  );
}
