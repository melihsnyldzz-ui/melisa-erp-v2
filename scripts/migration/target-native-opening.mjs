// Owner-authorized opening-only TEST writer. It never connects to Vega or LIVE.
import { sql, RUN, readPrivate, readSource, testPool, ident, fingerprints, savePrivate } from './target-opening-runtime.mjs';
import { hash, requireRule, decimal, roundDecimal, sumDecimals } from './mapping-opening.mjs';
import fs from 'node:fs';
import {privateRoot} from './target-opening-runtime.mjs';
const mutable = Object.freeze({ products:['current_stock_qty','average_cost_try','sales_price','purchase_price','brand','category','is_active'], customers:['balance'], suppliers:['balance'], party_currency_accounts:['current_balance'], product_prices:['price'],product_barcodes:['is_active'] });
const literal = value => "N'" + String(value).replaceAll("'", "''") + "'";
const negate = value => value.startsWith('-') ? value.slice(1) : '-' + value;
const zero = value => decimal(value)==='0.00000000';
let lastStage='initialization';
export function safeFailureCode(error){
  for(const message of [error.message,error.originalError?.message,...(error.precedingErrors??[]).map(e=>e.message)]){
    const code=String(message??'').match(/\b(?:MIGRATION|NATIVE|OPENING|WRONG_TEST|RUN|SOURCE|EXACT|ORIGINAL|VERIFIED|PROTECTED|NEW_ACCOUNT|IMMUTABLE|UNPLANNED|DUPLICATE|DECIMAL)_[A-Z0-9_]+\b/);
    if(code)return code[0];
  }
  return /^[A-Z0-9_]+$/.test(error.message??'')?error.message:'NATIVE_OPENING_FAILED';
}
function movementFor(p) {
  if(p.table==='products'&&!zero(p.stockDelta)) return {table:'stock_movements',key:`${RUN}/STOCK/${p.sourceId}`,fields:{ product_id:p.targetId,movement_type:'adjustment',source_type:'stock_adjustment',source_id:null,quantity_in:p.stockDelta.startsWith('-')?'0.000':p.stockDelta,quantity_out:p.stockDelta.startsWith('-')?p.stockDelta.slice(1):'0.000',quantity_net:p.stockDelta,unit_cost_try:p.fields.average_cost_try,average_cost_try_after:p.fields.average_cost_try,document_date:'2026-10-04',customer_id:null,supplier_id:null,created_by:'1',affects_inventory:true,inventory_cutover_id:null,source_record_key:`${RUN}/STOCK/${p.sourceId}`,migration_run_id:RUN,source_payload_hash:hash(p),source_payload_json:JSON.stringify(p),source_product_id:p.sourceId,source_stock_code:null,source_notes:'Vega opening synchronization; prior native history and local pending effects preserved',warehouse_name:'MERKEZ'}};
  if((['customers','suppliers'].includes(p.table)||p.auxiliary)&&!zero(p.balanceDelta)){const role=p.role??(p.table==='customers'?'customer':'supplier'),delta=p.balanceDelta,abs=delta.startsWith('-')?delta.slice(1):delta;return {table:role+'_movements',key:`${RUN}/${role.toUpperCase()}/${p.sourceId}/${p.currency}`,accountSourceKey:p.auxiliary?p.sourceKey:null,fields:{[role+'_id']:p.partyTargetId??p.targetId,[role==='customer'?'sales_invoice_id':'purchase_invoice_id']:null,party_entity_id:p.partyEntityId,party_currency_account_id:p.partyCurrencyAccountId,movement_type:'opening_balance',amount:roundDecimal(abs),currency_code:p.currency,balance_effect:roundDecimal(delta),balance_effect_exact:delta,document_date:'2026-10-04',created_by:'1',account_currency:p.currency,account_amount:roundDecimal(abs),document_exchange_rate_snapshot:p.currency==='TRY'?'1.00000000':null,account_exchange_rate_snapshot:p.currency==='TRY'?'1.00000000':null,amount_try:p.currency==='TRY'?roundDecimal(abs):null,source_record_key:`${RUN}/${role.toUpperCase()}/${p.sourceId}/${p.currency}`,migration_run_id:RUN,source_payload_hash:hash(p),source_payload_json:JSON.stringify(p),affects_balance:true,source_debit:role==='customer'?(delta.startsWith('-')?'0.00000000':delta):(delta.startsWith('-')?abs:'0.00000000'),source_credit:role==='supplier'?(delta.startsWith('-')?'0.00000000':delta):(delta.startsWith('-')?abs:'0.00000000'),source_notes:'Vega opening balance; currencies and existing native movements preserved'}};}
  return null;
}
export function validatePlan(plan) {
  const {planHash,...payload}=plan;requireRule(plan.run===RUN&&hash(payload)===planHash,'IMMUTABLE_PLAN_HASH_CHANGED');
  const keys=new Set();for(const p of plan.plans){requireRule(mutable[p.table],'NATIVE_TABLE_NOT_ALLOWED');const k=`${p.table}/${p.targetId??p.sourceKey}`;requireRule(!keys.has(k),'DUPLICATE_NATIVE_TARGET');keys.add(k);if(p.targetId!==null)for(const c of Object.keys(p.fields))requireRule(mutable[p.table].includes(c),'UNPLANNED_NATIVE_COLUMN');}
  return true;
}
export function nativeUpdateChunks(rows, size=500) {
  requireRule(Number.isInteger(size)&&size>0&&size<=500,'NATIVE_UPDATE_BATCH_BOUND_REQUIRED');
  const ids=new Set();
  for(const row of rows){requireRule(/^\d+$/.test(String(row.targetId)),'NATIVE_UPDATE_ID_REQUIRED');const id=BigInt(row.targetId).toString();requireRule(!ids.has(id),'DUPLICATE_NATIVE_TARGET');ids.add(id);}
  const ordered=[...rows].sort((a,b)=>BigInt(a.targetId)<BigInt(b.targetId)?-1:1),chunks=[];
  for(let i=0;i<ordered.length;i+=size)chunks.push(ordered.slice(i,i+size));
  return chunks;
}
export async function applyNativeOpening(mode) {
  lastStage='source-and-plan-check';
  requireRule(['--apply-test','--verify','--replay-test'].includes(mode),'EXPLICIT_TEST_MODE_REQUIRED');
  const plan=readPrivate('native-plan.json');validatePlan(plan);
  const {summary,mapped}=readSource(plan.sourceDirectory);requireRule(summary.snapshotHash===plan.sourceHash&&mapped.mappedHash===plan.mappedHash,'SOURCE_CHANGED_AFTER_PLAN');
  const pool=await testPool();
  try {
    if(mode!=='--apply-test')return await verify(pool,plan,mapped,mode==='--replay-test');
    const backup=JSON.parse(fs.readFileSync(privateRoot+'/backup-receipt.json'));
    requireRule(backup.server.toLowerCase()==='semih\\melisadev'&&backup.database==='MELISA_ERP_SIRKET_TEST_20260929_01'&&backup.copyOnly&&backup.checksum&&backup.verifyOnly&&backup.backupSetUuid,'VERIFIED_EXACT_TEST_BACKUP_REQUIRED');
    const prior=(await pool.request().query("SELECT OBJECT_ID(N'erp_migration.runs',N'U') id")).recordset[0].id;
    if(prior){const runs=(await pool.request().input('r',sql.NVarChar(80),RUN).query('SELECT status,source_hash,plan_hash FROM erp_migration.runs WHERE run_id=@r')).recordset;requireRule(runs.length===0,'RUN_ALREADY_EXISTS_USE_REPLAY');}
    requireRule(hash(await fingerprints(()=>pool.request()))===hash(plan.protectedBefore),'PROTECTED_HISTORY_CHANGED_AFTER_PLAN');
    const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new sql.Request(tx),q=async text=>(await req().query(text)).recordset;
    try{
      lastStage='transaction-and-lock';
      await q(`SET XACT_ABORT ON; DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'${RUN}',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @r<0 THROW 51071,'OPENING_LOCK_FAILED',1;IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51071,'WRONG_TEST_TARGET',1;`);
      await q(`IF SCHEMA_ID(N'erp_migration') IS NULL EXEC(N'CREATE SCHEMA erp_migration AUTHORIZATION dbo');IF OBJECT_ID(N'erp_migration.runs',N'U') IS NULL CREATE TABLE erp_migration.runs(run_id nvarchar(80) PRIMARY KEY,source_hash char(64) NOT NULL,plan_hash char(64) NOT NULL,status nvarchar(40) NOT NULL,actor nvarchar(128) NOT NULL,source_as_of nvarchar(40) NOT NULL,receipt_json nvarchar(max) NULL);IF OBJECT_ID(N'erp_migration.records',N'U') IS NULL CREATE TABLE erp_migration.records(run_id nvarchar(80) NOT NULL,entity nvarchar(40) NOT NULL,source_key nvarchar(400) NOT NULL,payload_hash char(64) NOT NULL,payload_json nvarchar(max) NOT NULL,PRIMARY KEY NONCLUSTERED(run_id,entity,source_key));CREATE TABLE #migration_updates(table_name sysname,id bigint,old_hash varchar(64),after_json nvarchar(max),PRIMARY KEY(table_name,id));CREATE TABLE #migration_inserts(table_name sysname,source_key nvarchar(400),after_json nvarchar(max),PRIMARY KEY NONCLUSTERED(table_name,source_key));`);
      await req().input('r',sql.NVarChar(80),RUN).input('s',sql.Char(64),plan.sourceHash).input('p',sql.Char(64),plan.planHash).input('a',sql.NVarChar(40),plan.sourceAsOf).query("INSERT erp_migration.runs VALUES(@r,@s,@p,N'PREPARED',SUSER_SNAME(),@a,NULL);EXEC sys.sp_set_session_context @key=N'migration_run',@value=@r;");
      const updates=plan.plans.filter(p=>p.targetId!==null),inserts=[...plan.plans.filter(p=>p.targetId===null).map(p=>({table:p.table,key:p.sourceKey,fields:p.fields})),...plan.plans.map(movementFor).filter(Boolean)];
      lastStage='immutable-plan-and-staging';
      for(let i=0;i<updates.length;i+=500)await req().input('j',sql.NVarChar(sql.MAX),JSON.stringify(updates.slice(i,i+500))).query("INSERT #migration_updates SELECT table_name,id,old_hash,after_json FROM OPENJSON(@j) WITH(table_name sysname '$.table',id bigint '$.targetId',old_hash varchar(64) '$.beforeHash',after_json nvarchar(max) '$.fields' AS JSON)");
      for(let i=0;i<inserts.length;i+=500)await req().input('j',sql.NVarChar(sql.MAX),JSON.stringify(inserts.slice(i,i+500))).query("INSERT #migration_inserts SELECT table_name,source_key,after_json FROM OPENJSON(@j) WITH(table_name sysname '$.table',source_key nvarchar(400) '$.key',after_json nvarchar(max) '$.fields' AS JSON)");
      const records=Object.entries(mapped.tables).flatMap(([entity,rows])=>rows.map(row=>({entity,source_key:row.source_key,payload_hash:hash(row),payload_json:JSON.stringify(row)})));
      for(let i=0;i<records.length;i+=500)await req().input('j',sql.NVarChar(sql.MAX),JSON.stringify(records.slice(i,i+500))).input('r',sql.NVarChar(80),RUN).query("INSERT erp_migration.records SELECT @r,entity,source_key,payload_hash,payload_json FROM OPENJSON(@j) WITH(entity nvarchar(40),source_key nvarchar(400),payload_hash char(64),payload_json nvarchar(max))");
      const meta=new Map(),originalGuards=[],newGuards=[];
      for(const table of [...new Set([...updates,...inserts].map(p=>p.table))]){
        lastStage='guard-installation:'+table;
        const columns=await q(`SELECT c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.${table}') ORDER BY c.column_id`);meta.set(table,columns);
        const guards=await q(`SELECT name,OBJECT_DEFINITION(object_id) definition FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.${table}') AND is_disabled=0`);
        if(!guards.some(g=>g.name.startsWith('test_guard_'))){const name='migration_guard_'+table;requireRule(!(await q(`SELECT OBJECT_ID(N'dbo.${name}') id`))[0].id,'MIGRATION_GUARD_ALREADY_EXISTS');await q(`CREATE TRIGGER dbo.${name} ON dbo.${table} AFTER INSERT,UPDATE,DELETE AS BEGIN ${guardBranch(table,columns,plan)} END;`);newGuards.push(name);}
        for(const guard of guards){if(!guard.name.startsWith('test_guard_'))continue;const extension=guardBranch(table,columns,plan);const def=guard.definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER').replace(/AS\s+BEGIN\b/i,match=>match+'\n'+extension+'\n');requireRule(def!==guard.definition,'UNKNOWN_GUARD_FORMAT');await q(def);originalGuards.push(guard);}
      }
      for(const table of [...new Set(updates.map(p=>p.table))]){
        lastStage='updates:'+table;
        const cols=mutable[table],metadata=meta.get(table),sets=cols.map(c=>{const type=sqlType(metadata.find(x=>x.name===c));return `p.${ident(c)}=CASE WHEN EXISTS(SELECT 1 FROM OPENJSON(j.after_json) z WHERE z.[key]=N'${c}') THEN CONVERT(${type},JSON_VALUE(j.after_json,N'$.${c}')) ELSE p.${ident(c)} END`;}).join(',');
        const chunks=nativeUpdateChunks(updates.filter(p=>p.table===table));
        for(let i=0;i<chunks.length;i++){
          lastStage=`updates:${table}:batch-${i+1}-of-${chunks.length}`;
          await req().input('ids',sql.NVarChar(sql.MAX),JSON.stringify(chunks[i].map(p=>p.targetId))).query(`DECLARE @batch TABLE(id bigint PRIMARY KEY);INSERT @batch SELECT id FROM OPENJSON(@ids) WITH(id bigint '$');IF EXISTS(SELECT 1 FROM @batch b JOIN #migration_updates j ON j.id=b.id AND j.table_name=N'${table}' JOIN dbo.${table} p ON p.id=j.id WHERE j.old_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)) THROW 51071,'NATIVE_PREIMAGE_CHANGED',1;UPDATE p SET ${sets} FROM @batch b JOIN dbo.${table} p ON p.id=b.id JOIN #migration_updates j ON j.id=p.id AND j.table_name=N'${table}';`);
        }
      }
      for(const table of [...new Set(inserts.map(p=>p.table))]){
        lastStage='inserts:'+table;
        const rows=inserts.filter(p=>p.table===table),columns=[...new Set(rows.flatMap(p=>Object.keys(p.fields)))],metadata=meta.get(table),defs=columns.map(c=>`${ident(c)} ${sqlType(metadata.find(x=>x.name===c))} '$.${c}'`).join(',');
        for(const row of rows.filter(r=>r.accountSourceKey&&r.fields.party_currency_account_id===null)){const linked=(await req().input('k',sql.NVarChar(250),row.accountSourceKey).query('SELECT id FROM dbo.party_currency_accounts WHERE source_record_key=@k')).recordset;requireRule(linked.length===1,'NEW_ACCOUNT_LINK_REQUIRED');row.fields.party_currency_account_id=String(linked[0].id);await req().input('k',sql.NVarChar(400),row.key).input('v',sql.NVarChar(80),row.fields.party_currency_account_id).query(`UPDATE #migration_inserts SET after_json=JSON_MODIFY(after_json,'$.party_currency_account_id',@v) WHERE source_key=@k AND table_name=N'${table}'`);}
        for(let i=0;i<rows.length;i+=500)await req().input('j',sql.NVarChar(sql.MAX),JSON.stringify(rows.slice(i,i+500).map(p=>p.fields))).query(`INSERT dbo.${table}(${columns.map(ident).join(',')}) SELECT ${columns.map(ident).join(',')} FROM OPENJSON(@j) WITH(${defs});`);
      }
      lastStage='original-guard-restoration';
      for(const guard of originalGuards)await q(guard.definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER'));
      for(const name of newGuards)await q(`DROP TRIGGER dbo.${name}`);
      requireRule(hash(await fingerprints(req))===hash(plan.protectedBefore),'NATIVE_HISTORY_OR_FINANCE_CHANGED');
      lastStage='reconciliation';
      const result=await verify({request:req},plan,mapped,false,false);requireRule(result.nativeDifferences===0&&result.stageDifferences===0,'NATIVE_RECONCILIATION_FAILED');
      await req().input('r',sql.NVarChar(80),RUN).input('receipt',sql.NVarChar(sql.MAX),JSON.stringify(result)).query("UPDATE erp_migration.runs SET status=N'COMMITTED',receipt_json=@receipt WHERE run_id=@r;EXEC sys.sp_set_session_context @key=N'migration_run',@value=NULL;");
      await tx.commit();savePrivate('commit-receipt.json',result);return result;
    }catch(e){await tx.rollback().catch(()=>{});throw e;}
  }finally{await pool.close();}
}
function sqlType(c){requireRule(c,'UNKNOWN_SQL_COLUMN');return c.type==='decimal'?`decimal(${c.precision},${c.scale})`:['nvarchar','varchar','char'].includes(c.type)?`${c.type}(${c.max_length===-1?'max':c.type==='nvarchar'?c.max_length/2:c.max_length})`:c.type;}
function guardBranch(table,columns,plan){
  const allowed=mutable[table]??[],immutable=columns.filter(c=>c.name!=='row_version'&&!allowed.includes(c.name)).map(c=>c.name),changes=allowed.map(c=>`(EXISTS(SELECT 1 FROM OPENJSON(p.after_json) z WHERE z.[key]=N'${c}') AND EXISTS(SELECT i.${ident(c)} EXCEPT SELECT CONVERT(${sqlType(columns.find(x=>x.name===c))},JSON_VALUE(p.after_json,N'$.${c}')))) OR (NOT EXISTS(SELECT 1 FROM OPENJSON(p.after_json) z WHERE z.[key]=N'${c}') AND EXISTS(SELECT i.${ident(c)} EXCEPT SELECT d.${ident(c)}))`).join(' OR ');
  const insertCols=columns.filter(c=>!['id','created_at','row_version'].includes(c.name)),insertChecks=insertCols.map(c=>`(EXISTS(SELECT 1 FROM OPENJSON(p.after_json) z WHERE z.[key]=N'${c.name}') AND EXISTS(SELECT i.${ident(c.name)} EXCEPT SELECT CONVERT(${sqlType(c)},JSON_VALUE(p.after_json,N'$.${c.name}')))) OR (NOT EXISTS(SELECT 1 FROM OPENJSON(p.after_json) z WHERE z.[key]=N'${c.name}') AND i.${ident(c.name)} IS NOT NULL)`).join(' OR ');
  const keyExpression=table==='product_barcodes'?"CONCAT(N'BARCODE/',i.product_id,N'/',i.barcode)":'i.source_record_key';
  return `/* ${RUN}: exact immutable plan only, restored before transaction commit. */
IF CONVERT(nvarchar(80),SESSION_CONTEXT(N'migration_run'))=N'${RUN}' BEGIN
 IF IS_SRVROLEMEMBER(N'sysadmin')<>1 OR OBJECT_ID(N'tempdb..#migration_updates') IS NULL OR OBJECT_ID(N'tempdb..#migration_inserts') IS NULL OR NOT EXISTS(SELECT 1 FROM erp_migration.runs WHERE run_id=N'${RUN}' AND source_hash=N'${plan.sourceHash}' AND plan_hash=N'${plan.planHash}' AND status=N'PREPARED') THROW 51071,'MIGRATION_PLAN_REQUIRED',1;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) THROW 51071,'MIGRATION_DELETE_FORBIDDEN',1;
 ${allowed.length?`IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id LEFT JOIN #migration_updates p ON p.id=i.id AND p.table_name=N'${table}' WHERE p.id IS NULL OR p.old_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT d.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) OR EXISTS(SELECT ${immutable.map(c=>'i.'+ident(c)).join(',')} EXCEPT SELECT ${immutable.map(c=>'d.'+ident(c)).join(',')}) OR (${changes})) THROW 51071,'MIGRATION_UPDATE_OUTSIDE_PLAN',1;`:"IF EXISTS(SELECT 1 FROM deleted) THROW 51071,'MIGRATION_HISTORY_UPDATE_FORBIDDEN',1;"}
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id=i.id LEFT JOIN #migration_inserts p ON p.source_key=${keyExpression} AND p.table_name=N'${table}' WHERE d.id IS NULL AND (p.source_key IS NULL OR (${insertChecks}))) THROW 51071,'MIGRATION_INSERT_OUTSIDE_PLAN',1;
 RETURN; END;`;
}
async function verify(pool,plan,mapped,replay,persist=true){
  const q=async s=>(await pool.request().query(s)).recordset;
  const run=(await pool.request().input('r',sql.NVarChar(80),RUN).query('SELECT source_hash,plan_hash,status FROM erp_migration.runs WHERE run_id=@r')).recordset[0];requireRule(run&&run.source_hash===plan.sourceHash&&run.plan_hash===plan.planHash,'RUN_HASH_CHANGED');
  if(replay)requireRule(run.status==='COMMITTED','REPLAY_REQUIRES_COMMITTED_RUN');
  if(persist)requireRule(hash(await fingerprints(()=>pool.request()))===hash(plan.protectedBefore),'ORIGINAL_HISTORY_FINANCE_OR_TERMINAL_CHANGED');
  const stage=(await pool.request().input('r',sql.NVarChar(80),RUN).query('SELECT entity,source_key,payload_hash,payload_json FROM erp_migration.records WHERE run_id=@r ORDER BY entity,source_key')).recordset;
  const expected=new Map(Object.entries(mapped.tables).flatMap(([t,rows])=>rows.map(row=>[`${t}/${row.source_key}`,hash(row)])));let stageDifferences=0;
  for(const row of stage){const k=`${row.entity}/${row.source_key}`;if(expected.get(k)!==row.payload_hash||hash(JSON.parse(row.payload_json))!==row.payload_hash)stageDifferences++;expected.delete(k);}stageDifferences+=expected.size;
  let nativeDifferences=0;const details=[];
  const nativeCounts={};
  for(const table of Object.keys(mutable)){
    const planned=plan.plans.filter(p=>p.table===table),columns=[...new Set(['id','source_record_key',...planned.flatMap(p=>Object.keys(p.fields))])],metadata=await q(`SELECT name,TYPE_NAME(user_type_id) type FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.${table}')`),types=new Map(metadata.map(c=>[c.name,c.type])),rows=await q(`SELECT ${columns.map(c=>table==='product_barcodes'&&c==='source_record_key'?"CONCAT(N'BARCODE/',product_id,N'/',barcode) source_record_key":['decimal','bigint','int'].includes(types.get(c))?`CONVERT(varchar(100),${ident(c)}) ${ident(c)}`:ident(c)).join(',')} FROM dbo.${table} ORDER BY id`),index=new Map(rows.map(r=>[String(r.id),r])),bySource=new Map(rows.filter(r=>r.source_record_key).map(r=>[r.source_record_key,r]));nativeCounts[table]={updates:planned.filter(p=>p.targetId!==null).length,inserts:planned.filter(p=>p.targetId===null).length};
    for(const p of planned){const row=p.targetId===null?bySource.get(p.sourceKey):index.get(p.targetId);if(!row){nativeDifferences++;details.push({sourceKey:p.sourceKey,table,reason:'NATIVE_ROW_MISSING'});continue;}for(const [f,wanted] of Object.entries(p.fields)){const actual=row[f]??null,expected=wanted??null;const equal=types.get(f)==='decimal'?decimal(actual)===decimal(expected):['bigint','int'].includes(types.get(f))?(actual===null?null:String(actual))===(expected===null?null:String(expected)):actual===expected;if(!equal){nativeDifferences++;details.push({sourceKey:p.sourceKey,table,field:f,reason:'NATIVE_FIELD_MISMATCH'});}}}
  }
  for(const table of ['stock_movements','customer_movements','supplier_movements']){
    const expectedMovements=plan.plans.map(movementFor).filter(p=>p?.table===table),columns=[...new Set(expectedMovements.flatMap(p=>Object.keys(p.fields)))],metadata=await q(`SELECT name,TYPE_NAME(user_type_id) type FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.${table}')`),types=new Map(metadata.map(c=>[c.name,c.type])),actual=columns.length?await q(`SELECT ${columns.map(c=>['decimal','bigint','int','date'].includes(types.get(c))?`CONVERT(varchar(100),${ident(c)}) ${ident(c)}`:ident(c)).join(',')} FROM dbo.${table} WHERE migration_run_id=N'${RUN}' ORDER BY source_record_key`):[],byKey=new Map(actual.map(r=>[r.source_record_key,r]));
    for(const m of expectedMovements){const r=byKey.get(m.key);if(!r){nativeDifferences++;continue;}if(m.accountSourceKey&&m.fields.party_currency_account_id===null){const acct=await pool.request().input('k',sql.NVarChar(250),m.accountSourceKey).query('SELECT id FROM dbo.party_currency_accounts WHERE source_record_key=@k');if(acct.recordset.length===1)m.fields.party_currency_account_id=String(acct.recordset[0].id);}
      for(const [f,wanted]of Object.entries(m.fields)){const a=r[f]??null,b=wanted??null,equal=types.get(f)==='decimal'?decimal(a)===decimal(b):['bigint','int'].includes(types.get(f))?(a===null?null:String(a))===(b===null?null:String(b)):types.get(f)==='date'?String(a)===b:a===b;if(!equal){nativeDifferences++;details.push({sourceKey:m.key,table,field:f,reason:'NATIVE_MOVEMENT_MISMATCH'});}}byKey.delete(m.key);}nativeDifferences+=byKey.size;
  }
  let ledgerDifferences=0;
  const stockLedger=await q('SELECT p.id,CONVERT(varchar(100),p.current_stock_qty) scalar_qty,CONVERT(varchar(100),COALESCE(e.qty,0)) ledger_qty FROM dbo.products p OUTER APPLY(SELECT SUM(quantity_net) qty FROM dbo.inventory_effective_movements m WHERE m.product_id=p.id)e'),stockIndex=new Map(stockLedger.map(r=>[String(r.id),r]));
  for(const p of plan.plans.filter(p=>p.table==='products')){const row=stockIndex.get(p.targetId);if(decimal(row?.scalar_qty)!==decimal(row?.ledger_qty))ledgerDifferences++;}
  for(const role of ['customer','supplier']){
    const accounts=await q(`SELECT a.id,a.source_record_key,CONVERT(varchar(100),a.current_balance) account_balance,CONVERT(varchar(100),COALESCE(l.balance,0)) ledger_balance FROM dbo.party_currency_accounts a OUTER APPLY(SELECT SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,m.balance_effect) ELSE 0 END) balance FROM dbo.${role}_movements m WHERE m.${role}_id=a.${role}_id AND COALESCE(m.account_currency,m.currency_code)=a.currency_code)l WHERE a.${role}_id IS NOT NULL`),byId=new Map(accounts.map(r=>[String(r.id),r])),bySource=new Map(accounts.map(r=>[r.source_record_key,r]));
    for(const p of plan.plans.filter(p=>p.table==='party_currency_accounts'&&(p.role===role||plan.plans.some(x=>x.table===(role==='customer'?'customers':'suppliers')&&x.partyCurrencyAccountId===p.targetId)))){const row=p.targetId===null?bySource.get(p.sourceKey):byId.get(p.targetId);if(decimal(row?.account_balance)!==decimal(row?.ledger_balance))ledgerDifferences++;}
  }
  nativeDifferences+=ledgerDifferences;
  const result={run:RUN,status:nativeDifferences+stageDifferences===0?'PASS_NATIVE_OPENING_MAPPED_SCOPE':'FAIL',sourceHash:plan.sourceHash,planHash:plan.planHash,sourceAsOf:plan.sourceAsOf,liveWrites:0,sourceWrites:0,nativeDifferences,ledgerDifferences,stageDifferences,stagedRecords:stage.length,nativeCounts,quarantined:plan.quarantine.length,unknowns:mapped.unknowns,replay,replayWrites:replay?0:null,sourceFreshLive:false,cutoverAccepted:false,details};
  if(persist)savePrivate(replay?'replay-receipt.json':'verification-receipt.json',result,true);return result;
}
if(process.argv[2])applyNativeOpening(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{const detail={run:RUN,stage:lastStage,code:safeFailureCode(e),number:e.number??null,message:e.message,stack:e.stack,originalError:e.originalError?{message:e.originalError.message,sqlstate:e.originalError.sqlstate,code:e.originalError.code}:null,precedingErrors:(e.precedingErrors??[]).map(x=>({message:x.message,number:x.number,state:x.state,lineNumber:x.lineNumber,procedure:x.procName}))};const name='failure-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'.json';savePrivate(name,detail);console.error(JSON.stringify({code:detail.code,number:detail.number,stage:detail.stage,privateFailureFile:name}));process.exitCode=1;});
