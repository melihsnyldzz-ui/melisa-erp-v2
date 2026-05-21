import React from 'react';
import { TopMenu } from '../navigation/TopMenu.jsx';
import { Sidebar } from '../navigation/Sidebar.jsx';
import { TabBar } from '../workspace/TabBar.jsx';
import { Workspace } from '../workspace/Workspace.jsx';
import { StatusBar } from './StatusBar.jsx';

export function AppShell() {
  return (
    <div className="erp-shell">
      <TopMenu />
      <div className="main-layout">
        <Sidebar />
        <section className="content-shell">
          <TabBar />
          <Workspace />
        </section>
      </div>
      <StatusBar />
    </div>
  );
}
