import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubStackBootPlan, createHubStackSettings, HUB_STACK_COPY_ID, HUB_STACK_DATABASE, HUB_STACK_ORIGIN, HUB_STACK_ENTRY} from './hub-stack-boot-plan.mjs';

function fixture() {
  const packagePin = (root, name) => ({packageRoot: `${root}\\${name} a123456`, sourceCommit: 'a'.repeat(40),
    manifestSha256: 'b'.repeat(64), config: {path: `C:\\Sirket\\ERP\\runtime\\Hub Stable\\${name}.json`, sha256: 'c'.repeat(64)}});
  return {schemaVersion: 1, ownerSid: 'S-1-5-21-123-456-789-1001', currentOwnerSid: 'S-1-5-21-123-456-789-1001',
    actualT1: false, copyId: HUB_STACK_COPY_ID, database: HUB_STACK_DATABASE, stableOrigin: HUB_STACK_ORIGIN,
    releaseRoots: ['C:\\Sirket\\ERP\\releases', 'C:\\Sirket\\CRM\\releases'], runtimeRoot: 'C:\\Sirket\\ERP\\runtime',
    windowsRoot: 'C:\\Windows', node: {path: 'C:\\Program Files\\nodejs\\node.exe', sha256: 'd'.repeat(64)},
    stackPackage: {packageRoot: 'C:\\Sirket\\ERP\\releases\\Hub Stack & Eğitim a123456', sourceCommit: 'a'.repeat(40),
      manifestSha256: 'b'.repeat(64), entrySha256: 'e'.repeat(64)},
    startupConfig: {path: 'C:\\Sirket\\ERP\\runtime\\Hub Stable\\startup & pins.json', sha256: 'f'.repeat(64)},
    components: {erpApiNative: packagePin('C:\\Sirket\\ERP\\releases', 'erp'), nativeOrder: packagePin('C:\\Sirket\\ERP\\releases', 'nativeOrder'),
      crm: packagePin('C:\\Sirket\\CRM\\releases', 'crm'), hub: packagePin('C:\\Sirket\\ERP\\releases', 'hub'), edge: packagePin('C:\\Sirket\\ERP\\releases', 'edge')}};
}
const mutate = operation => { const input = fixture(); operation(input); return input; };
const refuses = (operation, reason = /HUB_STACK_PLAN_/) => assert.throws(() => createHubStackBootPlan(mutate(operation)), reason);
// Pure fixture for the native Windows argument string emitted for PowerShell 5.1.
// Every quoted path is one argument. No Start-Process or task is executed.
function parseFixedNativeArguments(text) {
  const result = []; let current = ''; let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    else if (character === ' ' && !quoted) { if (current) {result.push(current); current = '';} }
    else current += character;
  }
  assert.equal(quoted, false); if (current) result.push(current); return result;
}

test('review XML has exact same-owner S4U Limited boot/logon identity and no Scheduler retry multiplication', () => {
  const input = fixture(), plan = createHubStackBootPlan(input);
  assert.equal(plan.preparationOnly, true); assert.equal(plan.installed, false); assert.equal(plan.actualBootTested, false);
  assert.equal(plan.activationRequiresApproval, true); assert.equal(plan.task.name, 'Melisa-Hub-TEST-Stack');
  assert.match(plan.task.xml, /<BootTrigger><Enabled>true<\/Enabled><Delay>PT30S<\/Delay><\/BootTrigger>/);
  assert.match(plan.task.xml, new RegExp(`<LogonTrigger><Enabled>true</Enabled><UserId>${input.ownerSid}</UserId></LogonTrigger>`));
  assert.match(plan.task.xml, /<LogonType>S4U<\/LogonType><RunLevel>LeastPrivilege<\/RunLevel>/);
  assert.match(plan.task.xml, /<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);
  assert.match(plan.task.xml, /<ExecutionTimeLimit>PT0S<\/ExecutionTimeLimit>/);
  assert.doesNotMatch(plan.task.xml, /RestartOnFailure|HighestAvailable|ServiceAccount|SYSTEM|Password|<NetworkSettings>/);
  assert.equal(plan.task.schedulerRestartCount, 0); assert.equal(plan.task.supervisorMaxRetries, 3); assert.equal(plan.task.supervisorRetrySeconds, 60);
});

