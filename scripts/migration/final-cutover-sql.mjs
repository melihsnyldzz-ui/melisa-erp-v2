// Parameterized native SQL adapter. The caller supplies a connected, verified
// driver; this module never discovers credentials, opens SQL, or runs a CLI.
import {hash} from './party-currency-readonly-plan.mjs';
import {check,units,exact,sqlHash,TARGET} from './goal73-supplier-delta.mjs';
import {childId,verifyChild,authorizeFinalCutover} from './final-cutover-runtime.mjs';
import {FINAL_PARTY_READ_SQL,FINAL_PARTY_READ_PROC_SQL,FINAL_PARTY_READ_PROC_HASH} from '../../apps/api/src/services/finalPartyDeltaRead.mjs';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);
const ident=v=>{check(/^[A-Za-z_][A-Za-z0-9_]*$/.test(v),'FINAL_SQL_IDENTIFIER');return '['+v+']';};
const lit=v=>"N'"+String(v).replaceAll("'","''")+"'";
const rowHash=a=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${a}.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
export const FINAL_MUTABLE_TABLES=Object.freeze(['products','product_prices','stock_movements','customers','suppliers','party_currency_accounts','customer_movements','supplier_movements','audit_logs']);
const tables=FINAL_MUTABLE_TABLES;
export const FINAL_PROTECTED_TABLES=Object.freeze([...tables,'party_entities','party_source_links','product_source_aliases','product_barcodes','sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','invoice_returns','invoice_return_items','finance_accounts','finance_account_movements','cash_adjustments','cash_drawers','cash_expenses','cash_sessions','cash_transfers','inventory_documents','inventory_document_items','financial_documents','financial_document_items','document_links','terminal_sync_queue']);
const protectedTables=FINAL_PROTECTED_TABLES;
export const FINAL_SCHEMA_SQL=`SELECT OBJECT_NAME(c.object_id) [table],c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed FROM sys.columns c WHERE c.object_id IN(${tables.map(t=>`OBJECT_ID(${lit('dbo.'+t)})`).join(',')}) ORDER BY [table],c.column_id`;
export const FINAL_GUARD_SQL=`SELECT t.name,OBJECT_NAME(t.parent_id) [table],OBJECT_DEFINITION(t.object_id) definition,t.is_disabled disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger') first_d,OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger') last_i,OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger') last_u,OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger') last_d FROM sys.triggers t WHERE t.parent_id IN(${tables.map(t=>`OBJECT_ID(${lit('dbo.'+t)})`).join(',')}) ORDER BY t.name`;
export const FINAL_JOURNAL_DDL=`CREATE TABLE erp_migration.final_cutover_parents(cutover_id uniqueidentifier PRIMARY KEY,plan_hash char(64) NOT NULL,collector_hash char(64) NOT NULL,plan_json nvarchar(max) NOT NULL,collector_json nvarchar(max) NOT NULL,party_hash char(64) NOT NULL,actor_id bigint NOT NULL,execution_hash char(64) NOT NULL);
CREATE TABLE erp_migration.final_cutover_events(id bigint IDENTITY PRIMARY KEY,cutover_id uniqueidentifier NOT NULL REFERENCES erp_migration.final_cutover_parents(cutover_id),plan_hash char(64) NOT NULL,state nvarchar(40) NOT NULL,proof_hash char(64) NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE erp_migration.final_cutover_children(child_id nvarchar(100) PRIMARY KEY,cutover_id uniqueidentifier NOT NULL REFERENCES erp_migration.final_cutover_parents(cutover_id),plan_hash char(64) NOT NULL,domain nvarchar(20) NOT NULL,inverse bit NOT NULL,receipt_json nvarchar(max) NOT NULL,receipt_hash char(64) NOT NULL,UNIQUE(cutover_id,domain,inverse));`;
export function finalJournalGuard(table){
 check(['parents','events','children'].includes(table),'FINAL_JOURNAL_TABLE');
 return `CREATE TRIGGER erp_migration.immutable_final_cutover_${table} ON erp_migration.final_cutover_${table} AFTER INSERT,UPDATE,DELETE AS BEGIN IF EXISTS(SELECT 1 FROM deleted) OR OBJECT_ID(N'tempdb..#final_plan') IS NULL OR NOT EXISTS(SELECT 1 FROM #final_plan WHERE plan_hash=CONVERT(char(64),SESSION_CONTEXT(N'final_cutover_plan'))) OR EXISTS(SELECT 1 FROM inserted i LEFT JOIN #final_plan p ON p.cutover_id=i.cutover_id AND p.plan_hash=i.plan_hash WHERE p.cutover_id IS NULL) THROW 51808,'FINAL_JOURNAL_IMMUTABLE',1;END`;
}
export function finalSqlType(c){
 check(c,'FINAL_SQL_COLUMN');
 if(['nvarchar','varchar','char'].includes(c.type))return `${c.type}(${c.max_length===-1?'max':c.type==='nvarchar'?c.max_length/2:c.max_length})`;
 if(c.type==='decimal')return `decimal(${c.precision},${c.scale})`;
 if(c.type==='datetime2')return `datetime2(${c.scale})`;
 check(['bigint','int','bit','date','datetime','smallint','tinyint','uniqueidentifier'].includes(c.type),'FINAL_SQL_TYPE');return c.type;
}
const writable=c=>!c.is_identity&&!c.is_computed&&c.type!=='timestamp';
// Expected afterimages are rendered by SQL, preserving untouched decimals.
export function finalGuardBranch(table,columns){
 check(tables.includes(table),'FINAL_GUARD_TABLE');
 const fields=columns.filter(c=>writable(c)&&!['created_at'].includes(c.name));
 const compare=fields.map(c=>`EXISTS(SELECT i.${ident(c.name)} EXCEPT SELECT v.${ident(c.name)})`).join(' OR ')||'1=0';
 const expected=fields.map(c=>`${ident(c.name)} ${finalSqlType(c)} ${lit('$.'+c.name)}`).join(',');
 return `IF SESSION_CONTEXT(N'final_cutover_plan') IS NOT NULL BEGIN
 IF DB_NAME()<>${lit(TARGET.database)} OR @@SERVERNAME<>${lit(TARGET.server)} OR OBJECT_ID(N'tempdb..#final_plan') IS NULL OR OBJECT_ID(N'tempdb..#final_rows') IS NULL OR NOT EXISTS(SELECT 1 FROM #final_plan WHERE plan_hash=CONVERT(char(64),SESSION_CONTEXT(N'final_cutover_plan'))) THROW 51808,'FINAL_EXACT_PLAN_REQUIRED',1;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) OR EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id=i.id LEFT JOIN #final_rows p ON p.table_name=${lit(table)} AND ((p.id=i.id AND d.id IS NOT NULL) OR(p.id IS NULL AND d.id IS NULL AND p.insert_key=${table==='audit_logs'?"CONCAT(i.reason,N'/',i.entity_type,N'/',i.entity_id)":'i.source_record_key'})) OUTER APPLY OPENJSON(p.after_json) WITH(${expected}) v WHERE p.table_name IS NULL OR(d.id IS NOT NULL AND p.before_hash<>${rowHash('d')}) OR(${compare})) THROW 51808,'FINAL_OUTSIDE_PLAN',1;
 RETURN;END;`;
}
export function finalNativeReadSql(row){
 check(id(row.nativeId),'FINAL_NATIVE_ID');
 if(row.kind==='account'){
  check(['customer','supplier'].includes(row.role),'FINAL_NATIVE_ROLE');const party=row.role==='customer'?'customers':'suppliers',fk=row.role+'_id',mov=row.role+'_movements',company=row.role==='customer'?'F0102':'F0103';
  return `SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(20),a.${fk}) partyId,CONVERT(varchar(20),a.party_entity_id) partyEntityId,a.currency_code currency,CONVERT(varchar(100),a.current_balance) value,${rowHash('a')} witness,(SELECT a.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) beforeJSON,CONVERT(varchar(100),p.balance) scalar,p.currency_code mainCurrency,CONVERT(varchar(100),(SELECT COALESCE(SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,m.balance_effect) ELSE 0 END),0) FROM dbo.${mov} m WHERE m.${fk}=p.id AND COALESCE(m.account_currency,m.currency_code)=a.currency_code)) ledger,(SELECT COUNT(*) FROM dbo.${mov} m WHERE m.${fk}=p.id AND COALESCE(m.account_currency,m.currency_code)=a.currency_code AND ISNULL(m.affects_balance,1)=1 AND m.balance_effect_exact IS NULL AND m.balance_effect IS NULL) ledgerMissing,(SELECT COUNT(*) FROM dbo.party_source_links l WHERE l.${fk}=p.id AND l.party_entity_id=a.party_entity_id AND l.source_company=${lit(company)} AND l.source_id=@sourceId AND l.${row.role==='customer'?'supplier':'customer'}_id IS NULL) links,(SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds h WHERE h.source_key=@sourceKey OR(h.entity=${lit(row.role)} AND h.native_id=p.id) OR(h.entity=N'account' AND h.native_id=a.id)) holds FROM dbo.party_currency_accounts a WITH(UPDLOCK,HOLDLOCK) JOIN dbo.${party} p WITH(UPDLOCK,HOLDLOCK) ON p.id=a.${fk} WHERE a.id=@nativeId AND a.currency_code=@currency AND a.${row.role==='customer'?'supplier':'customer'}_id IS NULL`;
 }
 const base=`(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.product_id=p.id AND a.source_product_id=@sourceId) links,(SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds h WHERE(h.entity=N'product' AND h.native_id=p.id) OR h.source_key=@sourceKey) holds`;
 if(row.kind==='stock')return `SELECT CONVERT(varchar(20),p.id) id,CONVERT(varchar(100),p.current_stock_qty) value,CONVERT(varchar(100),p.average_cost_try) unitCost,CONVERT(varchar(100),(SELECT COALESCE(SUM(quantity_net),0) FROM dbo.inventory_effective_movements WHERE product_id=p.id)) ledger,${rowHash('p')} witness,(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) beforeJSON,p.unit,${base} FROM dbo.products p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=@nativeId`;
 check(row.kind==='price','FINAL_NATIVE_KIND');
 return `SELECT CONVERT(varchar(20),x.id) id,CONVERT(varchar(100),x.price) value,${rowHash('x')} witness,(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) beforeJSON,${base} FROM dbo.product_prices x WITH(UPDLOCK,HOLDLOCK) JOIN dbo.products p WITH(HOLDLOCK) ON p.id=x.product_id WHERE p.id=@nativeId AND x.price_type=@priceType AND x.price_tier=@tier AND x.currency_code=@currency AND(x.source_unit_id=@unitSourceId OR(x.source_unit_id IS NULL AND @unitSourceId IS NULL))`;
}
const normalize=v=>v===null?null:exact(units(typeof v==='string'&&/^-?\d+\.\d{1,8}$/.test(v)?v.padEnd(v.indexOf('.')+9,'0'):v));
function nativeValid(row,state){check(state&&state.holds===0&&state.links===1,'FINAL_NATIVE_IDENTITY_HOLD');if(row.kind==='account'){check(state.currency===row.currency&&id(state.partyId)&&id(state.partyEntityId),'FINAL_NATIVE_ACCOUNT');check(state.ledgerMissing===0,'FINAL_LEDGER_UNKNOWN');if(state.mainCurrency===row.currency)check(state.scalar!=null&&normalize(state.scalar)===normalize(state.value),'FINAL_NATIVE_SCALAR_DRIFT');}if(row.kind==='stock')check(state.unit==='ADET','FINAL_NATIVE_UNIT');if(row.kind!=='price')check(normalize(state.value)===normalize(state.ledger),'FINAL_NATIVE_LEDGER');}
export function finalMutations(plan,row,state,approval,{inverse=false,applied=null}={}){
 nativeValid(row,state);check(typeof state.beforeJSON==='string'&&sqlHash(state.beforeJSON)===state.witness.toUpperCase(),'FINAL_NATIVE_SQL_HASH');
 if(row.operation==='NOOP')return [];
 const run=childId(plan,row.kind,inverse),key=run+'/'+hash(row.key).slice(0,32),delta=row.kind==='price'?null:exact(units(row.delta)*(inverse?-1n:1n));
 const after=row.kind==='price'?(inverse?row.nativeBefore:row.afterValue):exact(units(normalize(state.value))+units(delta));
 if(row.kind==='stock')check(units(after)>=0n&&units(after)%100000n===0n,'FINAL_NATIVE_STOCK_RANGE');
 if(row.kind==='price'&&inverse)check(normalize(state.value)===row.afterValue&&state.witness.toUpperCase()===applied.afterWitnessHash.toUpperCase(),'FINAL_PRICE_INVERSE_CAS');
 const mutation=(table,id,fields)=>({table,id,beforeHash:id?state.witness:null,fields});
 const payload=JSON.stringify({cutoverId:plan.cutoverId,planHash:plan.planHash,key:row.key,delta,inverse,parentChildId:inverse?childId(plan,row.kind):null});
 const provenance={source_record_key:key,migration_run_id:run,source_payload_hash:plan.planHash,source_payload_json:payload};
 let out;
 if(row.kind==='price')out=[mutation('product_prices',state.id,{price:after})];
 else if(row.kind==='stock')out=[mutation('products',row.nativeId,{current_stock_qty:after}),mutation('stock_movements',null,{...provenance,product_id:row.nativeId,movement_type:'adjustment',source_type:'stock_adjustment',source_id:null,quantity_in:units(delta)>0n?delta:'0.00000000',quantity_out:units(delta)<0n?exact(-units(delta)):'0.00000000',quantity_net:delta,quantity_in_exact:units(delta)>0n?delta:'0.00000000',quantity_out_exact:units(delta)<0n?exact(-units(delta)):'0.00000000',unit_cost_try:state.unitCost==null?null:normalize(state.unitCost),average_cost_try_after:state.unitCost==null?null:normalize(state.unitCost),document_date:plan.capture.businessDate,created_by:approval.actorId,affects_inventory:true,inventory_cutover_id:null,source_product_id:row.sourceKey.split('/').at(-1),warehouse_name:'MERKEZ'})];
 else{
  const amount=exact(units(delta)<0n?-units(delta):units(delta)),party=row.role==='customer'?'customers':'suppliers';
  out=[mutation('party_currency_accounts',row.nativeId,{current_balance:after}),mutation(row.role+'_movements',null,{...provenance,[row.role+'_id']:state.partyId,movement_type:'vega_journal',amount,currency_code:row.currency,balance_effect:delta,balance_effect_exact:delta,account_currency:row.currency,account_amount:amount,document_date:plan.capture.businessDate,created_by:approval.actorId,party_entity_id:state.partyEntityId,party_currency_account_id:row.nativeId,affects_balance:true})];
  // Existing legacy card display is only its own main currency. No FX conversion.
  if(state.mainCurrency===row.currency){check(units(after)%10000n===0n,'FINAL_SCALAR_PRECISION');out.push({table:party,id:state.partyId,beforeHash:null,fields:{balance:after}});}
 }
 out.push(mutation('audit_logs',null,{actor_user_id:approval.actorId,action:inverse?'final_cutover_inverse':'final_cutover_delta',entity_type:row.kind==='account'?'party_currency_account':row.kind==='price'?'product_price':'product',entity_id:row.kind==='price'?state.id:row.nativeId,before_json:state.beforeJSON,after_json:JSON.stringify({value:after,planHash:plan.planHash}),reason:run,source:'final_cutover'}));
 return out;
}
const guardWrapper=g=>/^(?:test_|c03_guard_|c09_guard_)/.test(g.name);
async function query(tx,operation,sql,params={}){const r=await tx.query(sql,params,{operation});return r?.recordset??r??[];}
export function createFinalSqlStore(driver){
 check(typeof driver?.transaction==='function'&&typeof driver.verifyPause==='function','FINAL_SQL_DRIVER');
 const authorized=new Map();let pinnedConnection=null;
 const fixture=driver.evidenceKind==='SYNTHETIC_NATIVE_SQL';
 const transact=fn=>driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
  const q=(op,s,p)=>query(tx,op,s,p);
  const identity=(await q('identity','SELECT @@SERVERNAME server,DB_NAME() [database]'))[0];check(identity?.server===TARGET.server&&identity.database===TARGET.database,'FINAL_SQL_TEST_IDENTITY');
  const connection=(await q('execution-identity',"SELECT ORIGINAL_LOGIN() login,USER_NAME() databaseUser,APP_NAME() applicationName"))[0];
  check(connection&&['login','databaseUser','applicationName'].every(k=>typeof connection[k]==='string'&&connection[k].length>0),'FINAL_SQL_EXECUTION_IDENTITY');
  if(pinnedConnection===null)pinnedConnection=hash(connection);else check(pinnedConnection===hash(connection),'FINAL_SQL_EXECUTION_IDENTITY_DRIFT');
  await q('lock',"SET XACT_ABORT ON;DECLARE @l int;EXEC @l=sys.sp_getapplock @Resource=N'MELISA-FINAL-CUTOVER',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51808,'FINAL_LOCK',1;");
  try{return await fn(q);}finally{await q('clear-session',"EXEC sys.sp_set_session_context @key=N'final_cutover_plan',@value=NULL;IF OBJECT_ID(N'tempdb..#final_rows') IS NOT NULL DROP TABLE #final_rows;IF OBJECT_ID(N'tempdb..#final_plan') IS NOT NULL DROP TABLE #final_plan;").catch(()=>{});}
 });
 const scope=async(q,plan)=>{await q('scope-ddl',"CREATE TABLE #final_plan(cutover_id uniqueidentifier PRIMARY KEY,plan_hash char(64));");await q('scope',"INSERT #final_plan VALUES(@cutoverId,@planHash);EXEC sys.sp_set_session_context @key=N'final_cutover_plan',@value=@planHash;",{cutoverId:plan.cutoverId,planHash:plan.planHash});};
 const childRead=async(q,plan,domain,inverse)=>{const r=(await q('child',"SELECT plan_hash,receipt_json,receipt_hash FROM erp_migration.final_cutover_children WITH(UPDLOCK,HOLDLOCK) WHERE child_id=@id",{id:childId(plan,domain,inverse)}))[0];if(!r)return null;const receipt=JSON.parse(r.receipt_json);check(r.plan_hash===plan.planHash&&r.receipt_hash===receipt.receiptHash,'FINAL_SQL_RECEIPT_HASH');return verifyChild(plan,domain,receipt,inverse);};
 const readNative=async(q,row)=>{const rows=await q('native',finalNativeReadSql(row),{nativeId:row.nativeId,sourceKey:row.sourceKey,sourceId:row.sourceKey.split('/').at(-1),currency:row.currency??null,priceType:row.priceType??null,tier:row.tier??null,unitSourceId:row.unitSourceId??null});check(rows.length===1,'FINAL_NATIVE_SINGLE');const state=rows[0];nativeValid(row,state);return state;};
 const eventSql="INSERT erp_migration.final_cutover_events(cutover_id,plan_hash,state,proof_hash)VALUES(@cutoverId,@planHash,@state,@proofHash)";
 async function writeEvent(q,plan,state,proofHash=null){await scope(q,plan);await q('event',eventSql,{cutoverId:plan.cutoverId,planHash:plan.planHash,state,proofHash});}
 async function protectedProof(q,plan,schema){
  const result={};
  for(const table of protectedTables){
   let where='';let cols='x.*';
   if(['stock_movements','customer_movements','supplier_movements'].includes(table))where='WHERE ISNULL(x.migration_run_id,N\'\') NOT LIKE @runPrefix';
   if(table==='audit_logs')where='WHERE ISNULL(x.reason,N\'\') NOT LIKE @runPrefix';
   const excluded=table==='products'?['current_stock_qty','row_version']:table==='party_currency_accounts'?['current_balance']:['customers','suppliers'].includes(table)?['balance','row_version']:table==='product_prices'?['price']:[];
   if(excluded.length)cols=schema.filter(c=>c.table===table&&!excluded.includes(c.name)).map(c=>'x.'+ident(c.name)).join(',');
   const rows=await q('protected',`SELECT CONVERT(varchar(20),x.id) id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${cols} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM dbo.${ident(table)} x ${where} ORDER BY x.id`,{runPrefix:plan.cutoverId+'/%'});result[table]=hash(rows);
  }
  result.authorization=hash(await q('authorization','SELECT (SELECT * FROM dbo.roles ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) roles,(SELECT * FROM dbo.permissions ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) permissions,(SELECT id,username,role_id,is_active,password_hash FROM dbo.users ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) users,(SELECT * FROM erp_migration.operation_quarantine_holds ORDER BY source_key FOR JSON PATH,INCLUDE_NULL_VALUES) holds'));
  return hash(result);
 }
 async function journal(q){
  const exists=(await q('journal-exists',"SELECT OBJECT_ID(N'erp_migration.final_cutover_parents') id"))[0]?.id;
  if(!exists){check((await q('migration-schema',"SELECT SCHEMA_ID(N'erp_migration') id"))[0]?.id,'FINAL_SCHEMA_REQUIRED');await q('journal-ddl',FINAL_JOURNAL_DDL);for(const t of ['parents','events','children'])await q('journal-guard-create',finalJournalGuard(t));}
  for(const t of ['parents','events','children']){const g=await q('journal-guard',`SELECT OBJECT_DEFINITION(object_id) definition,is_disabled disabled FROM sys.triggers WHERE object_id=OBJECT_ID(${lit('erp_migration.immutable_final_cutover_'+t)})`);check(g.length===1&&!g[0].disabled&&g[0].definition===finalJournalGuard(t),'FINAL_JOURNAL_GUARD');}
  const reader=await q('party-reader-exists',"SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_final_currency_deltas')) definition");
  if(!reader[0]?.definition)await q('party-reader-create',FINAL_PARTY_READ_PROC_SQL);else check(sqlHash(reader[0].definition)===FINAL_PARTY_READ_PROC_HASH,'FINAL_PARTY_READER_DRIFT');
  if(!fixture)for(const principal of ['melisa_sirket_test_20260929_01','melisa_sirket_sales_test_20260929_01'])await q('party-reader-existing-access',`IF DATABASE_PRINCIPAL_ID(${lit(principal)}) IS NULL THROW 51808,'FINAL_EXISTING_PRINCIPAL_REQUIRED',1;GRANT EXECUTE ON OBJECT::dbo.usp_read_final_currency_deltas TO ${ident(principal)}`);
 }
 async function reconcileReceipt(q,plan,domain,receipt,{inverse=false}={}){
  if(domain==='price')check(receipt.publication&&typeof driver.pricePublication?.verify==='function'&&await driver.pricePublication.verify({query:q,plan,receipt,inverse})===true,'FINAL_PRICE_READER_RECONCILIATION');
  for(const row of plan.rows.filter(r=>r.kind===domain)){
   const e=receipt.effects.find(e=>e.key===row.key),s=await readNative(q,row);
   if(domain==='price')check(normalize(s.value)===e.afterValue&&s.witness.toUpperCase()===e.afterWitnessHash.toUpperCase(),'FINAL_PRICE_RECONCILIATION');
   else{
    const local=(await q('local-effects',finalLocalEffectsSql(row),{id:row.nativeId,party:s.partyId,currency:row.currency??null}))[0];
    check(local&&(domain!=='account'||local.missing===0)&&normalize(s.value)===exact(units(inverse?row.nativeBefore:row.afterBalance)+units(normalize(local.value))-units(row.localEffects)),'FINAL_EXPECTED_RESIDUAL');
    // Later native business effects are permitted on replay/inverse; scalar=ledger
    // and immutable batch effect/audit identity remain mandatory.
    if(e.operation!=='NOOP'){
     const movement=domain==='stock'?'stock_movements':row.role+'_movements',effect=domain==='stock'?'quantity_net':'balance_effect_exact',owner=domain==='stock'?'product_id':row.role+'_id';
     const m=await q('effect',`SELECT CONVERT(varchar(100),m.${effect}) delta,m.migration_run_id runId,m.source_payload_hash planHash,CONVERT(varchar(20),m.${owner}) ownerId,${domain==='stock'?'m.affects_inventory affects':"m.affects_balance affects,m.account_currency currency,CONVERT(varchar(20),m.party_currency_account_id) accountId"} FROM dbo.${movement} m WHERE m.id=@id`,{id:e.movementId});
     check(m.length===1&&normalize(m[0].delta)===e.delta&&m[0].runId===receipt.id&&m[0].planHash===plan.planHash&&String(m[0].ownerId)===(domain==='stock'?row.nativeId:s.partyId)&&m[0].affects===true,'FINAL_MOVEMENT_BINDING');
     if(domain==='account')check(m[0].currency===row.currency&&m[0].accountId===row.nativeId,'FINAL_MOVEMENT_CURRENCY');
    }
   }
   if(e.operation!=='NOOP'){const a=await q('audit',"SELECT actor_user_id actorId,reason,action FROM dbo.audit_logs WHERE id=@id",{id:e.auditId});check(a.length===1&&String(a[0].actorId)===receipt.actorId&&a[0].reason===receipt.id&&a[0].action===(inverse?'final_cutover_inverse':'final_cutover_delta'),'FINAL_AUDIT_BINDING');}
  }
 }
 return {
  evidenceKind:fixture?'SYNTHETIC_NATIVE_SQL':'NATIVE_SQL',fixtureSchemas:driver.fixtureSchemas??null,
  prepare:async(plan,collector,approval)=>{
   authorizeFinalCutover(plan,collector,approval,approval?.action,{fixture,schemas:driver.fixtureSchemas});
   const result=await transact(async q=>{
   check(await driver.verifyPause(plan.freeze)===true,'FINAL_NATIVE_PAUSE_LOST');
   if(!fixture)check(approval.executionIdentity&&hash(approval.executionIdentity)===pinnedConnection,'FINAL_APPROVED_EXECUTION_IDENTITY');
   if(fixture){const recovery=await q('fixture-recovery','SELECT checkpoint_json FROM erp_migration.fixture_recovery_checkpoint WHERE checkpoint_hash=@h AND kind=N\'SYNTHETIC_NAMESPACE_RECOVERY\'',{h:approval.recovery.checkpointHash});check(recovery.length===1&&hash(JSON.parse(recovery[0].checkpoint_json))===approval.recovery.checkpointHash,'FINAL_FIXTURE_RECOVERY_BINDING');}
   check(typeof driver.pricePublication?.publish==='function'&&typeof driver.pricePublication?.verify==='function'&&/^[a-f0-9]{64}$/.test(driver.pricePublication.contractHash??'')&&approval.priceReaderHash===driver.pricePublication.contractHash,'FINAL_PRICE_READER_PUBLICATION_REQUIRED');
   // Representability of the complete sealed price version is a prerequisite
   // for the first domain. Reject impossible NULL bindings before stock writes.
   if(!fixture)check(driver.pricePublication.fixtureOnly!==true&&typeof driver.pricePublication.preflight==='function'&&await driver.pricePublication.preflight({plan})===true,'FINAL_PRICE_READER_PREFLIGHT_REQUIRED');
   const schema=await q('schema',FINAL_SCHEMA_SQL),guards=await q('guards',FINAL_GUARD_SQL);check(hash(schema)===approval.schemaHash&&hash(guards)===approval.guardHash,'FINAL_SQL_CONTRACT_DRIFT');
   check(guards.every(g=>!g.disabled),'FINAL_DISABLED_GUARD');
   const actor=await q('actor',"SELECT DISTINCT p.permission_key FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id AND r.is_active=1 JOIN dbo.permissions p ON p.role_id=u.role_id AND p.can_view=1 WHERE u.id=@actor AND u.is_active=1",{actor:approval.actorId});
   check(['stock.adjust','customer.view','supplier.view'].every(k=>actor.some(r=>r.permission_key===k)),'FINAL_ACTOR_PERMISSION');
   await scope(q,plan);await journal(q);
   const partyHash=hash(plan.rows.filter(r=>r.kind==='account')),prior=(await q('parent-manifest','SELECT plan_hash,collector_hash,party_hash,actor_id,execution_hash FROM erp_migration.final_cutover_parents WHERE cutover_id=@id',{id:plan.cutoverId}))[0];
   if(prior)check(prior.plan_hash===plan.planHash&&prior.collector_hash===collector.collectorHash&&prior.party_hash===partyHash&&String(prior.actor_id)===approval.actorId&&prior.execution_hash===pinnedConnection,'FINAL_SQL_PARENT_CONFLICT');
   else{await q('parent-create','INSERT erp_migration.final_cutover_parents VALUES(@id,@planHash,@collectorHash,@planJSON,@collectorJSON,@partyHash,@actorId,@executionHash)',{id:plan.cutoverId,planHash:plan.planHash,collectorHash:collector.collectorHash,planJSON:JSON.stringify(plan),collectorJSON:JSON.stringify(collector),partyHash,actorId:approval.actorId,executionHash:pinnedConnection});await q('event',eventSql,{cutoverId:plan.cutoverId,planHash:plan.planHash,state:'PREPARED',proofHash:null});}
   });authorized.set(plan.planHash,hash(approval));return result;
  },
  parent:plan=>transact(async q=>{const rows=await q('parent',"SELECT TOP(1) e.plan_hash planHash,e.state status,CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM erp_migration.final_cutover_events x WHERE x.cutover_id=e.cutover_id AND(x.state LIKE N'INVERSE_%' OR x.state=N'STOPPED_INVERSE' OR x.state=N'INVERSED')) OR EXISTS(SELECT 1 FROM erp_migration.final_cutover_children c WHERE c.cutover_id=e.cutover_id AND c.inverse=1) THEN 1 ELSE 0 END) inverseStarted FROM erp_migration.final_cutover_events e WHERE e.cutover_id=@id ORDER BY e.id DESC",{id:plan.cutoverId});return rows[0]??null;}),
  child:(plan,domain,inverse)=>transact(q=>childRead(q,plan,domain,inverse)),
  event:(plan,state,proof)=>transact(q=>writeEvent(q,plan,state,proof)),
  applyDomain:(plan,domain,approval,{inverse=false,applied=null}={})=>transact(async q=>{
   check(authorized.get(plan.planHash)===hash(approval)&&(!inverse||approval.action==='INVERSE'),'FINAL_SQL_APPROVAL_REQUIRED');
   check(await driver.verifyPause(plan.freeze)===true,'FINAL_NATIVE_PAUSE_LOST');
   const actor=await q('actor',"SELECT DISTINCT p.permission_key FROM dbo.users u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.roles r WITH(UPDLOCK,HOLDLOCK) ON r.id=u.role_id AND r.is_active=1 JOIN dbo.permissions p WITH(UPDLOCK,HOLDLOCK) ON p.role_id=u.role_id AND p.can_view=1 WHERE u.id=@actor AND u.is_active=1",{actor:approval.actorId});
   check(['stock.adjust','customer.view','supplier.view'].every(k=>actor.some(r=>r.permission_key===k)),'FINAL_ACTOR_PERMISSION');
   await scope(q,plan);await journal(q);
   const existing=await childRead(q,plan,domain,inverse);if(existing)return existing;
   const schema=await q('schema',FINAL_SCHEMA_SQL),guards=await q('guards',FINAL_GUARD_SQL);check(hash(schema)===approval.schemaHash&&hash(guards)===approval.guardHash,'FINAL_SQL_CONTRACT_DRIFT');
   const protectedBefore=await protectedProof(q,plan,schema),effects=[],staged=[];
   for(const row of plan.rows.filter(r=>r.kind===domain)){
    const state=await readNative(q,row);
    if(!inverse)check(state.witness.toUpperCase()===row.nativeWitnessHash.toUpperCase()&&normalize(state.value)===row.nativeBefore,'FINAL_NATIVE_PREIMAGE_DRIFT');
    const parentEffect=applied?.effects.find(e=>e.key===row.key);
    if(inverse){check(parentEffect,'FINAL_INVERSE_PARENT_EFFECT');await reconcileReceipt(q,plan,domain,applied);}
    const mutations=finalMutations(plan,row,state,approval,{inverse,applied:parentEffect});
    for(const mutation of mutations)staged.push({...mutation,rowKey:row.key});
    effects.push({key:row.key,rowHash:hash(row),nativeId:row.nativeId,operation:row.operation,delta:domain==='price'?null:exact(units(row.delta)*(inverse?-1n:1n)),beforeJSON:state.beforeJSON,afterValue:domain==='price'?(inverse?row.nativeBefore:row.afterValue):null,afterWitnessHash:state.witness,movementId:null,auditId:null});
   }
   await q('stage-ddl',"CREATE TABLE #final_rows(table_name sysname NOT NULL,id bigint NULL,insert_key nvarchar(250) NULL,before_hash char(64) NULL,after_json nvarchar(max) NOT NULL);CREATE UNIQUE INDEX IX_final_update ON #final_rows(table_name,id) WHERE id IS NOT NULL;CREATE UNIQUE INDEX IX_final_insert ON #final_rows(table_name,insert_key) WHERE id IS NULL;");
   for(const m of staged){
    const columns=schema.filter(c=>c.table===m.table),names=Object.keys(m.fields);check(names.every(n=>columns.some(c=>c.name===n&&writable(c))),'FINAL_MUTATION_SCHEMA');
    for(const name of names){const c=columns.find(c=>c.name===name),v=m.fields[name];if(c.type==='decimal'&&v!==null){const n=units(normalize(String(v)));check(n%(10n**BigInt(8-c.scale))===0n&&String(n<0n?-n:n).length<=c.precision+8-c.scale,'FINAL_MUTATION_PRECISION');}}
    const definitions=names.map(n=>`${ident(n)} ${finalSqlType(columns.find(c=>c.name===n))} '$.${n}'`).join(',');
    if(m.id){const state=await q('mutation-preimage',`SELECT ${rowHash('x')} witness,(SELECT ${columns.filter(writable).map(c=>(names.includes(c.name)?'v.':'x.')+ident(c.name)).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) afterJSON FROM dbo.${ident(m.table)} x WITH(UPDLOCK,HOLDLOCK) CROSS APPLY OPENJSON(@j) WITH(${definitions}) v WHERE x.id=@id`,{id:m.id,j:JSON.stringify(m.fields)});check(state.length===1&&(!m.beforeHash||state[0].witness===m.beforeHash),'FINAL_MUTATION_PREIMAGE');m.beforeHash=state[0].witness;m.afterJSON=state[0].afterJSON;}
    else{
     // Existing extra migration columns may be nullable. Unknown required fields
     // never get invented defaults, and SQL defaults own id/created_at only.
     for(const c of columns.filter(c=>writable(c)&&c.name!=='created_at'&&!names.includes(c.name))){check(c.is_nullable,'FINAL_REQUIRED_INSERT_COLUMN');m.fields[c.name]=null;}
     m.afterJSON=JSON.stringify(m.fields);
    }
    m.insertKey=m.id?null:m.table==='audit_logs'?`${m.fields.reason}/${m.fields.entity_type}/${m.fields.entity_id}`:m.fields.source_record_key;
    await q('stage-row','INSERT #final_rows VALUES(@table,@id,@key,@before,@after)',{table:m.table,id:m.id,key:m.insertKey,before:m.beforeHash,after:m.afterJSON});
   }
   const touched=new Set(staged.map(m=>m.table)),wrapped=guards.filter(g=>touched.has(g.table)&&guardWrapper(g)),added=[];
   for(const g of wrapped){check(/^CREATE\s+TRIGGER/i.test(g.definition)&&/AS\s+BEGIN\b/i.test(g.definition),'FINAL_GUARD_FORMAT');await q('guard-wrap',g.definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER').replace(/AS\s+BEGIN\b/i,s=>s+'\n'+finalGuardBranch(g.table,schema.filter(c=>c.table===g.table))+'\n'));}
   for(const table of touched){const name='final_cutover_exact_'+table;await q('guard-add',`CREATE TRIGGER dbo.${ident(name)} ON dbo.${ident(table)} AFTER INSERT,UPDATE,DELETE AS BEGIN ${finalGuardBranch(table,schema.filter(c=>c.table===table))} IF SESSION_CONTEXT(N'final_cutover_plan') IS NULL THROW 51808,'FINAL_SESSION_REQUIRED',1;END`);added.push(name);}
   for(const m of staged){
    const columns=schema.filter(c=>c.table===m.table),names=Object.keys(m.fields),defs=names.map(n=>`${ident(n)} ${finalSqlType(columns.find(c=>c.name===n))} '$.${n}'`).join(',');
    const params={id:m.id,j:JSON.stringify(m.fields)};
    const sql=m.id?`UPDATE x SET ${names.map(n=>ident(n)+'=v.'+ident(n)).join(',')} FROM dbo.${ident(m.table)} x CROSS APPLY OPENJSON(@j) WITH(${defs}) v WHERE x.id=@id;IF @@ROWCOUNT<>1 THROW 51808,'FINAL_UPDATE_SINGLE',1;SELECT CONVERT(varchar(20),@id) id`:`DECLARE @ids TABLE(id bigint);INSERT dbo.${ident(m.table)}(${names.map(ident).join(',')}) OUTPUT inserted.id INTO @ids SELECT ${names.map(ident).join(',')} FROM OPENJSON(@j) WITH(${defs});SELECT CONVERT(varchar(20),id) id FROM @ids`;
    const rows=await q('mutation',sql,params);check(rows.length===1&&id(rows[0].id),'FINAL_MUTATION_ID');const effect=effects.find(e=>e.key===m.rowKey);if(m.table.endsWith('_movements'))effect.movementId=rows[0].id;if(m.table==='audit_logs')effect.auditId=rows[0].id;
   }
   for(const name of added)await q('guard-drop','DROP TRIGGER dbo.'+ident(name));
   for(const g of wrapped){await q('guard-restore-drop','DROP TRIGGER dbo.'+ident(g.name));await q('guard-restore',g.definition);for(const [op,k] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']]){const order=g['first_'+k]?'First':g['last_'+k]?'Last':null;if(order)await q('guard-order',`EXEC sys.sp_settriggerorder @triggername=${lit('dbo.'+g.name)},@order=${lit(order)},@stmttype=${lit(op)}`);}}
   check(hash(await q('guards',FINAL_GUARD_SQL))===approval.guardHash,'FINAL_GUARD_RESTORE');
   check(await protectedProof(q,plan,schema)===protectedBefore,'FINAL_PROTECTED_HISTORY');
   for(const row of plan.rows.filter(r=>r.kind===domain)){const s=await readNative(q,row),effect=effects.find(e=>e.key===row.key);effect.afterWitnessHash=s.witness;if(!inverse)check(normalize(s.value)===(domain==='price'?row.afterValue:row.afterBalance),'FINAL_AFTER_VALUE');}
   const body={id:childId(plan,domain,inverse),planHash:plan.planHash,domain,inverse,status:'COMMITTED',actorId:approval.actorId,effects};let receipt={...body,receiptHash:hash(body)};
   if(domain==='price'){const publication=await driver.pricePublication.publish({query:q,plan,receipt,inverse});check(publication&&/^[a-f0-9]{64}$/.test(publication.publicationHash??''),'FINAL_PRICE_PUBLICATION_BINDING');body.publication=publication;receipt={...body,receiptHash:hash(body)};check(await driver.pricePublication.verify({query:q,plan,receipt,inverse})===true,'FINAL_PRICE_READER_PUBLICATION_FAILED');}
   await reconcileReceipt(q,plan,domain,receipt,{inverse});
   await q('child-create','INSERT erp_migration.final_cutover_children VALUES(@id,@cutoverId,@planHash,@domain,@inverse,@json,@hash)',{id:receipt.id,cutoverId:plan.cutoverId,planHash:plan.planHash,domain,inverse,json:JSON.stringify(receipt),hash:receipt.receiptHash});return receipt;
  }),
  verifyDomain:(plan,domain,receipt,opts)=>transact(q=>reconcileReceipt(q,plan,domain,receipt,opts)),
  reconcile:(plan,receipts,opts)=>transact(async q=>{for(const r of receipts)await reconcileReceipt(q,plan,r.domain,r,opts);return {ok:true,planHash:plan.planHash,receiptHashes:receipts.map(r=>r.receiptHash)};})
 };
}
// Reader bridge for future customer/supplier screens. Bound to the existing
// currency account, immutable parent/child receipt, and actual native effects.
export {FINAL_PARTY_READ_SQL};
export async function readFinalPartyDeltas(queryBoundary,accountIds){
 check(Array.isArray(accountIds)&&accountIds.length<=200&&accountIds.every(id),'FINAL_READER_SCOPE');
 return queryBoundary(FINAL_PARTY_READ_SQL,{account_ids:JSON.stringify(accountIds)});
}
export function attachFinalPartyDeltas(rows,proofRows){
 const proofs=new Map(proofRows.map(p=>[p.accountId,p]));
 for(const row of rows)for(const account of row.nativeAccounts??[]){const p=proofs.get(account.id);account.finalSourceDeltaExact=p?.verified===true?normalize(p.sourceDeltaExact):null;account.finalSourceDeltaVerified=p?.verified===true;}
 return rows;
}
// Fixture translation is explicit and cannot touch native commerce/journals.
// It is provided for a future separately authorized SQL-engine rehearsal.
// Source code never opens a connection, creates fixture data or runs it.
export function createFinalSqlFixtureDriver(driver,{nativeSchema,journalSchema}){
 check(/^final_cutover_fixture_[a-z0-9_]+$/.test(nativeSchema)&&/^final_cutover_fixture_[a-z0-9_]+$/.test(journalSchema)&&nativeSchema!==journalSchema,'FINAL_FIXTURE_SCHEMAS');
 const map=s=>s.replaceAll('[erp_migration].','['+journalSchema+'].').replaceAll('[dbo].','['+nativeSchema+'].').replaceAll('erp_migration.',journalSchema+'.').replaceAll('dbo.',nativeSchema+'.');
 const unmap=s=>s.replaceAll('['+journalSchema+'].','[erp_migration].').replaceAll('['+nativeSchema+'].','[dbo].').replaceAll(journalSchema+'.','erp_migration.').replaceAll(nativeSchema+'.','dbo.');
 return {evidenceKind:'SYNTHETIC_NATIVE_SQL',fixtureSchemas:{nativeSchema,journalSchema},verifyPause:driver.verifyPause,pricePublication:driver.pricePublication,transaction:(options,fn)=>driver.transaction(options,tx=>fn({query:async(sql,params,meta)=>{
  const result=await tx.query(map(sql),params,meta),rows=result?.recordset??result;
  if(Array.isArray(rows))for(const row of rows)if(typeof row.definition==='string')row.definition=unmap(row.definition);
  return result;
 }}))};
}
// Verify historical committed effects against BOTH their journal and the native
// ledger before handing them to the residual planner. Run IDs stay verbatim.
export async function readAcceptedFinalReceipts(queryBoundary,row){
 const verified=[];
 for(const receipt of row.acceptedReceipts){
  let sql;
  if(row.kind==='stock')sql=`SELECT r.plan_hash manifestHash,r.status,CONVERT(varchar(100),a.delta_qty) delta,CONVERT(varchar(100),m.quantity_net) nativeDelta,m.migration_run_id nativeRun,m.source_payload_hash nativeHash,a.payload_hash expectedNativeHash FROM erp_migration.goal7_delta_runs r JOIN erp_migration.goal7_delta_atoms a ON a.run_id=r.run_id JOIN erp_migration.goal7_delta_effects e ON e.run_id=a.run_id AND e.atom_id=a.atom_id LEFT JOIN dbo.stock_movements m ON m.id=e.effect_id WHERE r.run_id=@run AND r.run_kind=N'SOURCE_SAFE' AND a.product_id=@id AND m.product_id=a.product_id`;
  else{
   check(row.kind==='account'&&row.role==='supplier','FINAL_PRIOR_RECEIPT_UNSUPPORTED');
   sql=`SELECT r.manifest_hash manifestHash,r.status,CONVERT(varchar(100),e.delta) delta,CONVERT(varchar(100),m.balance_effect_exact) nativeDelta,m.migration_run_id nativeRun,m.source_payload_hash nativeHash,r.manifest_hash expectedNativeHash FROM dbo.goal73_supplier_currency_runs r JOIN dbo.goal73_supplier_currency_effects e ON e.run_id=r.run_id JOIN dbo.party_currency_accounts a ON a.id=e.account_id LEFT JOIN dbo.supplier_movements m ON m.id=e.movement_id LEFT JOIN dbo.audit_logs au ON au.id=e.audit_id WHERE r.run_id=@run AND a.id=@id AND e.currency=@currency AND a.currency_code=e.currency AND a.supplier_id=e.supplier_id AND(e.delta=0 OR(m.supplier_id=e.supplier_id AND m.party_currency_account_id=a.id AND m.account_currency=e.currency AND m.affects_balance=1 AND au.entity_id=a.id AND au.reason=r.run_id))`;
  }
  const records=await queryBoundary(sql,{run:receipt.runId,id:row.nativeId,currency:row.currency??null});
  check(records.length===1&&records[0].manifestHash===receipt.manifestHash&&records[0].status==='COMMITTED'&&normalize(records[0].delta)===receipt.delta,'FINAL_PRIOR_JOURNAL_BINDING');
  if(units(receipt.delta)!==0n)check(normalize(records[0].nativeDelta)===receipt.delta&&records[0].nativeRun===receipt.runId&&records[0].nativeHash===records[0].expectedNativeHash,'FINAL_PRIOR_NATIVE_EFFECT');
  verified.push({...receipt,committed:true});
 }
 return verified;
}
const atomKey=r=>r.kind==='account'?`${r.sourceKey}/${r.role}/${r.currency}`:r.kind==='stock'?r.sourceKey+'/STOCK':[r.sourceKey,'PRICE',r.priceType,r.unitSourceId??'CARD',r.tier,r.currency].join('/');
export function finalLocalEffectsSql(row){
 if(row.kind==='account'){check(['customer','supplier'].includes(row.role),'FINAL_LOCAL_ROLE');return `SELECT CONVERT(varchar(100),COALESCE(SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,m.balance_effect) ELSE 0 END),0)) value,COALESCE(SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 AND m.balance_effect_exact IS NULL AND m.balance_effect IS NULL THEN 1 ELSE 0 END),0) missing FROM dbo.${row.role}_movements m WHERE m.${row.role}_id=@party AND COALESCE(m.account_currency,m.currency_code)=@currency AND m.source_record_key IS NULL AND m.cutover_source_key IS NULL`;}
 check(row.kind==='stock','FINAL_LOCAL_KIND');return `SELECT CONVERT(varchar(100),COALESCE(SUM(m.quantity_net),0)) value FROM dbo.stock_movements m WHERE m.product_id=@id AND m.affects_inventory=1 AND m.source_record_key IS NULL AND m.inventory_cutover_id IS NULL AND NOT EXISTS(SELECT 1 FROM dbo.sales_invoices i WHERE m.source_type=N'sales_invoice' AND i.id=m.source_id AND i.affects_inventory=0) AND NOT EXISTS(SELECT 1 FROM dbo.purchase_invoices i WHERE m.source_type=N'purchase_invoice' AND i.id=m.source_id AND i.affects_inventory=0)`;
}
// Opening semantics and business eligibility were already accepted in Goal7.
// This registry binds those immutable facts; current values come from SQL.
export function createFinalBaselineReader({registry,queryBoundary,verifyPause}){
 const {acceptedBaselineHash,...body}=registry;
 check(hash(body)===acceptedBaselineHash&&registry.schemaVersion==='melisa-final-accepted-baseline.v1'&&registry.accepted===true&&/^[a-f0-9]{64}$/.test(registry.acceptanceEvidenceHash??'')&&Array.isArray(registry.atoms)&&Array.isArray(registry.excluded),'FINAL_ACCEPTED_REGISTRY');
 check(new Set(registry.atoms.map(atomKey)).size===registry.atoms.length,'FINAL_REGISTRY_DUPLICATE');
 return {evidenceKind:'NATIVE_READONLY',verifyPause,bind:async(captured,wantedHash)=>{
  check(wantedHash===acceptedBaselineHash,'FINAL_REGISTRY_BINDING');
  const identity=await queryBoundary('SELECT @@SERVERNAME server,DB_NAME() [database]',{});check(identity.length===1&&identity[0].server===TARGET.server&&identity[0].database===TARGET.database,'FINAL_BASELINE_TEST_IDENTITY');
  const sourceRows=[...captured.accounts.map(r=>({...r,kind:'account'})),...captured.stocks.map(r=>({...r,kind:'stock'})),...captured.prices.map(r=>({...r,kind:'price'}))],source=new Map(sourceRows.map(r=>[atomKey(r),r]));
  check(source.size===sourceRows.length&&sourceRows.length===registry.atoms.length,'FINAL_SOURCE_SCOPE_CHANGED');
  const out={baselineHash:acceptedBaselineHash,receiptsVerified:true,accounts:[],stocks:[],prices:[],excluded:registry.excluded};
  for(const atom of registry.atoms){
   const fresh=source.get(atomKey(atom));check(fresh&&fresh.sourceSemanticsVerified===true&&fresh.sourceT1!==undefined,'FINAL_SOURCE_ATOM_PROOF');
   const states=await queryBoundary(finalNativeReadSql(atom),{nativeId:atom.nativeId,sourceKey:atom.sourceKey,sourceId:atom.sourceKey.split('/').at(-1),currency:atom.currency??null,priceType:atom.priceType??null,tier:atom.tier??null,unitSourceId:atom.unitSourceId??null});check(states.length===1,'FINAL_BASELINE_NATIVE_SINGLE');const state=states[0];nativeValid(atom,state);
   const row={...atom,acceptedBaselineHash,nativeWitnessHash:state.witness,nativeBefore:normalize(state.value),sourceT1:fresh.sourceT1};delete row.kind;
   if(atom.kind==='account'){
    check(/^[a-f0-9]{64}$/.test(fresh.reportProofHash??'')&&fresh.openingVerified===true,'FINAL_REPORT_PROOF');row.reportProofHash=fresh.reportProofHash;row.t1Direction=fresh.t1Direction;row.nativeLedger=normalize(state.ledger);
    const local=await queryBoundary(finalLocalEffectsSql(atom),{party:state.partyId,currency:atom.currency});check(local[0]?.missing===0,'FINAL_LOCAL_UNKNOWN');row.localEffects=normalize(local[0].value);row.acceptedReceipts=await readAcceptedFinalReceipts(queryBoundary,atom);out.accounts.push(row);
   }else if(atom.kind==='stock'){
    check(fresh.unitVerified===true,'FINAL_SOURCE_UNIT_PROOF');row.nativeLedger=normalize(state.ledger);
    const local=await queryBoundary(`SELECT CONVERT(varchar(100),COALESCE(SUM(m.quantity_net),0)) value FROM dbo.stock_movements m WHERE m.product_id=@id AND m.affects_inventory=1 AND m.source_record_key IS NULL AND m.inventory_cutover_id IS NULL AND NOT EXISTS(SELECT 1 FROM dbo.sales_invoices i WHERE m.source_type=N'sales_invoice' AND i.id=m.source_id AND i.affects_inventory=0) AND NOT EXISTS(SELECT 1 FROM dbo.purchase_invoices i WHERE m.source_type=N'purchase_invoice' AND i.id=m.source_id AND i.affects_inventory=0)`,{id:atom.nativeId});row.localEffects=normalize(local[0].value);row.acceptedReceipts=await readAcceptedFinalReceipts(queryBoundary,atom);out.stocks.push(row);
   }else{
    check(atom.acceptedPriceVersion&&/^[a-f0-9]{64}$/.test(atom.acceptedPriceVersion.bindingsHash??''),'FINAL_ACCEPTED_PRICE_VERSION');
    const versions=await queryBoundary(`SELECT CONVERT(varchar(100),v.price_exact) value,v.native_row_hash witness,m.bindings_hash bindingsHash FROM erp_migration.goal7_source_version_prices v JOIN erp_migration.goal7_source_version_manifest m ON m.run_id=v.version_run_id WHERE m.sealed=1 AND v.version_run_id=@run AND v.product_id=@id AND v.price_type=@type AND v.price_tier=@tier AND v.currency_code=@currency AND(v.source_unit_id=@unit OR(v.source_unit_id IS NULL AND @unit IS NULL))`,{run:atom.acceptedPriceVersion.runId,id:atom.nativeId,type:atom.priceType,tier:atom.tier,currency:atom.currency,unit:atom.unitSourceId});
    check(versions.length===1&&versions[0].bindingsHash===atom.acceptedPriceVersion.bindingsHash&&normalize(versions[0].value)===atom.acceptedSourceLatest&&versions[0].witness.toUpperCase()===state.witness.toUpperCase(),'FINAL_PRICE_VERSION_BINDING');out.prices.push(row);
   }
  }
  return out;
 }};
}
