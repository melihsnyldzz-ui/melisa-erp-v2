import React, { useMemo, useState } from 'react';
import { DashboardAlertsPanel } from './DashboardAlertsPanel.jsx';
import { DashboardKpiGrid } from './DashboardKpiGrid.jsx';
import { DashboardRecentTransactions } from './DashboardRecentTransactions.jsx';
import { DashboardReceivablesPanel } from './DashboardReceivablesPanel.jsx';
import { DashboardSupplierPerformance } from './DashboardSupplierPerformance.jsx';
import { DashboardToolbar } from './DashboardToolbar.jsx';
import { DashboardTopProducts } from './DashboardTopProducts.jsx';
import {
  accountingKpis,
  criticalAlerts,
  patronKpis,
  receivables,
  recentTransactions,
  supplierPerformance,
  topProducts,
} from './dashboardMockData.js';

const periodLabels = {
  today: 'Bugun',
  week: 'Bu hafta',
  month: 'Bu ay',
};

export function DashboardScreen({ onOpenScreen }) {
  const [activeView, setActiveView] = useState('patron');
  const [period, setPeriod] = useState('today');
  const [refreshCount, setRefreshCount] = useState(0);
  const kpis = activeView === 'patron' ? patronKpis : accountingKpis;
  const visibleTitle = activeView === 'patron' ? 'Patron gorunumu' : 'Muhasebe gorunumu';
  const summary = useMemo(
    () => `${visibleTitle} / ${periodLabels[period]} / mock yenileme ${refreshCount}`,
    [period, refreshCount, visibleTitle],
  );

  return (
    <main className="work-area dashboard-screen">
      <DashboardToolbar
        activeView={activeView}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={() => setRefreshCount((count) => count + 1)}
        onViewChange={setActiveView}
      />
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
        <span>API/SQL/Auth bagli degil</span>
        <span>30 sn auto-refresh etiketi gorsel mock</span>
      </section>
    </main>
  );
}
