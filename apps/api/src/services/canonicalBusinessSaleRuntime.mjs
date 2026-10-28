// Production SQL runtime separated from the pure terminal feature graph.
// A supported protected startup alone owns the one-time bootstrap; caller
// pools, drivers, requests and transaction factories are never accepted.
import {createHash} from 'node:crypto';
import {BUSINESS_SESSION,assertCanonicalBusinessSession,getCanonicalBusinessSession,isCanonicalBusinessSaleAvailable,validateCanonicalBusinessSaleTransactionProof,CANONICAL_BUSINESS_SALE_METADATA_SQL,consumeCanonicalBusinessSaleRuntimeBootstrap} from './canonicalBusinessSessionContext.mjs';

export function configureCanonicalBusinessSaleRuntime(bootstrap){
 const access=consumeCanonicalBusinessSaleRuntimeBootstrap(bootstrap);
 const {saleAdmissions,saleTransactions,issuedSaleTransactions,saleReadContexts,saleOperations,saleError,frozen,positiveId,exact,sha,installRuntime}=access;
async function readCanonicalBusinessSaleContext({actor,selection}){
 if(!isCanonicalBusinessSaleAvailable(actor))saleError();
 const context=assertCanonicalBusinessSession(getCanonicalBusinessSession()),profile=saleAdmissions.get(context);
 if(!selection||Object.keys(selection).sort().join(',')!=='currency,customerAccountId,customerId,documentDate,items'||!positiveId(selection.customerId)||!positiveId(selection.customerAccountId)||!['TRY','USD','EUR'].includes(selection.currency)||typeof selection.documentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(selection.documentDate)||!Array.isArray(selection.items)||selection.items.length<1||selection.items.length>2)saleError();
 const ids=new Set();for(const item of selection.items){if(!item||Object.keys(item).sort().join(',')!=='productId,quantityExact3,quoteId'||!positiveId(item.productId)||!positiveId(item.quoteId)||!exact(item.quantityExact3,3)||! /^[1-5]\.000$/.test(item.quantityExact3)||ids.has(item.productId))saleError();ids.add(item.productId);}
 selection=structuredClone(selection);
 const db=await import('../config/database.js');if(!db.isCanonicalTest()||db.isIsolatedOperationCopyRuntime?.())saleError();
 const pool=await db.getSqlPool(),sql=db.getSqlDriver(),transaction=new sql.Transaction(pool),request=()=>new sql.Request(transaction);
 try{
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@canonicalSaleLock,@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51106,'CANONICAL_BUSINESS_SALE_BUSY',1;");
  const metadata=async()=>{const rows=(await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;if(rows?.length!==1)saleError();const m=rows[0];if(m.databaseName!==BUSINESS_SESSION.database||m.serverName!==BUSINESS_SESSION.server||m.loginName!==BUSINESS_SESSION.login||m.databaseUser!==BUSINESS_SESSION.login||m.sysadmin!==0||m.databaseControl!==0||m.liveDatabaseAccess!==0||m.transactionCount!==1||m.transactionState!==1||m.isolationLevel!==4||m.lockMode!=='Shared'||m.assertDefinitionHash!==profile.assertDefinitionHash||m.beginDefinitionHash!==profile.beginDefinitionHash||m.contextDefinitionHash!==profile.contextDefinitionHash||m.effectsDefinitionHash!==profile.effectsDefinitionHash||m.contextDefinitionHash!==profile.contextDefinitionHash)saleError();return m;};
  const before=await metadata(),rows=(await request().input('actor_id',sql.BigInt,'17').input('selection_json',sql.NVarChar(sql.MAX),JSON.stringify(selection)).execute('dbo.usp_canonical_business_sale_context_v1')).recordset;
  if(rows?.length!==1||typeof rows[0].context_json!=='string')saleError();let value;try{value=JSON.parse(rows[0].context_json);}catch{saleError();}
  const scope=value?.scope;
  if(value?.profileHash!==profile.profileHash||!sha(value.revision)||!sha(value.nativePreviewHash)||value.meta?.date!==selection.documentDate||value.meta.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||scope?.synthetic!==false||scope.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||scope.customer?.id!==selection.customerId||scope.customer.accountId!==selection.customerAccountId||scope.customer.currency!==selection.currency||!positiveId(scope.customer.partyId)||!Array.isArray(scope.products)||scope.products.length!==selection.items.length||value.capabilities?.canCollect!==false||value.capabilities.canCancelCollection!==false||!exact(value.rate?.rateExact8,8)||value.rate.currency!==selection.currency||typeof value.rate.rateDate!=='string'||value.rate.rateDate>selection.documentDate||typeof value.rate.sourceKey!=='string'||!value.nativeExpected||!Array.isArray(value.nativeExpected.items)||value.nativeExpected.items.length!==selection.items.length)saleError();
  for(const item of selection.items){const p=scope.products.filter(p=>p.id===item.productId);if(p.length!==1||p[0].synthetic!==false||p[0].operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||p[0].unit?.label!=='ADET'||p[0].unit.factorExact8!=='1.00000000'||!positiveId(p[0].unit.sourceId)||!exact(p[0].costExact4,4)||!Array.isArray(p[0].prices)||p[0].prices.filter(q=>q.quoteId===item.quoteId&&q.currency===selection.currency&&exact(q.unitPriceExact8,8)).length!==1)saleError();}
  if(JSON.stringify(await metadata())!==JSON.stringify(before))saleError();
  await transaction.commit();value.revision=value.revision.toLowerCase();value.nativePreviewHash=value.nativePreviewHash.toLowerCase();for(const key of ['canCreate','canFinalize','canCancel'])value.capabilities[key]=profile.writesEnabled===true&&value.capabilities[key]===true;frozen(value);saleReadContexts.set(value,context);return value;
 }catch(error){try{await transaction.rollback();}catch{}throw error;}
}
async function runCanonicalBusinessSaleTransaction(input,callback){
 if(!input||Object.keys(input).some(k=>!['actor','requestId','operation','invoiceId','bodyJson'].includes(k)))saleError();
 const context=assertCanonicalBusinessSession(getCanonicalBusinessSession()),profile=saleAdmissions.get(context);
 if(!profile||profile.writesEnabled!==true||typeof callback!=='function')saleError();
 if(!Object.hasOwn(saleOperations,input.operation)||String(input.actor?.id)!=='17'||input.actor.username!==context.username||String(input.actor.role?.id)!=='17'||input.actor.role.code!==context.roleCode||input.actor.isActive===false||input.actor.isAdmin===true||input.actor.testAdminSession===true||!Array.isArray(input.actor.permissions)||JSON.stringify([...input.actor.permissions].sort())!==JSON.stringify([...context.permissions].sort())||!input.actor.permissions.includes(saleOperations[input.operation])||typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestId)||typeof input.bodyJson!=='string')saleError();
 let body;try{body=JSON.parse(input.bodyJson);}catch{saleError();}
 if(!body||body.actorId!=='17'||body.operation!==input.operation||body.requestId!==input.requestId||(input.operation!=='sale_draft'&&(!positiveId(input.invoiceId)||body.id!==input.invoiceId)))saleError();
 input=Object.freeze({...input,actor:Object.freeze({...input.actor,role:Object.freeze({...input.actor.role}),permissions:Object.freeze([...input.actor.permissions])})});
 const db=await import('../config/database.js');
 if(!db.isCanonicalTest()||db.isIsolatedOperationCopyRuntime?.())saleError();
 const pool=await db.getSqlPool(),sql=db.getSqlDriver(),transaction=new sql.Transaction(pool);
 issuedSaleTransactions.set(transaction,{pool,sql,context});
 let committing=false;
 try{
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const request=()=>new sql.Request(transaction);
  await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@canonicalSaleLock,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51106,'CANONICAL_BUSINESS_SALE_BUSY',1;");
  const metadata=(await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;
  if(metadata?.length!==1||metadata[0].databaseName!==BUSINESS_SESSION.database||metadata[0].serverName!==BUSINESS_SESSION.server||metadata[0].loginName!==BUSINESS_SESSION.login||metadata[0].databaseUser!==BUSINESS_SESSION.login||metadata[0].sysadmin!==0||metadata[0].databaseControl!==0||metadata[0].liveDatabaseAccess!==0||metadata[0].transactionCount!==1||metadata[0].transactionState!==1||metadata[0].isolationLevel!==4||metadata[0].lockMode!=='Exclusive'||metadata[0].assertDefinitionHash!==profile.assertDefinitionHash||metadata[0].beginDefinitionHash!==profile.beginDefinitionHash||metadata[0].effectsDefinitionHash!==profile.effectsDefinitionHash||metadata[0].contextDefinitionHash!==profile.contextDefinitionHash)saleError();
  if(!Number.isSafeInteger(metadata[0].sessionId)||metadata[0].sessionId<=0||!positiveId(metadata[0].transactionId))saleError();
  const unchangedMetadata=async()=>{const current=(await request().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;if(current?.length!==1||JSON.stringify(current[0])!==JSON.stringify(metadata[0]))saleError();};
  // The owner checks the existing journal before resolving prices/stock. A
  // committed request never obtains another native transaction write binding.
  const issued=(await request().input('request_id',sql.UniqueIdentifier,input.requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),input.operation).input('payload_json',sql.NVarChar(sql.MAX),input.bodyJson).execute('dbo.usp_canonical_business_sale_begin_v1')).recordset;
  if(issued?.length!==1)saleError();
  const bodyHash=createHash('sha256').update(input.bodyJson,'utf16le').digest('hex').toUpperCase();
  if(issued[0].replayed===true){
   const old=issued[0];if(old.actorId!=='17'||old.operation!==input.operation||old.bodyHash!==bodyHash||typeof old.response_json!=='string')saleError();
   const value=JSON.parse(old.response_json);if(!value||value.requestId!==input.requestId)saleError();
   await unchangedMetadata();committing=true;await transaction.commit();return {...value,replayed:true};
  }
  if(issued[0].replayed!==false)saleError();
  const result=await withCanonicalBusinessSaleTransaction({...input,transaction},binding=>callback({binding,transaction,sql}));
  if(!result||result.requestId!==input.requestId)saleError();
  const responseJSON=JSON.stringify(result),responseHash=createHash('sha256').update(responseJSON,'utf16le').digest('hex').toUpperCase();
  await request().input('id',sql.UniqueIdentifier,input.requestId).input('actor',sql.BigInt,'17').input('operation',sql.NVarChar(30),input.operation).input('hash',sql.Char(64),bodyHash).input('payload',sql.NVarChar(sql.MAX),input.bodyJson).input('response',sql.NVarChar(sql.MAX),responseJSON).query('INSERT dbo.work_trade_requests(request_id,actor_id,operation,payload_hash,payload_json,response_json)VALUES(@id,@actor,@operation,@hash,@payload,@response);');
  const completed=(await request().input('request_id',sql.UniqueIdentifier,input.requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),input.operation).input('completed',sql.Bit,true).execute('dbo.usp_canonical_business_sale_assert_v1')).recordset;
  if(completed?.length!==1||completed[0].completed!==true||completed[0].phase!=='DONE'||completed[0].requestId!==input.requestId||completed[0].actorId!=='17'||completed[0].operation!==input.operation||completed[0].bodyHash!==bodyHash||completed[0].responseHash!==responseHash)saleError();
  await unchangedMetadata();committing=true;await transaction.commit();return result;
 }catch(error){try{await transaction.rollback();}catch{}if(committing)throw Object.assign(new Error('İşlemin sonucu henüz doğrulanamadı. Aynı işlem kimliğiyle sonucu kontrol edin.'),{code:'CANONICAL_BUSINESS_SALE_COMMIT_UNCONFIRMED',statusCode:503});throw error;}
 finally{saleTransactions.delete(transaction);issuedSaleTransactions.delete(transaction);}
}
async function withCanonicalBusinessSaleTransaction(input,callback){
 const {transaction,actor,requestId,operation,invoiceId=null,bodyJson}=input??{},issued=issuedSaleTransactions.get(transaction);
 if(!issued||Object.hasOwn(input,'request')||Object.hasOwn(input,'sql')||transaction.parent!==issued.pool)saleError();
 const {sql}=issued,request=()=>new sql.Request(transaction);
 const context=assertCanonicalBusinessSession(getCanonicalBusinessSession()),profile=saleAdmissions.get(context);
 if(issued.context!==context)saleError();
 if(!profile||!transaction||typeof request!=='function'||typeof callback!=='function'||saleTransactions.has(transaction)||!Object.hasOwn(saleOperations,operation)||String(actor?.id)!=='17'||actor.username!==context.username||String(actor.role?.id)!=='17'||actor.role.code!==context.roleCode||actor.isActive===false||actor.isAdmin===true||actor.testAdminSession===true||!Array.isArray(actor.permissions)||JSON.stringify([...actor.permissions].sort())!==JSON.stringify([...context.permissions].sort())||!actor.permissions.includes(saleOperations[operation])||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)||typeof bodyJson!=='string'||(invoiceId!==null&&!positiveId(invoiceId)))saleError();
 const bodyHash=createHash('sha256').update(bodyJson,'utf16le').digest('hex').toUpperCase();
 let body;try{body=JSON.parse(bodyJson);}catch{saleError();}
 if(!body||typeof body!=='object'||Array.isArray(body)||body.actorId!=='17'||body.operation!==operation||body.requestId!==requestId||(operation!=='sale_draft'&&body.id!==invoiceId))saleError();
 const req=()=>{const r=request();if(r?.parent!==transaction)saleError();return r;};
 const metadata=async()=>{const rows=(await req().input('canonicalSaleLock',sql.NVarChar(255),`melisa-canonical-business-sale:${profile.profileHash}`).query(CANONICAL_BUSINESS_SALE_METADATA_SQL)).recordset;if(rows?.length!==1)saleError();const m=rows[0];if(m.databaseName!==BUSINESS_SESSION.database||m.serverName!==BUSINESS_SESSION.server||m.loginName!==BUSINESS_SESSION.login||m.databaseUser!==BUSINESS_SESSION.login||m.sysadmin!==0||m.databaseControl!==0||m.liveDatabaseAccess!==0||m.transactionCount!==1||m.transactionState!==1||m.isolationLevel!==4||m.lockMode!=='Exclusive'||!Number.isSafeInteger(m.sessionId)||m.sessionId<=0||!positiveId(m.transactionId)||m.assertDefinitionHash!==profile.assertDefinitionHash||m.beginDefinitionHash!==profile.beginDefinitionHash||m.effectsDefinitionHash!==profile.effectsDefinitionHash||m.contextDefinitionHash!==profile.contextDefinitionHash)saleError();return m;};
 const before=await metadata();
 const rows=(await req().input('request_id',sql.UniqueIdentifier,requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),operation).execute('dbo.usp_canonical_business_sale_assert_v1')).recordset;
 if(rows?.length!==1||typeof rows[0].proof_json!=='string')saleError();
 let proof;try{proof=JSON.parse(rows[0].proof_json);}catch{saleError();}
 const binding=validateCanonicalBusinessSaleTransactionProof(proof,{profile,before,requestId,operation,invoiceId,bodyHash,body});
 const after=await metadata();if(JSON.stringify(after)!==JSON.stringify(before))saleError();
  saleTransactions.set(transaction,{context,binding,rawProofJSON:rows[0].proof_json});
  if(operation==='sale_draft')saleReadContexts.set(binding.context,context);
 try{
  const value=await callback(binding);
  await req().input('request_id',sql.UniqueIdentifier,requestId).input('actor_id',sql.BigInt,'17').input('operation',sql.NVarChar(40),operation).execute('dbo.usp_canonical_business_sale_effects_v1');
  if(JSON.stringify(await metadata())!==JSON.stringify(before))saleError();
  return value;
 }finally{saleTransactions.delete(transaction);if(operation==='sale_draft')saleReadContexts.delete(binding.context);}
}
 installRuntime({read:readCanonicalBusinessSaleContext,run:runCanonicalBusinessSaleTransaction,with:withCanonicalBusinessSaleTransaction});
}
