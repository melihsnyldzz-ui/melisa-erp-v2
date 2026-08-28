import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const screen = read('apps/web-admin/src/modules/finance/CollectionsOverviewScreen.jsx');
const form = read('apps/web-admin/src/modules/finance/CollectionsEntryForm.jsx');
const history = read('apps/web-admin/src/modules/finance/CollectionsHistoryTable.jsx');
const styles = read('apps/web-admin/src/styles/finance-entry-ux.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['summary cards are removed from the primary entry flow', !screen.includes('collections-stat-grid')],
  ['collection and payment modes remain separate', screen.includes("switchMode('collection')") && screen.includes("switchMode('payment')")],
  ['party search uses shared Turkish normalization', screen.includes('normalizeSearchText') && screen.includes('updatePartyQuery')],
  ['party and amount remain in the primary form', form.includes('collections-core-form') && form.includes('collections-party-field') && form.includes('amount-field')],
  ['secondary fields are collapsible', form.includes('collections-entry-details') && form.includes('İşlem ayrıntıları')],
  ['save remains guarded by existing canSubmit state', form.includes('disabled={!canSubmit}')],
  ['balance preview remains visible before save', form.includes('finance-effect-flow') && form.includes('nextBalance')],
  ['history table is reduced to six columns', (history.match(/<th>/g) || []).length === 6],
  ['receipt and ledger navigation remain available', history.includes('onSelectReceipt(row)') && history.includes('onOpenMovement(row)')],
  ['finance UX stylesheet loads after invoice styles', main.includes("import './styles/finance-entry-ux.css';")],
  ['primary form has stable responsive tracks', styles.includes('.collections-core-form') && styles.includes('@media (max-width: 980px)')],
  ['compact desktop stacks the preview safely', styles.includes('@media (max-width: 1450px)') && styles.includes('grid-template-columns: 1fr !important')],
];

const failed = checks.filter(([, ok]) => !ok);

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - Finance Entry UX / ${name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
