import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as personnelModel from './personnelManagementModel.mjs';
import { normalizeSearchText } from '../../utils/searchText.js';

const { transformSync } = createRequire(import.meta.url)('esbuild');
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
const same = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));

// Existing component-fixture pattern: render actual JSX and call its handlers;
// only React hooks and the lowest HTTP boundary are in-memory substitutes.
function hooks() {
  const slots = [];
  let cursor = 0, dirty = false, effects = [];
  return {
    api: {
      useState(initial) {
        const index = cursor++;
        if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, value => {
          const next = typeof value === 'function' ? value(slots[index].value) : value;
          if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
        }];
      },
      useMemo(factory, dependencies) {
        const index = cursor++;
        if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { dependencies, value: factory() };
        return slots[index].value;
      },
      useEffect(effect, dependencies) {
        const index = cursor++, previous = slots[index];
        if (!previous || !same(previous.dependencies, dependencies)) {
          effects.push({ index, effect, cleanup: previous?.cleanup });
          slots[index] = { dependencies, cleanup: previous?.cleanup };
        }
      },
    },
    start() { cursor = 0; dirty = false; effects = []; },
    finish() { for (const item of effects) { item.cleanup?.(); slots[item.index].cleanup = item.effect(); } return dirty; },
  };
}
function nodes(tree, predicate, result = []) {
  if (Array.isArray(tree)) tree.forEach(child => nodes(child, predicate, result));
  else if (tree && typeof tree === 'object') {
    if (predicate(tree)) result.push(tree);
    nodes(tree.props?.children, predicate, result);
  }
  return result;
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join(' ').replace(/\s+/g, ' ').trim();
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function loadModule(relative, imports) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(readFileSync(new URL(relative, import.meta.url), 'utf8'), { loader: relative.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code, {
    module, exports: module.exports,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected fixture dependency: ${name}`); return imports[name]; },
  });
  return module.exports;
}
function overview() {
  const roles = [
    { id: 2, code: 'admin', name: 'Existing admin', isActive: true },
    { id: 28, code: 'clean_test_administrator', name: 'Protected manager', isActive: true },
    { id: 20, code: 'terminal_user', name: 'Old role', isActive: true },
    { id: 30, code: 'personal_operations', name: 'Personal operations', isActive: true },
    { id: 31, code: 'personal_manager', name: 'Personal manager', isActive: true },
    { id: 32, code: 'personal_accounting', name: 'Personal accounting', isActive: true },
  ];
  return {
    cleanPersonnel: { ready: true, userIds: [50101, 50102, 50103], employeeIds: [60101], roleIds: [30, 31, 32], existingAccountRequired: true },
    roles, permissions: [], auditLogs: [],
    users: [
      { id: 10018, username: 'semih', displayName: 'Protected owner', roleId: 28, roleName: roles[1].name, isActive: true },
      { id: 15, username: 'ornek-personel', displayName: 'Protected sample', roleId: 20, roleName: roles[2].name, isActive: true },
      { id: 50101, username: 'fixture-free', displayName: 'Fixture free', roleId: 30, roleName: roles[3].name, isActive: true },
      { id: 50102, username: 'fixture-linked', displayName: 'Fixture linked', roleId: 31, roleName: roles[4].name, isActive: true },
      { id: 50103, username: 'fixture-inactive', displayName: 'Fixture inactive', roleId: 32, roleName: roles[5].name, isActive: false },
    ],
    employees: [
      { id: 18, employeeCode: 'PRS-0018', fullName: 'Protected sample employee', userId: 15, username: 'ornek-personel', isActive: true, canTerminalSale: true },
      { id: 60101, employeeCode: 'PRS-0019', fullName: 'Fixture linked employee', userId: 50102, username: 'fixture-linked', isActive: true, canTerminalSale: false },
    ],
  };
}
function screen(component, data = overview(), permissions = ['settings.manage']) {
  const runtime = hooks(), calls = [];
  let tree, current = clone(data);
  const result = () => ({ success: true, data: clone(current) });
  const client = {
    async get(path) { calls.push({ method: 'GET', path }); assert.ok(['/api/auth-admin/overview', '/api/personnel/overview'].includes(path)); return result(); },
    async post(path, body) {
      calls.push({ method: 'POST', path, body: clone(body) });
      if (path === '/api/auth-admin/users') {
        current.users.push({ ...clone(body), id: 50104, isActive: true });
        current.cleanPersonnel.userIds.push(50104);
      } else {
        assert.equal(path, '/api/personnel/employees');
        current.employees.push({ ...clone(body), id: 60102, username: current.users.find(user => user.id === body.userId)?.username });
        current.cleanPersonnel.employeeIds.push(60102);
      }
      return result();
    },
    async patch(path, body) { calls.push({ method: 'PATCH', path, body: clone(body) }); return result(); },
  };
  const authApi = loadModule('../../services/authAdminApi.js', { './apiClient.js': client });
  const personnelApi = loadModule('../../services/personnelApi.js', { './apiClient.js': client });
  const react = { ...runtime.api, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const exports = loadModule(`./${component}.jsx`, {
    react,
    './personnelManagementModel.mjs': personnelModel,
    '../../services/authAdminApi.js': authApi,
    '../../services/personnelApi.js': personnelApi,
    '../../utils/searchText.js': { normalizeSearchText },
    '../../utils/exportUtils.js': { exportRowsToCsv() {}, exportRowsToExcel() {}, printRowsReport() {} },
    'lucide-react': {},
  });
  function render() {
    for (let iteration = 0; iteration < 20; iteration++) {
      runtime.start(); tree = exports[component]({ permissions });
      if (!runtime.finish()) return;
    }
    throw Error('Component fixture did not settle');
  }
  const find = predicate => nodes(tree, predicate);
  function button(label) { const match = find(node => node.type === 'button' && text(node) === label)[0]; assert.ok(match, `Missing button: ${label}`); return match; }
  function field(label) {
    const match = find(node => node.type === 'label' && text(node.props.children.filter(child => typeof child === 'string' || child?.type === 'span')) === label)[0];
    assert.ok(match, `Missing field: ${label}`);
    return nodes(match, node => ['input', 'select'].includes(node.type))[0];
  }
  render();
  return {
    calls, find, button, field, render, get text() { return text(tree); },
    get writes() { return calls.filter(call => call.method !== 'GET'); },
    async settle() { await flush(); render(); },
    change(label, value) { field(label).props.onChange({ target: { value } }); render(); },
    async click(label) { const target = button(label); assert.notEqual(target.props.disabled, true, `Disabled button: ${label}`); await target.props.onClick(); await flush(); render(); },
  };
}

test('Sites uses the existing B5 screen sources without a different role or copying engine', () => {
  for (const name of ['AuthAdminScreen.jsx', 'PersonnelDefinitionsScreen.jsx', 'personnelManagementModel.mjs']) {
    assert.equal(readFileSync(new URL(name, import.meta.url), 'utf8'), readFileSync(new URL(`../../../../web-admin/src/modules/settings/${name}`, import.meta.url), 'utf8'));
  }
});

test('actual account screen uses API role metadata and keeps protected users read-only', async () => {
  const h = screen('AuthAdminScreen'); await h.settle();
  assert.match(h.text, /Bu mevcut hesap korunuyor/);
  assert.equal(h.button('Kullanıcı Yetkisini Kaydet').props.disabled, true);
  await h.button('Kullanıcı Yetkisini Kaydet').props.onClick();
  await h.button('Şifreyi Değiştir').props.onClick();
  assert.equal(h.writes.length, 0);
  await h.click('Yeni Kullanıcı');
  const roleChoices = nodes(h.field('Rol'), node => node.type === 'option').map(node => node.props.value);
  assert.deepEqual(roleChoices, [30, 31, 32]);
  h.change('Kullanıcı adı', 'fixture-new'); h.change('Ad soyad', 'Fixture new');
  h.change('İlk şifre', 'synthetic-fixture-only'); h.change('Rol', '31');
  await h.click('Kullanıcıyı Oluştur');
  assert.deepEqual(h.writes, [{ method: 'POST', path: '/api/auth-admin/users', body: { username: 'fixture-new', displayName: 'Fixture new', password: 'synthetic-fixture-only', roleId: 31 } }]);
  assert.match(h.text, /Yeni ERP kullanıcısı oluşturuldu/);
});

test('actual personnel screen selects an eligible existing user and sends only employee.userId', async () => {
  const h = screen('PersonnelDefinitionsScreen'); await h.settle();
  const choices = nodes(h.field('Mevcut kişisel hesap'), node => node.type === 'option').map(node => node.props.value);
  assert.deepEqual(choices, ['', 50101]);
  await h.click('Personeli Oluştur');
  assert.equal(h.writes.length, 0);
  assert.match(h.text, /Kullanıcı Yönetimi ekranında açtığınız kişisel hesabı seçin/);
  h.change('Ad soyad *', 'Fixture new employee'); h.change('Mevcut kişisel hesap', '50101');
  assert.equal(h.field('Kullanıcı adı *').props.value, 'fixture-free');
  assert.equal(h.field('Kullanıcı adı *').props.disabled, true);
  await h.click('Personeli Oluştur');
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].path, '/api/personnel/employees');
  assert.equal(h.writes[0].body.userId, 50101);
  assert.equal(Object.hasOwn(h.writes[0].body, 'loginUsername'), false);
  assert.equal(Object.hasOwn(h.writes[0].body, 'loginPassword'), false);
  assert.match(h.text, /Personel oluşturuldu/);
});

test('actual employee editor preserves its account and sale flag while protected sample edits are blocked', async () => {
  const h = screen('PersonnelDefinitionsScreen'); await h.settle();
  const choose = name => { h.find(node => node.type === 'button' && nodes(node, child => child.type === 'strong' && text(child) === name).length)[0].props.onClick(); h.render(); };
  choose('Protected sample employee');
  assert.equal(h.button('Değişiklikleri Kaydet').props.disabled, true);
  assert.equal(h.button('Şifre Değiştir').props.disabled, true);
  await h.button('Değişiklikleri Kaydet').props.onClick();
  assert.equal(h.writes.length, 0);
  choose('Fixture linked employee'); h.change('Ad soyad *', 'Fixture linked renamed');
  await h.click('Değişiklikleri Kaydet');
  assert.equal(h.writes[0].path, '/api/personnel/employees/60101');
  assert.equal(h.writes[0].body.userId, 50102);
  assert.equal(h.writes[0].body.canTerminalSale, false);
  assert.equal(Object.hasOwn(h.writes[0].body, 'loginPassword'), false);
});

test('unready personal-account metadata and missing manager permission do not open writes', async () => {
  const unready = overview(); unready.cleanPersonnel.ready = false;
  for (const component of ['AuthAdminScreen', 'PersonnelDefinitionsScreen']) {
    const h = screen(component, unready); await h.settle();
    assert.match(h.text, /henüz kurulmadı/);
    const save = h.button(component === 'AuthAdminScreen' ? 'Kullanıcı Yetkisini Kaydet' : 'Personeli Oluştur');
    assert.equal(save.props.disabled, true); await save.props.onClick(); assert.equal(h.writes.length, 0);
  }
  const noPermission = screen('AuthAdminScreen', overview(), []); await noPermission.settle();
  assert.equal(noPermission.button('Yeni Kullanıcı').props.disabled, true);
  assert.equal(noPermission.button('Kullanıcı Yetkisini Kaydet').props.disabled, true);
  await noPermission.button('Kullanıcı Yetkisini Kaydet').props.onClick();
  assert.equal(noPermission.writes.length, 0);
});

test('packing task stays absent from the real form and payload until native metadata supports it',async()=>{
 const h=screen('PersonnelDefinitionsScreen');await h.settle();assert.doesNotMatch(h.text,/Toplama ve kolileme/);
 h.change('Ad soyad *','Fixture employee');h.change('Mevcut kişisel hesap','50101');await h.click('Personeli Oluştur');
 assert.equal(Object.hasOwn(h.writes[0].body,'canTerminalPacking'),false);
});
test('supported real personnel form defaults packing off and saves only the selected personal task',async()=>{
 const data=overview();data.cleanPersonnel.packingTaskSupported=true;const h=screen('PersonnelDefinitionsScreen',data);await h.settle();
 assert.equal(h.field('Toplama ve kolileme').props.checked,false);assert.equal(h.field('Toplama ve kolileme').props.disabled,true);
 h.change('Ad soyad *','Fixture packer');h.change('Mevcut kişisel hesap','50101');assert.equal(h.field('Toplama ve kolileme').props.disabled,false);
 h.field('Toplama ve kolileme').props.onChange({target:{checked:true}});h.render();await h.click('Personeli Oluştur');
 assert.equal(h.writes[0].body.canTerminalPacking,true);assert.equal(h.writes[0].body.userId,50101);assert.equal(h.writes[0].body.canChangeSalePrice,false);
});
test('packing edit stays separate from sale and finance cannot inherit the task',async()=>{
 for(const roleId of [31,32]){
  const data=overview();data.cleanPersonnel.packingTaskSupported=true;data.users.find(u=>u.id===50102).roleId=roleId;data.employees.find(e=>e.id===60101).canTerminalPacking=true;
  const h=screen('PersonnelDefinitionsScreen',data);await h.settle();h.find(node=>node.type==='button'&&nodes(node,c=>c.type==='strong'&&text(c)==='Fixture linked employee').length)[0].props.onClick();h.render();
  assert.equal(h.field('Toplama ve kolileme').props.disabled,roleId===32);
  await h.click('Değişiklikleri Kaydet');assert.equal(h.writes[0].body.canTerminalPacking,roleId===31);assert.equal(h.writes[0].body.canTerminalSale,false);
 }
});
