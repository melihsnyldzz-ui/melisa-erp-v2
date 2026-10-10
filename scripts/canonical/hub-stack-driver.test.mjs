import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {STACK_STAGES,SQL_IDENTITY_QUERY,SQL_WRITE_PERMISSION_QUERY,assertSqlIdentity,coldSqlProbe,crmChildEnvironment,
  nativeArgumentTokens,processMatchesReceipt,stackAttempt,validateCrmHubPins,verifyCrmReadiness,crmHealthReceipt,cleanupOwnedChildren} from './hub-stack-driver.mjs';
const hash='a'.repeat(64), source='b'.repeat(40), owner='S-1-5-21-123-456-789-1001';
function settings() {
  const root='C:\\Sirket\\ERP\\releases';
  const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub','edge'].map(name=>[name,{packageRoot:`${name==='crm'?'C:\\Sirket\\CRM\\releases':root}\\${name}`,
    sourceCommit:source,manifestSha256:hash,config:{path:`C:\\Sirket\\ERP\\runtime\\hub\\${name}.json`,sha256:hash}}]));
  return {ownerSid:owner,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',
    node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:hash},stackPackage:{packageRoot:`${root}\\stack`,sourceCommit:source},
    runtimeRoot:'C:\\Sirket\\ERP\\runtime',components,crmPrivateFiles:{baseline:{path:'C:\\private\\baseline.env',sha256:hash},catalogAccess:{path:'C:\\Sirket\\CRM\\runtime\\catalog.json',sha256:hash}}};
}
function receipt(stage,s) {
  const pin=s.components[stage.component];
  return {pid:123,parentPid:42,stage:stage.name,copyId:s.copyId,actualT1:false,nodeSha256:hash,sourceCommit:source,
    packageRoot:pin.packageRoot,configPath:pin.config.path,configSha256:hash,entryPath:path.win32.join(pin.packageRoot,stage.entry),entrySha256:hash,
    creationTime:'2026-10-11T00:00:01.0000000Z',supervisorSourceCommit:source,parentEntryPath:path.win32.join(s.stackPackage.packageRoot,'scripts/canonical/hub-stack-driver.mjs'),
    parentEntrySha256:hash,driverCreationTime:'2026-10-11T00:00:00.0000000Z'};
}
function observation(stage,s,r=receipt(stage,s)) {
  const args=stage.component==='crm'||stage.component==='edge'?[]:[...(stage.mode?[stage.mode]:[]),`"${r.configPath}"`];
  return {pid:r.pid,parentPid:r.parentPid,ownerSid:s.ownerSid,nodePath:s.node.path,commandLine:`"${s.node.path}" ${r.entryPath} ${args.join(' ')}`.trim(),
    creationTime:r.creationTime,managedCreationTime:r.creationTime,parentOwnerSid:owner,parentNodePath:s.node.path,parentCommandLine:`"${s.node.path}" ${r.parentEntryPath} --config x --mode Start`,
    parentCreationTime:r.driverCreationTime,bindings:stage.ports.map(port=>({address:'127.0.0.1',port}))};
}
function crmConfig(s) {
  const pin=s.components.crm;
  return {sourceCommit:source,packageRoot:pin.packageRoot,packageManifestSha256:hash,database:s.database,actualT1:false,externalOperations:false,paidAi:false,whatsappSend:false,
    environmentVariables:{CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_EXPECTED_DATABASE:s.database,
      CRM_TEST_SOURCE_COMMIT:source,CRM_TEST_PACKAGE_ROOT:pin.packageRoot,CRM_TEST_PACKAGE_MANIFEST_SHA256:hash,CRM_TEST_NATIVE_SOURCE_COMMIT:source,
      CRM_STABLE_TRANSPORT:'true',CRM_TEST_COPY_ID:s.copyId,CRM_TEST_RUNTIME_DIR:'C:\\Sirket\\CRM\\runtime\\hub',CRM_TEST_LOG_DIR:'C:\\Sirket\\CRM\\logs\\hub',
      CRM_BASELINE_ENV:s.crmPrivateFiles.baseline.path,CRM_ERP_CATALOG_ACCESS_PATH:s.crmPrivateFiles.catalogAccess.path,CRM_PAID_AI_ENABLED:'true',
      CRM_AI_SALES_MODE:'copilot',WHATSAPP_SEND_ENABLED:'true',WHATSAPP_LIVE_SEND_APPROVED:'true',WAAPI_CHATWOOT_BRIDGE_ENABLED:'true',WAAPI_INCOMING_READER_ENABLED:'true',CRM_TEST_LAN_ADDRESS:'192.168.1.46'}};
}
function sqlConfig(){return {database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',server:'Semih\\MELISADEV',sqlUser:'readonly-fixture',sqlPassword:'synthetic-private-password',
  copyContext:{copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',sealHash:hash,target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',server:'Semih\\MELISADEV'}}};}