test('fixed order carries per-stage ports, protected original tasks and no SQL restore claim', () => {
  const plan = createHubStackBootPlan(fixture());
  assert.deepEqual(plan.dependencyOrder.map(stage => [stage.name, stage.ports]), [
    ['sqlReady', []], ['erpNative', [4186]], ['erpApi', [4184]], ['crmNativeOrder', [62704]],
    ['crmStack', [62700, 62701, 62702, 62703]], ['hub', [5234]], ['edge', [5244]]]);
  assert.equal(plan.dependencyOrder.at(-1).bind, '127.0.0.1');
  assert(plan.safety.protected.includes('TEST125/5194/4144/4146'));
  assert(plan.safety.protected.includes('Melisa-ERP-TEST-Canonical'));
  assert(plan.safety.protected.includes('Melisa-CRM-TEST-Completion/62400'));
  assert.equal(plan.rollback.automaticDatabaseRestore, false);
  assert.match(plan.safety.replaces, /Nothing installed or replaced/);
  assert(plan.prerequisites.some(item => /noninteractive S4U probe/.test(item)));
  assert(plan.prerequisites.some(item => /administrator authority/.test(item)));
  assert(plan.prerequisites.some(item => /no reboot performed/.test(item)));
});

test('plan cannot accept SYSTEM, another account, higher privileges or a password', () => {
  for (const sid of ['S-1-5-18', 'S-1-5-19', 'S-1-5-20', 'SYSTEM', 'Administrator', '', 1001])
    refuses(input => {input.ownerSid = sid; input.currentOwnerSid = sid;}, /OWNER_REJECTED/);
  refuses(input => { input.ownerSid = 'S-1-5-21-123-456-789-1002'; }, /OWNER_REJECTED/);
  for (const field of ['runLevel', 'password', 'environment', 'taskName', 'ports', 'schedulerRestartCount', 'command'])
    refuses(input => { input[field] = 'ignored'; }, /INPUT_FIELDS/);
});

test('copy/database/T1/stable-origin are exact; LIVE, TEST125 and hostname tricks cannot be selected', () => {
  for (const [field, values] of Object.entries({schemaVersion: [0, 2, '1'], actualT1: [true, 'false', null],
    copyId: ['e16b70f0-4057-428b-9abc-6bbcaf35fe83', null], database: ['MELISA_ERP_SIRKET_TEST_20260929_01', 'LIVE'],
    stableOrigin: ['https://semih.tail295701.ts.net:8443/', 'http://semih.tail295701.ts.net:8443',
      'https://semih.tail295701.ts.net', 'https://semih.tail295701.ts.net.evil:8443', 'http://192.168.1.46:5234']}))
    for (const value of values) refuses(input => {input[field] = value;}, /TARGET_REJECTED/);
});

