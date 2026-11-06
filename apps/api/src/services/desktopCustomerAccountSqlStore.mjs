// Fixed V4 SQL capability: one zero-balance customer account, journal and audit.
// No principal, grant, customer, legacy balance, or sales mutation is exposed.
import {MASTER_V4_RESERVE_SQL,MASTER_V4_FINISH_SQL} from '../../../../scripts/desktop-empty/master-v4-journal-sql.mjs';
import {desktopCustomerAccountCommand,CUSTOMER_ACCOUNT_OPERATION,customerAccountRecord,customerAccountDuplicateRecord,isCustomerAccountRecord} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
const fail=()=>{throw Error('CUSTOMER_ACCOUNT_SQL_UNAVAILABLE');};
const one=r=>{if(!Array.isArray(r?.recordset)||r.recordset.length!==1)fail();return r.recordset[0];};
export function createDesktopCustomerAccountSqlStore({pool,sql,verifySession}={}){
 if(!pool||typeof sql?.Transaction!=='function'||typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof sql?.VarBinary!=='function'||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||typeof verifySession!=='function')fail();
 return Object.freeze({async create({actorId,command:input,payloadHash}){
  const c=desktopCustomerAccountCommand(input);if(typeof actorId!=='string'||!/^[1-9]\d{0,18}$/.test(actorId)||typeof payloadHash!=='string'||!/^[0-9a-f]{64}$/.test(payloadHash))fail();
  const tx=new sql.Transaction(pool);let begun=false;
  const query=(statement,values={})=>{const r=new sql.Request(tx);for(const [k,v] of Object.entries(values))r.input(k,k==='payloadHash'?sql.VarBinary(32):sql.NVarChar(k==='responseJson'?sql.MAX:4000),v);return r.query(statement);};
  const journal={requestIdText:c.requestId,actorIdText:actorId,operation:CUSTOMER_ACCOUNT_OPERATION,payloadHash:Buffer.from(payloadHash,'hex')};
  const prefix='DECLARE @requestId uniqueidentifier=TRY_CONVERT(uniqueidentifier,@requestIdText),@actorId bigint=TRY_CONVERT(bigint,@actorIdText);\n';
  try{
   await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   // Normal auth is profile V4 and takes both permissions in one transaction lease.
   if(await verifySession({transaction:tx,actorId,permission:['customer.edit','customer.view']})!==true)fail();
   const reserved=await query(prefix+MASTER_V4_RESERVE_SQL,journal);
   if(!Array.isArray(reserved?.recordset)||reserved.recordset.length>1)fail();
   if(reserved.recordset.length){const prior=JSON.parse(reserved.recordset[0].response_json);if(!isCustomerAccountRecord(prior,c))fail();await tx.commit();begun=false;return {...prior,replayed:true};}
   const customerSql=`SELECT CONVERT(varchar(20),c.id) customerId,CONVERT(varchar(20),c.party_entity_id) entityId,c.customer_code customerCode,c.name customerName,c.currency_code currency,CONVERT(varchar(40),c.balance) balanceExact4 FROM dbo.customers c WITH(UPDLOCK,HOLDLOCK) JOIN dbo.party_entities e WITH(UPDLOCK,HOLDLOCK) ON e.id=c.party_entity_id WHERE c.id=TRY_CONVERT(bigint,@customer) AND c.is_active=1 AND c.is_deleted=0 AND e.role=N'customer' AND e.identity_rule=N'desktop-local';`;
   const locked=one(await query(customerSql,{customer:c.customerId}));
   if(locked.customerId!==c.customerId||locked.entityId!==c.entityId||locked.customerCode!==c.customerCode||locked.customerName!==c.customerName||typeof locked.balanceExact4!=='string')fail();
   const main=one(await query(`SELECT CONVERT(varchar(20),party_entity_id) entityId,CONVERT(varchar(20),supplier_id) supplierId,CONVERT(varchar(50),current_balance) balanceExact8,balance_status balanceStatus FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE customer_id=TRY_CONVERT(bigint,@customer) AND currency_code=@currency;`,{customer:c.customerId,currency:locked.currency}));
   if(main.entityId!==c.entityId||main.supplierId!==null||main.balanceStatus!=='local'||!/^-?(?:0|[1-9]\d*)\.\d{4}$/.test(locked.balanceExact4)||typeof main.balanceExact8!=='string'||!/^-?(?:0|[1-9]\d*)\.\d{8}$/.test(main.balanceExact8)||BigInt(locked.balanceExact4.replace('.',''))*10000n!==BigInt(main.balanceExact8.replace('.','')))fail();
   // Parent lock serializes normal account creation; unique index covers every writer.
   const existing=await query(`SELECT CONVERT(varchar(20),id) id,CONVERT(varchar(20),party_entity_id) entityId FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK,INDEX(UX_desktop_v4_customer_currency)) WHERE customer_id=TRY_CONVERT(bigint,@customer) AND currency_code=@currency AND customer_id IS NOT NULL AND supplier_id IS NULL;`,{customer:c.customerId,currency:c.currency});
   if(!Array.isArray(existing?.recordset)||existing.recordset.length>1)fail();let response;
   if(existing.recordset.length){if(existing.recordset[0].entityId!==c.entityId)fail();response=customerAccountDuplicateRecord(c);}
   else{
    const inserted=one(await query(`INSERT dbo.party_currency_accounts(party_entity_id,customer_id,supplier_id,currency_code,current_balance,balance_status) OUTPUT CONVERT(varchar(20),inserted.id) id VALUES(TRY_CONVERT(bigint,@entity),TRY_CONVERT(bigint,@customer),NULL,@currency,CONVERT(decimal(28,8),0),N'local');`,{entity:c.entityId,customer:c.customerId,currency:c.currency}));
    const saved=one(await query(`SELECT CONVERT(varchar(20),id) id,CONVERT(varchar(20),customer_id) customerId,CONVERT(varchar(20),party_entity_id) entityId,CONVERT(varchar(20),supplier_id) supplierId,currency_code currency,CONVERT(varchar(50),current_balance) balanceExact8,balance_status balanceStatus,source_record_key sourceRecordKey FROM dbo.party_currency_accounts WITH(HOLDLOCK) WHERE id=TRY_CONVERT(bigint,@account);`,{account:inserted.id}));
    const {supplierId,balanceStatus,sourceRecordKey,...account}=saved;
    if(saved.id!==inserted.id||supplierId!==null||balanceStatus!=='local'||sourceRecordKey!==null)fail();response=customerAccountRecord(c,account);
    const after=one(await query(customerSql,{customer:c.customerId}));if(JSON.stringify(after)!==JSON.stringify(locked))fail();
    const afterJson=JSON.stringify({kind:'desktop-customer-account-v4',actorId,command:c,account});
    await query(`INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason,source) VALUES(TRY_CONVERT(bigint,@actor),N'customer.account.create',N'party-currency-account',TRY_CONVERT(bigint,@account),@json,@request,N'desktop-master-v4');`,{actor:actorId,account:account.id,json:afterJson,request:c.requestId});
    const audit=one(await query(`SELECT CONVERT(varchar(20),actor_user_id) actorId,CONVERT(varchar(20),entity_id) accountId,after_json afterJson FROM dbo.audit_logs WITH(HOLDLOCK) WHERE action=N'customer.account.create' AND entity_type=N'party-currency-account' AND source=N'desktop-master-v4' AND reason=@request;`,{request:c.requestId}));if(audit.actorId!==actorId||audit.accountId!==account.id||audit.afterJson!==afterJson)fail();
   }
   const json=JSON.stringify(response),finished=one(await query(prefix+MASTER_V4_FINISH_SQL,{...journal,responseJson:json}));if(finished.response_json!==json)fail();
   const savedJournal=one(await query(`SELECT operation,CONVERT(varchar(20),actor_id) actorId,LOWER(CONVERT(varchar(64),payload_hash,2)) payloadHash,response_json responseJson FROM dbo.desktop_local_master_requests WITH(HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`,{request:c.requestId}));
   if(savedJournal.operation!==CUSTOMER_ACCOUNT_OPERATION||savedJournal.actorId!==actorId||savedJournal.payloadHash!==payloadHash||savedJournal.responseJson!==json)fail();
   await tx.commit();begun=false;return {...response,replayed:false};
  }finally{if(begun)try{await tx.rollback();}catch{}}
 }});
}
