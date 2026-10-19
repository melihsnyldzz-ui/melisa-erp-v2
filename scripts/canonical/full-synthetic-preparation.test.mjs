import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSourceInventory, compileSyntheticPreparation, preparationDigest, SOURCE_SHA, SYNTHETIC_TARGET} from './full-synthetic-preparation.mjs';

const file = (path, text) => ({path, text});
const sample = () => buildSourceInventory([
  file('infra/sql/migrations/0001.sql', 'CREATE TABLE dbo.users(id bigint PRIMARY KEY);\nCREATE TABLE [dbo].[roles](id bigint);'),
  file('apps/api/src/services/example.mjs', "const P='dbo.usp_existing'; const sql=`CREATE PROCEDURE ${P} AS SELECT * FROM dbo.invoice_returns;`; const old=`ALTER PROCEDURE dbo.usp_only_alter AS SELECT 1`;"),
  file('apps/api/scripts/vega-native-migration-store.mjs', "await create('party_currency_accounts',{currency_code:'nvarchar(3)'});"),
]);
function profile(manifest) {return {schemaVersion:'melisa-full-synthetic-profile.v1',sourceSha:SOURCE_SHA,inventoryDigest:preparationDigest(manifest),target:{...SYNTHETIC_TARGET},origin:{kind:'FRESH_SYNTHETIC',backupUsed:false,businessDataUsed:false},externalProvidersDisabled:true};}

