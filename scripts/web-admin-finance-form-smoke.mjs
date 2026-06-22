import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const workspacePath = resolve(repoRoot, 'apps/web-admin/src/components/workspace/Workspace.jsx');
const collectionsPath = resolve(repoRoot, 'apps/web-admin/src/modules/finance/CollectionsOverviewScreen.jsx');

const workspaceSource = readFileSync(workspacePath, 'utf8');
const collectionsSource = readFileSync(collectionsPath, 'utf8');
const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

addCheck(
  'collections route passes dirty callback',
  workspaceSource.includes('onDirtyChange={onDirtyChange}') && workspaceSource.includes('<CollectionsOverviewScreen'),
);
addCheck(
  'collections screen accepts dirty callback',
  collectionsSource.includes('export function CollectionsOverviewScreen({ initialPayload, onDirtyChange, onOpenScreen })'),
);
addCheck(
  'collections screen stores dirty state',
  collectionsSource.includes('const [isDirty, setIsDirty] = useState(false);'),
);
addCheck(
  'collections screen reports dirty changes',
  collectionsSource.includes('onDirtyChange?.(isDirty)') && collectionsSource.includes('[isDirty, onDirtyChange]'),
);
addCheck(
  'collections user edits mark form dirty',
  collectionsSource.includes('function updateField(key, value)') && collectionsSource.includes('setIsDirty(true);'),
);
addCheck(
  'collections save and mode reset clear dirty state',
  (collectionsSource.match(/setIsDirty\(false\);/g) || []).length >= 2,
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
