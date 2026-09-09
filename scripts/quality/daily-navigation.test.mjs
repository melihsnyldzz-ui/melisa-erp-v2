import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleModules, navigationSections, sidebarGroups } from '../../apps/web-admin/src/data/mockNavigationData.js';
import { roleViews } from '../../apps/web-admin/src/config/roleViews.js';

test('every commerce module opens a screen in the selected working view', () => {
  const commerceIds = navigationSections.flatMap(section => section.screenIds).filter(id => !id.startsWith('whatsapp-'));
  for (const role of roleViews) {
    const allowed = new Set(commerceIds.filter(id => !role.screenIds || role.screenIds.includes(id)));
    const visible = getVisibleModules(allowed);
    for (const module of visible) assert.ok(allowed.has(module.screenId), `${role.id}/${module.label}`);
    for (const id of allowed) {
      const section = navigationSections.find(section => section.screenIds.includes(id));
      assert.ok(visible.some(module => module.label === section.label), `${role.id}/${id} unreachable`);
    }
  }
});

test('nondefault-only and empty working views do not open unavailable default screens', () => {
  for (const id of ['supplier-list', 'collections-overview', 'import-foundation', 'purchase-invoice-list']) {
    const visible = getVisibleModules(new Set([id]));
    assert.equal(visible.length, 1);
    assert.equal(visible[0].screenId, id);
  }
  assert.deepEqual(getVisibleModules(new Set()), []);
});

test('commerce sidebar targets have a single entry and unambiguous module ownership', () => {
  const ids = sidebarGroups.flatMap(group => group.items.map(item => item.screenId)).filter(id => !id.startsWith('whatsapp-'));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(navigationSections.filter(section => section.screenIds.includes(id)).length, 1, id);
});
