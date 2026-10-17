import {CRM_ORDER_TEST,crmOrderError,normalizeCrmOrderRequest,crmOrderGatewayOrigin,crmOrderFingerprint,normalizeCrmOpeningProduct,crmOrderNativeId,crmOrderPublicId,crmOrderMoney,crmOrderTotals} from './testCrmOrderContract.mjs';

const sqlCodes={51090:'CRM_TEST_DATABASE_REQUIRED',51091:'CRM_TEST_LINES_INVALID',51092:'CRM_TEST_PRODUCT_MAPPING_REQUIRED',51093:'CRM_TEST_REQUEST_CONFLICT',51094:'CRM_TEST_SCOPE_REQUIRED',51095:'CRM_TEST_LOCK_TIMEOUT',51096:'CRM_TEST_ORDER_NOT_FOUND',51097:'CRM_TEST_OPENING_BINDING_DRIFT',51098:'CRM_TEST_PRODUCT_QUARANTINED',51099:'CRM_TEST_OPENING_NOT_READY'};
export function createTestCrmOrderService({environment=process.env,transport=globalThis.fetch,sqlDependencies=()=>import('../config/database.js')}={}){
  const origin=crmOrderGatewayOrigin(environment.CRM_TEST_GATEWAY_ORIGIN);
  function assertEnvironment(){if(environment.MELISA_CANONICAL_TEST!=='true'||environment.MELISA_TEST_SCOPED_SALES!=='true'||environment.SQL_DATABASE!==CRM_ORDER_TEST.database||environment.SQL_READ_ONLY!=='false')throw crmOrderError('CRM_TEST_DATABASE_REQUIRED',503)}
  async function crmContext(authorization){
    assertEnvironment();
    if(typeof authorization!=='string'||!/^Bearer [^\s]+$/.test(authorization))throw crmOrderError('CRM_TEST_SESSION_REQUIRED',401);
    async function read(route){
      assertEnvironment();
      let response;try{response=await transport(new URL(route,origin),{headers:{authorization,accept:'application/json'},redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)})}catch{throw crmOrderError('CRM_TEST_VERIFICATION_UNAVAILABLE',503)}
      if(!response.ok)throw crmOrderError('CRM_TEST_ACCESS_DENIED',response.status===401?401:403);
      let body;try{const raw=await response.text();if(Buffer.byteLength(raw)>2*1024*1024)throw Error();body=JSON.parse(raw)}catch{throw crmOrderError('CRM_TEST_VERIFICATION_UNAVAILABLE',503)}
      assertEnvironment();if(body.success!==true)throw crmOrderError('CRM_TEST_ACCESS_DENIED',403);return body;
    }
    const identity=await read('/auth/me'),actor=identity.data;
    if(identity.meta?.source!=='crm-auth'||!actor||typeof actor.id!=='string'||!actor.id||actor.id.length>80||actor.active===false||!['patron','mudur','personel'].includes(actor.role)||!Array.isArray(actor.permissions)||!actor.permissions.includes('crm.view')||!actor.permissions.includes('crm.send'))throw crmOrderError('CRM_TEST_ACCESS_DENIED',403);
    const conversation=await read('/crm/conversations/55'),phone=conversation.data?.phone;
    if(conversation.meta?.source!=='chatwoot-conversation'||String(conversation.data?.id)!=='55'||typeof phone!=='string'||!/^\+?[1-9]\d{6,14}$/.test(phone)||phone.replace(/^\+/,'')!==CRM_ORDER_TEST.peer)throw crmOrderError('CRM_TEST_SCOPE_REQUIRED',403);
    return{...actor,read};
  }
  function nativeActor(actor,permission){
    let id;try{id=crmOrderNativeId(actor?.id);}catch{throw crmOrderError('CRM_TEST_NATIVE_PERMISSION_REQUIRED',403)}
    if(actor.active===false||!Array.isArray(actor.permissions)||!actor.permissions.includes(permission))throw crmOrderError('CRM_TEST_NATIVE_PERMISSION_REQUIRED',403);
    return crmOrderPublicId(id); // Safe legacy numbers preserve existing UUID fingerprints; larger IDs stay strings.
  }
  async function fresh(authorization,previous){const current=await crmContext(authorization);if(current.id!==previous.id||current.role!==previous.role||current.chatwootAgentId!==previous.chatwootAgentId)throw crmOrderError('CRM_TEST_ACCESS_DENIED',403);return current;}
  async function execute(procedure,bindings,beforeExecute){
    assertEnvironment();const db=await sqlDependencies(),pool=await db.getSqlPool(),sql=db.getSqlDriver();
    const identity=await pool.request().query('SELECT DB_NAME() AS databaseName;');
    if(identity.recordset?.[0]?.databaseName!==CRM_ORDER_TEST.database)throw crmOrderError('CRM_TEST_DATABASE_REQUIRED',503);
    if(beforeExecute)await beforeExecute();assertEnvironment();
    const request=pool.request();for(const[name,type,value]of bindings)request.input(name,type(sql),value);
    try{return await request.execute(procedure)}catch(error){
      const code=sqlCodes[error.number||error.originalError?.info?.number];
      throw crmOrderError(code||'CRM_TEST_ORDER_UNAVAILABLE',code==='CRM_TEST_ORDER_NOT_FOUND'?404:['CRM_TEST_REQUEST_CONFLICT','CRM_TEST_PRODUCT_MAPPING_REQUIRED','CRM_TEST_OPENING_BINDING_DRIFT','CRM_TEST_PRODUCT_QUARANTINED'].includes(code)?409:503);
    }
  }
  const actors=(native,crm)=>[['actor_id',sql=>sql.BigInt,native],['crm_actor_id',sql=>sql.NVarChar(80),crm.id]];
  function contextResult(result){
    const customers=result.recordsets?.[0],rows=result.recordsets?.[1];
    if(!Array.isArray(customers)||customers.length!==1||!Array.isArray(rows)||rows.length>50)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
    const customer=customers[0];if(crmOrderNativeId(customer.id)!=='593'||customer.code!==CRM_ORDER_TEST.customerCode||typeof customer.name!=='string'||!customer.name||!['TRY','USD','EUR'].includes(customer.currency))throw crmOrderError('CRM_TEST_SCOPE_REQUIRED',503);
    const products=rows.map(normalizeCrmOpeningProduct);
    for(const key of ['sourceId','stockCode','nativeProductId','nativePriceId'])if(new Set(products.map(row=>row[key])).size!==products.length)throw crmOrderError('CRM_TEST_PRODUCT_MAPPING_REQUIRED',409);
    return{database:CRM_ORDER_TEST.database,environment:'CANONICAL_TEST',purpose:'crm-order-draft-only',customer:{id:593,code:customer.code,name:customer.name,currency:customer.currency},products};
  }
  function document(result,requestId){
    const headers=result.recordsets?.[0],rows=result.recordsets?.[1],row=headers?.[0];
    if(!Array.isArray(headers)||headers.length!==1||!row||row.status!=='draft'||crmOrderNativeId(row.customerId)!=='593'||!Array.isArray(rows)||rows.length<1||rows.length>50||typeof row.documentNo!=='string'||!row.documentNo||row.documentNo.length>120||typeof row.customerName!=='string'||!row.customerName)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
    const items=rows.map(line=>({sourceId:line.sourceId,stockCode:line.stockCode,quantity:Number(line.quantity),unitPrice:crmOrderMoney(line.unitPrice,1000000),currency:line.currency,lineTotal:crmOrderMoney(line.lineTotal)}));
    const exchangeRate=Number(row.exchangeRate);
    try{normalizeCrmOrderRequest({requestId,conversationId:'55',customerId:593,exchangeRate,items:items.map(({lineTotal,...item})=>item)});}catch{throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503)}
    const expected=crmOrderTotals(items,exchangeRate);
    if(items.some((line,index)=>expected.lineTotals[index]!==line.lineTotal)||row.documentCurrency!==items[0].currency)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
    const grandTotal=crmOrderMoney(row.grandTotal),amountTry=crmOrderMoney(row.amountTry);
    if(expected.grandTotal!==grandTotal||expected.amountTry!==amountTry)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
    return{database:CRM_ORDER_TEST.database,requestId,id:crmOrderPublicId(row.id),documentNo:row.documentNo,status:'draft',customerId:593,customerName:row.customerName,documentCurrency:row.documentCurrency,exchangeRate,grandTotal,amountTry,items,erpPersisted:true,testOnly:true,stockEffect:false,ledgerEffect:false};
  }
  return{
    async context(actor,authorization){const native=nativeActor(actor,'sales.view'),crm=await crmContext(authorization),guard=()=>fresh(authorization,crm),result=await execute('dbo.usp_test_crm_order_context',actors(native,crm),guard);await guard();return contextResult(result);},
    async create(input,actor,authorization){
      const native=nativeActor(actor,'sales.create'),normalized=normalizeCrmOrderRequest(input),crm=await crmContext(authorization),guard=()=>fresh(authorization,crm),fingerprint=crmOrderFingerprint(normalized,native,crm.id);
      // Preserve actor-scoped UUID replay before consulting current product scope.
      try{
        const previous=await execute('dbo.usp_test_crm_order_read',[...actors(native,crm),['request_id',sql=>sql.UniqueIdentifier,normalized.requestId]],guard);
        if(previous.recordsets?.[0]?.[0]?.payloadHash!==fingerprint)throw crmOrderError('CRM_TEST_REQUEST_CONFLICT',409);
        await guard();return document(previous,normalized.requestId);
      }catch(error){if(error.code!=='CRM_TEST_ORDER_NOT_FOUND')throw error}
      const context=contextResult(await execute('dbo.usp_test_crm_order_context',actors(native,crm),guard));
      for(const line of normalized.items){
        const mapped=context.products.find(row=>row.sourceId===line.sourceId);
        if(!mapped||mapped.stockCode!==line.stockCode||mapped.unitPrice!==line.unitPrice||mapped.currency!==line.currency)throw crmOrderError('CRM_TEST_PRODUCT_MAPPING_REQUIRED',409);
        const proof=await crm.read('/crm/catalog/products/'+line.sourceId),product=proof.data;
        if(proof.meta?.source!=='melisa-existing-erp-stock-read'||proof.meta.sourceDatabaseVerified!==true||proof.meta.sourceDatabases?.products!=='VEGA2026'||proof.meta.sourceDatabases?.images!=='MELISA_ERP_V2'||product?.id!==line.sourceId||product.stockCode!==mapped.stockCode||product.salePrice!==mapped.unitPrice||product.currency!==mapped.currency||product.priceStatus!=='recorded'||product.priceBasis!=='per-item')throw crmOrderError('CRM_TEST_CATALOG_CHANGED',409);
      }
      const result=await execute('dbo.usp_test_crm_order_create',[...actors(native,crm),['request_id',sql=>sql.UniqueIdentifier,normalized.requestId],['conversation_id',sql=>sql.NVarChar(20),normalized.conversationId],['customer_id',sql=>sql.BigInt,normalized.customerId],['exchange_rate',sql=>sql.Decimal(18,8),normalized.exchangeRate],['items_json',sql=>sql.NVarChar(sql.MAX),JSON.stringify(normalized.items)],['payload_hash',sql=>sql.VarChar(64),fingerprint]],guard);
      await guard();return document(result,normalized.requestId);
    },
    async get(requestId,actor,authorization){
      if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw crmOrderError('CRM_TEST_REQUEST_ID_INVALID');
      const native=nativeActor(actor,'sales.view'),crm=await crmContext(authorization),guard=()=>fresh(authorization,crm),result=await execute('dbo.usp_test_crm_order_read',[...actors(native,crm),['request_id',sql=>sql.UniqueIdentifier,requestId]],guard);await guard();return document(result,requestId.toLowerCase());
    },
  };
}
let service;
export const testCrmOrders=()=>service||(service=createTestCrmOrderService());