test('Node, full source, entry, manifests and private config hash pins are required and carried unchanged', () => {
  const input = fixture(), plan = createHubStackBootPlan(input);
  assert.deepEqual(plan.pins.node, input.node);
  assert.equal(plan.pins.stackPackage.entryPath, `${input.stackPackage.packageRoot}\\${HUB_STACK_ENTRY}`);
  assert.equal(plan.pins.stackPackage.sourceCommit, input.stackPackage.sourceCommit);
  assert.equal(plan.pins.stackPackage.manifestSha256, input.stackPackage.manifestSha256);
  assert.equal(plan.pins.stackPackage.entrySha256, input.stackPackage.entrySha256);
  for (const [name, component] of Object.entries(input.components)) {
    assert.equal(plan.pins.components[name].sourceCommit, component.sourceCommit);
    assert.equal(plan.pins.components[name].manifestSha256, component.manifestSha256);
    assert.deepEqual(plan.pins.components[name].config, component.config);
  }
  for (const bad of ['', 'a'.repeat(39), 'g'.repeat(40), 'a'.repeat(41), null])
    refuses(input => {input.stackPackage.sourceCommit = bad;}, /SOURCE_PIN/);
  for (const bad of ['', 'a'.repeat(63), 'g'.repeat(64), null]) {
    refuses(input => {input.node.sha256 = bad;}, /NODE_PIN/);
    refuses(input => {input.stackPackage.entrySha256 = bad;}, /ENTRY_PIN/);
    refuses(input => {input.components.hub.manifestSha256 = bad;}, /MANIFEST_PIN/);
    refuses(input => {input.startupConfig.sha256 = bad;}, /CONFIG_PIN/);
  }
});

test('unknown nested fields and missing components cannot sneak custom commands, credentials or ports into a plan', () => {
  refuses(input => {input.node.command = 'arbitrary';}, /NODE_FIELDS/);
  refuses(input => {input.stackPackage.entryRelativePath = 'evil.ps1';}, /PACKAGE_FIELDS/);
  refuses(input => {input.startupConfig.password = 'not-a-real-secret';}, /CONFIG_FIELDS/);
  refuses(input => {input.components.erpApiNative.config.SQL_PASSWORD = 'not-a-real-secret';}, /CONFIG_FIELDS/);
  refuses(input => {input.components.crm.ports = [62400];}, /PACKAGE_FIELDS/);
  refuses(input => {input.components.unknown = input.components.crm;}, /COMPONENTS_FIELDS/);
  refuses(input => {delete input.components.edge;}, /COMPONENTS_FIELDS/);
});

test('path escapes, ambiguous Windows paths, UNC, command injection and dynamic environment references fail closed', () => {
  for (const candidate of ['relative.json', '\\\\server\\share\\file.json', 'C:/Sirket/ERP/runtime/file.json',
    'C:\\Sirket\\ERP\\runtime\\..\\releases\\file.json', 'C:\\Sirket\\ERP\\runtime\\.\\file.json',
    'C:\\Sirket\\ERP\\runtime\\double\\\\file.json', 'C:\\Sirket\\ERP\\runtime\\quote".json',
    "C:\\Sirket\\ERP\\runtime\\quote'.json", 'C:\\Sirket\\ERP\\runtime\\line\n.json',
    'C:\\Sirket\\ERP\\runtime\\file.json:stream', 'C:\\Sirket\\ERP\\runtime\\NUL.json',
    'C:\\Sirket\\ERP\\runtime\\trailing.\\file.json', 'C:\\Sirket\\ERP\\runtime\\bad%PATH%.json',
    'C:\\Sirket\\ERP\\runtime\\$(process).json', 'C:\\Sirket\\ERP\\runtime\\file?.json',
    'C:\\Sirket\\ERP\\runtime\\file.json\\'])
    refuses(input => {input.startupConfig.path = candidate;}, /PATH_REJECTED/);
});

