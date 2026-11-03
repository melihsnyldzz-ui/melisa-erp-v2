import assert from 'node:assert/strict';
import test from 'node:test';
import {backupProjection,copyRecoveryProjection,startupProjection,createWorkSystemService} from './workSystemService.mjs';
import {fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext,isolatedCopyTopology} from './isolatedOperationCopyContext.mjs';
import {validateSystemSummary} from '../../../sites-workflow/src/workflow/workSystemSettingsModel.mjs';

const valid='2026-10-08T20:32:43.5743848Z';
const database='MELISA_ERP_SIRKET_TEST_20260929_01';
const actor={id:16,displayName:'Offline personel',role:{code:'isolated_test_ilker'},permissions:['finance.view']};
function backup(date=valid){return {version:1,environment:'TEST',sourceDatabase:database,backup:{status:'success',completedAt:date,checksumVerified:true,sizeBytes:10},restore:{status:'success',completedAt:date,sourceDatabaseMatched:true,criticalDataMatched:true}};}
function recovery(date=valid,shared=false){return {schemaVersion:shared?'melisa-shared-test.recovery-comparison.v1':'melisa-stage4.recovery-comparison.v1',status:'PASS',comparedAt:date,tablesCompared:shared?51:29,moduleDefinitionsCompared:shared?177:337,sourceBeforeAfterEqual:true,...(shared?{rawCopyMatchesSource:true}:{bothRawRestoresMatchSource:true,recoveryReadOnly:true,operationalCopyReadWrite:true}),changed:[],hashBasis:'SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET',actualRestorePerformed:true,activeDatabaseOverwritten:false,coverage:shared?'51 critical tables; not all database rows':'29 critical tables and all SQL modules/native columns; not whole database rows'};}
function copy(date=valid,shared=false,mutate=()=>{}){
 const raw=shared?structuredClone(businessInboundFixture().copy):fixtureContext();raw.recoveryProof=recovery(date,shared);mutate(raw);
 const {sealHash,...body}=raw;return validateIsolatedOperationCopyContext({...body,sealHash:isolatedCopyHash(body)});
}
function startup(observedAt){return {version:1,environment:'TEST',observedAt,sourceCommit:'offline',startup:{configured:true,state:'running'}};}
const invalidDates=['2026-02-31T00:00:00Z','2025-02-29T00:00:00Z','1900-02-29T00:00:00Z','2100-02-29T00:00:00Z','2026-04-31T12:00:00+03:00','2026-06-31T23:30:00.123456789-04:00','2026-11-31T00:00:00+14:00'];

for(const date of invalidDates)test(`public backup/restore projection cannot promote impossible calendar ${date}`,()=>{
 assert.equal(Number.isFinite(Date.parse(date)),true,'Old parser must accept the concrete counterexample');
 const record=backup(date),before=JSON.stringify(record),result=backupProjection(record);
 assert.equal(result.backup.status,'unknown');assert.equal(result.backup.lastSuccessAt,null);assert.equal(result.restore.status,'unknown');assert.equal(result.restore.lastSuccessAt,null);
 assert.equal(Object.hasOwn(result,'recoveryEvidence'),false);assert.equal(JSON.stringify(record),before);
});

for(const shared of [false,true])for(const date of [invalidDates[0],invalidDates[1],invalidDates[4]])test(`public ${shared?'shared':'stage4'} recovery projection rejects impossible sealed comparison ${date}`,()=>{
 const context=copy(date,shared),before=JSON.stringify(context),result=copyRecoveryProjection(context);
 assert.deepEqual(result,backupProjection(null));assert.equal(Object.hasOwn(result,'recoveryEvidence'),false);assert.equal(JSON.stringify(context),before);
});

