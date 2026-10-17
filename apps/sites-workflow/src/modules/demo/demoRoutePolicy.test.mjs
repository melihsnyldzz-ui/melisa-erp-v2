import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function routes(source, start, end) {
  const body = source.split(start)[1].split(end)[0];
  const entries = [...body.matchAll(/^  (?:'([^']+)'|([a-z][\w-]*)): \{/gm)];
  return Object.fromEntries(entries.map((entry, index) => [entry[1] || entry[2],
    body.slice(entry.index, entries[index + 1]?.index ?? body.length)]));
}

test('demo route permissions and denial messages stay aligned with the local workspace', () => {
  const local = routes(read('../../components/workspace/Workspace.jsx'), 'const workspaceRouteRegistry = {', '\n};');
  const demo = routes(read('./demoRoutePolicy.js'), 'export const demoRoutePolicy = {', '\n};');
  assert.equal(Object.keys(local).length, 55);
  assert.deepEqual(Object.keys(demo), Object.keys(local));
  for (const [id, source] of Object.entries(local)) {
    const copy = demo[id];
    for (const field of ['permissionKeys', 'unauthorizedMessage']) {
      assert.equal(copy.match(new RegExp(`${field}: ([^\\n]+),`))?.[1], source.match(new RegExp(`${field}: ([^\\n]+),`))?.[1], `${id}: ${field}`);
    }
    assert.equal(copy.match(/permissionMode: ([^\n]+),/)?.[1], source.match(/permissionMode: ([^\n]+),/)?.[1] ?? "'any'", `${id}: permissionMode`);
  }
});

test('the separate demo dispatcher covers precisely the connected screens', () => {
  const workspace = read('../../components/workspace/DemoWorkspace.jsx');
  const connected = read('./ConnectedReadWorkspace.jsx').match(/export const connectedReadScreens = new Set\(\[([\s\S]*?)\]\)/)[1];
  const operation = read('./OperationsWorkspace.jsx');
  const kinds = operation.match(/const routeKinds=\{([^}]+)\}/)[1];
  const salesOrders = operation.match(/const salesOrderScreens=new Set\(\[([^\]]+)\]\)/)[1];
  const ids = source => [...source.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const demoOperations = workspace.match(/const operationScreens = new Set\(\[([\s\S]*?)\]\)/)[1];
  const demoReads = workspace.match(/const connectedReadScreens = new Set\(\[([\s\S]*?)\]\)/)[1];
  const sourceOperations = ['dashboard', 'stock-list', 'customer-list', 'supplier-list', 'reports-overview', ...[...kinds.matchAll(/'([^']+)':/g)].map(match => match[1]), ...ids(salesOrders)];
  assert.deepEqual(new Set(ids(demoOperations)), new Set(sourceOperations));
  assert.deepEqual(new Set(ids(demoReads)), new Set(ids(connected)));
});
