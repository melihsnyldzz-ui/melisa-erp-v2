// Exact, separately approved TEST-only use of the existing typed delta/journal
// adapter. Importing performs no I/O; the caller owns backup, pause and SQL.
import {createHash} from 'node:crypto';
import {hash} from './party-currency-readonly-plan.mjs';
import {check, units, exact, sqlHash, TARGET} from './goal73-supplier-delta.mjs';
import {verifyCurrentFinanceApprovalPacket} from './unified-finance-approval-plan.mjs';
import {FINAL_SCHEMA_SQL, FINAL_GUARD_SQL, FINAL_PROTECTED_TABLES, FINAL_JOURNAL_DDL,
  finalJournalGuard, finalSqlType, finalGuardBranch, finalNativeReadSql} from './final-cutover-sql.mjs';
import {CURRENT_FINANCE_PARTY_PROC_SQL,CURRENT_FINANCE_PARTY_PROC_HASH} from '../../apps/api/src/services/currentFinanceDeltaRead.mjs';

export const CURRENT_APPROVED_PACKET_HASH = '21b32fe75f766be9783f0f5258f21217a300a521f2e9a9c26fce289b89fffa57';
const sha = text => createHash('sha256').update(text).digest('hex');
const ident = value => {check(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), 'CURRENT_SQL_IDENTIFIER'); return '[' + value + ']';};
const lit = value => "N'" + String(value).replaceAll("'", "''") + "'";
const writable = c => !c.is_identity && !c.is_computed && c.type !== 'timestamp';
const normalize = value => {check(typeof value === 'string' && /^-?\d+(?:\.\d{1,8})?$/.test(value),'CURRENT_NATIVE_DECIMAL');const [a,b='']=value.split('.');return exact(units(a+'.'+b.padEnd(8,'0')));};
const numericId = value => typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value);
const sqlRow = alias => `(SELECT ${alias}.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)`;
const rowHash = alias => `CONVERT(varchar(64),HASHBYTES('SHA2_256',${sqlRow(alias)}),2)`;
const maskVersion = text => text.replace(/"row_version":"[A-Za-z0-9+/=]+"/g,'"row_version":"SQL_AUTOMATIC_ROW_VERSION"');
export function currentFinanceContext(packetHash=CURRENT_APPROVED_PACKET_HASH) {
  check(/^[a-f0-9]{64}$/.test(packetHash),'CURRENT_PACKET_HASH');
  const h=sha('ERP-CARICOMPLETION01/TEST/'+packetHash);
  const cutoverId=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
  return {schemaVersion:'melisa-current-finance-read-context.v1',cutoverId,planHash:packetHash,packetHash,
    partyBindingsHash:hash({packetHash,mode:'APPROVED_CURRENT_TEST_ACCOUNT_DELTA',actualT1:false}),actualT1:false};
}
export function validateCurrentExecutionApproval(packet, approval, expectedHash=CURRENT_APPROVED_PACKET_HASH) {
  check(packet.packetHash===expectedHash && approval?.schemaVersion==='melisa-current-finance-execution-approval.v1'
    && approval.packetHash===packet.packetHash && approval.humanAmountApproved===true && approval.testOnly===true
    && approval.actorId==='13' && approval.target?.server===TARGET.server && approval.target.database===TARGET.database,
  'CURRENT_EXACT_HUMAN_TEST_APPROVAL');
  check(packet.summary.pendingNewAccounts===283 && packet.summary.pendingDifferenceAccounts===59
    && packet.summary.pendingNoOpAccounts===224 && packet.summary.scalarMirrorRepairAccounts===157
    && packet.summary.precisionUpgradeAccounts===159 && packet.summary.priorAppliedAccounts===16
    && packet.summary.blockedOrExcludedAccounts===770,'CURRENT_FIXED_283_SCOPE');
  check(hash(approval.approvedAccountKeys)===hash(packet.pendingAccountKeys),'CURRENT_ACCOUNT_KEYS_CHANGED');
  return currentFinanceContext(packet.packetHash);
}
export function currentSourceEligibility(row, proof, now=Date.now()) {
  const c=proof?.checks?.find(c=>c.accountKey===row.accountKey);
  if(proof?.identity?.server!=='DESKTOP-KSRK0EQ'||proof.identity.database!=='VEGA2026'
    ||proof.identity.sysadmin!==0||proof.SELECTOnly!==true||proof.twoPassStable!==true
    ||!Number.isFinite(Date.parse(proof.endedAt))||now-Date.parse(proof.endedAt)>120000||now<Date.parse(proof.endedAt))
    throw Error('CURRENT_SOURCE_BOUNDARY_OR_FRESHNESS');
  if(!c||c.eligible!==true||c.sourceRowsHash!==row.source.rowsHash
    ||c.cardIdentityHash!==row.source.closingWitness.cardIdentityHash) return 'SOURCE_CHANGED';
  return null;
}
export function currentNativeEligibility(row, state) {
  if(!state||String(state.id)!==row.native.id||String(state.partyId)!==row.native.targetId
    ||String(state.partyEntityId)!==row.native.partyEntityId||state.currency!==row.source.currency
    ||state.mainCurrency!==row.mainCurrency||state.links!==1||state.holds!==0||state.ledgerMissing!==0) return 'TARGET_IDENTITY_HOLD_OR_CURRENCY_CHANGED';
  if(normalize(state.value)!==row.proposal.nativeBefore||normalize(state.ledger)!==row.proposal.nativeBefore
    ||normalize(state.localEffects)!==row.proposal.preservedLocalEffects) return 'TARGET_BALANCE_LEDGER_OR_LOCAL_CHANGED';
  const witness=row.scalarWitness;
  if(state.witness!==witness.nativeAccountBeforeSqlHash||sqlHash(state.partyJSON)!==witness.nativePartyBeforeSqlHash)
    return 'TARGET_FULL_BEFOREIMAGE_CHANGED';
  const expected=row.native.captureMovementRows.map(r=>({id:r.id,h:r.rowHash})).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
  if(hash(state.movementHashes)!==hash(expected)) return 'TARGET_HISTORY_CHANGED';
  return null;
}
export function verifyCurrentReceipt(receipt, context) {
  const {receiptHash,...body}=receipt;
  check(hash(body)===receiptHash&&receipt.status==='COMMITTED'&&receipt.planHash===context.planHash
    &&receipt.id===context.cutoverId+'/account'&&receipt.actualT1===false&&receipt.mode==='APPROVED_CURRENT_TEST_ACCOUNT_DELTA'
    &&receipt.actorId==='13','CURRENT_REPLAY_BODY_CONFLICT');
  check(new Set(receipt.effects.map(e=>e.nativeId)).size===receipt.effects.length
    &&receipt.effects.every(e=>units(e.delta)===0n?e.movementId===null&&e.auditId===null:numericId(e.movementId)&&numericId(e.auditId)),
    'CURRENT_RECEIPT_EFFECT_IDENTITY');
  return receipt;
}
// Existing movement columns are decimal(18,4). They remain compatibility
// projections; the authoritative effect and all delta arithmetic stay 28,8.
export function currentLegacyFourProjection(value) {
  const n=units(value),absolute=n<0n?-n:n,rounded=(absolute/10000n+(absolute%10000n>=5000n?1n:0n))*10000n;
  return exact(n<0n?-rounded:rounded);
}
export async function prepareCurrentPrecisionPermit(q,packetHash) {
  check(/^[a-f0-9]{64}$/.test(packetHash),'CURRENT_PACKET_HASH');
  // Local temp tables must originate in the owning batch. A parameterized
  // sp_executesql call would drop its CREATE TABLE when that RPC returns.
  await q('precision-permit-ddl',"CREATE TABLE #approved_current_finance_precision(packet_hash char(64),backup_verified bit,fresh_native_source_verified bit,mirror_before_images_verified bit,native_writes_paused bit);");
  await q('precision-permit',"INSERT #approved_current_finance_precision VALUES(@hash,1,1,1,1);EXEC sys.sp_set_session_context @key=N'current_finance_amount_approval',@value=@hash;",{hash:packetHash});
}
export function currentFinancialMutations(row,state,context,businessDate) {
  const delta=row.proposal.nativeDelta;
  if(units(delta)===0n) return [];
  check(normalize(state.value)===row.proposal.nativeBefore&&normalize(state.ledger)===row.proposal.nativeBefore
    &&state.links===1&&state.holds===0&&state.currency===row.source.currency,'CURRENT_DELTA_PREIMAGE');
  const run=context.cutoverId+'/account',key=run+'/'+hash(row.accountKey).slice(0,32),amount=exact(units(delta)<0n?-units(delta):units(delta));
  const legacyEffect=currentLegacyFourProjection(delta),legacyAmount=currentLegacyFourProjection(amount);
  const out=[{table:'party_currency_accounts',id:row.native.id,fields:{current_balance:row.proposal.expectedAfter}},
    {table:row.source.role+'_movements',id:null,fields:{[row.source.role+'_id']:row.native.targetId,
      source_record_key:key,migration_run_id:run,source_payload_hash:context.planHash,
      source_payload_json:JSON.stringify({packetHash:context.planHash,accountKey:row.accountKey,delta,actualT1:false,legacyFourProjection:legacyEffect,legacyFieldsAreCompatibilityOnly:true}),
      movement_type:'vega_journal',amount:legacyAmount,currency_code:row.source.currency,balance_effect:legacyEffect,balance_effect_exact:delta,
      account_currency:row.source.currency,account_amount:legacyAmount,document_date:businessDate,created_by:'13',
      party_entity_id:row.native.partyEntityId,party_currency_account_id:row.native.id,affects_balance:true}},
    {table:'audit_logs',id:null,fields:{actor_user_id:'13',action:'final_cutover_delta',entity_type:'party_currency_account',
      entity_id:row.native.id,before_json:state.beforeJSON,after_json:JSON.stringify({value:row.proposal.expectedAfter,packetHash:context.planHash}),
      reason:run,source:'current_finance_approved_test'}}];
  if(row.mainCurrency===row.source.currency) out.push({table:row.source.role==='customer'?'customers':'suppliers',id:row.native.targetId,fields:{balance:row.proposal.expectedAfter}});
  return out;
}
export function createCurrentFinanceSqlStore(driver) {
  check(['transaction','verifyPause','verifyBackup','freshSource','prepareReadModel'].every(k=>typeof driver?.[k]==='function'),'CURRENT_CONNECTED_GUARDED_DRIVER');
  const transact=callback=>driver.transaction({isolation:'SERIALIZABLE'},async tx=>{
    const q=async(op,sql,params={})=>{const r=await tx.query(sql,params,{operation:op});return r?.recordset??r??[];};
    const identity=(await q('identity','SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N\'sysadmin\') admin'))[0];
    check(identity?.server===TARGET.server&&identity.database===TARGET.database&&identity.admin===1,'CURRENT_EXACT_TEST_DATABASE');
    await q('lock',"SET XACT_ABORT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;SET ANSI_WARNINGS ON;SET ANSI_PADDING ON;SET CONCAT_NULL_YIELDS_NULL ON;SET ARITHABORT ON;SET NUMERIC_ROUNDABORT OFF;DECLARE @l int;EXEC @l=sys.sp_getapplock @Resource=N'MELISA-FINAL-CUTOVER',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51830,'CURRENT_LOCK',1;EXEC @l=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51830,'CURRENT_WRITE_LOCK',1;");
    try{return await callback(q);}finally{await q('cleanup',"EXEC sys.sp_set_session_context @key=N'final_cutover_plan',@value=NULL;EXEC sys.sp_set_session_context @key=N'current_finance_amount_approval',@value=NULL;IF OBJECT_ID(N'tempdb..#final_rows') IS NOT NULL DROP TABLE #final_rows;IF OBJECT_ID(N'tempdb..#final_plan') IS NOT NULL DROP TABLE #final_plan;IF OBJECT_ID(N'tempdb..#approved_current_finance_precision') IS NOT NULL DROP TABLE #approved_current_finance_precision;").catch(()=>{});}
  });
  async function readNative(q,row) {
    const atom={kind:'account',role:row.source.role,nativeId:row.native.id};
    const params={nativeId:row.native.id,sourceId:row.source.sourceId,sourceKey:row.source.sourceKey,currency:row.source.currency};
    const states=await q('native',finalNativeReadSql(atom),params);if(states.length!==1)return null;
    const party=row.source.role==='customer'?'customers':'suppliers',mov=row.source.role+'_movements',fk=row.source.role+'_id';
    const extras=(await q('native-party-ledger',`SELECT ${sqlRow('p')} partyJSON,CONVERT(varchar(100),(SELECT COALESCE(SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 AND m.source_record_key IS NULL AND m.cutover_source_key IS NULL THEN COALESCE(m.balance_effect_exact,m.balance_effect) ELSE 0 END),0) FROM dbo.${ident(mov)} m WHERE m.${ident(fk)}=p.id AND COALESCE(m.account_currency,m.currency_code)=@currency)) localEffects FROM dbo.${ident(party)} p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=@partyId`,{partyId:row.native.targetId,currency:row.source.currency}))[0];
    const movementHashes=await q('native-history',`SELECT CONVERT(varchar(20),m.id) id,${rowHash('m')} h FROM dbo.${ident(mov)} m WITH(HOLDLOCK) WHERE m.${ident(fk)}=@partyId AND COALESCE(m.account_currency,m.currency_code)=@currency ORDER BY m.id`,{partyId:row.native.targetId,currency:row.source.currency});
    return {...states[0],...extras,movementHashes};
  }
  async function reconcileReceipt(q,packet,receipt,context) {
    verifyCurrentReceipt(receipt,context);
    const byKey=new Map(packet.rows.filter(r=>packet.pendingAccountKeys.includes(r.accountKey)).map(r=>[r.accountKey,r]));
    const used=[...receipt.effects.map(e=>e.key),...receipt.deferred.map(e=>e.accountKey)];
    check(used.length===283&&new Set(used).size===283&&used.every(k=>byKey.has(k)),'CURRENT_RECEIPT_EXACT_ACCOUNT_COVERAGE');
    for(const effect of receipt.effects) {
      const row=byKey.get(effect.key);
      check(effect.nativeId===row.native.id&&effect.role===row.source.role&&effect.currency===row.source.currency&&effect.delta===row.proposal.nativeDelta,'CURRENT_RECEIPT_APPROVED_AMOUNT');
      const state=await readNative(q,row);
      check(state&&state.holds===0&&state.links===1&&state.ledgerMissing===0&&state.currency===row.source.currency
        &&String(state.partyId)===row.native.targetId&&String(state.partyEntityId)===row.native.partyEntityId
        &&normalize(state.value)===row.proposal.expectedAfter&&normalize(state.ledger)===row.proposal.expectedAfter
        &&normalize(state.localEffects)===row.proposal.preservedLocalEffects&&state.witness===effect.afterWitnessHash,
      'CURRENT_RECEIPT_NATIVE_RECONCILIATION');
      if(row.mainCurrency===row.source.currency)check(normalize(state.scalar)===row.proposal.expectedAfter,'CURRENT_RECEIPT_SCALAR');
      if(units(effect.delta)!==0n) {
        const mov=row.source.role+'_movements',fk=row.source.role+'_id',run=context.cutoverId+'/account';
        const m=(await q('receipt-movement',`SELECT ${sqlRow('m')} j,CONVERT(varchar(100),m.balance_effect_exact) effectExact FROM dbo.${ident(mov)} m WHERE id=@id`,{id:effect.movementId}))[0];
        const a=(await q('receipt-audit',`SELECT ${sqlRow('a')} j FROM dbo.audit_logs a WHERE id=@id`,{id:effect.auditId}))[0];
        check(m&&a,'CURRENT_RECEIPT_EFFECT_MISSING');const movement=JSON.parse(m.j),audit=JSON.parse(a.j);
        check(String(movement[fk])===row.native.targetId&&String(movement.party_currency_account_id)===row.native.id
          &&movement.account_currency===row.source.currency&&movement.currency_code===row.source.currency
          &&normalize(m.effectExact)===effect.delta&&movement.affects_balance===true
          &&movement.movement_type==='vega_journal'&&movement.migration_run_id===run&&movement.source_payload_hash===packet.packetHash
          &&movement.source_record_key===run+'/'+hash(row.accountKey).slice(0,32)
          &&String(audit.actor_user_id)==='13'&&audit.action==='final_cutover_delta'&&audit.reason===run
          &&audit.entity_type==='party_currency_account'&&String(audit.entity_id)===row.native.id,
        'CURRENT_RECEIPT_NATIVE_EFFECT_BINDING');
        check(effect.movementAfterHash===sqlHash(m.j)&&effect.auditAfterHash===sqlHash(a.j),'CURRENT_RECEIPT_NATIVE_FULL_EFFECT_HASH');
      }
    }
  }
  async function protectedProof(q,eligible,schema,context) {
    const accounts=eligible.filter(r=>units(r.proposal.nativeDelta)!==0n).map(r=>r.native.id);
    const parties=role=>eligible.filter(r=>r.source.role===role&&r.mainCurrency===r.source.currency&&(r.proposal.scalarMirrorRepairRequired||units(r.proposal.nativeDelta)!==0n)).map(r=>r.native.targetId);
    const proof={};
    for(const table of [...FINAL_PROTECTED_TABLES,'cash_drawer_accounts','cash_session_counts','inventory_cutovers','inventory_cutover_items','goal73_supplier_currency_runs','goal73_supplier_currency_effects']) {
      let columns='x.*',where='';
      if(['customers','suppliers'].includes(table)) {
        const allowed=parties(table==='customers'?'customer':'supplier');
        columns=schema.filter(c=>c.table===table).map(c=>c.name==='balance'?`CASE WHEN x.id IN(${allowed.length?allowed.join(','):'-1'}) THEN CONVERT(decimal(28,8),0) ELSE CONVERT(decimal(28,8),x.balance) END balance`:c.name==='row_version'?`CASE WHEN x.id IN(${allowed.length?allowed.join(','):'-1'}) THEN CONVERT(varbinary(8),0x0000000000000000) ELSE x.row_version END row_version`:'x.'+ident(c.name)).join(',');
      } else if(table==='party_currency_accounts'&&accounts.length) where=`WHERE x.id NOT IN(${accounts.join(',')})`;
      else if(['customer_movements','supplier_movements'].includes(table))where="WHERE ISNULL(x.migration_run_id,N'')<>@run";
      else if(table==='audit_logs')where="WHERE ISNULL(x.reason,N'')<>@run";
      const journalTable=table.startsWith('goal73_');
      const key=journalTable?(table.endsWith('_effects')?"CONCAT(x.run_id,N'/',x.account_id)":'x.run_id'):'CONVERT(varchar(20),x.id)';
      const order=journalTable?(table.endsWith('_effects')?'x.run_id,x.account_id':'x.run_id'):'x.id';
      const rows=await q('protected',`SELECT ${key} id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${columns} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM dbo.${ident(table)} x ${where} ORDER BY ${order}`,{run:context.cutoverId+'/account'});
      proof[table]=hash(rows);
    }
    proof.authorization=hash(await q('authorization','SELECT (SELECT * FROM dbo.roles ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) roles,(SELECT * FROM dbo.permissions ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) permissions,(SELECT id,username,role_id,is_active,password_hash FROM dbo.users ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) users,(SELECT * FROM erp_migration.operation_quarantine_holds ORDER BY source_key FOR JSON PATH,INCLUDE_NULL_VALUES) holds'));
    return hash(proof);
  }
  async function patch(q,mutations,schema,guards) {
    await q('stage-clear','DELETE #final_rows;');
    for(const m of mutations) {
      const columns=schema.filter(c=>c.table===m.table),names=Object.keys(m.fields);
      check(names.every(n=>columns.some(c=>c.name===n&&writable(c))),'CURRENT_MUTATION_SCHEMA');
      for(const n of names) {const c=columns.find(c=>c.name===n),v=m.fields[n];if(c.type==='decimal'&&v!==null)check(units(normalize(String(v)))%(10n**BigInt(8-c.scale))===0n,'CURRENT_MUTATION_NO_ROUNDING');}
      const defs=names.map(n=>`${ident(n)} ${finalSqlType(columns.find(c=>c.name===n))} '$.${n}'`).join(',');
      if(m.id) {
        const before=(await q('patch-before',`SELECT ${rowHash('x')} witness,${sqlRow('x')} beforeJSON,(SELECT ${columns.filter(writable).map(c=>(names.includes(c.name)?'v.':'x.')+ident(c.name)).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) afterJSON FROM dbo.${ident(m.table)} x WITH(UPDLOCK,HOLDLOCK) CROSS APPLY OPENJSON(@j) WITH(${defs}) v WHERE x.id=@id`,{id:m.id,j:JSON.stringify(m.fields)}))[0];
        check(before&&(!m.beforeHash||before.witness===m.beforeHash),'CURRENT_PATCH_CAS');Object.assign(m,{beforeHash:before.witness,beforeJSON:before.beforeJSON,afterJSON:before.afterJSON});
      } else {
        for(const c of columns.filter(c=>writable(c)&&c.name!=='created_at'&&!names.includes(c.name))) {check(c.is_nullable,'CURRENT_REQUIRED_INSERT_COLUMN');m.fields[c.name]=null;}
        m.afterJSON=JSON.stringify(m.fields);
      }
      m.insertKey=m.id?null:m.table==='audit_logs'?`${m.fields.reason}/${m.fields.entity_type}/${m.fields.entity_id}`:m.fields.source_record_key;
      await q('stage-row','INSERT #final_rows VALUES(@table,@id,@key,@before,@after)',{table:m.table,id:m.id,key:m.insertKey,before:m.beforeHash??null,after:m.afterJSON});
    }
    const touched=new Set(mutations.map(m=>m.table)),wrapped=guards.filter(g=>touched.has(g.table)&&/^(?:test_|c03_guard_|c09_guard_)/.test(g.name)),added=[];
    for(const g of wrapped) {check(!g.disabled&&/^CREATE\s+TRIGGER/i.test(g.definition)&&/AS\s+BEGIN\b/i.test(g.definition),'CURRENT_GUARD_BASELINE');await q('guard-wrap',g.definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER').replace(/AS\s+BEGIN\b/i,s=>s+'\n'+finalGuardBranch(g.table,schema.filter(c=>c.table===g.table))+'\n'));}
    for(const t of touched) {const n='current_finance_exact_'+t;await q('guard-add',`CREATE TRIGGER dbo.${ident(n)} ON dbo.${ident(t)} AFTER INSERT,UPDATE,DELETE AS BEGIN ${finalGuardBranch(t,schema.filter(c=>c.table===t))} IF SESSION_CONTEXT(N'final_cutover_plan') IS NULL THROW 51830,'CURRENT_SESSION_REQUIRED',1; END`);added.push(n);}
    for(const m of mutations) {
      const names=Object.keys(m.fields),columns=schema.filter(c=>c.table===m.table),defs=names.map(n=>`${ident(n)} ${finalSqlType(columns.find(c=>c.name===n))} '$.${n}'`).join(',');
      const statement=m.id?`UPDATE x SET ${names.map(n=>ident(n)+'=v.'+ident(n)).join(',')} FROM dbo.${ident(m.table)} x CROSS APPLY OPENJSON(@j) WITH(${defs}) v WHERE x.id=@id;IF @@ROWCOUNT<>1 THROW 51830,'CURRENT_UPDATE_SINGLE',1;SELECT CONVERT(varchar(20),@id) id`:`DECLARE @ids TABLE(id bigint);INSERT dbo.${ident(m.table)}(${names.map(ident).join(',')}) OUTPUT inserted.id INTO @ids SELECT ${names.map(ident).join(',')} FROM OPENJSON(@j) WITH(${defs});SELECT CONVERT(varchar(20),id) id FROM @ids`;
      const result=await q('mutation',statement,{id:m.id,j:JSON.stringify(m.fields)});check(result.length===1&&numericId(result[0].id),'CURRENT_MUTATION_ID');m.actualId=result[0].id;
      m.actualAfterJSON=(await q('patch-after',`SELECT ${sqlRow('x')} j FROM dbo.${ident(m.table)} x WHERE id=@id`,{id:m.actualId}))[0].j;
    }
    for(const name of added)await q('guard-remove','DROP TRIGGER dbo.'+ident(name));
    for(const g of wrapped) {await q('guard-restore-drop','DROP TRIGGER dbo.'+ident(g.name));await q('guard-restore',g.definition);for(const [op,k] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']]) {const order=g['first_'+k]?'First':g['last_'+k]?'Last':null;if(order)await q('guard-order',`EXEC sys.sp_settriggerorder @triggername=${lit('dbo.'+g.name)},@order=${lit(order)},@stmttype=${lit(op)}`);}}
    check(hash(await q('guard-readback',FINAL_GUARD_SQL))===hash(guards),'CURRENT_GUARD_RESTORE');
    return mutations;
  }
  return {apply:async({packet,trustedInput,phase,phaseFileText,precisionSql,approval})=>{
    verifyCurrentFinanceApprovalPacket(packet,trustedInput);
    const context=validateCurrentExecutionApproval(packet,approval);
    check(sha(precisionSql)===packet.precisionScriptHash,'CURRENT_PRECISION_SCRIPT_CHANGED');
    const {phaseHash,...phaseBody}=phase;check(hash(phaseBody)===phaseHash&&typeof phaseFileText==='string'&&hash(JSON.parse(phaseFileText))===hash(phase)&&sha(phaseFileText)===packet.precisionPhaseFileHash,'CURRENT_PRECISION_PHASE_CHANGED');
    check(/^\d{4}-\d{2}-\d{2}$/.test(approval.businessDate??''),'CURRENT_APPLICATION_DATE');
    check(await driver.verifyPause()===true,'CURRENT_TEST_WRITER_NOT_PAUSED');
    check(await driver.verifyBackup(approval.backup)===true,'CURRENT_BACKUP_NOT_VERIFIED');
    return transact(async q=>{
      await q('scope-ddl','CREATE TABLE #final_plan(cutover_id uniqueidentifier PRIMARY KEY,plan_hash char(64));CREATE TABLE #final_rows(table_name sysname NOT NULL,id bigint NULL,insert_key nvarchar(250) NULL,before_hash char(64) NULL,after_json nvarchar(max) NOT NULL);CREATE UNIQUE INDEX IX_current_update ON #final_rows(table_name,id) WHERE id IS NOT NULL;CREATE UNIQUE INDEX IX_current_insert ON #final_rows(table_name,insert_key) WHERE id IS NULL;');
      await q('scope','INSERT #final_plan VALUES(@cutoverId,@planHash);EXEC sys.sp_set_session_context @key=N\'final_cutover_plan\',@value=@planHash;',{cutoverId:context.cutoverId,planHash:context.planHash});
      const journal=(await q('journal-exists',"SELECT OBJECT_ID(N'erp_migration.final_cutover_parents') id"))[0]?.id;
      if(!journal) {await q('journal-ddl',FINAL_JOURNAL_DDL);for(const t of ['parents','events','children'])await q('journal-guard-create',finalJournalGuard(t));}
      for(const t of ['parents','events','children']) {const guards=await q('journal-guard',`SELECT OBJECT_DEFINITION(object_id) definition,is_disabled disabled FROM sys.triggers WHERE object_id=OBJECT_ID(${lit('erp_migration.immutable_final_cutover_'+t)})`);check(guards.length===1&&!guards[0].disabled&&guards[0].definition===finalJournalGuard(t),'CURRENT_JOURNAL_GUARD');}
      const existing=(await q('receipt','SELECT plan_hash,receipt_json,receipt_hash FROM erp_migration.final_cutover_children WITH(UPDLOCK,HOLDLOCK) WHERE child_id=@id',{id:context.cutoverId+'/account'}))[0];
      if(existing) {const receipt=verifyCurrentReceipt(JSON.parse(existing.receipt_json),context);check(existing.plan_hash===packet.packetHash&&existing.receipt_hash===receipt.receiptHash,'CURRENT_REPLAY_BODY_CONFLICT');await reconcileReceipt(q,packet,receipt,context);return {...receipt,status:'REPLAY_NOOP',newEffects:0};}
      const actor=await q('actor',"SELECT u.id FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id JOIN dbo.permissions p ON p.role_id=r.id WHERE u.id=13 AND u.is_active=1 AND r.is_active=1 AND r.id=2 AND p.permission_key=N'purchase.finalize' AND p.can_approve=1");check(actor.length===1,'CURRENT_EXISTING_ACTOR');
      const pending=packet.rows.filter(r=>packet.pendingAccountKeys.includes(r.accountKey)),source=await driver.freshSource(packet),eligible=[],deferred=[];
      for(const row of pending) {const state=await readNative(q,row);const reason=currentSourceEligibility(row,source)||currentNativeEligibility(row,state);if(reason)deferred.push({accountKey:row.accountKey,reason});else eligible.push(row);}
      const initialSchema=await q('schema',FINAL_SCHEMA_SQL),guards=await q('guards',FINAL_GUARD_SQL);
      check(guards.every(g=>!g.disabled),'CURRENT_DISABLED_GUARD');
      let protectedBefore=await protectedProof(q,eligible,initialSchema,context);
      // Re-read source immediately before the first DDL/mutation, after the
      // potentially expensive whole-target preservation proof.
      const finalSource=await driver.freshSource(packet),beforeCount=eligible.length;
      for(let i=eligible.length-1;i>=0;i--) {const reason=currentSourceEligibility(eligible[i],finalSource);if(reason){deferred.push({accountKey:eligible[i].accountKey,reason});eligible.splice(i,1);}}
      if(beforeCount!==eligible.length)protectedBefore=await protectedProof(q,eligible,initialSchema,context);
      check(await driver.verifyPause()===true,'CURRENT_TEST_WRITER_NOT_PAUSED');
      await prepareCurrentPrecisionPermit(q,packet.packetHash);
      await q('precision',precisionSql);
      const schema=await q('schema-after',FINAL_SCHEMA_SQL);check(['customers','suppliers'].every(t=>schema.some(c=>c.table===t&&c.name==='balance'&&c.precision===28&&c.scale===8)),'CURRENT_PRECISION_READBACK');
      const mirrorEffects=[],mirrorBefore=new Map(),mirrorMutations=[];
      for(const row of eligible.filter(r=>r.proposal.scalarMirrorRepairRequired)) {
        const p=phase.rows.find(p=>p.accountKey===row.accountKey);check(p,'CURRENT_MIRROR_PHASE_MISSING');
        const state=await readNative(q,row);check(sqlHash(state.partyJSON)===p.before28_8SqlHash,'CURRENT_POST_DDL_PREIMAGE');
        mirrorBefore.set(row.accountKey,state);mirrorMutations.push({rowKey:row.accountKey,table:row.source.role==='customer'?'customers':'suppliers',id:row.native.targetId,beforeHash:p.before28_8SqlHash,fields:{balance:p.approvedMirrorExact}});
      }
      if(mirrorMutations.length)await patch(q,mirrorMutations,schema,guards);
      for(const row of eligible.filter(r=>r.proposal.scalarMirrorRepairRequired)) {
        const p=phase.rows.find(p=>p.accountKey===row.accountKey),state=mirrorBefore.get(row.accountKey),after=mirrorMutations.find(m=>m.rowKey===row.accountKey).actualAfterJSON;
        check(sqlHash(maskVersion(after))===p.mirror28_8PlannedProjectionHash,'CURRENT_MIRROR_BUSINESS_PROJECTION');
        const next=await readNative(q,row);check(next.witness===state.witness&&normalize(next.value)===p.nativeAccountExactUnchanged&&hash(next.movementHashes)===hash(state.movementHashes),'CURRENT_MIRROR_CREATED_FINANCE');
        mirrorEffects.push({accountKey:row.accountKey,nativeId:row.native.id,beforeJSON:state.partyJSON,afterJSON:after,beforeHash:sqlHash(state.partyJSON),afterHash:sqlHash(after),noLedgerEffect:true});
      }
      const effects=[],financialBefore=new Map(),financialMutations=[];
      for(const row of eligible) {
        const state=await readNative(q,row);
        check(normalize(state.value)===row.proposal.nativeBefore,'CURRENT_DELTA_ACCOUNT_CHANGED');
        const mutations=currentFinancialMutations(row,state,context,approval.businessDate);
        financialBefore.set(row.accountKey,state);financialMutations.push(...mutations.map(m=>({...m,rowKey:row.accountKey})));
      }
      if(financialMutations.length)await patch(q,financialMutations,schema,guards);
      for(const row of eligible) {
        const state=financialBefore.get(row.accountKey),beforeParty=state.partyJSON,mutations=financialMutations.filter(m=>m.rowKey===row.accountKey);
        const after=await readNative(q,row);check(normalize(after.value)===row.proposal.expectedAfter&&normalize(after.ledger)===row.proposal.expectedAfter&&normalize(after.localEffects)===row.proposal.preservedLocalEffects,'CURRENT_AFTER_RECONCILIATION');
        if(row.mainCurrency===row.source.currency)check(normalize(after.scalar)===row.proposal.expectedAfter,'CURRENT_MAIN_SCALAR_RECONCILIATION');
        const sharedMainChanged=eligible.some(r=>r.source.role===row.source.role&&r.native.targetId===row.native.targetId&&r.mainCurrency===r.source.currency&&units(r.proposal.nativeDelta)!==0n);
        if(!mutations.length)check(state.witness===after.witness&&hash(state.movementHashes)===hash(after.movementHashes)&&(sharedMainChanged||beforeParty===after.partyJSON),'CURRENT_LEDGER_NOOP_CHANGED');
        effects.push({key:row.accountKey,nativeId:row.native.id,role:row.source.role,currency:row.source.currency,delta:row.proposal.nativeDelta,
          beforeJSON:state.beforeJSON,afterJSON:after.beforeJSON,beforePartyJSON:beforeParty,afterPartyJSON:after.partyJSON,
          beforeWitnessHash:state.witness,afterWitnessHash:after.witness,movementId:mutations.find(m=>m.table.endsWith('_movements'))?.actualId??null,auditId:mutations.find(m=>m.table==='audit_logs')?.actualId??null,
          movementAfterHash:mutations.find(m=>m.table.endsWith('_movements'))?sqlHash(mutations.find(m=>m.table.endsWith('_movements')).actualAfterJSON):null,
          auditAfterHash:mutations.find(m=>m.table==='audit_logs')?sqlHash(mutations.find(m=>m.table==='audit_logs').actualAfterJSON):null});
      }
      check(await protectedProof(q,eligible,schema,context)===protectedBefore,'CURRENT_PROTECTED_HISTORY_CHANGED');
      check(hash(await q('guards-final',FINAL_GUARD_SQL))===hash(guards),'CURRENT_GUARDS_CHANGED');
      const body={id:context.cutoverId+'/account',planHash:packet.packetHash,domain:'account',inverse:false,status:'COMMITTED',actorId:'13',actualT1:false,
        mode:'APPROVED_CURRENT_TEST_ACCOUNT_DELTA',effects,mirrorEffects,deferred,approvedAccounts:283,appliedAccounts:effects.filter(e=>units(e.delta)!==0n).length,
        unchangedAccounts:effects.filter(e=>units(e.delta)===0n).length,mirrorAccounts:mirrorEffects.length,newEffects:effects.filter(e=>units(e.delta)!==0n).length,
        protectedBeforeHash:protectedBefore,prior16Preserved:true,blocked770Preserved:true,backup:approval.backup};
      const receipt={...body,receiptHash:hash(body)};verifyCurrentReceipt(receipt,context);
      await reconcileReceipt(q,packet,receipt,context);
      const parent={schemaVersion:'melisa-current-finance-test-application.v1',packetHash:packet.packetHash,actualT1:false,approvedAccountKeys:packet.pendingAccountKeys,deferred};
      await q('parent-create','INSERT erp_migration.final_cutover_parents VALUES(@id,@hash,@source,@plan,@collector,@party,@actor,@execution)',{id:context.cutoverId,hash:packet.packetHash,source:hash(finalSource),plan:JSON.stringify(parent),collector:JSON.stringify(finalSource),party:context.partyBindingsHash,actor:'13',execution:hash(approval)});
      await q('child-create','INSERT erp_migration.final_cutover_children VALUES(@id,@parent,@hash,N\'account\',0,@json,@receipt)',{id:receipt.id,parent:context.cutoverId,hash:packet.packetHash,json:JSON.stringify(receipt),receipt:receipt.receiptHash});
      await q('reconciled','INSERT erp_migration.final_cutover_events(cutover_id,plan_hash,state,proof_hash) VALUES(@id,@hash,N\'CURRENT_RECONCILED\',@receipt)',{id:context.cutoverId,hash:packet.packetHash,receipt:receipt.receiptHash});
      const reader=(await q('reader-exists',"SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_current_finance_deltas')) definition"))[0]?.definition;
      if(!reader)await q('reader-create',CURRENT_FINANCE_PARTY_PROC_SQL);else check(sqlHash(reader)===CURRENT_FINANCE_PARTY_PROC_HASH,'CURRENT_READER_DRIFT');
      const readerAfter=(await q('reader-readback',"SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_current_finance_deltas')) definition"))[0]?.definition;
      check(typeof readerAfter==='string'&&sqlHash(readerAfter)===CURRENT_FINANCE_PARTY_PROC_HASH,'CURRENT_READER_INSTALL_VERIFY');
      check(await driver.prepareReadModel(q,{...context,accountIds:effects.map(e=>e.nativeId)})===true,'CURRENT_READ_MODEL_NOT_PREPARED');
      check(await driver.verifyPause()===true,'CURRENT_TEST_WRITER_NOT_PAUSED');
      return receipt;
    });
  }};
}