const validDates=['2024-02-29T00:00:00Z','2000-02-29T00:00:00Z','2400-02-29T00:00:00Z','1900-02-28T00:00:00Z','0000-02-29T00:00:00Z','0096-02-29T00:00:00Z','+010000-02-29T00:00:00Z','2026-10-08T20:32:43.5Z','2026-10-08T20:32:43.574Z',valid,'2026-10-08T20:32:43.574384899Z','2024-02-29T00:15:00+14:00','2024-02-29T23:45:00-12:00','2026-12-31T23:45:00-03:30','2026-01-01T00:15:00+05:45','2024-02-29T24:00:00Z','2026-10-08','2026-10-08T20:32:43','2026-10-08 20:32:43','Thu, 08 Oct 2026 20:32:43 GMT'];
for(const date of validDates)test(`public projections preserve the existing valid timestamp ${date}`,()=>{
 const record=backup(date),before=JSON.stringify(record),result=backupProjection(record);
 assert.equal(result.backup.status,'success');assert.equal(result.restore.status,'success');assert.equal(result.backup.lastSuccessAt,date);assert.equal(result.restore.lastSuccessAt,date);assert.equal(JSON.stringify(record),before);
 assert.equal(startupProjection(startup(date),{sourceCommit:'offline',now:Date.parse(date)}).lastCheckAt,date);
});

for(const shared of [false,true])test(`valid ${shared?'shared':'stage4'} fractional/offset comparison remains historical and not current-backup proof`,()=>{
 for(const date of [valid,'2024-02-29T00:15:00+14:00','2024-02-29T23:45:00.123456789-12:00']){
  const result=copyRecoveryProjection(copy(date,shared));assert.equal(result.backup.status,'success');assert.equal(result.restore.status,'success');assert.equal(result.recoveryEvidence.comparedAt,date);assert.equal(result.recoveryEvidence.currentBackupVerified,false);assert.equal(result.recoveryEvidence.coverage,'recorded_copy_scope');
 }
});

test('null, unknown and failed evidence retain their existing separate states without inference',()=>{
 for(const date of [null,undefined,'not-a-date']){
  const record=backup(date);record.backup.completedAt=date;record.restore.completedAt=date;const result=backupProjection(record);
  assert.equal(result.backup.status,'unknown');assert.equal(result.restore.status,'unknown');assert.equal(result.backup.lastSuccessAt,null);assert.equal(result.restore.lastSuccessAt,null);
 }
 for(const state of ['unknown','failed']){const record=backup(invalidDates[0]);record.backup.status=state;record.restore.status=state;const result=backupProjection(record);assert.equal(result.backup.status,state);assert.equal(result.restore.status,state);assert.equal(result.backup.lastSuccessAt,null);assert.equal(result.restore.lastSuccessAt,null);}
});

test('startup cannot use a normalized impossible date even inside its existing freshness window',()=>{
 const result=startupProjection(startup(invalidDates[0]),{sourceCommit:'offline',now:Date.parse('2026-03-03T00:00:00Z')});assert.deepEqual(result,{status:'unknown',lastCheckAt:null});
});

test('startup keeps exact 90-second and five-second boundaries plus source/environment checks',()=>{
 const now=Date.parse('2026-11-03T09:00:00Z');
 for(const [delta,allowed] of [[-90000,true],[-90001,false],[5000,true],[5001,false]]){const date=new Date(now+delta).toISOString(),result=startupProjection(startup(date),{sourceCommit:'offline',now});assert.equal(result.status,allowed?'technical_ready_acceptance_pending':'unknown');assert.equal(result.lastCheckAt,allowed?date:null);}
 for(const patch of [{sourceCommit:'other'},{environment:'LIVE'},{version:2}])assert.equal(startupProjection({...startup(new Date(now).toISOString()),...patch},{sourceCommit:'offline',now}).status,'unknown');
});

test('backup target, checksum and actual-restore prerequisites are unchanged',()=>{
 for(const patch of [{environment:'LIVE'},{sourceDatabase:'other'},{version:2}])assert.deepEqual(backupProjection({...backup(),...patch}),backupProjection(null));
 const record=backup();record.backup.checksumVerified=false;record.restore.criticalDataMatched=false;const result=backupProjection(record);assert.equal(result.backup.status,'unknown');assert.equal(result.restore.status,'unknown');
 for(const shared of [false,true])for(const mutate of [raw=>raw.recoveryProof.actualRestorePerformed=false,raw=>raw.recoveryProof.changed=['products'],raw=>raw.recoveryProof.activeDatabaseOverwritten=true])assert.deepEqual(copyRecoveryProjection(copy(valid,shared,mutate)),backupProjection(null));
 const cloned=structuredClone(copy());assert.throws(()=>copyRecoveryProjection(cloned));
});

