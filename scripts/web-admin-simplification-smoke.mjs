import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  modules, sidebarGroups, navigationSections, screenRegistry, initialTabs,
  getNavigationSection, getModulesForRole,
} from '../apps/web-admin/src/data/mockNavigationData.js';
import { buildScreenCommands } from '../apps/web-admin/src/utils/navigationCommands.js';

const read = (path) => readFileSync(new URL(`../apps/web-admin/src/${path}`, import.meta.url), 'utf8');
const sidebarIds = sidebarGroups.flatMap((group) => group.items.map((item) => item.screenId));
const preservedIds = [
  'dashboard','operational-health','stock-list','product-card','bulk-product-create','price-list','stock-movements','stock-valuation','stock-count',
  'customer-list','customer-card','customer-movements','customer-statement','supplier-list','supplier-card','vega-koli-movements','supplier-movements','supplier-statement',
  'sales-invoice','vega-supplier-movements','sales-invoice-list','sales-offers','sales-offer','fedex-micro-export-demo','sales-orders','sales-order',
  'purchase-invoice','bulk-purchase-entry','purchase-invoice-list','finance-overview','collections-overview','proforma-invoice','cash-customers','cash-register',
  'cash-bank-ledger','accounting-journal','accounting-control','catalog-list','whatsapp-planner','whatsapp-web-queue','whatsapp-crm-inbox','terminal-overview','import-foundation',
  'reports-overview','vega-sales-comparison','vega-sales-performance','vega-product-profitability','export-center','definitions-overview','personnel-definitions',
  'settings-overview','currency-rates','auth-overview','audit-log',
];

test('Eight business modules replace eleven top-level entries', () => {
  assert.deepEqual(modules.map((item) => item.label), ['Ana Sayfa','Stok','Cariler','Satış','Alış','Finans','Raporlar','Ayarlar']);
});
test('All original registry IDs are preserved', () => {
  assert.deepEqual(Object.keys(screenRegistry).sort(), [...preservedIds].sort());
});
test('Every sidebar target exists and is unique', () => {
  assert.equal(new Set(sidebarIds).size, sidebarIds.length);
  sidebarIds.forEach((id) => assert.ok(screenRegistry[id], id));
});
test('Every registry entry belongs to exactly one navigation section', () => {
  preservedIds.forEach((id) => assert.equal(navigationSections.filter((section) => section.screenIds.includes(id)).length, 1, id));
});
test('Top-level targets are registered in their own section', () => {
  modules.forEach((item) => assert.equal(getNavigationSection(item.screenId).label, item.label));
});
test('Existing pinned dashboard remains unchanged', () => {
  assert.equal(initialTabs[0].id, 'dashboard'); assert.equal(initialTabs[0].pinned, true);
});
test('FedEx demo leaves operational navigation and command search without deleting its route', () => {
  assert.ok(screenRegistry['fedex-micro-export-demo']);
  assert.equal(sidebarIds.includes('fedex-micro-export-demo'), false);
  assert.equal(buildScreenCommands().some((item) => item.screenId === 'fedex-micro-export-demo'), false);
});
test('Record cards stay reachable but do not duplicate list menus', () => {
  ['product-card','customer-card','supplier-card'].forEach((id) => {
    assert.ok(screenRegistry[id]); assert.equal(sidebarIds.includes(id), false);
    assert.ok(buildScreenCommands().some((item) => item.screenId === id));
  });
});
test('Customer and supplier screens are grouped under Cariler', () => {
  ['customer-list','customer-card','supplier-list','supplier-card'].forEach((id) => assert.equal(getNavigationSection(id).label, 'Cariler'));
});
test('Terminal monitoring, import and health remain available under settings', () => {
  ['terminal-overview','import-foundation','operational-health','audit-log','auth-overview'].forEach((id) => {
    assert.ok(sidebarIds.includes(id)); assert.equal(getNavigationSection(id).label, 'Ayarlar');
  });
});
test('CRM and catalog remain available under auxiliary applications', () => {
  const group = sidebarGroups.find((item) => item.title === 'Ek Uygulamalar');
  ['whatsapp-crm-inbox','catalog-list','whatsapp-planner','whatsapp-web-queue'].forEach((id) => {
    assert.ok(group.items.some((item) => item.screenId === id)); assert.equal(getNavigationSection(id).label, 'Ayarlar');
  });
});
test('Finance ledgers and controls are not deleted as visual clutter', () => {
  ['collections-overview','cash-register','cash-bank-ledger','accounting-journal','accounting-control'].forEach((id) => assert.ok(sidebarIds.includes(id)));
});
test('Command palette deduplicates by destination rather than label', () => {
  const commands = buildScreenCommands();
  assert.equal(commands.length, new Set(commands.map((item) => item.screenId)).size);
  assert.equal(commands[0].screenId, 'sales-invoice');
});
test('Vega data source is explicit on known stock/sales/purchase list shortcuts', () => {
  ['stock-list','sales-invoice-list','purchase-invoice-list'].forEach((id) => {
    assert.match(buildScreenCommands().find((item) => item.screenId === id).label, /Vega/);
  });
});
test('Restricted supplier view opens an available supplier destination', () => {
  const result = getModulesForRole(new Set(['supplier-list']));
  assert.deepEqual(result, [{ label: 'Cariler', screenId: 'supplier-list' }]);
});
test('Empty role view does not expose top-level modules', () => assert.deepEqual(getModulesForRole(new Set()), []));
test('Unrestricted view retains all eight modules', () => assert.deepEqual(getModulesForRole(null), modules));
test('Retired demo alone cannot expose a settings module', () => assert.deepEqual(getModulesForRole(new Set(['fedex-micro-export-demo'])), []));
test('Static shortcuts no longer claim observed stock/health results', () => {
  const text = read('components/layout/SmartInsightsPanel.jsx');
  for (const phrase of ['Eksi stok yok','Stok kontrolü temiz','Finans özeti hazır']) assert.equal(text.includes(phrase), false);
  assert.match(text, /canlı analiz veya sistem sağlığı sonucu göstermez/);
});
test('Session chrome no longer claims database connectivity from demo flag', () => {
  const sidebar = read('components/navigation/Sidebar.jsx');
  const status = read('components/layout/StatusBar.jsx');
  assert.equal(status.includes('Bağlantı açık'), false);
  assert.equal(status.includes("user.role.name"), false);
  assert.match(status, /Bu çubukta doğrulanmıyor/);
  assert.match(sidebar, /Veri bağlantısı bu panelde ölçülmez/);
  assert.equal(sidebar.includes('<small>Hazır</small>'), false);
});
