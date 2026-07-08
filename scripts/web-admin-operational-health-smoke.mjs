import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { screenRegistry, sidebarGroups } from '../apps/web-admin/src/data/mockNavigationData.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const workspaceSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/workspace/Workspace.jsx'), 'utf8');
const screenSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/operations/OperationalHealthScreen.jsx'), 'utf8');
const serviceSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/services/monitoringApi.js'), 'utf8');
const systemRoutesSource = readFileSync(resolve(repoRoot, 'apps/api/src/routes/systemRoutes.js'), 'utf8');
const packageSource = readFileSync(resolve(repoRoot, 'apps/web-admin/package.json'), 'utf8');
const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

const sidebarItems = sidebarGroups.flatMap((group) => group.items.map((item) => ({
  group: group.title,
  screenId: item.screenId,
})));

addCheck('screen registry contains operational health', screenRegistry['operational-health']?.label === 'Operasyon Sağlığı');
addCheck('sidebar exposes operational health under operations', sidebarItems.some((item) => item.group === 'Operasyon' && item.screenId === 'operational-health'));
addCheck('workspace route renders operational health screen', workspaceSource.includes("'operational-health':") && workspaceSource.includes('<OperationalHealthScreen />'));
addCheck('workspace route requires audit view', /'operational-health':\s*\{[\s\S]*?permissionKeys:\s*\['audit\.view'\]/.test(workspaceSource));
addCheck('backend monitoring summary requires audit view', systemRoutesSource.includes("requirePermission('audit.view')") && systemRoutesSource.includes("systemRoutes.get('/monitoring/summary'"));
addCheck('web client reads monitoring summary endpoint', serviceSource.includes("get('/api/monitoring/summary')"));
addCheck('screen shows read-only boundary', screenSource.includes('DB write, migration, reset, restore') && screenSource.includes('WhatsApp gonderimi baslatmaz'));
addCheck('screen shows failed sync metric', screenSource.includes('failedSyncCount') && screenSource.includes('Terminal queue failed'));
addCheck('screen shows import and finalize visibility notes', screenSource.includes('imports?.note') && screenSource.includes('finalize?.note'));
addCheck('screen does not call write methods', !/\b(post|put|patch)\s*\(/.test(screenSource) && !/from '..\/..\/services\/.*Api\.js';[\s\S]*(post|put|patch)/.test(screenSource));
addCheck('package exposes operational health smoke', packageSource.includes('"smoke:operational-health"'));

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Web Admin / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