test('real canonical summary with injected readers/clock downgrades invalid backup and startup evidence without I/O',async()=>{
 const record=backup(invalidDates[0]),calls=[],now=new Date('2026-03-03T00:00:00Z');
 const service=createWorkSystemService({context:()=>({sourceCommit:'offline',packageId:'OFFLINE'}),clock:()=>now,read:async file=>{calls.push({kind:'read',file});return file.endsWith('/backup-status.json')?record:startup(file.includes('/CRM/')?now.toISOString():invalidDates[0]);},health:async(url,check)=>{calls.push({kind:'health',url});return check(url.endsWith('/test-health')?{ok:true,databaseName:database,sourceCommit:'offline'}:{success:true});},database:async()=>{calls.push({kind:'database'});return true;}});
 const before=JSON.stringify(record),result=await service.summary(actor);
 assert.equal(result.backup.status,'unknown');assert.equal(result.restore.status,'unknown');assert.equal(result.autostart.erp.status,'unknown');assert.equal(result.autostart.erp.lastCheckAt,null);assert.equal(result.autostart.crm.status,'technical_ready_acceptance_pending');
 assert.equal(result.currentUser.id,16);assert.equal(result.currentUser.displayName,actor.displayName);assert.deepEqual(result.currentUser.roleCodes,['isolated_test_ilker']);assert.deepEqual(result.currentUser.permissionsSummary,['Finans görüntüleme']);assert.equal(result.terminal.physicalAcceptance,'pending');assert.ok(result.services.every(s=>s.status==='ready'&&s.checkedAt===now.toISOString()));
 assert.equal(validateSystemSummary(result),result);assert.equal(JSON.stringify(record),before);assert.equal(calls.filter(c=>c.kind==='read').length,3);assert.equal(calls.filter(c=>c.kind==='health').length,2);assert.equal(calls.filter(c=>c.kind==='database').length,1);await assert.rejects(()=>service.summary(null),{statusCode:403});assert.equal(calls.length,6);
});

for(const shared of [false,true])test(`real ${shared?'shared':'stage4'} summary rejects invalid recovery while retaining actor/copy/health boundaries`,async()=>{
 const context=copy(invalidDates[0],shared),port=isolatedCopyTopology(context).nativePort,now=new Date('2026-11-03T09:00:00Z'),calls=[];
 const release={sourceCommit:context.sourceCommit,packageId:'OFFLINE',copyContext:context};
 const service=createWorkSystemService({context:()=>release,clock:()=>now,read:async()=>{throw Error('Canonical file read forbidden');},database:async()=>{throw Error('Canonical database probe forbidden');},copyDatabase:async c=>{calls.push('copyDatabase');assert.equal(c,context);return true;},health:async(url,check)=>{
  calls.push(url);assert.equal(url,`http://127.0.0.1:${port}/test-health`);const response={ok:true,environment:'ISOLATED_TEST_COPY',mode:'native',port,sqlReadOnly:true,writes:false,databaseName:context.target.database,serverName:context.target.server,sysadmin:0,databaseControl:0,liveDatabaseAccess:0,originalDatabaseAccess:0,copyId:context.copyId,backupSHA:context.backupSHA,sourceCommit:release.sourceCommit,packageId:release.packageId};
  for(const patch of [{copyId:'other'},{databaseName:'other'},{sqlReadOnly:false},{sysadmin:1},{sourceCommit:'other'}])assert.equal(check({...response,...patch}),false);return check(response);
 }});
 const result=await service.summary(actor);assert.deepEqual(result.backup,backupProjection(null).backup);assert.deepEqual(result.restore,backupProjection(null).restore);assert.equal(Object.hasOwn(result,'recoveryEvidence'),false);assert.equal(validateSystemSummary(result),result);assert.equal(result.terminal.physicalAcceptance,'pending');assert.equal(result.currentUser.id,16);assert.ok(result.services.every(s=>s.status==='ready'));assert.equal(result.autostart.erp.status,'unknown');assert.equal(calls.length,2);
 await assert.rejects(()=>service.summary({...actor,role:{code:'admin'}}),{statusCode:403});await assert.rejects(()=>service.summary({...actor,id:99}),{statusCode:403});assert.equal(calls.length,2);
});