test('inventory resolves literal template names, bracket identifiers and known create helper without imports', () => {
  const m=sample();
  assert.equal(m.objects.find(x=>x.name==='dbo.usp_existing').state,'SOURCE_CREATE_FOUND');
  assert.equal(m.objects.find(x=>x.name==='dbo.roles').state,'SOURCE_CREATE_FOUND');
  assert.equal(m.objects.find(x=>x.name==='dbo.party_currency_accounts').state,'SOURCE_HELPER_CREATE_FOUND');
  assert.equal(m.objects.find(x=>x.name==='dbo.invoice_returns').state,'NO_CREATE_CAPTURED');
  assert.equal(m.objects.find(x=>x.name==='dbo.usp_only_alter').state,'ALTER_ONLY_NO_BASE_CREATE');
});
test('inventory is stable under input ordering and does not imply SQL validation', () => {
  const files=[file('infra/sql/a.sql','CREATE TABLE dbo.a(id bigint);'),file('infra/sql/b.sql','SELECT * FROM dbo.b;')];
  assert.deepEqual(buildSourceInventory(files),buildSourceInventory([...files].reverse()));
  assert.equal(sample().sqlApplied,false);
  assert.equal(sample().sqlSyntaxValidated,false);
  assert.equal(sample().completeSchemaProven,false);
});
test('ambiguous and dynamic names are unresolved, never invented or reported as exact names', () => {
  const m=buildSourceInventory([file('scripts/a.mjs', 'const T="dbo.one"; const sql=`CREATE TABLE ${T}(id int); CREATE TABLE dbo.work_${name}(id int);`;'),file('scripts/b.mjs','const T="dbo.two";'),file('scripts/c.mjs','const sql=`CREATE PROCEDURE ${T} AS SELECT 1`;')]);
  assert.equal(m.objects.find(x=>x.name==='dbo.one').state,'SOURCE_CREATE_FOUND');
  assert.ok(m.unresolvedTemplates.length);
  assert.equal(m.objects.some(x=>x.name==='dbo.work_'),false);
  assert.equal(m.objects.some(x=>x.name==='dbo.two'&&x.state==='SOURCE_CREATE_FOUND'),false);
});
test('comments do not become declarations and history references are kept separate', () => {
  const m=buildSourceInventory([file('infra/sql/a.sql','-- CREATE TABLE dbo.fake(id int);\n/* CREATE TABLE dbo.other(id int); */\nSELECT * FROM Vega.dbo.F0102TBLSTOKLAR;')]);
  assert.equal(m.objects.some(x=>x.name==='dbo.fake'||x.name==='dbo.other'),false);
  assert.equal(m.objects.find(x=>x.name==='dbo.f0102tblstoklar').scope,'HISTORICAL_OR_SYSTEM_REFERENCE');
});
test('FK and index declarations remain source candidates with exact locations', () => {
  const m=buildSourceInventory([file('infra/sql/a.sql','CREATE TABLE dbo.child(id bigint REFERENCES dbo.parent(id));\nCREATE UNIQUE INDEX [ix_child] ON [dbo].[child](id);')]);
  assert.deepEqual(m.foreignKeyReferences,[{path:'infra/sql/a.sql',line:1,referencedObject:'dbo.parent',referencedColumns:'id'}]);
  assert.deepEqual(m.indexes,[{path:'infra/sql/a.sql',line:2,name:'ix_child',table:'dbo.child',unique:true}]);
});
test('only tracked implementation-path inputs accepted; no private/env/backup/fixture evidence scan', () => {
  for(const path of ['infra/cloud-full-test/.private/runtime.mjs','.env','docs/evidence/data.sql','apps/api/src/a.test.mjs','scripts/a-fixture.mjs','scripts/backup.bak','../infra/sql/a.sql']) {
    assert.throws(()=>buildSourceInventory([file(path,'CREATE TABLE dbo.bad(id int);')]));
  }
});
test('real finops installer named fixture is source, not excluded test data', () => {
  const m=buildSourceInventory([file('scripts/canonical/enable-test-work-finops-fixture.mjs','CREATE PROCEDURE dbo.usp_work_supplier_payment_ready AS SELECT 1; CREATE TABLE dbo.work_finops_scope(id int);')]);
  assert.equal(m.objects.find(x=>x.name==='dbo.usp_work_supplier_payment_ready').state,'SOURCE_CREATE_FOUND');
  assert.equal(m.objects.find(x=>x.name==='dbo.work_finops_scope').state,'SOURCE_CREATE_FOUND');
});
test('valid new synthetic profile produces only a blocked source plan with no authority', () => {
  const m=sample(),p=compileSyntheticPreparation(m,profile(m));
  assert.equal(p.canApply,false); assert.equal(p.canStart,false); assert.equal(p.runtimeGrant,null);
  assert.ok(p.blockers.includes('FULL_SCHEMA_AND_BUSINESS_MODULES_NOT_PROVEN'));
  assert.ok(p.missingCreateCaptures.includes('dbo.invoice_returns'));
});
test('a complete-looking tiny manifest cannot authorize the full runtime', () => {
  const m=buildSourceInventory([file('infra/sql/a.sql','CREATE TABLE dbo.a(id int);')]);
  assert.equal(compileSyntheticPreparation(m,profile(m)).canStart,false);
});
test('source/provenance tampering and unknown profile options reject before plan generation', () => {
  const m=sample(),p=profile(m);
  for(const patch of [{sourceSha:'0'.repeat(40)},{inventoryDigest:'0'.repeat(64)},{skipProof:true},{password:'not-a-real-secret'},{origin:{kind:'RESTORED_COPY',backupUsed:true,businessDataUsed:false}},{externalProvidersDisabled:false}]) {
    assert.throws(()=>compileSyntheticPreparation(m,{...p,...patch}));
  }
});
test('legacy topology, original DB, arbitrary host/login/ports cannot enter synthetic profile', () => {
  const m=sample(),p=profile(m);
  for(const target of [{server:'Semih\\MELISADEV'},{database:'MELISA_ERP_V2'},{applicationLogin:'sa'},{apiPort:4184},{nativePort:5234},{webPort:80},{other:'x'}]) assert.throws(()=>compileSyntheticPreparation(m,{...p,target:{...p.target,...target}}));
});
test('committed plan is reproducible and explicitly blocked; original seeds are not selected for replay', () => {
  const dir=new URL('../../infra/cloud-full-test/',import.meta.url);
  const m=JSON.parse(readFileSync(new URL('erp-source-manifest.json',dir)));
  const p=JSON.parse(readFileSync(new URL('synthetic-profile.json',dir)));
  const expected=JSON.parse(readFileSync(new URL('synthetic-bootstrap-plan.json',dir)));
  assert.deepEqual(compileSyntheticPreparation(m,p),expected);
  assert.ok(m.objects.some(x=>x.name==='dbo.party_currency_accounts'&&x.state==='SOURCE_HELPER_CREATE_FOUND'));
  assert.equal(m.objects.find(x=>x.name==='dbo.invoice_return_items').state,'ALTER_ONLY_NO_BASE_CREATE');
  assert.equal(expected.seed.state,'LOGICAL_SPEC_ONLY_NO_SQL_OR_ID_MAPPING');
  assert.equal(expected.seed.replayOriginalSeed,false);
  const proxy=readFileSync(new URL('nginx.draft.conf',dir),'utf8');
  assert.ok(proxy.includes('erp-web:'+p.target.webPort));
  assert.ok(proxy.includes('erp-api:'+p.target.apiPort));
  const compose=JSON.parse(readFileSync(new URL('compose.draft.yaml',dir)));
  assert.notEqual(Number(compose.services['crm-gateway'].environment.WHATSAPP_CRM_PORT),p.target.webPort);
});
