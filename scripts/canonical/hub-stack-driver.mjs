// Reviewable source only. Imported tests use adapters; CLI is activated only
// by the pinned, same-owner supervisor after separately approved installation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHubStackBootPlan, HUB_STACK_COPY_ID, HUB_STACK_DATABASE} from './hub-stack-boot-plan.mjs';
const runFile = promisify(execFile);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Error(`HUB_STACK_${code}`); };
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const componentNames = ['erpApiNative', 'nativeOrder', 'crm', 'hub', 'edge'];
export const STACK_STAGES = Object.freeze([
  {name: 'erpNative', component: 'erpApiNative', ports: [4186], entry: 'apps/api/start-shared-test-copy.mjs', mode: 'native'},
  {name: 'erpApi', component: 'erpApiNative', ports: [4184], entry: 'apps/api/start-shared-test-copy.mjs', mode: 'erp'},
  {name: 'crmNativeOrder', component: 'nativeOrder', ports: [62704], entry: 'apps/api/start-crm-order-test.mjs', mode: '--shared-current-test'},
  {name: 'crmCatalog', component: 'crm', ports: [62702], entry: 'deploy/test-erp-catalog.mjs'},
  {name: 'crmOrders', component: 'crm', ports: [62703], entry: 'deploy/test-erp-orders.mjs'},
  {name: 'crmServer', component: 'crm', ports: [62700, 62701], entry: 'deploy/test-server.mjs'},
  {name: 'hub', component: 'hub', ports: [5234], entry: 'apps/api/start-shared-test-copy-web.mjs'},
  {name: 'edge', component: 'edge', ports: [5244], entry: 'scripts/canonical/hub-stable-edge.mjs'},
].map(stage => Object.freeze({...stage, ports: Object.freeze(stage.ports)})));
export const SQL_IDENTITY_QUERY = `SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,
 ORIGINAL_LOGIN() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,
 HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,
 HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
 (SELECT COUNT(*) FROM sys.databases WHERE name<>DB_NAME() AND (UPPER(name) LIKE '%PROD%' OR UPPER(name) LIKE '%LIVE%') AND HAS_DBACCESS(name)=1) liveDatabaseAccess,
 (SELECT CONVERT(varchar(36),copy_id) FROM dbo.stage4_copy_manifest WHERE copy_id=@copyId AND sealed=1) copyId,
 (SELECT seal_hash FROM dbo.stage4_copy_manifest WHERE copy_id=@copyId AND sealed=1) sealHash;`;
export const SQL_WRITE_PERMISSION_QUERY = `SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE')
 WHERE permission_name IN('INSERT','UPDATE','DELETE','ALTER','CONTROL','TAKE OWNERSHIP')
 UNION SELECT p.permission_name FROM sys.tables t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p
 WHERE p.permission_name IN('INSERT','UPDATE','DELETE','ALTER','CONTROL','TAKE OWNERSHIP');`;

export function assertSqlIdentity(row, config) {
  if (!row || row.databaseName !== HUB_STACK_DATABASE || row.serverName !== config.copyContext?.target?.server
      || row.loginName !== config.sqlUser || row.databaseUser !== config.sqlUser
      || row.sysadmin !== 0 || row.databaseControl !== 0 || row.originalDatabaseAccess !== 0 || row.liveDatabaseAccess !== 0
      || row.copyId !== HUB_STACK_COPY_ID || !equal(row.sealHash, config.copyContext?.sealHash)) fail('COLD_SQL_IDENTITY_REJECTED');
}

export async function coldSqlProbe(config, sql) {
  if (config.database !== HUB_STACK_DATABASE || config.copyContext?.copyId !== HUB_STACK_COPY_ID
      || config.copyContext?.target?.database !== HUB_STACK_DATABASE
      || typeof config.sqlUser !== 'string' || !config.sqlUser || typeof config.sqlPassword !== 'string' || !config.sqlPassword)
    fail('COLD_SQL_CONFIG_REJECTED');
  const pool = new sql.ConnectionPool({server: config.server, port: 1433, database: config.database,
    user: config.sqlUser, password: config.sqlPassword, options: {encrypt: false, trustServerCertificate: true},
    connectionTimeout: 10000, requestTimeout: 10000});
  try {
    await pool.connect();
    const identity = (await pool.request().input('copyId', sql.UniqueIdentifier, HUB_STACK_COPY_ID).query(SQL_IDENTITY_QUERY)).recordset;
    if (identity?.length !== 1) fail('COLD_SQL_IDENTITY_REJECTED');
    assertSqlIdentity(identity[0], config);
    const permissions = (await pool.request().query(SQL_WRITE_PERMISSION_QUERY)).recordset;
    if (!Array.isArray(permissions) || permissions.length) fail('COLD_SQL_WRITE_PRIVILEGE_REJECTED');
    return {ready: true, readOnlyProbe: true, database: HUB_STACK_DATABASE, copyId: HUB_STACK_COPY_ID};
  } finally { await pool.close(); }
}

