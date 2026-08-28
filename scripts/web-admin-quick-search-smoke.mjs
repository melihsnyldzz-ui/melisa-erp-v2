import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const paletteSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/layout/CommandPalette.jsx'), 'utf8');
const serviceSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/services/quickSearchApi.js'), 'utf8');
const appShellSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/layout/AppShell.jsx'), 'utf8');

const checks = [
  ['Ctrl+K opens the palette', appShellSource.includes("event.key.toLocaleLowerCase('tr-TR') === 'k'")],
  ['search is read-only', !serviceSource.match(/\b(post|put|patch|remove|del)\s*\(/)],
  ['products are searched', serviceSource.includes('fetchProducts') && serviceSource.includes("screenId: 'product-card'")],
  ['customers are searched', serviceSource.includes('fetchCustomers') && serviceSource.includes("screenId: 'customer-card'")],
  ['suppliers are searched', serviceSource.includes('fetchSuppliers') && serviceSource.includes("screenId: 'supplier-card'")],
  ['sales invoices are searched', serviceSource.includes('fetchSalesDrafts') && serviceSource.includes("screenId: 'sales-invoice'")],
  ['purchase invoices are searched', serviceSource.includes('fetchPurchaseDrafts') && serviceSource.includes("screenId: 'purchase-invoice'")],
  ['partial API failures are tolerated', serviceSource.includes('Promise.allSettled') && serviceSource.includes('failedSources')],
  ['record payload opens the correct tab', paletteSource.includes("onOpenScreen(command.screenId, command.payload || {})")],
  ['result keys distinguish alternate screen labels', paletteSource.includes("-${command.label}`}")],
  ['remote search is debounced', paletteSource.includes('}, 250)')],
  ['stale remote results are rejected', paletteSource.includes('searchSequenceRef.current !== sequence')],
  ['keyboard navigation remains available', ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].every((key) => paletteSource.includes(key))],
];

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} - Quick Search / ${name}`);
}

const failed = checks.filter(([, passed]) => !passed);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
