import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { modules, screenRegistry, sidebarGroups } from '../apps/web-admin/src/data/mockNavigationData.js';
import { roleViews } from '../apps/web-admin/src/config/roleViews.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const workspacePath = resolve(repoRoot, 'apps/web-admin/src/components/workspace/Workspace.jsx');
const appShellPath = resolve(repoRoot, 'apps/web-admin/src/components/layout/AppShell.jsx');

const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function screenIdsFromItems(groups) {
  return groups.flatMap((group) => (group.items || []).map((item) => ({
    group: group.title,
    label: item.label,
    screenId: item.screenId,
  })));
}

function extractWorkspaceRouteIds() {
  const source = readFileSync(workspacePath, 'utf8');
  const start = source.indexOf('const workspaceRouteRegistry = {');
  const end = source.indexOf('export function Workspace', start);

  if (start < 0 || end < 0) {
    return null;
  }

  const registrySource = source.slice(start, end);
  const routeIds = new Set();
  const routePattern = /^\s{2}(?:'([^']+)'|([A-Za-z][\w-]*)):\s*\{/gm;
  let match = routePattern.exec(registrySource);

  while (match) {
    routeIds.add(match[1] || match[2]);
    match = routePattern.exec(registrySource);
  }

  return routeIds;
}

const registryIds = Object.keys(screenRegistry);
const registrySet = new Set(registryIds);
const routeIds = extractWorkspaceRouteIds();
const appShellSource = readFileSync(appShellPath, 'utf8');

addCheck('screenRegistry ids match object keys', registryIds.every((id) => screenRegistry[id]?.id === id));
addCheck('screenRegistry has no default dirty true', registryIds.every((id) => screenRegistry[id]?.dirty !== true));
addCheck('AppShell scopes dirty updates by tab id', appShellSource.includes('function updateTabDirty') || appShellSource.includes('const updateTabDirty'));
addCheck('AppShell warns before browser unload when tabs are dirty', appShellSource.includes('beforeunload') && appShellSource.includes('hasDirtyTabs'));

const moduleMissing = modules.filter((item) => !registrySet.has(item.screenId));
addCheck('top modules resolve to screenRegistry', moduleMissing.length === 0, moduleMissing.map((item) => item.screenId).join(', '));

const sidebarMissing = screenIdsFromItems(sidebarGroups).filter((item) => !registrySet.has(item.screenId));
addCheck('sidebar items resolve to screenRegistry', sidebarMissing.length === 0, sidebarMissing.map((item) => `${item.group}/${item.label}:${item.screenId}`).join(', '));

const roleMissing = roleViews.flatMap((roleView) => (
  (roleView.screenIds || [])
    .filter((screenId) => !registrySet.has(screenId))
    .map((screenId) => `${roleView.id}:${screenId}`)
));
addCheck('role view screen ids resolve to screenRegistry', roleMissing.length === 0, roleMissing.join(', '));

if (!routeIds) {
  addCheck('workspace route registry is present', false, workspacePath);
} else {
  addCheck('workspace route registry is present', true, `${routeIds.size} routes`);
  const missingRoutes = registryIds.filter((screenId) => !routeIds.has(screenId));
  const orphanRoutes = [...routeIds].filter((screenId) => !registrySet.has(screenId));
  addCheck('screenRegistry ids have Workspace routes', missingRoutes.length === 0, missingRoutes.join(', '));
  addCheck('Workspace routes resolve to screenRegistry', orphanRoutes.length === 0, orphanRoutes.join(', '));
}

const duplicateLabels = new Map();
for (const item of screenIdsFromItems(sidebarGroups)) {
  const key = `${item.group}/${item.label}/${item.screenId}`;
  duplicateLabels.set(key, (duplicateLabels.get(key) || 0) + 1);
}
const duplicateItems = [...duplicateLabels.entries()].filter(([, count]) => count > 1);
addCheck('sidebar has no duplicate menu rows', duplicateItems.length === 0, duplicateItems.map(([key]) => key).join(', '));

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  const status = check.ok ? 'PASS' : 'FAIL';
  const detail = check.detail ? ` - ${check.detail}` : '';
  console.log(`${status} - Web Admin / ${check.name}${detail}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
