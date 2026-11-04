import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sql from 'mssql';
import {normalizeCrmV2Request,crmV2Fingerprint,validateCrmV2Document} from './services/crmOrderV2Contract.mjs';
import {CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_IDENTITY_SQL,assertCleanIdentity} from './services/cleanSyntheticContext.mjs';
let raw='';for await(const chunk of process.stdin)raw+=chunk;const credential=JSON.parse(raw);raw='';
const pool=await new sql.ConnectionPool({server:'127.0.0.1',port:1433,database:CLEAN_DATABASE,user:CLEAN_LOGIN,password:credential.password,options:{encrypt:false,trustServerCertificate:true}}).connect();credential.password='';
try{
 assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);
 const actor=15,crmActor='clean-staff-20261022';
 const customers=JSON.parse((await pool.request().input('actor_id',sql.BigInt,actor).input('crm_actor_id',sql.NVarChar(80),crmActor).input('phone',sql.NVarChar(15),'905550000001').input('search',sql.NVarChar(120),'').execute('dbo.usp_test_crm_order_v2_customers')).recordset[0].resultJson);
 assert.equal(customers.status,'matched');assert.equal(customers.entries.length,1);
 const request=normalizeCrmV2Request({requestId:'89a4d734-0f03-49c9-a9bd-b5a790521021',conversationId:'55',peer:'905550000001',customerId:customers.entries[0].id,customerMatch:{basis:'exact-phone',phone:'905550000001',revision:customers.entries[0].revision,reason:null},documentCurrency:'TRY',exchangeRateExact8:'1.00000000',items:[{productId:1,stockCode:'0007 MELISA',quantity:2,priceId:1,unitSourceId:1,tier:1,currency:'TRY',priceExact8:'125.50000000',priceSourceKey:'SYNTHETIC/20261022/products/1/PRICE/sale/1/1/TRY'}]});
 const create=async(body,actorId=actor)=>JSON.parse((await pool.request().input('actor_id',sql.BigInt,actorId).input('crm_actor_id',sql.NVarChar(80),crmActor).input('request_id',sql.UniqueIdentifier,body.requestId).input('body_json',sql.NVarChar(sql.MAX),JSON.stringify(body)).input('payload_hash',sql.VarChar(64),crmV2Fingerprint(body,actorId,crmActor)).execute('dbo.usp_test_crm_order_v2_create')).recordset[0].resultJson);
 const first=validateCrmV2Document(await create(request),request.requestId),replay=validateCrmV2Document(await create(request),request.requestId);assert.equal(first.id,replay.id);assert.equal(first.grandTotalExact4,'251.0000');
 const conflict={...request,items:request.items.map(i=>({...i,quantity:3}))};await assert.rejects(create(conflict),e=>e.number===51205);
 await assert.rejects(create({...request,requestId:'0ab207eb-ebca-4ee5-afb2-fb4d7373c201',items:request.items.map(i=>({...i,priceExact8:'126.00000000'}))}),e=>e.number===51204);
 await assert.rejects(create({...request,requestId:'a935c2d9-dd95-4ed6-9155-c235ba0818ff'},16),e=>e.number===51201);
 const read=JSON.parse((await pool.request().input('actor_id',sql.BigInt,actor).input('crm_actor_id',sql.NVarChar(80),crmActor).input('request_id',sql.UniqueIdentifier,request.requestId).execute('dbo.usp_test_crm_order_v2_read')).recordset[0].resultJson);assert.equal(validateCrmV2Document(read,request.requestId).id,first.id);
 await fs.writeFile('C:/Sirket/ERP/clean/20261022/runtime/native-order-request.json',JSON.stringify(request,null,2));
 const proof={kind:'actual-native-sql',environment:'CLEAN_SYNTHETIC_TEST',requestId:request.requestId,orderId:first.id,documentNo:first.documentNo,total:first.grandTotalExact4,currency:'TRY',replaySameId:replay.id===first.id,conflictRejected:true,wrongPriceRejected:true,readerCreateDenied:true,stockEffect:false,ledgerEffect:false};
 await fs.writeFile('C:/Sirket/ERP/clean/20261022/runtime/native-order-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await pool.close();}
