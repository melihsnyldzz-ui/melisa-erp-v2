import {CRM_ORDER_TEST,crmOrderError,normalizeCrmOrderRequest,crmOrderGatewayOrigin,crmOrderFingerprint} from './testCrmOrderContract.mjs';

const sqlCodes={51090:'CRM_TEST_DATABASE_REQUIRED',51091:'CRM_TEST_LINES_INVALID',51092:'CRM_TEST_PRODUCT_MAPPING_REQUIRED',51093:'CRM_TEST_REQUEST_CONFLICT',51094:'CRM_TEST_SCOPE_REQUIRED',51095:'CRM_TEST_LOCK_TIMEOUT',51096:'CRM_TEST_ORDER_NOT_FOUND'};
export function createTestCrmOrderService({environment=process.env,transport=globalThis.fetch,sqlDependencies=()=>import('../config/database.js')}={}){
  const origin=crmOrderGatewayOrigin(environment.CRM_TEST_GATEWAY_ORIGIN);
  function assertEnvironment(){if(environment.MELISA_CANONICAL_TEST!=='true'||environment.MELISA_TEST_SCOPED_SALES!=='true'||environment.SQL_DATABASE!==CRM_ORDER_TEST.database||environment.SQL_READ_ONLY!=='false')throw crmOrderError('CRM_TEST_DATABASE_REQUIRED',503)}
  async function crmContext(authorization){
    assertEnvironment();
    if(typeof authorization!=='string'||!/^Bearer [^\s]+$/.test(authorization))throw crmOrderError('CRM_TEST_SESSION_REQUIRED',401);
    async function read(route){
      let response;try{response=await transport(new URL(route,origin),{headers:{authorization,accept:'application/json'},redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)})}catch{throw crmOrderError('CRM_TEST_VERIFICATION_UNAVAILABLE',503)}
      if(!response.ok)throw crmOrderError('CRM_TEST_ACCESS_DENIED',response.status===401?401:403);
      let body;try{const raw=await response.text();if(Buffer.byteLength(raw)>2*1024*1024)throw Error();body=JSON.parse(raw)}catch{throw crmOrderError('CRM_TEST_VERIFICATION_UNAVAILABLE',503)}
      if(body.success!==true)throw crmOrderError('CRM_TEST_ACCESS_DENIED',403);return body;
    }
    const identity=await read('/auth/me'),actor=identity.data;
    if(identity.meta?.source!=='crm-auth'||!actor||typeof actor.id!=='string'||!actor.id||actor.id.length>80||actor.active===false||!['patron','mudur','personel'].includes(actor.role)||!actor.permissions?.includes('crm.view')||!actor.permissions?.includes('crm.send'))throw crmOrderError('CRM_TEST_ACCESS_DENIED',403);
    const conversation=await read('/crm/conversations/55');
    if(conversation.meta?.source!=='chatwoot-conversation'||String(conversation.data?.id)!=='55'||String(conversation.data?.phone||'').replace(/\D/g,'')!==CRM_ORDER_TEST.peer)throw crmOrderError('CRM_TEST_SCOPE_REQUIRED',403);
    return{...actor,read};
  }
  function nativeActor(actor,permission){if(!Number.isSafeInteger(Number(actor?.id))||Number(actor.id)<1||!actor.permissions?.includes(permission))throw crmOrderError('CRM_TEST_NATIVE_PERMISSION_REQUIRED',403);return Number(actor.id)}
  async function execute(procedure,bindings){
    const db=await sqlDependencies(),pool=await db.getSqlPool(),sql=db.getSqlDriver();
    const identity=await pool.request().query('SELECT DB_NAME() AS databaseName;');
    if(identity.recordset?.[0]?.databaseName!==CRM_ORDER_TEST.database)throw crmOrderError('CRM_TEST_DATABASE_REQUIRED',503);
    const request=pool.request();for(const[name,type,value]of bindings)request.input(name,type(sql),value);
    try{return await request.execute(procedure)}catch(error){const code=sqlCodes[error.number||error.originalError?.info?.number];throw crmOrderError(code||'CRM_TEST_ORDER_UNAVAILABLE',code==='CRM_TEST_REQUEST_CONFLICT'?409:code==='CRM_TEST_ORDER_NOT_FOUND'?404:code==='CRM_TEST_PRODUCT_MAPPING_REQUIRED'?409:503)}
  }
  const actors=(native,crm)=>[['actor_id',sql=>sql.BigInt,native],['crm_actor_id',sql=>sql.NVarChar(80),crm.id]];
  function document(result,requestId){
    const row=result.recordsets?.[0]?.[0];if(!row||row.status!=='draft'||Number(row.customerId)!==593)throw crmOrderError('CRM_TEST_ORDER_CONTRACT_INVALID',503);
    return{database:CRM_ORDER_TEST.database,requestId,id:Number(row.id),documentNo:row.documentNo,status:'draft',customerId:593,customerName:row.customerName,documentCurrency:row.documentCurrency,exchangeRate:Number(row.exchangeRate),grandTotal:Number(row.grandTotal),amountTry:Number(row.amountTry),items:(result.recordsets[1]||[]).map(line=>({sourceId:line.sourceId,stockCode:line.stockCode,quantity:Number(line.quantity),unitPrice:Number(line.unitPrice),currency:line.currency,lineTotal:Number(line.lineTotal)})),erpPersisted:true,testOnly:true,stockEffect:false,ledgerEffect:false};
  }
  return{
    async context(actor,authorization){const native=nativeActor(actor,'sales.view'),crm=await crmContext(authorization),result=await execute('dbo.usp_test_crm_order_context',actors(native,crm)),customer=result.recordsets?.[0]?.[0];if(!customer||Number(customer.id)!==593||customer.code!==CRM_ORDER_TEST.customerCode)throw crmOrderError('CRM_TEST_SCOPE_REQUIRED',503);return{database:CRM_ORDER_TEST.database,environment:'CANONICAL_TEST',purpose:'crm-order-draft-only',customer:{...customer,id:593},products:(result.recordsets[1]||[]).map(row=>({...row,erpProductId:Number(row.erpProductId),unitPrice:Number(row.unitPrice)}))};},
    async create(input,actor,authorization){const native=nativeActor(actor,'sales.create'),normalized=normalizeCrmOrderRequest(input),crm=await crmContext(authorization);
      const fingerprint=crmOrderFingerprint(normalized,native,crm.id);
      try{
        const previous=await execute('dbo.usp_test_crm_order_read',[...actors(native,crm),['request_id',sql=>sql.UniqueIdentifier,normalized.requestId]]);
        if(previous.recordsets?.[0]?.[0]?.payloadHash!==fingerprint)throw crmOrderError('CRM_TEST_REQUEST_CONFLICT',409);
        return document(previous,normalized.requestId);
      }catch(error){if(error.code!=='CRM_TEST_ORDER_NOT_FOUND')throw error}
      for(const line of normalized.items){const proof=await crm.read('/crm/catalog/products/'+line.sourceId),product=proof.data;if(proof.meta?.source!=='melisa-existing-erp-stock-read'||proof.meta.sourceDatabaseVerified!==true||proof.meta.sourceDatabases?.products!=='VEGA2026'||proof.meta.sourceDatabases?.images!=='MELISA_ERP_V2'||product?.id!==line.sourceId||product.stockCode!==line.stockCode||product.salePrice!==line.unitPrice||product.currency!==line.currency||product.priceStatus!=='recorded'||product.priceBasis!=='per-item')throw crmOrderError('CRM_TEST_CATALOG_CHANGED',409)}
      const result=await execute('dbo.usp_test_crm_order_create',[...actors(native,crm),['request_id',sql=>sql.UniqueIdentifier,normalized.requestId],['conversation_id',sql=>sql.NVarChar(20),normalized.conversationId],['customer_id',sql=>sql.BigInt,normalized.customerId],['exchange_rate',sql=>sql.Decimal(18,8),normalized.exchangeRate],['items_json',sql=>sql.NVarChar(sql.MAX),JSON.stringify(normalized.items)],['payload_hash',sql=>sql.VarChar(64),fingerprint]]);return document(result,normalized.requestId);},
    async get(requestId,actor,authorization){if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw crmOrderError('CRM_TEST_REQUEST_ID_INVALID');const native=nativeActor(actor,'sales.view'),crm=await crmContext(authorization),result=await execute('dbo.usp_test_crm_order_read',[...actors(native,crm),['request_id',sql=>sql.UniqueIdentifier,requestId]]);return document(result,requestId.toLowerCase());},
  };
}
let service;
export const testCrmOrders=()=>service||(service=createTestCrmOrderService());
