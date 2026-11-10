// Native-record validation and finite, caller-SHA-bound rollback receipt loader.
// No SQL connection, process launch, credential access, mutation or authority by default.
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {REHEARSAL_SERVER,REHEARSAL_DATABASE} from './identity.mjs';
import {OLD_TABLES,ALL_TABLES,NEW_TABLES,ADDED_COLUMNS,NEW_COLUMN_SHAPES,NEW_CHILDREN,NEW_TABLE_INDEXES,columnShape,REFERENCE_ROWS,UPGRADE_SCHEMA_STAGES} from './empty-profile-fragments.mjs';
export const utf16sha=s=>createHash('sha256').update(s,'utf16le').digest('hex');
export const utf8sha=s=>createHash('sha256').update(s).digest('hex');
export const SOURCE_SIGNATURE=utf8sha(JSON.stringify({schema:UPGRADE_SCHEMA_STAGES,references:REFERENCE_ROWS}));
export const HASH_FIELDS=Object.freeze(['metadata','security','objectIds','identities','rows','marker','semantic','references']);
const baselines=new WeakSet(),authorities=new WeakSet(),hex=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail=()=>{throw Error('K0210_EMPTY_PROFILE_EVIDENCE_REJECTED');};
function need(x){if(!x)fail();}
function own(o,keys){need(o&&Object.getPrototypeOf(o)===Object.prototype&&same(Object.keys(o).sort(),[...keys].sort()));}
function json(s){need(typeof s==='string'&&Buffer.byteLength(s,'utf8')<=2097152);try{return JSON.parse(s);}catch{fail();}}
const parts=['schemas','synonyms','userTypes','objects','columns','keys','indexes','foreignKeys','checks','defaults'];
const fixedTarget={server:REHEARSAL_SERVER,database:REHEARSAL_DATABASE,databaseId:9,databaseGuid:'6d773db9-bd69-4906-b791-d63a490ab1f2',databaseCreateTime:'2026-11-10T11:10:18.030',environmentId:'287f689a-43bb-43dd-950b-adb615fcb20c'};
export function nativeRecord(value,version){
 own(value,['state',...HASH_FIELDS.flatMap(k=>[k+'Json',k+'Sha256'])]);
 need(value.state===`K0210_EMPTY_PROFILE_SCHEMA${version}_OBSERVED`);
 const parsed={};for(const k of HASH_FIELDS){need(hex.test(value[k+'Sha256'])&&utf16sha(value[k+'Json'])===value[k+'Sha256']);parsed[k]=json(value[k+'Json']);}
 const tables=version===2?OLD_TABLES:ALL_TABLES;need(Array.isArray(parsed.objectIds)&&Array.isArray(parsed.identities)&&Array.isArray(parsed.rows));
 const tableObjects=parsed.objectIds.filter(x=>x.type.trim()==='U');need(same(tableObjects.map(x=>x.name).sort(),tables)&&new Set(parsed.objectIds.map(x=>x.objectId)).size===parsed.objectIds.length);
 need(parsed.objectIds.every(x=>x.schemaName==='dbo'&&Number.isSafeInteger(x.objectId)&&x.objectId>0));
 need(same(parsed.rows.map(x=>x.tableName).sort(),tables)&&parsed.rows.every(x=>Number.isSafeInteger(x.rowCount)&&x.rowCount>=0));
 own(parsed.semantic,parts);need(parts.every(k=>Array.isArray(parsed.semantic[k])));
 need(same(parsed.semantic.objects.filter(x=>x.type.trim()==='U').map(x=>x.name).sort(),tables));
 need(Array.isArray(parsed.metadata.tables)&&same(parsed.metadata.tables.map(x=>x.table_name).sort(),tables));
 need(same(parsed.objectIds.map(x=>x.schemaName+'/'+x.name+'/'+x.type.trim()).sort(),parsed.semantic.objects.map(x=>x.schemaName+'/'+x.name+'/'+x.type.trim()).sort()));
 const expectedIds=parsed.semantic.columns.filter(x=>x.is_identity).map(x=>[x.tableName,x.columnName].join('/')).sort();
 need(same(parsed.identities.map(x=>x.tableName+'/'+x.columnName).sort(),expectedIds)&&parsed.identities.every(x=>tableObjects.some(t=>t.name===x.tableName&&t.objectId===x.objectId)&&x.seedValue==='1'&&x.incrementValue==='1'&&(x.lastValue===null||/^[0-9]+$/.test(x.lastValue))&&/^[0-9]+$/.test(x.identCurrent)));
 need(Array.isArray(parsed.marker)&&parsed.marker.length===1&&parsed.marker[0].id===1&&parsed.marker[0].environment_id?.toLowerCase()===fixedTarget.environmentId&&parsed.marker[0].schema_version===version&&parsed.marker[0].read_only===false&&parsed.marker[0].actual_t1===false&&parsed.marker[0].external_operations===false);
 const count=Object.fromEntries(parsed.rows.map(x=>[x.tableName,x.rowCount]));
 need(count.desktop_empty_installation===1&&tables.every(t=>['desktop_empty_installation','system_settings','finance_accounts'].includes(t)||count[t]===0));
 own(parsed.references,['settings','cash']);need(Array.isArray(parsed.references.settings)&&Array.isArray(parsed.references.cash));
 const writer=parsed.security.principals?.filter(x=>x.name==='desktop_local_writer_v2'&&x.type==='R');need(writer?.length===1&&Array.isArray(parsed.security.members)&&Array.isArray(parsed.security.permissions)&&!parsed.security.members.some(x=>x.role_principal_id===writer[0].principal_id||x.member_principal_id===writer[0].principal_id)&&!parsed.security.permissions.some(x=>x.grantee_principal_id===writer[0].principal_id||x.grantor_principal_id===writer[0].principal_id));
 if(version===2){need(count.system_settings===0&&parsed.references.settings.length===0&&parsed.references.cash.length===0);}
 else {
  need(count.system_settings===2&&count.finance_accounts===1&&parsed.references.settings.length===2&&parsed.references.cash.length===1);
  const settings=parsed.references.settings.map(({id,...row})=>row).sort((a,b)=>a.setting_key.localeCompare(b.setting_key));need(same(settings,[...REFERENCE_ROWS.settings].sort((a,b)=>a.setting_key.localeCompare(b.setting_key))));
  const {id,...cash}=parsed.references.cash[0];need(same(cash,REFERENCE_ROWS.cash));
 }
 return parsed;
}
export function reviewCompleteSchema2Baseline(native){
 const parsed=nativeRecord(native,2),value=Object.freeze({native:Object.freeze({...native}),hashes:Object.freeze(Object.fromEntries(HASH_FIELDS.map(k=>[k,native[k+'Sha256']]))),parsed});baselines.add(value);return value;
}
export function assertCompleteBaseline(b){need(baselines.has(b));return b;}
export function assertUpgradeAuthority(a,b){need(authorities.has(a)&&a.baselineHash===utf8sha(JSON.stringify(assertCompleteBaseline(b).hashes))&&a.sourceSignature===SOURCE_SIGNATURE);return a;}
function semanticShape(semantic){own(semantic,parts);need(parts.every(k=>Array.isArray(semantic[k])));}
// Old metadata may differ only where the existing reviewed DDL declares it.
// New metadata is subsequently bound byte-for-byte by its actual rollback SHA.
export function compareUpgradeSemantic(beforeJson,candidateJson){
 const b=json(beforeJson),c=json(candidateJson);semanticShape(b);semanticShape(c);
 need(same(b.objects.filter(x=>x.type.trim()==='U').map(x=>x.name).sort(),OLD_TABLES)&&same(c.objects.filter(x=>x.type.trim()==='U').map(x=>x.name).sort(),ALL_TABLES));
 const changedChecks=new Set(['CK_desktop_local_requests_operation','CK_desktop_profile_version_mode','CK_desktop_request_operation','CK_desktop_resolution_kind','CK_customer_movements_type','CK_stock_movements_source_type','CK_supplier_movements_type']);
 const newIndexes=new Set(['UX_desktop_v3_supplier_entity','UX_desktop_v3_supplier_account','UX_desktop_v4_customer_currency','UX_desktop_goods_stock_once','UX_desktop_goods_receipt_invoice','UX_desktop_goods_line_movement']);
 const newForeignKeys=new Set(['FK_desktop_v3_supplier_entity','FK_desktop_v3_account_supplier','FK_v6_purchase_invoices_entity','FK_v6_purchase_invoices_account','FK_v6_supplier_movements_entity','FK_v6_supplier_movements_account']);
 const added=new Set(ADDED_COLUMNS.map(([t,n])=>t+'/'+n));
 const skip=(x,part)=>NEW_TABLES.includes(x.tableName)||NEW_TABLES.includes(x.parentName)||(part==='objects'&&NEW_TABLES.includes(x.name))||(part==='columns'&&added.has(x.tableName+'/'+x.columnName))||((part==='checks'||part==='objects')&&changedChecks.has(x.name))||((part==='foreignKeys'||part==='objects')&&newForeignKeys.has(x.name))||(part==='indexes'&&newIndexes.has(x.name));
 for(const p of parts)need(same(b[p].filter(x=>!skip(x,p)),c[p].filter(x=>!skip(x,p))));
 for(const [tableName,columnName,type] of ADDED_COLUMNS){const rows=c.columns.filter(x=>x.tableName===tableName&&x.columnName===columnName);need(rows.length===1&&rows[0].schemaName==='dbo'&&rows[0].is_nullable===true&&rows[0].is_identity===false&&rows[0].is_computed===false);for(const [k,v] of Object.entries(columnShape(type)))need(rows[0][k]===v);}
 need(c.columns.filter(x=>added.has(x.tableName+'/'+x.columnName)).length===15);
 const newColumns=c.columns.filter(x=>NEW_TABLES.includes(x.tableName));need(newColumns.length===NEW_COLUMN_SHAPES.length);
 for(const spec of NEW_COLUMN_SHAPES){const found=newColumns.filter(x=>x.tableName===spec.tableName&&x.columnName===spec.columnName);need(found.length===1&&found[0].schemaName==='dbo');for(const [k,v] of Object.entries(spec))need(found[0][k]===v);}
 const children=c.objects.filter(x=>NEW_TABLES.includes(x.parentName));need(children.length===NEW_CHILDREN.length&&NEW_CHILDREN.every(spec=>children.filter(x=>x.name===spec.name&&x.parentName===spec.parentName&&x.type.trim()===spec.type&&x.parentSchema==='dbo'&&x.schemaName==='dbo').length===1));
 const indexes=c.indexes.filter(x=>NEW_TABLES.includes(x.tableName));need(indexes.length===NEW_TABLE_INDEXES.length&&NEW_TABLE_INDEXES.every(spec=>indexes.filter(x=>x.name===spec.name&&x.tableName===spec.tableName&&x.schemaName==='dbo').length===1));
 for(const name of newIndexes)need(c.indexes.filter(x=>x.name===name).length===1);
 for(const name of newForeignKeys)need(c.foreignKeys.filter(x=>x.name===name&&x.is_disabled===false&&x.is_not_trusted===false&&x.is_not_for_replication===false).length===1);
 need(c.objects.every(x=>x.schemaName==='dbo'&&(!NEW_TABLES.includes(x.parentName)||['PK','UQ','C','D','F'].includes(x.type.trim()))));
 need(c.checks.every(x=>x.is_disabled===false&&x.is_not_trusted===false&&x.is_not_for_replication===false)&&c.foreignKeys.every(x=>x.is_disabled===false&&x.is_not_trusted===false&&x.is_not_for_replication===false));
 return utf16sha(candidateJson);
}
const receiptNames=['upgrade-baseline.json','upgrade-rollback.json','upgrade-after-rollback.json','upgrade-actual-review.json'];
function bytesPinned(file,pin){need(hex.test(pin));let p=resolve(file);while(true){need(!lstatSync(p).isSymbolicLink());const next=dirname(p);if(next===p)break;p=next;}const bytes=readFileSync(file);need(bytes.length>0&&bytes.length<=4194304&&utf8sha(bytes)===pin);return bytes;}
// The two SHA arguments must come from the root's separately reviewed immutable
// actual-rollback acceptance and apply decision. No Boolean or serialized brand
// can reach the apply compiler. Runtime OS proof still belongs to the executor.
export function loadReviewedUpgrade({acceptanceFile,expectedAcceptanceSha256,applyDecisionFile,expectedApplyDecisionSha256}={}){
 need(basename(acceptanceFile)==='upgrade-rollback-acceptance.json'&&basename(applyDecisionFile)==='upgrade-apply-decision.json'&&dirname(resolve(acceptanceFile))===dirname(resolve(applyDecisionFile)));
 const a=json(bytesPinned(acceptanceFile,expectedAcceptanceSha256).toString('utf8')),d=json(bytesPinned(applyDecisionFile,expectedApplyDecisionSha256).toString('utf8'));
 need(a.state==='ROOT_K0210_EMPTY_PROFILE_DDL_ROLLBACK_ACCEPTANCE'&&a.sourceSignature===SOURCE_SIGNATURE&&a.realRollbackAccepted===true&&a.applyAuthorized===false);own(a.pins,receiptNames);
 const r={};for(const name of receiptNames)r[name]=json(bytesPinned(join(dirname(acceptanceFile),name),a.pins[name]).toString('utf8'));
 for(const [k,v] of Object.entries(fixedTarget))need(a.target?.[k]===v);
 need(same(d.target,a.target)&&receiptNames.slice(0,3).every(n=>same(r[n].target,a.target)));
 const baseline=reviewCompleteSchema2Baseline(r['upgrade-baseline.json'].native),after=reviewCompleteSchema2Baseline(r['upgrade-after-rollback.json'].native),rollback=r['upgrade-rollback.json'],review=r['upgrade-actual-review.json'];
 need(same(baseline.hashes,after.hashes)&&rollback.sourceSignature===SOURCE_SIGNATURE&&rollback.baselineSha256===a.pins['upgrade-baseline.json']&&rollback.executeReaderCount===1&&rollback.sqlSubmitted===true&&uuid.test(rollback.operationId));
 const p=rollback.protocol;need(p.phase==='BATCH_COMPLETE'&&p.openReturned===true&&p.openAdmissionPassed===true&&p.openExceptionObserved===false&&p.overflow===false&&p.batchInformation.length===0&&p.batchExceptions.length===1&&p.batchExceptions[0].nativeError===51990&&p.batchExceptions[0].sqlState==='42000'&&p.batchExceptions[0].phase==='BATCH');
 need(Array.isArray(p.openInformation)&&p.openInformation.length<=2&&p.openInformation.every(x=>x.phase==='OPENING'&&x.source==='InfoMessage'&&[5701,5703].includes(x.nativeError)&&x.sqlState==='01000'));for(const n of [5701,5703])need(p.openInformation.filter(x=>x.nativeError===n).length<=1);
 need(rollback.capture.resultSetCount===1&&rollback.capture.rows.length===1&&same(rollback.capture.fieldNames,['state','semanticJson','semanticSha256'])&&rollback.capture.readerDisposed===true&&rollback.capture.sqlExceptionObserved===true&&rollback.capture.nonSqlError===false&&same(rollback.capture.sqlErrors,[{nativeError:51990,sqlState:'42000'}]));
 const candidate=rollback.capture.rows[0];need(candidate.state==='K0210_EMPTY_PROFILE_DDL_CANDIDATE'&&utf16sha(candidate.semanticJson)===candidate.semanticSha256);compareUpgradeSemantic(baseline.native.semanticJson,candidate.semanticJson);
 const rp=rollback.executorProcess,ap=r['upgrade-after-rollback.json'].observerProcess;need(Number.isSafeInteger(rp.pid)&&Number.isSafeInteger(ap.pid)&&rp.pid>0&&ap.pid>0&&rp.pid!==ap.pid&&rp.birthUtc!==ap.birthUtc&&rollback.exited===true&&rollback.exitCode===0&&r['upgrade-after-rollback.json'].exited===true&&r['upgrade-after-rollback.json'].exitCode===0);
 need(review.decision==='GO_EMPTY_PROFILE_DDL_ROLLBACK_ONLY'&&review.P1P2Findings===0&&review.sourceSignature===SOURCE_SIGNATURE&&review.operationId===rollback.operationId&&same(review.pins,Object.fromEntries(receiptNames.slice(0,3).map(n=>[n,a.pins[n]]))));
 need(d.state==='ROOT_K0210_EMPTY_PROFILE_APPLY_DECISION'&&d.rollbackAcceptanceSha256===expectedAcceptanceSha256&&d.sourceSignature===SOURCE_SIGNATURE&&d.schemaApplyAuthorized===true&&d.technicalReferenceSeedsAuthorized===true&&d.referencePolicySha256===utf8sha(JSON.stringify(REFERENCE_ROWS))&&uuid.test(d.operationId)&&d.operationId!==rollback.operationId);
 for(const k of ['usersChanged','rolesChanged','permissionsChanged','grantsChanged','credentialsChanged','businessSeed','automaticRetry','runtimeAction'])need(d[k]===false);
 const rt=d.runtime;need(rt&&hex.test(rt.proofSha256)&&/^[a-f0-9]{40}$/.test(rt.sourceHead)&&hex.test(rt.packageSha256)&&rt.sourceCount===317&&rt.target?.database==='MELISA_ERP_DESKTOP_TEST_20261105'&&rt.target?.databaseGuid==='c67f5317-9c0d-4831-aadd-fadc379a95d1'&&rt.target?.environmentId==='eb2888c2-51cb-4570-a933-397cf7e62806'&&rt.target?.schemaVersion===7);
 need(basename(rt.proofFile)==='current-running-target.json');const proof=json(bytesPinned(rt.proofFile,rt.proofSha256).toString('utf8'));need(proof.state==='OWN_LEDGER_CURRENT_RUNNING_TARGET'&&proof.sourceHead===rt.sourceHead&&proof.packageSha256===rt.packageSha256&&proof.sourceCount===317&&same(proof.target,rt.target)&&proof.processes?.length===2&&proof.listeners?.length===2);
 const owner=proof.processes.filter(x=>x.kind==='owner'),worker=proof.processes.filter(x=>x.kind==='worker');need(owner.length===1&&worker.length===1&&worker[0].ParentProcessId===owner[0].ProcessId&&proof.listeners.every(x=>x.OwningProcess===worker[0].ProcessId&&x.LocalAddress==='127.0.0.1')&&same(proof.listeners.map(x=>x.LocalPort).sort(),[4294,5294]));
 const authority=Object.freeze({sourceSignature:SOURCE_SIGNATURE,baselineHash:utf8sha(JSON.stringify(baseline.hashes)),candidateSemanticSha256:candidate.semanticSha256,acceptanceSha256:expectedAcceptanceSha256,applyDecisionSha256:expectedApplyDecisionSha256,executionAuthorized:false});authorities.add(authority);return Object.freeze({baseline,authority});
}
