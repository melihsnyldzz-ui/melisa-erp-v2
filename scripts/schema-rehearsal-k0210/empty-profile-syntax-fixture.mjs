// Entirely synthetic 2030 process/SID and in-memory database metadata.
// Temporary public receipt files exercise the real file/hash loader; no SQL runs.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {REHEARSAL_SERVER,REHEARSAL_DATABASE} from './identity.mjs';
import {OLD_TABLES,NEW_TABLES,ALL_TABLES,ADDED_COLUMNS,NEW_COLUMN_SHAPES,NEW_CHILDREN,NEW_TABLE_INDEXES,columnShape,REFERENCE_ROWS} from './empty-profile-fragments.mjs';
import {HASH_FIELDS,SOURCE_SIGNATURE,utf16sha,utf8sha,loadReviewedUpgrade} from './empty-profile-review.mjs';
import {compileCompleteSchema2Observer,compileEmptyProfileUpgrade,compileEmptyProfileObserver} from './empty-profile-upgrade.mjs';
export const SYNTHETIC_IDENTITY=Object.freeze({server:REHEARSAL_SERVER,database:REHEARSAL_DATABASE,databaseId:9,databaseGuid:'6d773db9-bd69-4906-b791-d63a490ab1f2',databaseCreateTime:'2026-11-10T11:10:18.030',environmentId:'287f689a-43bb-43dd-950b-adb615fcb20c',adminPid:60101,adminProcessBirth:'2030-01-01T09:00:00.0000000Z',adminSid:'0x0102030405060708',sqlProcessId:60102,sqlProcessBirth:'2030-01-01T08:00:00.0000000Z'});
const schemaObject=(name,type='U',parentName=null)=>({schemaName:'dbo',name,type,parentSchema:parentName?'dbo':null,parentName,definition:null});
export function syntheticSemantic(version){
 const b={schemas:[{name:'dbo'}],synonyms:[],userTypes:[],objects:OLD_TABLES.map(n=>schemaObject(n)),columns:OLD_TABLES.map(tableName=>({schemaName:'dbo',tableName,columnName:'id',...columnShape('bigint'),is_nullable:false,is_identity:true,is_computed:false})),keys:[],indexes:[],foreignKeys:[],checks:[],defaults:[]};
 if(version===2)return b;
 b.objects.push(...NEW_TABLES.map(n=>schemaObject(n)),...NEW_CHILDREN.map(x=>schemaObject(x.name,x.type,x.parentName)));
 b.columns.push(...ADDED_COLUMNS.map(([tableName,columnName,type])=>({schemaName:'dbo',tableName,columnName,...columnShape(type),is_nullable:true,is_identity:false,is_computed:false})),...NEW_COLUMN_SHAPES.map(x=>({schemaName:'dbo',...x})));
 const oldIndexes=[['suppliers','UX_desktop_v3_supplier_entity'],['party_currency_accounts','UX_desktop_v3_supplier_account'],['party_currency_accounts','UX_desktop_v4_customer_currency'],['stock_movements','UX_desktop_goods_stock_once']];
 b.indexes.push(...oldIndexes.map(([tableName,name])=>({schemaName:'dbo',tableName,name})),...NEW_TABLE_INDEXES.map(x=>({schemaName:'dbo',...x})));
 const fks=[['suppliers','FK_desktop_v3_supplier_entity'],['party_currency_accounts','FK_desktop_v3_account_supplier'],['purchase_invoices','FK_v6_purchase_invoices_entity'],['purchase_invoices','FK_v6_purchase_invoices_account'],['supplier_movements','FK_v6_supplier_movements_entity'],['supplier_movements','FK_v6_supplier_movements_account']];
 b.foreignKeys.push(...fks.map(([tableName,name])=>({schemaName:'dbo',tableName,name,is_disabled:false,is_not_trusted:false,is_not_for_replication:false})));
 return b;
}
export function syntheticNative(version){
 const tables=version===2?OLD_TABLES:ALL_TABLES,semantic=syntheticSemantic(version),tableId=new Map(tables.map((n,i)=>[n,100+i]));
 const objectIds=semantic.objects.map((x,i)=>({schemaName:x.schemaName,name:x.name,type:x.type,objectId:x.type==='U'?tableId.get(x.name):1000+i,parentObjectId:x.parentName?tableId.get(x.parentName):0,parentName:x.parentName}));
 const identities=semantic.columns.filter(x=>x.is_identity).map(x=>({schemaName:'dbo',tableName:x.tableName,objectId:tableId.get(x.tableName),columnId:1,columnName:x.columnName,seedValue:'1',incrementValue:'1',lastValue:version===7&&x.tableName==='system_settings'?'2':version===7&&x.tableName==='finance_accounts'?'1':null,identCurrent:version===7&&x.tableName==='system_settings'?'2':'1'}));
 const references=version===2?{settings:[],cash:[]}:{settings:REFERENCE_ROWS.settings.map((x,i)=>({id:i+1,...x})),cash:[{id:1,...REFERENCE_ROWS.cash}]};
 const values={metadata:{tables:tables.map(table_name=>({schema_name:'dbo',table_name}))},security:{principals:[{principal_id:20,name:'desktop_local_writer_v2',type:'R',owning_principal_id:1}],members:[],permissions:[]},objectIds,identities,rows:tables.map(tableName=>({tableName,rowCount:tableName==='desktop_empty_installation'?1:version===7&&tableName==='system_settings'?2:version===7&&tableName==='finance_accounts'?1:0})),marker:[{id:1,environment_id:SYNTHETIC_IDENTITY.environmentId,schema_version:version,actual_t1:false,external_operations:false,read_only:false,created_at:'2030-01-01T10:00:00.000'}],semantic,references};
 const out={state:`K0210_EMPTY_PROFILE_SCHEMA${version}_OBSERVED`};for(const k of HASH_FIELDS){out[k+'Json']=JSON.stringify(values[k]);out[k+'Sha256']=utf16sha(out[k+'Json']);}return out;
}
export function withSyntheticUpgradeCase(action){
 const dir=mkdtempSync(join(tmpdir(),'k0210-empty-upgrade-')),files={};const put=(name,value)=>{const bytes=JSON.stringify(value);writeFileSync(join(dir,name),bytes,{flag:'wx'});files[name]=value;return utf8sha(bytes);};
 try{
  const rehearsalTarget=Object.fromEntries(['server','database','databaseId','databaseGuid','databaseCreateTime','environmentId','adminSid','sqlProcessId','sqlProcessBirth'].map(k=>[k,SYNTHETIC_IDENTITY[k]]));
  const native=syntheticNative(2),candidateJson=JSON.stringify(syntheticSemantic(7));
  const pins={};pins['upgrade-baseline.json']=put('upgrade-baseline.json',{native,sourceSignature:SOURCE_SIGNATURE});
  pins['upgrade-rollback.json']=put('upgrade-rollback.json',{sourceSignature:SOURCE_SIGNATURE,baselineSha256:pins['upgrade-baseline.json'],operationId:'20000000-0000-4000-8000-000000000001',executeReaderCount:1,sqlSubmitted:true,exited:true,exitCode:0,executorProcess:{pid:60103,birthUtc:'2030-01-01T10:00:00.0000000Z'},protocol:{phase:'BATCH_COMPLETE',openReturned:true,openAdmissionPassed:true,openExceptionObserved:false,overflow:false,openInformation:[{phase:'OPENING',source:'InfoMessage',nativeError:5701,sqlState:'01000'}],batchInformation:[],batchExceptions:[{phase:'BATCH',nativeError:51990,sqlState:'42000'}]},capture:{fieldNames:['state','semanticJson','semanticSha256'],resultSetCount:1,rows:[{state:'K0210_EMPTY_PROFILE_DDL_CANDIDATE',semanticJson:candidateJson,semanticSha256:utf16sha(candidateJson)}],readerDisposed:true,sqlExceptionObserved:true,nonSqlError:false,sqlErrors:[{nativeError:51990,sqlState:'42000'}]}});
  pins['upgrade-after-rollback.json']=put('upgrade-after-rollback.json',{native:structuredClone(native),observerProcess:{pid:60104,birthUtc:'2030-01-01T10:01:00.0000000Z'},exited:true,exitCode:0});
  for(const n of ['upgrade-baseline.json','upgrade-rollback.json','upgrade-after-rollback.json']){files[n].target=rehearsalTarget;const text=JSON.stringify(files[n]);writeFileSync(join(dir,n),text);pins[n]=utf8sha(text);}
  files['upgrade-rollback.json'].baselineSha256=pins['upgrade-baseline.json'];writeFileSync(join(dir,'upgrade-rollback.json'),JSON.stringify(files['upgrade-rollback.json']));pins['upgrade-rollback.json']=utf8sha(JSON.stringify(files['upgrade-rollback.json']));
  pins['upgrade-actual-review.json']=put('upgrade-actual-review.json',{decision:'GO_EMPTY_PROFILE_DDL_ROLLBACK_ONLY',P1P2Findings:0,sourceSignature:SOURCE_SIGNATURE,operationId:files['upgrade-rollback.json'].operationId,pins:{...pins}});
  const acceptanceSha=put('upgrade-rollback-acceptance.json',{state:'ROOT_K0210_EMPTY_PROFILE_DDL_ROLLBACK_ACCEPTANCE',sourceSignature:SOURCE_SIGNATURE,target:rehearsalTarget,realRollbackAccepted:true,applyAuthorized:false,pins});
  const target={server:REHEARSAL_SERVER,database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',schemaVersion:7};
  const proof={state:'OWN_LEDGER_CURRENT_RUNNING_TARGET',sourceHead:'1'.repeat(40),packageSha256:'2'.repeat(64),sourceCount:317,target,processes:[{kind:'owner',ProcessId:60105,ParentProcessId:60000},{kind:'worker',ProcessId:60106,ParentProcessId:60105}],listeners:[{LocalAddress:'127.0.0.1',LocalPort:4294,OwningProcess:60106},{LocalAddress:'127.0.0.1',LocalPort:5294,OwningProcess:60106}]};
  const proofSha=put('current-running-target.json',proof);
  const decision={state:'ROOT_K0210_EMPTY_PROFILE_APPLY_DECISION',operationId:'20000000-0000-4000-8000-000000000002',target:rehearsalTarget,rollbackAcceptanceSha256:acceptanceSha,sourceSignature:SOURCE_SIGNATURE,schemaApplyAuthorized:true,technicalReferenceSeedsAuthorized:true,referencePolicySha256:utf8sha(JSON.stringify(REFERENCE_ROWS)),usersChanged:false,rolesChanged:false,permissionsChanged:false,grantsChanged:false,credentialsChanged:false,businessSeed:false,automaticRetry:false,runtimeAction:false,runtime:{proofFile:join(dir,'current-running-target.json'),proofSha256:proofSha,sourceHead:proof.sourceHead,packageSha256:proof.packageSha256,sourceCount:317,target}};
  const decisionSha=put('upgrade-apply-decision.json',decision);
  const args={acceptanceFile:join(dir,'upgrade-rollback-acceptance.json'),expectedAcceptanceSha256:acceptanceSha,applyDecisionFile:join(dir,'upgrade-apply-decision.json'),expectedApplyDecisionSha256:decisionSha};
  return action({dir,files,args,load:()=>loadReviewedUpgrade(args)});
 }finally{if(dirname(resolve(dir))!==resolve(tmpdir())||!basename(dir).startsWith('k0210-empty-upgrade-'))throw Error('SYNTHETIC_TEMP_PATH');rmSync(dir,{recursive:true,force:false});}
}
export function emitEmptyProfileSyntaxFixture(){return withSyntheticUpgradeCase(({load})=>{
 const {baseline,authority}=load();const cases=[['baseline',compileCompleteSchema2Observer(SYNTHETIC_IDENTITY),0],['ddl-rollback',compileEmptyProfileUpgrade(SYNTHETIC_IDENTITY,baseline,'rollback'),7],['apply-reference-seeds',compileEmptyProfileUpgrade(SYNTHETIC_IDENTITY,baseline,'apply',authority),9],['schema7-observer',compileEmptyProfileObserver(SYNTHETIC_IDENTITY,baseline,authority),0]];
 return {kind:'K0210_EMPTY_PROFILE_SYNTHETIC_TSQL160_FIXTURE',executionAuthorized:false,sqlExecuted:false,identityIsSynthetic:true,baselineIsSynthetic:true,identityFixture:SYNTHETIC_IDENTITY,cases:cases.map(([name,d,minimumLiteralBodies])=>({name,sql:d.sql,sha256:d.sha256,minimumLiteralBodies}))};
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(JSON.stringify(emitEmptyProfileSyntaxFixture()));
