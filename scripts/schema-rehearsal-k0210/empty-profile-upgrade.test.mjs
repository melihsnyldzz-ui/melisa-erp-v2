import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {MASTER_V3_OPERATION_CHECK_SQL} from '../desktop-empty/master-v3-journal-sql.mjs';
import {MASTER_V4_OPERATION_CHECK_SQL} from '../desktop-empty/master-v4-journal-sql.mjs';
import {compileDesktopGoodsV6SchemaFragments} from '../../apps/api/src/config/desktopGoodsV6Schema.mjs';
import {DESKTOP_FINANCE_PROPOSAL_SQL} from '../../apps/api/src/config/desktopFinanceSchemaProposal.mjs';
import {OLD_TABLES,NEW_TABLES,ALL_TABLES,ADDED_COLUMNS,NEW_CHILDREN,NEW_COLUMN_SHAPES,V3_ADD_COLUMN,V3_SCHEMA,V4_SCHEMA,V6_SCHEMA,V7_SCHEMA,SETTINGS_INSERT,SETTINGS_VERIFY,CASH_INSERT,REFERENCE_ROWS,UPGRADE_SCHEMA_STAGES} from './empty-profile-fragments.mjs';
import {HASH_FIELDS,utf16sha,utf8sha,reviewCompleteSchema2Baseline,nativeRecord,compareUpgradeSemantic,loadReviewedUpgrade} from './empty-profile-review.mjs';
import {compileCompleteSchema2Observer,compileEmptyProfileUpgrade,compileEmptyProfileObserver} from './empty-profile-upgrade.mjs';
import {compileCompleteSchema2Observer as rawSecurityBaselineV1} from './empty-profile-baseline.mjs';
import {SYNTHETIC_IDENTITY as m,syntheticNative,syntheticSemantic,withSyntheticUpgradeCase,emitEmptyProfileSyntaxFixture} from './empty-profile-syntax-fixture.mjs';
const source=n=>readFileSync(new URL('../desktop-empty/'+n,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const nativeChange=(r,k,mutate)=>{const v=JSON.parse(r[k+'Json']);mutate(v);r[k+'Json']=JSON.stringify(v);r[k+'Sha256']=utf16sha(r[k+'Json']);};
test('named inline REFERENCES retain all51 declared children and reject each missing or changed FK',()=>{
 // These16 named column constraints are present in the existing V6/V7 DDL
 // and in the rejected native candidate; FOREIGN KEY-only inventory omitted them.
 const inline=[
  ['desktop_goods_receipts','FK_dgr_supplier'],['desktop_goods_receipts','FK_dgr_account'],['desktop_goods_receipts','FK_dgr_actor'],['desktop_goods_receipts','FK_dgr_invoice'],
  ['desktop_goods_receipt_lines','FK_dgl_receipt'],['desktop_goods_receipt_lines','FK_dgl_product'],['desktop_goods_receipt_lines','FK_dgl_selected_unit'],['desktop_goods_receipt_lines','FK_dgl_base_unit'],['desktop_goods_receipt_lines','FK_dgl_movement'],
  ['desktop_goods_purchase_links','FK_dgp_line'],['desktop_goods_purchase_links','FK_dgp_invoice'],['desktop_goods_purchase_links','FK_dgp_item'],
  ['desktop_goods_requests','FK_dgreq_actor'],['desktop_goods_requests','FK_dgreq_receipt'],
  ['finance_account_movements','FK_finance_account_movements_account'],['desktop_finance_requests','FK_desktop_finance_requests_actor']
 ];
 assert.equal(NEW_CHILDREN.length,51);assert.equal(new Set(NEW_CHILDREN.map(x=>x.name)).size,51);
 for(const [parentName,name] of inline){
  assert.deepEqual(NEW_CHILDREN.filter(x=>x.name===name),[{parentName,name,type:'F'}]);
  assert((V6_SCHEMA+'\n'+V7_SCHEMA).includes('CONSTRAINT '+name+' REFERENCES '));
 }
 const before=JSON.stringify(syntheticSemantic(2));assert.doesNotThrow(()=>compareUpgradeSemantic(before,JSON.stringify(syntheticSemantic(7))));
 for(const [,name] of inline)for(const mutate of [c=>c.objects=c.objects.filter(x=>x.name!==name),c=>c.objects.find(x=>x.name===name).parentName='users',c=>c.objects.find(x=>x.name===name).type='C']){
  const c=syntheticSemantic(7);mutate(c);assert.throws(()=>compareUpgradeSemantic(before,JSON.stringify(c)));
 }
 const extra=syntheticSemantic(7);extra.objects.push({schemaName:'dbo',parentSchema:'dbo',parentName:'desktop_goods_receipts',name:'FK_undeclared',type:'F'});assert.throws(()=>compareUpgradeSemantic(before,JSON.stringify(extra)));
});
function rebind(c,mutate){mutate(c.files);const put=n=>{const bytes=JSON.stringify(c.files[n]);writeFileSync(join(c.dir,n),bytes);return utf8sha(bytes);};const names=['upgrade-baseline.json','upgrade-rollback.json','upgrade-after-rollback.json'];const pins=Object.fromEntries(names.map(n=>[n,put(n)]));c.files['upgrade-rollback.json'].baselineSha256=pins['upgrade-baseline.json'];pins['upgrade-rollback.json']=put('upgrade-rollback.json');c.files['upgrade-actual-review.json'].pins={...pins};pins['upgrade-actual-review.json']=put('upgrade-actual-review.json');c.files['upgrade-rollback-acceptance.json'].pins=pins;c.args.expectedAcceptanceSha256=put('upgrade-rollback-acceptance.json');c.files['upgrade-apply-decision.json'].rollbackAcceptanceSha256=c.args.expectedAcceptanceSha256;c.args.expectedApplyDecisionSha256=put('upgrade-apply-decision.json');}
test('the finite upgrade reuses the exact legacy schema slices and removes only the explicit reference seed statements',()=>{
 const v3=source('master-v3-transition.mjs').match(/const ddl=`([\s\S]*?)`;/)[1].split('\n GRANT INSERT')[0].replace('${MASTER_V3_OPERATION_CHECK_SQL}',MASTER_V3_OPERATION_CHECK_SQL).trimEnd();assert.equal(V3_SCHEMA,v3);assert(source('master-v3-transition.mjs').includes("EXEC sys.sp_executesql N'"+V3_ADD_COLUMN+"'"));
 const v4=source('master-v4-transition.mjs').match(/const ddl=`([\s\S]*?)`;/)[1].replace('${MASTER_V4_OPERATION_CHECK_SQL}',MASTER_V4_OPERATION_CHECK_SQL);assert.equal(V4_SCHEMA,v4);
 assert.equal(V6_SCHEMA,compileDesktopGoodsV6SchemaFragments({mode:'apply'}).sql.replace(SETTINGS_INSERT+SETTINGS_VERIFY,''));assert.equal(V7_SCHEMA,DESKTOP_FINANCE_PROPOSAL_SQL.replace(CASH_INSERT,''));
 assert.equal(UPGRADE_SCHEMA_STAGES.length,6);assert.equal(OLD_TABLES.length,36);assert.equal(NEW_TABLES.length,7);assert.equal(ALL_TABLES.length,43);assert.equal(ADDED_COLUMNS.length,15);assert(NEW_CHILDREN.length>0&&NEW_COLUMN_SHAPES.length>0);
});
test('complete schema2 native input covers every36-table object and identity; legacy27 and rows/default coercions reject',()=>{
 const r=syntheticNative(2),b=reviewCompleteSchema2Baseline(r);assert.equal(Object.keys(b.hashes).length,8);assert.doesNotThrow(()=>compileEmptyProfileUpgrade(m,b,'rollback'));
 for(const mutate of [x=>nativeChange(x,'metadata',o=>o.tables.splice(0,9)),x=>nativeChange(x,'objectIds',o=>o.splice(0,9)),x=>nativeChange(x,'identities',o=>o.splice(0,9)),x=>nativeChange(x,'rows',o=>o.find(y=>y.tableName==='users').rowCount=1),x=>nativeChange(x,'references',o=>o.settings.push({setting_key:'creditTermsDays',setting_value:'30'})),x=>x.metadataJson+=' ']){const x=structuredClone(r);mutate(x);assert.throws(()=>reviewCompleteSchema2Baseline(x));}
 assert.throws(()=>compileEmptyProfileUpgrade(m,JSON.parse(JSON.stringify(b)),'rollback'));
});
test('DDL-only rollback never consumes an existing identity or grants/creates users; all schema steps share one transaction',()=>{
 const b=reviewCompleteSchema2Baseline(syntheticNative(2)),d=compileEmptyProfileUpgrade(m,b,'rollback');assert.equal(d.executionAuthorized,false);assert.equal(d.rollbackWritesExistingIdentityTables,false);assert.equal(d.referenceSeeds,null);
 assert.doesNotMatch(d.sql,/\bINSERT\s+dbo\.|\bGRANT\b|\bDENY\b|\bREVOKE\b|\bDBCC\b|\bRESEED\b|IDENTITY_INSERT|CREATE\s+(?:LOGIN|USER|ROLE)|\bCOMMIT\b/i);assert.equal((d.sql.match(/BEGIN TRANSACTION/g)||[]).length,1);assert.match(d.sql,/THROW 51990,'K0210_EMPTY_PROFILE_DDL_ROLLBACK',1/);
 assert.doesNotMatch(d.sql,/5240|30002|permissions:49|MELISA_ERP_DESKTOP_TEST_20261105|eb2888c2-51cb-4570-a933-397cf7e62806/);assert.match(d.sql,/K0210_COMPLETE_BASELINE_CHANGED/);assert.match(d.sql,/K0210_OLD_OBJECT_IDENTITY_OR_SECURITY_CHANGED/);
});
test('only the trusted same-process file loader yields an apply brand; copying/serializing it or passing a Boolean rejects',()=>withSyntheticUpgradeCase(c=>{
 const {baseline,authority}=c.load();const d=compileEmptyProfileUpgrade(m,baseline,'apply',authority);assert.equal(d.executionAuthorized,false);assert.equal(d.requiresAuthenticatedRollbackReceipt,true);assert.deepEqual(d.referenceSeeds,REFERENCE_ROWS);assert.match(d.sql,/COMMIT TRANSACTION;SELECT N'K0210_EMPTY_PROFILE_SCHEMA7_APPLIED'/);assert.match(d.sql,/K0210_UPGRADE_CANDIDATE_CHANGED/);
 for(const value of [true,{...authority},JSON.parse(JSON.stringify(authority)),{candidateSemanticSha256:authority.candidateSemanticSha256}])assert.throws(()=>compileEmptyProfileUpgrade(m,baseline,'apply',value));
 assert.throws(()=>compileEmptyProfileUpgrade(m,baseline,'rollback',authority));
 const o=compileEmptyProfileObserver({...m,adminPid:60107},baseline,authority);assert.equal(o.readOnly,true);assert.match(o.sql,/IDENT_CURRENT\(N'dbo.system_settings'\).*ISNULL\(@settingsLast,0\)\+2/);assert.doesNotMatch(o.sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|GRANT|RESEED|DBCC)\b/i);
}));
test('plain serialized acceptance, changed hashes, compound batch errors and reused observer process are not apply authority',()=>{
 for(const mutate of [f=>f['upgrade-rollback-acceptance.json'].realRollbackAccepted='true',f=>f['upgrade-rollback.json'].capture.sqlErrors.push({nativeError:3621,sqlState:'01000'}),f=>f['upgrade-rollback.json'].protocol.batchInformation.push({nativeError:5701,sqlState:'01000'}),f=>f['upgrade-rollback.json'].protocol.openInformation.push({phase:'OPENING',source:'InfoMessage',nativeError:1205,sqlState:'01000'}),f=>f['upgrade-after-rollback.json'].observerProcess.pid=f['upgrade-rollback.json'].executorProcess.pid,f=>f['upgrade-actual-review.json'].decision='GO_SOURCE_ONLY',f=>f['upgrade-apply-decision.json'].grantsChanged=true,f=>nativeChange(f['upgrade-after-rollback.json'].native,'identities',x=>x.find(i=>i.tableName==='system_settings').lastValue='2')])withSyntheticUpgradeCase(c=>{rebind(c,mutate);assert.throws(c.load);});
 withSyntheticUpgradeCase(c=>{writeFileSync(join(c.dir,'upgrade-actual-review.json'),'{}');assert.throws(c.load);});
});
test('undeclared old changes, fifteen-column precision drift, unknown new columns/constraints/triggers and wrong tables reject',()=>{
 const before=JSON.stringify(syntheticSemantic(2));
 for(const mutate of [c=>c.synonyms.push({name:'foreign'}),c=>c.columns.find(x=>x.columnName==='party_entity_id').is_nullable=false,c=>c.columns.find(x=>x.columnName==='account_amount').scale=2,c=>c.columns.push({schemaName:'dbo',tableName:NEW_TABLES[0],columnName:'unknown',typeName:'int'}),c=>c.objects.push({schemaName:'dbo',parentSchema:'dbo',parentName:NEW_TABLES[0],name:'unknown',type:'C'}),c=>c.objects.push({schemaName:'dbo',parentSchema:'dbo',parentName:NEW_TABLES[0],name:'trigger',type:'TR'}),c=>c.objects=c.objects.filter(x=>x.name!==NEW_TABLES[0])]){const c=syntheticSemantic(7);mutate(c);assert.throws(()=>compareUpgradeSemantic(before,JSON.stringify(c)));}
});
test('reference rows are exactly two original lock defaults and one zero TRY cash; no commercial/default terms are fabricated',()=>{
 assert.deepEqual(REFERENCE_ROWS.settings.map(x=>[x.setting_group,x.setting_key,x.setting_value,x.value_type,x.is_active]),[['accounting','periodLockEnabled','false','boolean',true],['accounting','periodLockedThroughDate',null,'string',true]]);assert.equal(REFERENCE_ROWS.cash.opening_balance,'0.0000');assert.equal(REFERENCE_ROWS.cash.current_balance,'0.0000');
 assert.doesNotThrow(()=>nativeRecord(syntheticNative(7),7));for(const mutate of [r=>nativeChange(r,'references',x=>x.cash[0].current_balance='1.0000'),r=>nativeChange(r,'references',x=>x.settings[1].setting_value='2030-01-01'),r=>nativeChange(r,'rows',x=>x.find(y=>y.tableName==='sales_invoices').rowCount=1)]){const r=syntheticNative(7);mutate(r);assert.throws(()=>nativeRecord(r,7));}
});
test('baseline and final observers are read-only, DB5/excluded identity refuses, and syntax fixture is only four fake2030 previews',()=>{
 const d=compileCompleteSchema2Observer(m);assert.equal(d.readOnly,true);assert.match(d.sql,/sys.identity_columns/);assert.match(d.sql,/parent_object_id parentObjectId/);assert.match(d.sql,/COUNT_BIG\(\*\) AS \[rowCount\]/);assert.doesNotMatch(d.sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|GRANT|RESEED|DBCC)\b/i);
 for(const change of [{databaseId:5},{databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1'},{environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806'},{databaseCreateTime:'2026-02-30T10:00:00.000'}])assert.throws(()=>compileCompleteSchema2Observer({...m,...change}));
 const f=emitEmptyProfileSyntaxFixture();assert.equal(f.sqlExecuted,false);assert.equal(f.identityIsSynthetic,true);assert.equal(f.identityFixture.adminProcessBirth.slice(0,4),'2030');assert.deepEqual(f.cases.map(x=>x.name),['baseline','ddl-rollback','apply-reference-seeds','schema7-observer']);assert(f.cases.every(x=>utf8sha(x.sql)===x.sha256));
});
test('security collector v2 changes only the two optional SQL collections and preserves the frozen v1 source',()=>{
 const previous=rawSecurityBaselineV1(m),current=compileCompleteSchema2Observer(m);
 const members="JSON_QUERY((SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) members";
 const permissions="JSON_QUERY((SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES)) permissions";
 const canonical=s=>s.replace('JSON_QUERY((', 'JSON_QUERY(COALESCE((').replace(')) ', "),N'[]')) ");
 assert.equal(previous.sql.split(members).length,2);assert.equal(previous.sql.split(permissions).length,2);
 assert.equal(current.sql,previous.sql.replace(members,canonical(members)).replace(permissions,canonical(permissions)));
 assert.notEqual(current.sha256,previous.sha256);assert.equal(current.readOnly,true);
});
test('raw native security NULL is never silently coerced by the consumer; canonical empty arrays remain valid',()=>{
 assert.doesNotThrow(()=>reviewCompleteSchema2Baseline(syntheticNative(2)));
 for(const k of ['members','permissions']){const n=syntheticNative(2);nativeChange(n,'security',s=>s[k]=null);const old=n.securityJson;assert.throws(()=>reviewCompleteSchema2Baseline(n));assert.equal(n.securityJson,old);}
});
