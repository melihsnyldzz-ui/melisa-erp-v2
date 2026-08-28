import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const styles = read('apps/web-admin/src/styles/workspace-visual-hierarchy.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['global hierarchy stylesheet loads last', main.indexOf("import './styles/workspace-visual-hierarchy.css';") > main.indexOf("import './styles/responsive-layout-hardening.css';")],
  ['workspace uses layered background and panel borders', styles.includes('--workspace-bg') && styles.includes('--workspace-panel-border')],
  ['panel titles and toolbars are visually separated', styles.includes('.panel-title') && styles.includes('.dashboard-toolbar')],
  ['tables use stronger headers zebra rows and selected state', styles.includes('--workspace-table-head') && styles.includes('nth-child(even)') && styles.includes('tr.selected td')],
  ['form controls receive visible focus treatment', styles.includes('input:focus') && styles.includes('rgba(15, 118, 110, 0.13)')],
  ['WhatsApp CRM keeps its dedicated theme', styles.includes(':not(.whatsapp-crm-screen)')],
  ['dark mode has matching hierarchy tokens', styles.includes('.dark-mode-shell') && styles.includes('--workspace-selected: #164e48')],
  ['mobile spacing remains compact', styles.includes('@media (max-width: 760px)')],
];

const failed = checks.filter(([, ok]) => !ok);

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - Global Visual Hierarchy / ${name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
