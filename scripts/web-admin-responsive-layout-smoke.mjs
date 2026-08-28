import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');
const styles = read('apps/web-admin/src/styles/responsive-layout-hardening.css');
const main = read('apps/web-admin/src/main.jsx');
const topMenu = read('apps/web-admin/src/components/navigation/TopMenu.jsx');

const checks = [
  ['responsive hardening stylesheet is loaded last', main.includes("import './styles/responsive-layout-hardening.css';")],
  ['shell and workspace have zero minimum width guards', styles.includes('.work-area > *') && styles.includes('min-width: 0;')],
  ['tables scroll inside their own wrappers', styles.includes('.invoice-table-wrap') && styles.includes('overflow-x: auto;')],
  ['1280 layout removes duplicate view presets', styles.includes('@media (max-width: 1280px)') && styles.includes('.top-actions > .view-preset-button')],
  ['1280 top actions use five stable tracks', styles.includes('minmax(410px, 440px)') && styles.includes('minmax(62px, 76px)')],
  ['compact module rail keeps every module icon visible', styles.includes('.module-menu .module-label') && styles.includes('flex: 0 0 38px;')],
  ['1100 layout removes secondary new invoice action', styles.includes('@media (max-width: 1100px)') && styles.includes('.top-actions > .top-primary-action')],
  ['bulk purchase entry collapses to three and two columns', styles.includes('repeat(3, minmax(0, 1fr))') && styles.includes('repeat(2, minmax(0, 1fr))')],
  ['bulk purchase add action spans compact form width', styles.includes('.bulk-purchase-screen .bulk-purchase-entry-grid > button') && styles.includes('grid-column: 1 / -1;')],
  ['compact desktop sidebar has a smaller fallback', styles.includes('@media (max-width: 900px)') && styles.includes('--erp-sidebar-width: 184px;')],
  ['compact module icons retain accessible names and tooltips', topMenu.includes('aria-label={module.label}') && topMenu.includes('title={module.label}')],
  ['form controls cannot exceed their panels', styles.includes('.work-area textarea') && styles.includes('max-width: 100%;')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - Responsive layout / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
