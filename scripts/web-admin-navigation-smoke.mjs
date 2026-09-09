import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  modules,
  navigationSections,
  screenRegistry,
  sidebarGroups,
} from '../apps/web-admin/src/data/mockNavigationData.js';
import { roleViews } from '../apps/web-admin/src/config/roleViews.js';
import { getViewOptionItems } from '../apps/web-admin/src/config/viewOptions.js';
import { screenTypeLabel } from '../apps/web-admin/src/utils/screenLabels.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const workspacePath = resolve(repoRoot, 'apps/web-admin/src/components/workspace/Workspace.jsx');
const appShellPath = resolve(repoRoot, 'apps/web-admin/src/components/layout/AppShell.jsx');
const sidebarPath = resolve(repoRoot, 'apps/web-admin/src/components/navigation/Sidebar.jsx');
const navigationPath = resolve(repoRoot, 'apps/web-admin/src/data/mockNavigationData.js');

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

function extractObjectKeys(source, declarationName) {
  const pattern = new RegExp(`const\\s+${declarationName}\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = source.match(pattern);

  if (!match) return null;

  const keys = [];
  const keyPattern = /^\s*(?:'([^']+)'|([A-Za-z][\w-]*))\s*:/gm;
  let keyMatch = keyPattern.exec(match[1]);

  while (keyMatch) {
    keys.push(keyMatch[1] || keyMatch[2]);
    keyMatch = keyPattern.exec(match[1]);
  }

  return keys;
}

function normalizeNavigationKey(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

const registryIds = Object.keys(screenRegistry);
const registrySet = new Set(registryIds);
const routeIds = extractWorkspaceRouteIds();
const appShellSource = readFileSync(appShellPath, 'utf8');
const sidebarSource = readFileSync(sidebarPath, 'utf8');
const navigationSource = readFileSync(navigationPath, 'utf8');
const sidebarItems = screenIdsFromItems(sidebarGroups);
const sidebarScreenIds = new Set(sidebarItems.map((item) => item.screenId));
const sidebarGroupTitles = new Set(sidebarGroups.map((group) => group.title));
const moduleLabels = new Set(modules.map((item) => item.label));

addCheck('screenRegistry ids match object keys', registryIds.every((id) => screenRegistry[id]?.id === id));
addCheck('screenRegistry has no default dirty true', registryIds.every((id) => screenRegistry[id]?.dirty !== true));
addCheck('AppShell scopes dirty updates by tab id', appShellSource.includes('function updateTabDirty') || appShellSource.includes('const updateTabDirty'));
addCheck('AppShell preserves each open tab state while inactive', appShellSource.includes('tabs.map((tab) =>') && appShellSource.includes('<React.Activity') && appShellSource.includes("mode={tab.id === activeTab.id ? 'visible' : 'hidden'}"));
addCheck('each preserved tab reports dirty state to its own tab id', appShellSource.includes('activeTab={tab}') && appShellSource.includes('updateTabDirty(tab.id, isDirty)'));
addCheck('AppShell warns before browser unload when tabs are dirty', appShellSource.includes('beforeunload') && appShellSource.includes('hasDirtyTabs'));

const moduleMissing = modules.filter((item) => !registrySet.has(item.screenId));
addCheck('top modules resolve to screenRegistry', moduleMissing.length === 0, moduleMissing.map((item) => item.screenId).join(', '));

const registryModuleMissing = registryIds.filter((screenId) => !moduleLabels.has(screenRegistry[screenId].module)
  && screenRegistry[screenId].module !== 'Katalog'
  && screenRegistry[screenId].module !== 'Terminal'
  && screenRegistry[screenId].module !== 'Güvenlik');
addCheck('screenRegistry modules are known navigation areas', registryModuleMissing.length === 0, registryModuleMissing.map((screenId) => `${screenId}:${screenRegistry[screenId].module}`).join(', '));

const sidebarMissing = sidebarItems.filter((item) => !registrySet.has(item.screenId));
addCheck('sidebar items resolve to screenRegistry', sidebarMissing.length === 0, sidebarMissing.map((item) => `${item.group}/${item.label}:${item.screenId}`).join(', '));

const sectionScreenIds = navigationSections.flatMap((section) => section.screenIds);
const missingSectionScreens = sectionScreenIds.filter((screenId) => !registrySet.has(screenId));
const unmappedSidebarScreens = [...sidebarScreenIds].filter((screenId) => !sectionScreenIds.includes(screenId));
addCheck('navigation sections resolve to screenRegistry', missingSectionScreens.length === 0, missingSectionScreens.join(', '));
addCheck('sidebar screens belong to a navigation section', unmappedSidebarScreens.length === 0, unmappedSidebarScreens.join(', '));
addCheck('sidebar uses contextual module groups', sidebarSource.includes('contextualGroups'));
addCheck('sidebar has no duplicate favorites block', !sidebarSource.includes('favoriteScreens'));
addCheck('sidebar visible labels use valid Turkish text', ['Musteri', 'Tedarikci', 'Satis', 'Alis', 'Urun', 'Modul', 'Menude', 'baglanti yok', 'Hazir'].every((fragment) => !sidebarSource.includes(fragment)) && sidebarSource.includes('Modül Paneli') && sidebarSource.includes('Menüde ara'));
addCheck('navigation security labels use valid Turkish', screenRegistry['auth-overview'].label === 'Yetki ve Denetim' && !navigationSource.includes('GÃ'));
addCheck('technical screen types have Turkish display labels', screenTypeLabel('fis') === 'fiş'
  && screenTypeLabel('ozet') === 'özet'
  && screenTypeLabel('islem') === 'işlem'
  && screenTypeLabel('import') === 'aktarım');
addCheck('sidebar renders screen type through display formatter', sidebarSource.includes('screenTypeLabel(activeTab.type)'));
addCheck('screen type ids still preserve contextual view behavior', getViewOptionItems({ type: 'fis' }).some((item) => item.label === 'Fiş yardımcı alanları')
  && getViewOptionItems({ type: 'ozet' }).some((item) => item.label === 'Rapor özeti'));

const itemDisplayLabelKeys = extractObjectKeys(sidebarSource, 'itemDisplayLabels') || [];
const missingItemDisplayLabels = [...sidebarScreenIds].filter((screenId) => !itemDisplayLabelKeys.includes(screenId));
const orphanItemDisplayLabels = itemDisplayLabelKeys.filter((screenId) => !registrySet.has(screenId));
addCheck('sidebar visible items have display labels', missingItemDisplayLabels.length === 0, missingItemDisplayLabels.join(', '));
addCheck('sidebar item display labels resolve to screenRegistry', orphanItemDisplayLabels.length === 0, orphanItemDisplayLabels.join(', '));

const itemIconKeys = extractObjectKeys(sidebarSource, 'itemIcons') || [];
const missingItemIcons = [...sidebarScreenIds].filter((screenId) => !itemIconKeys.includes(screenId));
const orphanItemIcons = itemIconKeys.filter((screenId) => !registrySet.has(screenId));
addCheck('sidebar visible items have icons', missingItemIcons.length === 0, missingItemIcons.join(', '));
addCheck('sidebar item icons resolve to screenRegistry', orphanItemIcons.length === 0, orphanItemIcons.join(', '));

const groupDisplayLabelKeys = extractObjectKeys(sidebarSource, 'groupDisplayLabels') || [];
const groupIconKeys = extractObjectKeys(sidebarSource, 'groupIcons') || [];
const normalizedGroupTitles = [...sidebarGroupTitles].map(normalizeNavigationKey);
const missingGroupDisplayLabels = normalizedGroupTitles.filter((title) => !groupDisplayLabelKeys.includes(title));
const missingGroupIcons = normalizedGroupTitles.filter((title) => !groupIconKeys.includes(title));
addCheck('sidebar groups have display labels', missingGroupDisplayLabels.length === 0, missingGroupDisplayLabels.join(', '));
addCheck('sidebar groups have icons', missingGroupIcons.length === 0, missingGroupIcons.join(', '));

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
for (const item of sidebarItems) {
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