const CRM_ENV_KEYS = new Set(['CRM_TEST_PORT_BASE','CRM_ISOLATED_PREPARATION','CRM_TEST_ERP_ORIGIN','CRM_TEST_EXPECTED_DATABASE',
  'CRM_PAID_AI_ENABLED','CRM_AI_SALES_MODE','WHATSAPP_SEND_ENABLED','WHATSAPP_LIVE_SEND_APPROVED','WAAPI_CHATWOOT_BRIDGE_ENABLED',
  'WAAPI_INCOMING_READER_ENABLED','CRM_TEST_LAN_ADDRESS','CRM_TEST_RUNTIME_DIR','CRM_TEST_LOG_DIR','CRM_TEST_NATIVE_SOURCE_COMMIT',
  'CRM_TEST_NATIVE_PACKAGE_ID','CRM_TEST_SOURCE_COMMIT','CRM_TEST_PACKAGE_ROOT','CRM_TEST_PACKAGE_MANIFEST_SHA256','CRM_BASELINE_ENV',
  'CRM_ERP_CATALOG_ACCESS_PATH','CRM_TEST_TERMINAL_PERSONNEL_USERNAME','CRM_TEST_AUTOSTART_CONFIGURED','CRM_STABLE_TRANSPORT','CRM_TEST_COPY_ID']);
