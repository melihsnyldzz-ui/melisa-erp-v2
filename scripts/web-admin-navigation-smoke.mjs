import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { modules, navigationSections, screenRegistry, sidebarGroups } from '../apps/web-admin/src/data/mockNavigationData.js';
import { roleViews } from '../apps/web-admin/src/config/roleViews.js';
import { getViewOptionItems } from '../apps/web-admin/src/config/viewOptions.js';
import { screenTypeLabel } from '../apps/web-admin/src/utils/screenLabels.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, 'apps/web-admin/src', path), 'utf8');
const workspaceSource = read('components/workspace/Workspace.jsx');
const appShellSource = read('components/layout/AppShell.jsx');
const sidebarSource = read('components/navigation/Sidebar.jsx');
const navigationSource = read('data/mockNavigationData.js');
const checks = [];
const addCheck = (name, ok, detail = '') => checks.push({ name, ok, detail });
const registryIds = Object.keys(screenRegistry);
const registrySet = new Set(registryIds);
const sidebarItems = sidebarGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })));
const sidebarIds = new Set(sidebarItems.map((item) => item.screenId));
const moduleLabels = new Set(modules.map((item) => item.label));
const sectionIds = navigationSections.flatMap((section) => section.screenIds);

function objectKeys(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  if (!match) return [];
  return [...match[1].matchAll(/^\s*(?:'([^']+)'|([A-Za-z][\w-]*))\s*:/gm)].map((item) => item[1] || item[2]);
}

addCheck('screenRegistry ids match object keys', registryIds.every((id) => screenRegistry[id].id === id));
addCheck('screenRegistry has no default dirty true', registryIds.every((id) => screenRegistry[id].dirty !== true));
addCheck('AppShell scopes dirty updates by tab id', appShellSource.includes('function updateTabDirty') || appShellSource.includes('const updateTabDirty'));
addCheck('AppShell preserves each open tab state while inactive', appShellSource.includes('tabs.map((tab) =>') && appShellSource.includes('<React.Activity') && appShellSource.includes("mode={tab.id === activeTab.id ? 'visible' : 'hidden'}"));
addCheck('each preserved tab reports dirty state to its own tab id', appShellSource.includes('activeTab={tab}') && appShellSource.includes('updateTabDirty(tab.id, isDirty)'));
addCheck('AppShell warns before browser unload when tabs are dirty', appShellSource.includes('beforeunload') && appShellSource.includes('hasDirtyTabs'));
addCheck('top modules resolve to screenRegistry', modules.every((item) => registrySet.has(item.screenId)));
addCheck('screenRegistry modules are known navigation areas', registryIds.every((id) => moduleLabels.has(screenRegistry[id].module) || ['Katalog','Terminal','Güvenlik'].includes(screenRegistry[id].module)));
addCheck('sidebar items resolve to screenRegistry', sidebarItems.every((item) => registrySet.has(item.screenId)));
addCheck('navigation sections resolve to screenRegistry', sectionIds.every((id) => registrySet.has(id)));
addCheck('sidebar screens belong to a navigation section', [...sidebarIds].every((id) => sectionIds.includes(id)));
addCheck('sidebar uses contextual module groups', sidebarSource.includes('contextualGroups'));
addCheck('sidebar has no duplicate favorites block', !sidebarSource.includes('favoriteScreens'));
addCheck('sidebar visible labels use valid Turkish text', ['Musteri','Tedarikci','Satis','Alis','Urun','Modul','Menude','baglanti yok','Hazir'].every((fragment) => !sidebarSource.includes(fragment)) && sidebarSource.includes('Menüde ara'));
addCheck('navigation security module has no mojibake', navigationSource.includes("module: 'Güvenlik'") && !navigationSource.includes('GÃ'));
addCheck('technical screen types have Turkish display labels', screenTypeLabel('fis') === 'fiş' && screenTypeLabel('ozet') === 'özet' && screenTypeLabel('islem') === 'işlem' && screenTypeLabel('import') === 'aktarım');
addCheck('sidebar renders screen type through display formatter', sidebarSource.includes('screenTypeLabel(activeTab.type)'));
addCheck('screen type ids still preserve contextual view behavior', getViewOptionItems({ type: 'fis' }).some((item) => item.label === 'Fiş yardımcı alanları') && getViewOptionItems({ type: 'ozet' }).some((item) => item.label === 'Rapor özeti'));
// Labels now have one owner: navigation data. Do not require a duplicate display-label map.
addCheck('sidebar visible items have canonical labels', sidebarItems.every((item) => typeof item.label === 'string' && item.label.trim().length > 0) && sidebarSource.includes('{item.label}'));
const iconKeys = objectKeys(sidebarSource, 'itemIcons');
addCheck('sidebar visible items have icons', [...sidebarIds].every((id) => iconKeys.includes(id)));
addCheck('sidebar item icons resolve to screenRegistry', iconKeys.every((id) => registrySet.has(id)));
const groupIconKeys = objectKeys(sidebarSource, 'groupIcons');
addCheck('sidebar groups have canonical labels', sidebarGroups.every((group) => typeof group.title === 'string' && group.title.trim().length > 0) && sidebarSource.includes('{group.title}'));
addCheck('sidebar groups have icons', sidebarGroups.every((group) => groupIconKeys.includes(group.title)));
addCheck('role view screen ids resolve to screenRegistry', roleViews.every((role) => (role.screenIds || []).every((id) => registrySet.has(id))));

const start = workspaceSource.indexOf('const workspaceRouteRegistry = {');
const end = workspaceSource.indexOf('export function Workspace', start);
const registrySource = start >= 0 && end >= 0 ? workspaceSource.slice(start, end) : '';
const routeIds = new Set([...registrySource.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z][\w-]*)):\s*\{/gm)].map((item) => item[1] || item[2]));
addCheck('workspace route registry is present', routeIds.size > 0, `${routeIds.size} routes`);
addCheck('screenRegistry ids have Workspace routes', registryIds.every((id) => routeIds.has(id)));
addCheck('Workspace routes resolve to screenRegistry', [...routeIds].every((id) => registrySet.has(id)));
addCheck('sidebar has no duplicate destinations', sidebarItems.length === sidebarIds.size);
addCheck('retired demo is absent from operational menus', !sidebarIds.has('fedex-micro-export-demo') && screenRegistry['fedex-micro-export-demo']?.hiddenFromNavigation === true);
addCheck('workspace permission gate remains present', workspaceSource.includes('hasRoutePermission') && workspaceSource.includes('<UnauthorizedScreen'));

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} - Web Admin / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
const failed = checks.filter((check) => !check.ok);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
