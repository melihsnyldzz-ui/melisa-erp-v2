// SOURCE PREPARATION / NOT INSTALLED.
// Pure review plan only: no filesystem, process, task, network or SQL access.
import path from 'node:path';

export const HUB_STACK_COPY_ID = 'e16b70f0-4057-428b-9abc-6bbcaf35fe82';
export const HUB_STACK_DATABASE = 'MELISA_ERP_CRM_SHARED_TEST_20261009_02';
export const HUB_STACK_ORIGIN = 'https://semih.tail295701.ts.net:8443';
export const HUB_STACK_ENTRY = 'scripts\\canonical\\watch-hub-stack.ps1';
const RELEASE_ROOTS = ['C:\\Sirket\\ERP\\releases', 'C:\\Sirket\\CRM\\releases'];
const RUNTIME_ROOT = 'C:\\Sirket\\ERP\\runtime';
const COMPONENTS = ['erpApiNative', 'nativeOrder', 'crm', 'hub', 'edge'];

function reject(code) { throw new Error(`HUB_STACK_PLAN_${code}`); }
function object(value, keys, label, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key))
      || keys.some(key => !Object.hasOwn(value, key))) reject(`${label}_FIELDS`);
}
function windowsPath(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]:\\/.test(value)
      || /[\x00-\x1f\x7f"'/%`$<>|?*]/.test(value)
      || value.slice(2).includes(':') || value.endsWith('\\')
      || path.win32.normalize(value) !== value) reject('PATH_REJECTED');
  const parts = value.slice(3).split('\\');
  if (parts.some(part => !part || part === '.' || part === '..'
      || /[. ]$/.test(part)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) reject('PATH_REJECTED');
  return value;
}
function equalPath(a, b) { return a.toLowerCase() === b.toLowerCase(); }
function beneath(value, root) { return value.toLowerCase().startsWith(`${root.toLowerCase()}\\`); }
function hash(value, label, length = 64) {
  if (typeof value !== 'string' || !new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value)) reject(`${label}_PIN`);
  return value.toLowerCase();
}
function configRef(value, runtimeRoot) {
  object(value, ['path', 'sha256'], 'CONFIG');
  const configPath = windowsPath(value.path);
  if (!beneath(configPath, runtimeRoot) || path.win32.extname(configPath).toLowerCase() !== '.json') reject('CONFIG_SCOPE');
  return {path: configPath, sha256: hash(value.sha256, 'CONFIG')};
}
function packagePin(value, releaseRoots, runtimeRoot, stack = false) {
  object(value, stack ? ['packageRoot', 'sourceCommit', 'manifestSha256', 'entrySha256']
    : ['packageRoot', 'sourceCommit', 'manifestSha256', 'config'], 'PACKAGE');
  const packageRoot = windowsPath(value.packageRoot);
  if (!releaseRoots.some(root => beneath(packageRoot, root))
      || releaseRoots.some(root => equalPath(packageRoot, root))) reject('PACKAGE_SCOPE');
  const pin = {packageRoot, sourceCommit: hash(value.sourceCommit, 'SOURCE', 40),
    manifestPath: path.win32.join(packageRoot, 'release-manifest.json'),
    manifestSha256: hash(value.manifestSha256, 'MANIFEST')};
  if (stack) return {...pin, entryPath: path.win32.join(packageRoot, HUB_STACK_ENTRY), entrySha256: hash(value.entrySha256, 'ENTRY')};
  return {...pin, config: configRef(value.config, runtimeRoot)};
}
function xml(value) { return String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[character])); }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Validate explicit pins and return reviewable XML; this does not validate files or install a task. */
export function createHubStackBootPlan(input) {
  object(input, ['schemaVersion', 'ownerSid', 'currentOwnerSid', 'actualT1', 'copyId', 'database',
    'stableOrigin', 'releaseRoots', 'runtimeRoot', 'windowsRoot', 'node', 'stackPackage', 'startupConfig', 'components'], 'INPUT', ['privateSources', 'dependencyLocks', 'crmPrivateFiles']);
  if (input.schemaVersion !== 1 || input.actualT1 !== false || input.copyId !== HUB_STACK_COPY_ID
      || input.database !== HUB_STACK_DATABASE || input.stableOrigin !== HUB_STACK_ORIGIN) reject('TARGET_REJECTED');
  if (typeof input.ownerSid !== 'string' || !/^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$/.test(input.ownerSid)
      || input.ownerSid !== input.currentOwnerSid) reject('OWNER_REJECTED');
  if (!Array.isArray(input.releaseRoots) || input.releaseRoots.length !== 2
      || input.releaseRoots.some((root, index) => !equalPath(windowsPath(root), RELEASE_ROOTS[index]))) reject('ROOT_SCOPE');
  const runtimeRoot = windowsPath(input.runtimeRoot);
  if (!equalPath(runtimeRoot, RUNTIME_ROOT)) reject('ROOT_SCOPE');
  const windowsRoot = windowsPath(input.windowsRoot);
  if (!equalPath(windowsRoot, 'C:\\Windows')) reject('SHELL_SCOPE');
  object(input.node, ['path', 'sha256'], 'NODE');
  const nodePath = windowsPath(input.node.path);
  if (path.win32.basename(nodePath).toLowerCase() !== 'node.exe'
      || beneath(nodePath, runtimeRoot) || input.releaseRoots.some(root => beneath(nodePath, root))) reject('NODE_SCOPE');
  const node = {path: nodePath, sha256: hash(input.node.sha256, 'NODE')};
  const stackPackage = packagePin(input.stackPackage, input.releaseRoots, runtimeRoot, true);
  const startupConfig = configRef(input.startupConfig, runtimeRoot);
  object(input.components, COMPONENTS, 'COMPONENTS');
  const components = Object.fromEntries(COMPONENTS.map(name => [name,
    packagePin(input.components[name], input.releaseRoots, runtimeRoot)]));
  let privateSources;
  if (Object.hasOwn(input, 'privateSources')) {
    const names = ['operationConfig', 'crmActivationConfig', 'nativeOrderConfig', 'hubPinConfig'];
    object(input.privateSources, names, 'PRIVATE_SOURCES');
    privateSources = Object.fromEntries(names.map(name => [name, configRef(input.privateSources[name], runtimeRoot)]));
  }
  let dependencyLocks;
  if (Object.hasOwn(input, 'dependencyLocks')) {
    const names = ['erpApiNative', 'nativeOrder', 'crm'];
    object(input.dependencyLocks, names, 'DEPENDENCY_LOCKS');
    dependencyLocks = Object.fromEntries(names.map(name => {
      const ref = input.dependencyLocks[name]; object(ref, ['path', 'sha256'], 'DEPENDENCY_LOCK');
      const lockPath = windowsPath(ref.path);
      if (!equalPath(lockPath, path.win32.join(components[name].packageRoot, 'hub-dependency-lock.json'))) reject('DEPENDENCY_LOCK_SCOPE');
      return [name, {path: lockPath, sha256: hash(ref.sha256, 'DEPENDENCY_LOCK')}];
    }));
  }
  let crmPrivateFiles;
  if (Object.hasOwn(input, 'crmPrivateFiles')) {
    const names = ['baseline', 'catalogAccess']; object(input.crmPrivateFiles, names, 'CRM_PRIVATE_FILES');
    crmPrivateFiles = Object.fromEntries(names.map(name => {
      const ref = input.crmPrivateFiles[name]; object(ref, ['path', 'sha256'], 'CRM_PRIVATE_FILE');
      const file = windowsPath(ref.path);
      if (input.releaseRoots.some(root => beneath(file, root))) reject('CRM_PRIVATE_FILE_SCOPE');
      return [name, {path: file, sha256: hash(ref.sha256, 'CRM_PRIVATE_FILE')}];
    }));
  }
  if (!beneath(stackPackage.packageRoot, input.releaseRoots[0])
      || !beneath(components.crm.packageRoot, input.releaseRoots[1])
      || ['erpApiNative', 'nativeOrder', 'hub', 'edge'].some(name => !beneath(components[name].packageRoot, input.releaseRoots[0]))) reject('COMPONENT_REPO_SCOPE');
  const execute = path.win32.join(windowsRoot, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  const argumentTokens = ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'RemoteSigned',
    '-File', stackPackage.entryPath, '-StartupConfigPath', startupConfig.path, '-StartupConfigSha256', startupConfig.sha256, '-Action', 'Start'];
  // Native Windows argv quoting. Quotes/backslashes-at-end were rejected above;
  // these are data arguments, never a PowerShell -Command expression.
  const argumentsText = `-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${stackPackage.entryPath}" -StartupConfigPath "${startupConfig.path}" -StartupConfigSha256 ${startupConfig.sha256} -Action Start`;
  const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>${xml(`SOURCE PREPARATION / NOT INSTALLED; TEST DB02 only; source ${stackPackage.sourceCommit}`)}</Description></RegistrationInfo>
  <Triggers>
    <BootTrigger><Enabled>true</Enabled><Delay>PT30S</Delay></BootTrigger>
    <LogonTrigger><Enabled>true</Enabled><UserId>${xml(input.ownerSid)}</UserId></LogonTrigger>
  </Triggers>
  <Principals><Principal id="Owner"><UserId>${xml(input.ownerSid)}</UserId><LogonType>S4U</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><Enabled>true</Enabled></Settings>
  <Actions Context="Owner"><Exec><Command>${xml(execute)}</Command><Arguments>${xml(argumentsText)}</Arguments><WorkingDirectory>${xml(stackPackage.packageRoot)}</WorkingDirectory></Exec></Actions>
</Task>`;
  return freeze({schemaVersion: 1, preparationOnly: true, installed: false, actualBootTested: false,
    activationRequiresApproval: true, actualT1: false, copyId: input.copyId, database: input.database, stableOrigin: input.stableOrigin,
    task: {name: 'Melisa-Hub-TEST-Stack', path: '\\', ownerSid: input.ownerSid, logonType: 'S4U', runLevel: 'Limited',
      trigger: ['Boot', 'SameOwnerLogon'], execute, argumentTokens, arguments: argumentsText,
      workingDirectory: stackPackage.packageRoot, multipleInstances: 'IgnoreNew', executionTimeLimit: 'PT0S',
      schedulerRestartCount: 0, supervisorMaxRetries: 3, supervisorRetrySeconds: 60, xml: taskXml},
    pins: {node, stackPackage, startupConfig, components, ...(privateSources ? {privateSources} : {}), ...(dependencyLocks ? {dependencyLocks} : {}), ...(crmPrivateFiles ? {crmPrivateFiles} : {})},
    dependencyOrder: [
      {name: 'sqlReady', action: 'read-only readiness and exact DB02/copy/privilege identity; never start or change SQL', ports: []},
      {name: 'erpNative', component: 'erpApiNative', ports: [4186]},
      {name: 'erpApi', component: 'erpApiNative', ports: [4184]},
      {name: 'crmNativeOrder', component: 'nativeOrder', ports: [62704]},
      {name: 'crmStack', component: 'crm', ports: [62700, 62701, 62702, 62703]},
      {name: 'hub', component: 'hub', ports: [5234]},
      {name: 'edge', component: 'edge', ports: [5244], bind: '127.0.0.1'}],
    safety: {credentials: 'References and SHA256 only; no passwords or inline environment values',
      fileValidation: 'Before any start, independently verify full manifests, entry, Node and config SHA256 plus exact owner and DB02 identity',
      portOwnership: 'An occupied foreign port must fail closed; never kill, adopt or repoint another owner',
      retryBudget: 'One initial attempt plus at most three supervisor retries, sixty seconds apart; no Scheduler RestartOnFailure node',
      network: 'Plan makes no Serve, firewall, DNS, ACL, router, Tailscale or bind changes',
      protected: ['TEST125/5194/4144/4146', 'Melisa-ERP-TEST-Canonical', 'Melisa-CRM-TEST-Completion/62400', 'Vega', 'LIVE', 'trade data', 'PR23', 'PR3', 'PR27'],
      replaces: 'Nothing installed or replaced. Disabling/replacing Melisa-Hub-TEST-Web needs exact separate activation approval.',
      login: 'S4U is not proof of SQL, profile, encrypted-file or outbound access; no automatic admin or personnel session',
      sharedOrigin: 'Normal own-account authentication only; no remote test-admin, stage4-actor or passwordless convenience bootstrap'},
    prerequisites: [
      'Exact package, entry, Node, config hashes and before-images reviewed; source plan itself does not inspect files',
      'Same-owner noninteractive S4U probe proves SQL auth, private config/file access, profile dependencies and outbound sockets',
      'Batch-logon right and administrator authority for Boot task registration verified without changing grants',
      'Supervisor enforces the fixed dependency order, owner/receipt identity, one retry budget and guarded rollback',
      'SQL and Tailscale service automatic readiness, node-key expiry and stable HTTPS route separately verified',
      'Exact Serve/Host/Origin policy and cookie isolation plus separate network activation approval',
      'Boot/logon/reboot maintenance and physical recovery plan approved; no reboot performed by this plan'],
    rollback: {automaticDatabaseRestore: false, scope: 'Only newly installed task and its positively identified owned children after activation approval',
      steps: ['Save old Hub task XML/SDDL, process/config/package pins and Serve before-image before activation',
        'If new readiness fails, stop only receipt-verified new children and remove/disable only the new task',
        'Restore exactly approved prior Hub task/network configuration; never repoint TEST125 or old CRM tasks',
        'Preserve all packages, logs, private configs, migration journals and trade data; no SQL restore/reset']}});
}

/** Serialize only reference settings; the file's SHA lives in the external task plan, avoiding a self-hash cycle. */
export function createHubStackSettings(input) {
  const plan = createHubStackBootPlan(input);
  const componentPin = pin => ({packageRoot: pin.packageRoot, sourceCommit: pin.sourceCommit,
    manifestSha256: pin.manifestSha256, config: pin.config});
  return freeze({schemaVersion: 1, ownerSid: plan.task.ownerSid, actualT1: false,
    copyId: plan.copyId, database: plan.database, stableOrigin: plan.stableOrigin,
    releaseRoots: [...input.releaseRoots], runtimeRoot: input.runtimeRoot, windowsRoot: input.windowsRoot,
    node: plan.pins.node, stackPackage: {packageRoot: plan.pins.stackPackage.packageRoot,
      sourceCommit: plan.pins.stackPackage.sourceCommit, manifestSha256: plan.pins.stackPackage.manifestSha256,
      entrySha256: plan.pins.stackPackage.entrySha256},
    components: Object.fromEntries(COMPONENTS.map(name => [name, componentPin(plan.pins.components[name])])),
    ...(plan.pins.privateSources ? {privateSources: plan.pins.privateSources} : {}),
    ...(plan.pins.dependencyLocks ? {dependencyLocks: plan.pins.dependencyLocks} : {}),
    ...(plan.pins.crmPrivateFiles ? {crmPrivateFiles: plan.pins.crmPrivateFiles} : {})});
}
