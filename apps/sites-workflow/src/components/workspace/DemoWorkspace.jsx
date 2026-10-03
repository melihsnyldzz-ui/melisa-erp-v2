import React, { lazy, Suspense } from 'react';
import { demoRoleCanOpen, demoRolePermissions } from '../../config/demoRolePolicy.js';
import { demoRoutePolicy } from '../../modules/demo/demoRoutePolicy.js';
import { DemoStoreGate } from '../../modules/demo/DemoStoreGate.jsx';
import { UnauthorizedScreen } from '../auth/UnauthorizedScreen.jsx';
import { apiConfig } from '../../config/apiConfig.js';

const ManagementWorkspace = lazy(() => import('../../modules/demo/ManagementWorkspace.jsx').then(module => ({ default: module.ManagementWorkspace })));
const OperationsWorkspace = lazy(() => import('../../modules/demo/OperationsWorkspace.jsx').then(module => ({ default: module.OperationsWorkspace })));
const ConnectedReadWorkspace = lazy(() => import('../../modules/demo/ConnectedReadWorkspace.jsx').then(module => ({ default: module.ConnectedReadWorkspace })));
const TerminalWorkspace = lazy(() => import('../../modules/demo/TerminalWorkspace.jsx').then(module => ({ default: module.TerminalWorkspace })));
const ReportsWorkspace = lazy(() => import('../../modules/demo/ReportsWorkspace.jsx').then(module => ({ default: module.ReportsWorkspace })));
const VegaProductsGate = lazy(() => import('../../modules/vega/VegaProductsGate.jsx').then(module => ({ default: module.VegaProductsGate })));

const operationScreens = new Set([
  'dashboard', 'stock-list', 'customer-list', 'supplier-list', 'reports-overview',
  'inventory-receipt-list', 'purchase-invoice-list', 'purchase-invoice',
  'sales-invoice-list', 'sales-invoice', 'stock-count', 'cash-register',
  'cash-bank-ledger', 'collections-overview', 'sales-offers', 'sales-offer',
  'sales-orders', 'sales-order',
]);
const connectedReadScreens = new Set([
  'product-card', 'customer-card', 'supplier-card', 'stock-movements',
  'customer-movements', 'customer-statement', 'supplier-movements',
  'supplier-statement', 'price-list', 'stock-valuation', 'finance-overview',
  'accounting-journal', 'cash-customers',
]);

export function DemoWorkspace({ activeTab, onDirtyChange, onOpenScreen, permissions = [], roleViewId = 'yonetici' }) {
  const screenId = activeTab.screenId ?? activeTab.id;
  if (!demoRoleCanOpen(roleViewId, screenId)) return <UnauthorizedScreen message="Bu ekran seçili görev rolüne açık değil." />;
  const route = demoRoutePolicy[screenId];
  if (!route) return <main className="work-area"><section className="erp-panel" role="alert">Ekran bağlı değil: {activeTab.label || screenId}</section></main>;
  const allowed = demoRolePermissions(permissions, roleViewId);
  if (route.permissionMode === 'all'
    ? !route.permissionKeys.every(key => allowed.includes(key))
    : !route.permissionKeys.some(key => allowed.includes(key))) {
    return <UnauthorizedScreen message={route.unauthorizedMessage} />;
  }

  let content;
  if (apiConfig.vegaProductsMode && (screenId === 'stock-list' || (screenId === 'product-card' && activeTab.payload?.vegaSourceId))) content = <VegaProductsGate screenId={screenId} payload={activeTab.payload} onOpenScreen={onOpenScreen} />;
  else if (screenId === 'settings-overview') content = <ManagementWorkspace roleViewId={roleViewId} onOpenScreen={onOpenScreen} />;
  else if (screenId === 'reports-overview') content = <ReportsWorkspace onOpenScreen={onOpenScreen} />;
  else if (screenId === 'terminal-overview') content = <TerminalWorkspace onDirtyChange={onDirtyChange} roleViewId={roleViewId} onOpenScreen={onOpenScreen} />;
  else if (operationScreens.has(screenId)) content = <OperationsWorkspace screenId={screenId} payload={activeTab.payload} permissions={allowed} roleViewId={roleViewId} onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen} />;
  else if (connectedReadScreens.has(screenId)) content = <ConnectedReadWorkspace screenId={screenId} payload={activeTab.payload} permissions={allowed} onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen} />;
  else content = <main className="work-area"><section className="erp-panel"><h1>{activeTab.label || screenId}</h1><p>Bu işlevin bağlı demo veri kaynağı henüz tamamlanmadı. Eski örnek kayıtlar gerçek işlem sonucu gibi gösterilmiyor.</p><p>İlgili iş akışı sonraki çalışma paketinde bağlanacak.</p></section></main>;
  return <DemoStoreGate><Suspense fallback={<main className="work-area"><section className="erp-panel" role="status">Ekran yükleniyor…</section></main>}>
    {content}
  </Suspense></DemoStoreGate>;
}