function sqlRow(c){return {databaseName:c.database,serverName:c.copyContext.target.server,loginName:c.sqlUser,databaseUser:c.sqlUser,sysadmin:0,databaseControl:0,
  originalDatabaseAccess:0,liveDatabaseAccess:0,copyId:c.copyContext.copyId,sealHash:hash};}

test('cold probe is SQL-auth SELECT-only and closes even on a rejected permission or identity', async()=>{
  const config=sqlConfig(),queries=[];let connected,closed=0;
  class Pool {constructor(options){connected=options;}async connect(){}async close(){closed++;}request(){return {input(){return this;},async query(text){queries.push(text);return {recordset: text===SQL_IDENTITY_QUERY?[sqlRow(config)]:[]};}};}}
  const proof=await coldSqlProbe(config,{ConnectionPool:Pool,UniqueIdentifier:'fixture'});
  assert.equal(proof.readOnlyProbe,true);assert.equal(closed,1);assert.equal(connected.user,'readonly-fixture');assert.equal(connected.password,config.sqlPassword);
  assert.equal(Object.hasOwn(connected,'trustedConnection'),false);assert.equal(queries.length,2);
  for(const query of queries){assert.match(query,/^SELECT /);assert.doesNotMatch(query,/\b(?:EXEC(?:UTE)?|INSERT INTO|UPDATE\s+dbo|DELETE FROM|ALTER\s+TABLE|CREATE\s+TABLE|BACKUP|RESTORE)\b/i);}
  assert.doesNotMatch(JSON.stringify(proof),/synthetic-private-password|readonly-fixture/);
});

test('wrong server/DB/login/copy/seal, elevated or original/LIVE access cannot pass cold SQL proof',()=>{
  const c=sqlConfig();for(const key of ['databaseName','serverName','loginName','databaseUser','copyId','sealHash','sysadmin','databaseControl','originalDatabaseAccess','liveDatabaseAccess']){
    const row=sqlRow(c);row[key]='wrong';assert.throws(()=>assertSqlIdentity(row,c),/COLD_SQL_IDENTITY_REJECTED/);
  }
  assert.throws(()=>assertSqlIdentity({...sqlRow(c),sysadmin:'0'},c),/COLD_SQL_IDENTITY_REJECTED/);
});

test('cold SQL denies reader write privileges and closes the connection',async()=>{
  const c=sqlConfig();let closed=false;
  class Pool {async connect(){}async close(){closed=true;}request(){return {input(){return this;},async query(text){return {recordset:text===SQL_IDENTITY_QUERY?[sqlRow(c)]:[{permission_name:'UPDATE'}]};}};}}
  await assert.rejects(coldSqlProbe(c,{ConnectionPool:Pool,UniqueIdentifier:'fixture'}),/COLD_SQL_WRITE_PRIVILEGE_REJECTED/);assert.equal(closed,true);
});