export function crmChildEnvironment(config, settings, baseline = {}) {
  const pin = settings.components.crm, vars = config.environmentVariables;
  if (config.sourceCommit !== pin.sourceCommit || !equal(config.packageRoot, pin.packageRoot)
      || !equal(config.packageManifestSha256, pin.manifestSha256) || config.database !== HUB_STACK_DATABASE
      || config.actualT1 !== false || config.externalOperations !== false || config.paidAi !== false || config.whatsappSend !== false
      || !vars || typeof vars !== 'object' || Array.isArray(vars)
      || Object.keys(vars).some(name => !CRM_ENV_KEYS.has(name)) || Object.values(vars).some(value => typeof value !== 'string')) fail('CRM_ACTIVATION_PIN_REJECTED');
  if (vars.CRM_TEST_PORT_BASE !== '62700' || vars.CRM_ISOLATED_PREPARATION !== 'true'
      || vars.CRM_TEST_ERP_ORIGIN !== 'http://127.0.0.1:4184' || vars.CRM_TEST_EXPECTED_DATABASE !== HUB_STACK_DATABASE
      || vars.CRM_TEST_SOURCE_COMMIT !== pin.sourceCommit || !equal(vars.CRM_TEST_PACKAGE_ROOT, pin.packageRoot)
      || !equal(vars.CRM_TEST_PACKAGE_MANIFEST_SHA256, pin.manifestSha256)
      || vars.CRM_TEST_NATIVE_SOURCE_COMMIT !== settings.components.nativeOrder.sourceCommit
      || vars.CRM_STABLE_TRANSPORT !== 'true' || vars.CRM_TEST_COPY_ID!==HUB_STACK_COPY_ID) fail('CRM_ENVIRONMENT_SCOPE_REJECTED');
  for (const [name, root] of [['CRM_TEST_RUNTIME_DIR','C:\\Sirket\\CRM\\runtime'],['CRM_TEST_LOG_DIR','C:\\Sirket\\CRM\\logs']]) {
    if (typeof vars[name] !== 'string' || !vars[name].toLowerCase().startsWith(`${root.toLowerCase()}\\`)
        || /[\r\n"'`$%]/.test(vars[name]) || vars[name].split(/[\\/]/).some(part => part === '..' || part === '.')) fail('CRM_PRIVATE_PATH_REJECTED');
  }
  if (!settings.crmPrivateFiles || !equal(vars.CRM_BASELINE_ENV,settings.crmPrivateFiles.baseline.path)
      || !equal(vars.CRM_ERP_CATALOG_ACCESS_PATH,settings.crmPrivateFiles.catalogAccess.path)) fail('CRM_PRIVATE_FILE_PIN_REQUIRED');
  // Never inherit providers or NODE_OPTIONS. Native own-account auth is retained.
  return {...baseline, ...vars, CRM_PAID_AI_ENABLED: 'false', CRM_AI_SALES_MODE: 'off', WHATSAPP_SEND_ENABLED: 'false',
    WHATSAPP_LIVE_SEND_APPROVED: 'false', WAAPI_CHATWOOT_BRIDGE_ENABLED: 'false', WAAPI_INCOMING_READER_ENABLED: 'false',
    CRM_TEST_LAN_ADDRESS: '', CRM_TEST_AUTOSTART_CONFIGURED: 'true'};
}

export function validateCrmHubPins(hubPin, settings, crm, indexSha256) {
  const pin=settings.components.crm, expectedPackageId=`crm-shared-stable-test-${pin.sourceCommit}`;
  const expectedRuntime=path.win32.join('C:\\Sirket\\CRM\\runtime',`hub-stable-${pin.sourceCommit}`);
  const expectedHealth=path.win32.join(expectedRuntime,'health-status.json');
  if(hubPin.apiSourceCommit!==settings.components.erpApiNative.sourceCommit || hubPin.crmSourceCommit!==pin.sourceCommit
      || hubPin.crmPackageId!==expectedPackageId || path.win32.basename(pin.packageRoot)!==expectedPackageId
      || !equal(crm.environmentVariables.CRM_TEST_RUNTIME_DIR,expectedRuntime) || !equal(hubPin.crmIndexSha256,indexSha256) || !equal(hubPin.crmHealthPath,expectedHealth)) fail('CRM_HUB_PIN_REJECTED');
  return {packageId:expectedPackageId,healthPath:expectedHealth,indexSha256:indexSha256.toLowerCase()};
}
export async function verifyCrmReadiness(stage,settings,hubPin,fetchImpl=fetch) {
  const pin=settings.components.crm;
  const get=async(port,route,maxBytes) => {
    const response=await fetchImpl(`http://127.0.0.1:${port}${route}`,{method:'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(4000)});
    if(response.status!==200)fail('CRM_READINESS_STATUS_REJECTED');
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)fail('CRM_READINESS_BODY_REJECTED');chunks.push(Buffer.from(chunk));}
    return Buffer.concat(chunks);
  };
  if(stage.name==='crmServer'){
    const html=await get(62700,'/',1048576);
    if(sha(html)!==hubPin.crmIndexSha256)fail('CRM_INDEX_PIN_REJECTED');
  }
  const port=stage.name==='crmServer'?62701:stage.ports[0];
  const service={crmServer:'gateway',crmCatalog:'catalog',crmOrders:'orders'}[stage.name];
  const body=JSON.parse((await get(port,'/test-health',65536)).toString('utf8'));
  if(body.ok!==true || body.service!==service || body.sourceCommit!==pin.sourceCommit
      || body.packageId!==hubPin.crmPackageId || body.database!==settings.database || body.copyId!==settings.copyId
      || body.identityKind!=='CONFIGURED_TEST_TRANSPORT' || body.dependencyProof!=='SEPARATE_ERP_NATIVE_PROBES'
      || body.actualT1!==false || body.externalOperations!==false || body.paidAi!==false || body.whatsappSend!==false)
    fail('CRM_HEALTH_IDENTITY_REJECTED');
  return {ready:true,stage:stage.name};
}
export function crmHealthReceipt(settings,children,{state='running',now=Date.now()}={}) {
  const find=name=>children.find(item=>item.stage.name===name)?.child;
  const services=Object.fromEntries([['server','crmServer'],['catalog','crmCatalog'],['orders','crmOrders']].map(([name,stage])=>
    [name,{state:state==='running'&&find(stage)?'running':'unverified',pid:find(stage)?.pid??0}]));
  const ready=state==='running'&&['crmServer','crmCatalog','crmOrders','erpApi','crmNativeOrder'].every(name=>find(name));
  return {version:1,environment:'CANONICAL_TEST',sourceCommit:settings.components.crm.sourceCommit,
    packageId:`crm-shared-stable-test-${settings.components.crm.sourceCommit}`,packageManifestSha256:settings.components.crm.manifestSha256,
    copyId:settings.copyId,database:settings.database,actualT1:false,observedAt:new Date(now).toISOString(),
    startup:{state:ready?'running':state==='stopping'?'stopping':'degraded'},services,
    dependencies:{erp:{state:ready?'ready':'unverified'},native:{state:ready?'ready':'unverified'}}};
}
export async function cleanupOwnedChildren(started,driver) {
  const survivors=[];
  for(const item of [...started].reverse()){
    try{if(await driver.stopOwned(item.stage,item.child)===false)survivors.push({stage:item.stage.name,pid:item.child.pid});}
    catch{survivors.push({stage:item.stage.name,pid:item.child.pid});}
  }
  if(survivors.length){await driver.reportCleanupSurvivors?.(survivors);const error=Error('HUB_STACK_CLEANUP_UNVERIFIED_SURVIVORS');error.survivors=survivors;throw error;}
}

export function nativeArgumentTokens(value) {
  if(typeof value!=='string'||/[\r\n\x00]/.test(value))return [];
  const tokens=[];let token='',quoted=false,inToken=false;
  for(let i=0;i<value.length;i++){
    const char=value[i];
    if(char==='\\'){
      let count=1;while(value[i+1]==='\\'){count++;i++;}
      if(value[i+1]==='"'){token+='\\'.repeat(Math.floor(count/2));i++;if(count%2)token+='"';else quoted=!quoted;}
      else token+='\\'.repeat(count);
      inToken=true;
    }else if(char==='"'){quoted=!quoted;inToken=true;}
    else if(/\s/.test(char)&&!quoted){if(inToken){tokens.push(token);token='';inToken=false;}}
    else{token+=char;inToken=true;}
  }
  if(quoted)return [];if(inToken)tokens.push(token);return tokens;
}
export function processMatchesReceipt(observation, receipt, stage, settings, requireListening=true) {
  const pin = settings.components[stage.component];
  const entry = path.win32.join(pin.packageRoot, stage.entry.replaceAll('/', '\\'));
  if (!observation || !receipt || !Number.isInteger(observation.pid) || observation.pid < 1
      || observation.pid !== receipt.pid || observation.parentPid !== receipt.parentPid || observation.ownerSid !== settings.ownerSid
      || !equal(observation.nodePath, settings.node.path) || receipt.nodeSha256 !== settings.node.sha256.toLowerCase()
      || receipt.stage !== stage.name || receipt.copyId !== settings.copyId || receipt.actualT1 !== false
      || receipt.sourceCommit !== pin.sourceCommit || !equal(receipt.packageRoot, pin.packageRoot)
      || !equal(receipt.configPath, pin.config.path) || !equal(receipt.configSha256, pin.config.sha256)
      || !equal(receipt.entryPath, entry) || !/^[a-f0-9]{64}$/.test(receipt.entrySha256 ?? '')
      || !equal(nativeArgumentTokens(observation.commandLine)[0],settings.node.path)
      || !equal(nativeArgumentTokens(observation.commandLine)[1],entry)
      || Math.abs(Date.parse(observation.creationTime) - Date.parse(observation.managedCreationTime)) > 1
      || observation.creationTime !== receipt.creationTime || !Number.isFinite(Date.parse(receipt.creationTime))) return false;
  const tokens=nativeArgumentTokens(observation.commandLine).slice(1);
  const expected=stage.component==='crm'||stage.component==='edge'?[entry]:[entry,...(stage.mode?[stage.mode]:[]),pin.config.path];
  if(tokens.length!==expected.length||tokens.some((token,index)=>!equal(token,expected[index])))return false;
  const parentEntry=path.win32.join(settings.stackPackage.packageRoot,'scripts','canonical','hub-stack-driver.mjs');
  const parentTokens=nativeArgumentTokens(observation.parentCommandLine);
  if(receipt.supervisorSourceCommit!==settings.stackPackage.sourceCommit||!equal(receipt.parentEntryPath,parentEntry)
      || !/^[a-f0-9]{64}$/.test(receipt.parentEntrySha256??'')||observation.parentOwnerSid!==settings.ownerSid
      || !equal(observation.parentNodePath,settings.node.path)||!equal(parentTokens[0],settings.node.path)
      || !equal(parentTokens[1],parentEntry)||observation.parentCreationTime!==receipt.driverCreationTime)return false;
  const bindings = observation.bindings;
  if (!Array.isArray(bindings) || requireListening&&!bindings.length
      || bindings.some(item => !stage.ports.includes(item.port) || !(item.address === '127.0.0.1'
        || stage.component !== 'edge' && /^192\.168\.1\.(?:[1-9]|[1-9]\d|1\d{2}|2[0-4]\d|25[0-4])$/.test(item.address)))) return false;
  return !requireListening||stage.ports.every(port => bindings.some(item => item.port === port && item.address === '127.0.0.1'));
}

export async function stackAttempt(settings, driver) {
  const started = [], tracked = [];
  try {
    await driver.verifyPins(settings);
    const sql = await driver.sqlReady(settings);
    if (sql?.ready !== true || sql.readOnlyProbe !== true || sql.database !== settings.database || sql.copyId !== settings.copyId) fail('SQL_NOT_READY');
    for (const stage of STACK_STAGES) {
      const before = await driver.inspect(stage);
      let child;
      if (before.length) {
        if (before.length !== 1) fail('FOREIGN_PORT_OWNER');
        child = await driver.existingReceipt(stage);
        if (!processMatchesReceipt(before[0], child, stage, settings)) fail('FOREIGN_PORT_OWNER');
        await driver.validateReceiptPins(child, stage);
      } else {
        child = await driver.start(stage);
        started.push({stage, child});
      }
      await driver.readiness(stage, child);
      tracked.push({stage, child});
      if(stage.name==='crmServer')await driver.publishHealth?.(tracked,'running');
    }
    await driver.monitor(tracked);
    fail('OWNED_CHILD_EXITED');
  } finally {
    // Never kill an adopted child. Stop only children from this exact attempt,
    // rechecking OS creation/parent/config/entry/node pins immediately first.
    try{await driver.publishHealth?.(tracked,'stopping');}finally{await cleanupOwnedChildren(started,driver);}
  }
}

function safeBaseEnvironment(env) {
  return Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','COMSPEC','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA',
    'HOMEDRIVE','HOMEPATH','USERNAME','USERDOMAIN','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS']
    .filter(key => typeof env[key] === 'string').map(key => [key, env[key]]));
}
function noReparse(target) {
  let cursor = target;
  while (cursor.length > 3) { if (fs.lstatSync(cursor).isSymbolicLink()) fail('REPARSE_PATH_REJECTED'); cursor = path.dirname(cursor); }
}
function readPin(ref) {
  noReparse(ref.path); const bytes = fs.readFileSync(ref.path);
  if (!equal(sha(bytes), ref.sha256)) fail('FILE_HASH_REJECTED'); return bytes;
}
function packageFiles(pin, crm = false) {
  const manifest = JSON.parse(readPin({path: path.join(pin.packageRoot, 'release-manifest.json'), sha256: pin.manifestSha256}));
  if ((crm ? manifest.source?.commit : manifest.sourceCommit) !== pin.sourceCommit || !Array.isArray(manifest.files) || !manifest.files.length) fail('PACKAGE_SOURCE_REJECTED');
  const seen = new Map();
  for (const item of manifest.files) {
    if (typeof item.path !== 'string' || /[\x00-\x1f"'`$%<>|?:*]/.test(item.path) || path.isAbsolute(item.path)
        || item.path.split(/[\\/]/).some(part => !part || part === '..' || part === '.')) fail('MANIFEST_PATH_REJECTED');
    const target = path.resolve(pin.packageRoot, item.path), key = target.toLowerCase();
    if (seen.has(key) || !key.startsWith(`${pin.packageRoot.toLowerCase()}${path.sep}`)) fail('MANIFEST_PATH_REJECTED');
    seen.set(key,item.sha256.toLowerCase()); readPin({path: target, sha256: item.sha256});
  }
  return seen;
}
function verifyDependencyLock(ref, pin, moduleRoot) {
  const lock = JSON.parse(readPin(ref));
  if (lock.schemaVersion !== 1 || lock.sourceCommit !== pin.sourceCommit || !equal(lock.packageRoot, pin.packageRoot)
      || !Array.isArray(lock.files) || !lock.files.length) fail('DEPENDENCY_LOCK_REJECTED');
  const all = new Map();
  for (const item of lock.files) {
    if (typeof item.path !== 'string' || !item.path.startsWith(`${moduleRoot}/node_modules/`)
        || item.path.split(/[\\/]/).some(part => !part || part === '..' || part === '.')
        || /[\x00-\x1f"'`$%<>|?:*]/.test(item.path)) fail('DEPENDENCY_LOCK_REJECTED');
    const absolute = path.resolve(pin.packageRoot, item.path), key = absolute.toLowerCase();
    if (all.has(key)) fail('DEPENDENCY_LOCK_REJECTED'); all.set(key, item.sha256); readPin({path: absolute, sha256: item.sha256});
  }
  const root = path.join(pin.packageRoot, moduleRoot, 'node_modules'), observed = new Set();
  const scan = directory => { noReparse(directory); for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name); if (entry.isSymbolicLink()) fail('DEPENDENCY_REPARSE_REJECTED');
    if (entry.isDirectory()) scan(absolute); else if (entry.isFile()) observed.add(absolute.toLowerCase()); else fail('DEPENDENCY_FILE_REJECTED');
  }};
  scan(root);
  if (observed.size !== all.size || [...observed].some(file => !all.has(file))) fail('DEPENDENCY_INVENTORY_DRIFT');
}

export async function createRuntimeDriver(settings,{readOnlyProbe=false}={}) {
  const shell = path.join(settings.windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const ownRoot = settings.stackPackage.packageRoot;
  const probe = path.join(ownRoot, 'scripts', 'canonical', 'hub-stack-process-probe.ps1');
  const stateRoot = path.join(settings.runtimeRoot, 'hub-stable-stack');
  const inspect = async (stage,pid=null) => {
    const argv=['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',probe,'-Ports',stage.ports.join(',')];
    if(pid!==null){if(!Number.isInteger(pid)||pid<1)fail('OS_PROBE_PID_REJECTED');argv.push('-ProcessId',String(pid));}
    const {stdout} = await runFile(shell, argv, {windowsHide:true,timeout:10000,maxBuffer:128*1024});
    const result = JSON.parse(stdout.replace(/^\ufeff/, '')); if (!Array.isArray(result)) fail('OS_PROBE_SHAPE_REJECTED'); return result;
  };
  let operation, crm, native, hubPin, crmPins, crmIndexPin;const entries=new Map();
  const json = ref => JSON.parse(readPin(ref).toString('utf8').replace(/^\ufeff/, ''));
  const receiptPath = stage => path.join(stateRoot, `${stage.name}.json`);
  const save = (stage, value) => { const file = receiptPath(stage), tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value)); fs.renameSync(tmp, file); };
  const observationsMatch = async (stage, child) => { const rows = await inspect(stage); return rows.length === 1 && processMatchesReceipt(rows[0], child, stage, settings); };
  const driver = {
    inspect,
    async verifyPins() {
      if (process.platform !== 'win32' || !equal(process.execPath, settings.node.path)
          || !settings.privateSources || !settings.dependencyLocks || !settings.crmPrivateFiles) fail('ACTIVATION_DEPENDENCY_PINS_REQUIRED');
      const {stdout: actualSid}=await runFile(shell,['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,timeout:10000});
      if(actualSid.trim()!==settings.ownerSid)fail('CURRENT_OWNER_REJECTED');
      readPin({path: settings.node.path, sha256: settings.node.sha256}); packageFiles(settings.stackPackage);
      readPin({path:path.join(ownRoot,'scripts','canonical','watch-hub-stack.ps1'),sha256:settings.stackPackage.entrySha256});
      for (const name of componentNames) {
        const files=packageFiles(settings.components[name],name==='crm');readPin(settings.components[name].config);
        if(name==='crm')crmIndexPin=files.get(path.join(settings.components.crm.packageRoot,'apps','frontend','dist','client','index.html').toLowerCase());
        for(const stage of STACK_STAGES.filter(item=>item.component===name)){
          const entry=path.join(settings.components[name].packageRoot,stage.entry),entryPin=files.get(entry.toLowerCase());
          if(!entryPin)fail('FIXED_ENTRY_NOT_MANIFEST_PINNED');entries.set(stage.name,entryPin);
        }
      }
      for (const name of ['erpApiNative','nativeOrder','crm']) verifyDependencyLock(settings.dependencyLocks[name],settings.components[name],name==='crm'?'apps/gateway':'apps/api');
      for (const ref of Object.values(settings.privateSources)) readPin(ref);
      for (const ref of Object.values(settings.crmPrivateFiles)) readPin(ref);
      operation=json(settings.privateSources.operationConfig);native=json(settings.privateSources.nativeOrderConfig);
      crm=json(settings.privateSources.crmActivationConfig);hubPin=json(settings.privateSources.hubPinConfig);
      if (!equal(settings.privateSources.operationConfig.path,settings.components.erpApiNative.config.path)
          || !equal(settings.privateSources.operationConfig.path,settings.components.hub.config.path)
          || !equal(settings.privateSources.nativeOrderConfig.path,settings.components.nativeOrder.config.path)
          || !equal(settings.privateSources.crmActivationConfig.path,settings.components.crm.config.path)
          || operation.database!==HUB_STACK_DATABASE || operation.copyContext?.copyId!==HUB_STACK_COPY_ID
          || operation.erpPort!==4184 || operation.nativePort!==4186 || operation.webPort!==5234 || operation.host!=='127.0.0.1'
          || native.database!==HUB_STACK_DATABASE || native.crmOrderCurrentContext?.copyId!==HUB_STACK_COPY_ID
          || native.nativePort!==62704 || native.crmOrderCurrentContext?.actualT1!==false
          || native.crmOrderCurrentContext?.externalOperations!==false || native.crmOrderCurrentContext?.stockEffect!==false || native.crmOrderCurrentContext?.ledgerEffect!==false
          || hubPin.apiSourceCommit!==settings.components.erpApiNative.sourceCommit) fail('PRIVATE_CONFIG_SCOPE_REJECTED');
      crmChildEnvironment(crm,settings,safeBaseEnvironment(process.env));
      const crmIndex=path.join(settings.components.crm.packageRoot,'apps','frontend','dist','client','index.html');
      if(!crmIndexPin)fail('CRM_INDEX_NOT_MANIFEST_PINNED');readPin({path:crmIndex,sha256:crmIndexPin});
      crmPins=validateCrmHubPins(hubPin,settings,crm,crmIndexPin);
      if(!readOnlyProbe){fs.mkdirSync(stateRoot,{recursive:true});noReparse(stateRoot);
        fs.mkdirSync(path.dirname(crmPins.healthPath),{recursive:true});noReparse(path.dirname(crmPins.healthPath));
        await driver.publishHealth([],'degraded');}
    },
    async sqlReady() {
      const require=createRequire(path.join(settings.components.erpApiNative.packageRoot,'apps','api','package.json'));
      return coldSqlProbe(operation,require('mssql'));
    },
    async existingReceipt(stage) {try{return JSON.parse(fs.readFileSync(receiptPath(stage),'utf8'));}catch{return null;}},
    async validateReceiptPins(receipt,stage) {if(receipt.entrySha256!==entries.get(stage.name))fail('RECEIPT_ENTRY_PIN_REJECTED');readPin({path:receipt.entryPath,sha256:receipt.entrySha256});readPin({path:receipt.parentEntryPath,sha256:receipt.parentEntrySha256});readPin(settings.components[stage.component].config);},
    async start(stage) {
      const pin=settings.components[stage.component],entry=path.join(pin.packageRoot,stage.entry),entrySha256=entries.get(stage.name);
      readPin({path:entry,sha256:entrySha256});readPin(pin.config);
      let env=safeBaseEnvironment(process.env),args=[entry];
      if(stage.component==='crm')env=crmChildEnvironment(crm,settings,env);
      else if(stage.mode)args.push(stage.mode,pin.config.path);else args.push(pin.config.path);
      if(stage.name==='hub')env.MELISA_HUB_CONFIG_PATH=settings.privateSources.hubPinConfig.path;
      if(stage.name==='edge'){env.MELISA_HUB_EDGE_CONFIG_PATH=pin.config.path;env.MELISA_HUB_EDGE_CONFIG_SHA256=pin.config.sha256;args=[entry];}
      const run=crypto.randomUUID();
      const out=fs.openSync(path.join(stateRoot,`${stage.name}-${run}.out.log`),'wx');
      const err=fs.openSync(path.join(stateRoot,`${stage.name}-${run}.err.log`),'wx');
      let child;
      try{child=spawn(settings.node.path,args,{cwd:stage.component==='crm'?pin.packageRoot:path.join(pin.packageRoot,'apps','api'),env,windowsHide:true,stdio:['ignore',out,err]});}finally{fs.closeSync(out);fs.closeSync(err);}
      await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('HUB_STACK_CHILD_SPAWN_FAILED')));});
      const receipt={pid:child.pid,parentPid:process.pid,stage:stage.name,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,
        configPath:pin.config.path,configSha256:pin.config.sha256.toLowerCase(),nodeSha256:settings.node.sha256.toLowerCase(),
        copyId:settings.copyId,actualT1:false,entryPath:entry,entrySha256,creationTime:null,run,
        supervisorSourceCommit:settings.stackPackage.sourceCommit,parentEntryPath:fileURLToPath(import.meta.url),
        parentEntrySha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),driverCreationTime:null};
      for(let tick=0;tick<40;tick++){
        const rows=await inspect(stage,child.pid);
        if(rows.length===1&&rows[0].pid===child.pid){receipt.creationTime=rows[0].creationTime;receipt.driverCreationTime=rows[0].parentCreationTime;if(!processMatchesReceipt(rows[0],receipt,stage,settings,false))fail('NEW_CHILD_IDENTITY_REJECTED');save(stage,receipt);return receipt;}
        if(child.exitCode!==null)fail('NEW_CHILD_EXITED');
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      // No blind kill when no listen/creation receipt can be proved.
      fail('NEW_CHILD_NO_VERIFIED_RECEIPT');
    },
    async readiness(stage,child) {
      let ready=false;
      for(let tick=0;tick<120;tick++){if(await observationsMatch(stage,child)){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,250));}
      if(!ready)fail('CHILD_RECEIPT_DRIFT');
      if(stage.component==='crm'){await verifyCrmReadiness(stage,settings,hubPin);return;}
      const route='/test-health';
      const response=await fetch(`http://127.0.0.1:${stage.ports[0]}${route}`,{method:'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(4000)});
      if(!response.ok)fail('DEPENDENCY_HEALTH_NOT_READY');
      const text=await response.text();if(text.length>65536)fail('HEALTH_TOO_LARGE');const h=JSON.parse(text),pin=settings.components[stage.component];
      if(h.ok!==true||h.sourceCommit!==pin.sourceCommit||h.copyId!==settings.copyId||h.actualT1!==false
          ||(h.databaseName??h.database)!==settings.database)fail('DEPENDENCY_HEALTH_IDENTITY_REJECTED');
      if(['erpNative','erpApi'].includes(stage.name)&&['sysadmin','databaseControl','liveDatabaseAccess','originalDatabaseAccess'].some(name=>h[name]!==0))fail('DEPENDENCY_HEALTH_PRIVILEGE_REJECTED');
      if(['erpNative','erpApi','crmNativeOrder'].includes(stage.name)&&(h.externalOperations!==false||h.automaticJobs!==false))fail('DEPENDENCY_EXTERNAL_GATE_REJECTED');
    },
    async monitor(children) {
      // No restart inside this driver. PowerShell owns the single 3/60 budget.
      try{for(;;){
        for(const {stage,child} of children)if(!await observationsMatch(stage,child))fail('OWNED_CHILD_EXITED');
        for(const {stage,child} of children.filter(item=>['erpApi','crmNativeOrder','crmServer','crmCatalog','crmOrders'].includes(item.stage.name)))await driver.readiness(stage,child);
        await driver.publishHealth(children,'running');await new Promise(resolve=>setTimeout(resolve,15000));
      }}catch(error){await driver.publishHealth(children,'degraded');throw error;}
    },
    async publishHealth(children,state) {
      if(!crmPins)return;
      const target=crmPins.healthPath;noReparse(path.dirname(target));if(fs.existsSync(target))noReparse(target);
      const temporary=`${target}.${process.pid}.tmp`;
      fs.writeFileSync(temporary,JSON.stringify(crmHealthReceipt(settings,children,{state})),{flag:'wx'});fs.renameSync(temporary,target);
    },
    async reportCleanupSurvivors(survivors) {
      const target=path.join(stateRoot,'cleanup-unverified.json');
      fs.writeFileSync(target,JSON.stringify({state:'manual-recovery-required',observedAt:new Date().toISOString(),survivors}));
    },
    async stopOwned(stage,child) {
      const rows=await inspect(stage,child.pid);
      if(rows.length!==1||!processMatchesReceipt(rows[0],child,stage,settings,false))return false;
      readPin({path:child.entryPath,sha256:child.entrySha256});readPin({path:child.parentEntryPath,sha256:child.parentEntrySha256});readPin(settings.components[stage.component].config);
      // This pid is this attempt's child with matching OS creation and parent.
      process.kill(child.pid);return true;
    },
  };
  return driver;
}