test('configs stay private, packages stay immutable and each component stays in its approved repo', () => {
  for (const candidate of ['C:\\Sirket\\ERP\\runtime-evil\\file.json', 'C:\\Sirket\\ERP\\releases\\file.json',
    'C:\\Sirket\\CRM\\runtime\\file.json', 'C:\\Sirket\\ERP\\runtime\\file.ps1'])
    refuses(input => {input.startupConfig.path = candidate;}, /CONFIG_SCOPE/);
  for (const candidate of ['C:\\Sirket\\ERP\\melisa-erp-v2', 'C:\\Sirket\\ERP\\releases-evil\\package', 'C:\\Sirket\\ERP\\releases'])
    refuses(input => {input.stackPackage.packageRoot = candidate;}, /PACKAGE_SCOPE/);
  refuses(input => {input.components.crm.packageRoot = 'C:\\Sirket\\ERP\\releases\\crm';}, /COMPONENT_REPO_SCOPE/);
  refuses(input => {input.components.hub.packageRoot = 'C:\\Sirket\\CRM\\releases\\hub';}, /COMPONENT_REPO_SCOPE/);
  refuses(input => {input.runtimeRoot = 'C:\\Sirket\\ERP\\runtime-evil';}, /ROOT_SCOPE/);
  refuses(input => {input.releaseRoots.reverse();}, /ROOT_SCOPE/);
  refuses(input => {input.windowsRoot = 'C:\\fakeWindows';}, /SHELL_SCOPE/);
  refuses(input => {input.node.path = 'C:\\Sirket\\ERP\\runtime\\node.exe';}, /NODE_SCOPE/);
  refuses(input => {input.node.path = 'C:\\Program Files\\nodejs\\powershell.exe';}, /NODE_SCOPE/);
});

test('XML escapes data and Windows PowerShell 5.1 argument boundaries preserve paths with spaces and ampersands', () => {
  const input = fixture(), plan = createHubStackBootPlan(input);
  assert.match(plan.task.xml, /Hub Stack &amp; Eğitim/);
  assert.match(plan.task.xml, /startup &amp; pins\.json/);
  assert.match(plan.task.xml, /&quot;/);
  assert.doesNotMatch(plan.task.xml, /-Command|EncodedCommand|Bypass/);
  assert.deepEqual(parseFixedNativeArguments(plan.task.arguments), plan.task.argumentTokens);
  assert.equal(plan.task.argumentTokens.length, 14);
  assert.equal(plan.task.argumentTokens[7], `${input.stackPackage.packageRoot}\\${HUB_STACK_ENTRY}`);
  assert.equal(plan.task.argumentTokens[9], input.startupConfig.path);
  assert.equal(plan.task.argumentTokens[11], input.startupConfig.sha256);
  assert.equal(plan.task.execute, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});

test('source preparation returns no source/input mutation and cannot be altered into a different task', () => {
  const input = fixture(), before = JSON.stringify(input), plan = createHubStackBootPlan(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(plan.task), true); assert.equal(Object.isFrozen(plan.pins.components.crm), true);
  assert.throws(() => {plan.task.ownerSid = 'S-1-5-18';}, TypeError);
  assert.throws(() => {plan.dependencyOrder[2].ports.push(4144);}, TypeError);
  assert.doesNotMatch(JSON.stringify(plan), /not-a-real-secret|SQL_PASSWORD|Bearer /);
});

test('startup settings use only private-source references and leave their own hash outside the file', () => {
  const input = fixture();
  input.privateSources = Object.fromEntries(['operationConfig', 'crmActivationConfig', 'nativeOrderConfig', 'hubPinConfig']
    .map(name => [name, {path: `C:\\Sirket\\ERP\\runtime\\Hub Stable\\${name}.json`, sha256: 'a'.repeat(64)}]));
  const settings = createHubStackSettings(input);
  assert.deepEqual(settings.privateSources, input.privateSources);
  assert.equal(Object.hasOwn(settings, 'startupConfig'), false);
  assert.equal(Object.hasOwn(settings, 'currentOwnerSid'), false);
  assert.equal(settings.ownerSid, input.ownerSid);
  assert.equal(Object.hasOwn(settings.stackPackage, 'manifestPath'), false);
  assert.equal(Object.hasOwn(settings.components.hub, 'manifestPath'), false);
  refuses(value => {value.privateSources = {...input.privateSources, SQL_PASSWORD: 'not-a-real-secret'};}, /PRIVATE_SOURCES_FIELDS/);
  refuses(value => {value.privateSources = {...input.privateSources, operationConfig: {path: input.privateSources.operationConfig.path, sha256: 'a'.repeat(64), password: 'not-a-real-secret'}};}, /CONFIG_FIELDS/);
});