test('direct CRM env pins current source and hard-disables AI/send; stale5f8/unknown secret keys cannot pass',()=>{
  const s=settings(),c=crmConfig(s),env=crmChildEnvironment(c,s,{SystemRoot:'C:\\Windows'});
  for(const key of ['CRM_PAID_AI_ENABLED','WHATSAPP_SEND_ENABLED','WHATSAPP_LIVE_SEND_APPROVED','WAAPI_CHATWOOT_BRIDGE_ENABLED','WAAPI_INCOMING_READER_ENABLED'])assert.equal(env[key],'false');
  assert.equal(env.CRM_AI_SALES_MODE,'off');assert.equal(env.CRM_TEST_LAN_ADDRESS,'');assert.equal(env.CRM_STABLE_TRANSPORT,'true');
  assert.throws(()=>crmChildEnvironment({...c,sourceCommit:'5f8cb2375c8dbc8713c6769da2b5ba65480f2f41'},s),/CRM_ACTIVATION_PIN_REJECTED/);
  assert.throws(()=>crmChildEnvironment({...c,environmentVariables:{...c.environmentVariables,NODE_OPTIONS:'--import evil'}},s),/CRM_ACTIVATION_PIN_REJECTED/);
  assert.throws(()=>crmChildEnvironment({...c,paidAi:true},s),/CRM_ACTIVATION_PIN_REJECTED/);
  assert.throws(()=>crmChildEnvironment({...c,environmentVariables:{...c.environmentVariables,CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4144'}},s),/CRM_ENVIRONMENT_SCOPE_REJECTED/);
});

test('argv parser preserves Windows paths and receipt requires exact child+parent+config+source+creation+loopback tuple',()=>{
  const s=settings(),stage=STACK_STAGES[0],r=receipt(stage,s),o=observation(stage,s,r);
  assert.equal(processMatchesReceipt(o,r,stage,s),true);
  assert.deepEqual(nativeArgumentTokens('"C:\\Program Files\\node.exe" C:\\a\\entry.mjs "C:\\a b\\config.json"'),['C:\\Program Files\\node.exe','C:\\a\\entry.mjs','C:\\a b\\config.json']);
  for(const key of ['pid','parentPid','ownerSid','nodePath','creationTime','parentOwnerSid','parentNodePath','parentCreationTime','parentCommandLine'])assert.equal(processMatchesReceipt({...o,[key]:'wrong'},r,stage,s),false,key);
  for(const key of ['sourceCommit','configSha256','copyId','entryPath','supervisorSourceCommit'])assert.equal(processMatchesReceipt(o,{...r,[key]:'wrong'},stage,s),false,key);
  assert.equal(processMatchesReceipt({...o,bindings:[{address:'0.0.0.0',port:4186}]},r,stage,s),false);
  assert.equal(processMatchesReceipt({...o,bindings:[]},r,stage,s),false);
  assert.equal(processMatchesReceipt({...o,bindings:[]},r,stage,s,false),true);
  assert.equal(processMatchesReceipt({...o,commandLine:o.commandLine+' --extra'},r,stage,s),false);
});

function mockDriver(s,{foreign=false,badSql=false,badPins=false}={}) {
  const events=[],stops=[];return {events,stops,
    async verifyPins(){events.push('pins');if(badPins)throw Error('HUB_STACK_PACKAGE_SOURCE_REJECTED');},
    async sqlReady(){events.push('sql');return {ready:!badSql,readOnlyProbe:true,database:s.database,copyId:s.copyId};},
    async inspect(stage){events.push(`inspect:${stage.name}`);return foreign?[{pid:999}]:[];},
    async existingReceipt(){return null;},async validateReceiptPins(){events.push('receipt-pin');},
    async start(stage){events.push(`start:${stage.name}`);return receipt(stage,s);},
    async readiness(stage){events.push(`ready:${stage.name}`);},async monitor(){throw Error('HUB_STACK_OWNED_CHILD_EXITED');},
    async stopOwned(stage){stops.push(stage.name);},
  };
}
test('one attempt starts native/API/order/directCRM/Hub/edge in exact order then rolls back only its own new children',async()=>{
  const s=settings(),d=mockDriver(s);await assert.rejects(stackAttempt(s,d),/OWNED_CHILD_EXITED/);
  assert.deepEqual(d.events.slice(0,2),['pins','sql']);
  assert.deepEqual(d.events.filter(item=>item.startsWith('start:')).map(item=>item.slice(6)),STACK_STAGES.map(stage=>stage.name));
  assert.deepEqual(d.stops,[...STACK_STAGES].reverse().map(stage=>stage.name));
  assert.equal(d.events.some(item=>/supervisor/.test(item)),false);
});
test('package/SQL failures and foreign port owners stop before any child or role/trade creation',async()=>{
  const s=settings();for(const option of [{badPins:true},{badSql:true},{foreign:true}]){const d=mockDriver(s,option);await assert.rejects(stackAttempt(s,d));assert.equal(d.events.filter(item=>item.startsWith('start:')).length,0);assert.equal(d.stops.length,0);}
});

test('runtime source has only fixed starters and SELECT probe; no task/network change or convenience-role mint',()=>{
  const text=fs.readFileSync(new URL('./hub-stack-driver.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(text,/test-supervisor\.mjs|watch-hub-web\.ps1|Register-ScheduledTask|tailscale serve|Set-NetFirewall|\/api\/auth\/(?:test-admin|stage4-actor)/i);
  assert.match(text,/ACTIVATION_DEPENDENCY_PINS_REQUIRED/);assert.match(text,/DEPENDENCY_INVENTORY_DRIFT/);
  assert.match(text,/processMatchesReceipt\(rows\[0\],child,stage,settings,false\)/);
  assert.match(text,/CRM_STABLE_TRANSPORT/);
  assert.match(SQL_WRITE_PERMISSION_QUERY,/sys\.fn_my_permissions/);
});

function stableCrmFixture(){const s=settings();s.components.crm.packageRoot=`C:\\Sirket\\CRM\\releases\\crm-shared-stable-test-${source}`;const c=crmConfig(s);c.environmentVariables.CRM_TEST_RUNTIME_DIR=`C:\\Sirket\\CRM\\runtime\\hub-stable-${source}`;
 const pin={apiSourceCommit:source,crmSourceCommit:source,crmPackageId:`crm-shared-stable-test-${source}`,crmIndexSha256:hash,crmHealthPath:path.win32.join(c.environmentVariables.CRM_TEST_RUNTIME_DIR,'health-status.json')};return{s,c,pin};}
test('CRM heartbeat path/source/package/index are cross-pinned and cannot overwrite legacy runtime',()=>{
 const {s,c,pin}=stableCrmFixture();assert.equal(validateCrmHubPins(pin,s,c,hash).packageId,pin.crmPackageId);
 for(const key of ['apiSourceCommit','crmSourceCommit','crmPackageId','crmIndexSha256','crmHealthPath'])assert.throws(()=>validateCrmHubPins({...pin,[key]:'wrong'},s,c,hash),/CRM_HUB_PIN_REJECTED/);
 const old=structuredClone(c);old.environmentVariables.CRM_TEST_RUNTIME_DIR='C:\\Sirket\\CRM\\runtime\\ERP-FINAL04-20261010';assert.throws(()=>validateCrmHubPins({...pin,crmHealthPath:path.win32.join(old.environmentVariables.CRM_TEST_RUNTIME_DIR,'health-status.json')},s,old,hash),/CRM_HUB_PIN_REJECTED/);
});
test('CRM readiness requires 200 exact HTML SHA plus safe source-bound health; 403/404/500 never pass',async()=>{
 const {s,pin}=stableCrmFixture();const bytes='legacy-shell';pin.crmIndexSha256=(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
 const stage=STACK_STAGES.find(x=>x.name==='crmServer');const h={ok:true,identityKind:'CONFIGURED_TEST_TRANSPORT',dependencyProof:'SEPARATE_ERP_NATIVE_PROBES',service:'gateway',sourceCommit:source,packageId:pin.crmPackageId,database:s.database,copyId:s.copyId,actualT1:false,externalOperations:false,paidAi:false,whatsappSend:false};
 const fetcher=(status=200,body=h,html=bytes)=>async url=>new Response(url.endsWith('/test-health')?JSON.stringify(body):html,{status});
 assert.equal((await verifyCrmReadiness(stage,s,pin,fetcher())).ready,true);
 for(const code of [201,401,403,404,500])await assert.rejects(verifyCrmReadiness(stage,s,pin,fetcher(code)),/CRM_READINESS_STATUS_REJECTED/);
 await assert.rejects(verifyCrmReadiness(stage,s,pin,fetcher(200,h,'wronghtml')),/CRM_INDEX_PIN_REJECTED/);
 for(const key of ['ok','service','sourceCommit','packageId','database','copyId','actualT1','externalOperations','paidAi','whatsappSend'])await assert.rejects(verifyCrmReadiness(stage,s,pin,fetcher(200,{...h,[key]:'wrong'})),/CRM_HEALTH_IDENTITY_REJECTED/);
});
test('CRM health only declares running after all verified CRM and ERP/native dependencies; degraded/stopping cannot fake readiness',()=>{
 const s=settings(),children=STACK_STAGES.map(stage=>({stage,child:receipt(stage,s)}));const proof=crmHealthReceipt(s,children,{now:0});assert.equal(proof.startup.state,'running');assert.equal(proof.packageId,`crm-shared-stable-test-${source}`);
 for(const state of ['degraded','stopping']){const h=crmHealthReceipt(s,children,{state,now:1});assert.notEqual(h.startup.state,'running');assert.equal(h.dependencies.erp.state,'unverified');assert.equal(h.services.orders.state,'unverified');}
 assert.equal(crmHealthReceipt(s,children.filter(x=>x.stage.name!=='crmOrders')).startup.state,'degraded');
});
test('cleanup continues after an error or unverified survivor without killing adopted children',async()=>{
 const s=settings(),started=STACK_STAGES.map(stage=>({stage,child:receipt(stage,s)})),visited=[];let report;
 const driver={async stopOwned(stage){visited.push(stage.name);if(stage.name==='edge')throw Error('private');if(stage.name==='hub')return false;return true;},async reportCleanupSurvivors(rows){report=rows;}};
 await assert.rejects(cleanupOwnedChildren(started,driver),/CLEANUP_UNVERIFIED_SURVIVORS/);assert.deepEqual(visited,[...STACK_STAGES].reverse().map(x=>x.name));assert.deepEqual(report.map(x=>x.stage),['edge','hub']);
});