export async function runPinnedStackDriver({configPath,configSha256,ownerSid,mode='Probe',driverFactory=createRuntimeDriver}) {
  const settings=JSON.parse(readPin({path:configPath,sha256:configSha256}).toString('utf8').replace(/^\ufeff/,''));
  createHubStackBootPlan({...settings,currentOwnerSid:ownerSid,startupConfig:{path:configPath,sha256:configSha256}});
  const expected=path.join(settings.stackPackage.packageRoot,'scripts','canonical','hub-stack-driver.mjs');
  if(!equal(fileURLToPath(import.meta.url),expected)&&driverFactory===createRuntimeDriver)fail('DRIVER_EXECUTION_PACKAGE_REJECTED');
  const driver=await driverFactory(settings,{readOnlyProbe:mode==='Probe'});
  if(mode==='Probe'){await driver.verifyPins(settings);const proof=await driver.sqlReady(settings);if(proof.ready!==true)fail('SQL_NOT_READY');return {prepared:true,probe:'readonly-sql',actualBootTested:false,copyId:settings.copyId};}
  if(mode!=='Start')fail('DRIVER_MODE_REJECTED');
  await stackAttempt(settings,driver);
}
if(process.argv[1]&&equal(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
  const keys=['--config','--sha256','--owner-sid','--mode'],args=process.argv.slice(2);
  try{
    if(args.length!==8||keys.some((key,index)=>args[index*2]!==key))fail('DRIVER_ARGUMENTS_REJECTED');
    await runPinnedStackDriver({configPath:args[1],configSha256:args[3],ownerSid:args[5],mode:args[7]});
    process.stdout.write('HUB_STACK_READONLY_PROBE_VERIFIED\n');
  }catch(error){const code=/^HUB_STACK_[A-Z_]+$/.test(error?.message??'')?error.message:'HUB_STACK_DRIVER_FAILED';process.stderr.write(code+'\n');process.exitCode=1;}
}
