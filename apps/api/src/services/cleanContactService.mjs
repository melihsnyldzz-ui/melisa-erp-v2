import {assertRegisteredCleanContext,assertCleanIdentity,CLEAN_IDENTITY_SQL,isCleanAdministrator} from './cleanSyntheticContext.mjs';
import {parseCustomerContact,parseCustomerContactId,parseCustomerContactRequestId} from './customerContactModel.mjs';
const fail=(code='CLEAN_CONTACT_UNAVAILABLE',statusCode=503)=>{throw Object.assign(Error('İletişim bilgileri veya düzenleme yetkisi doğrulanamadı.'),{code,statusCode});};
export function cleanContactInput(kind,id,body){
 if(!['customer','supplier'].includes(kind)||!['1','2','3','4'].includes(parseCustomerContactId(id)))fail('CLEAN_CONTACT_FORBIDDEN',403);
 const parsed=parseCustomerContact(id,body);
 return {kind,entityId:id,requestId:parsed.requestId,expectedRevision:parsed.expectedRevision,phone:parsed.phone,city:parsed.city,country:parsed.country};
}
export function cleanContactContext(raw,kind,id){
 if(!raw||raw.schemaVersion!==`melisa-${kind}-contact-context.v1`||raw.entityId!==id||typeof raw.code!=='string'||!raw.code||typeof raw.name!=='string'||!raw.name||typeof raw.revision!=='string'||! /^[A-F0-9]{64}$/.test(raw.revision)||raw.copyId?.toLowerCase()!=='e662fd94-d797-4b3b-938a-d143ad758b67'||! /^[A-F0-9]{64}$/.test(raw.sealHash??'')||!raw.contact||Object.keys(raw.contact).sort().join()!=='city,country,phone')fail();
 parseCustomerContact(id,{requestId:'00000000-0000-4000-8000-000000000001',expectedRevision:raw.revision,...raw.contact});
 return {schemaVersion:raw.schemaVersion,copyId:raw.copyId,sealHash:raw.sealHash,[kind+'Id']:id,[kind+'Code']:raw.code,[kind+'Name']:raw.name,revision:raw.revision,contact:{...raw.contact}};
}
export function createCleanContactService({dependencies=()=>import('../config/database.js')}={}){
 async function run(kind,id,actor,body,requestId){
  if(!['customer','supplier'].includes(kind)||!['1','2','3','4'].includes(parseCustomerContactId(id))||!isCleanAdministrator(actor)||![kind+'.view',kind+'.edit'].every(p=>actor.permissions.includes(p)))fail('CLEAN_CONTACT_FORBIDDEN',403);
  assertRegisteredCleanContext();if(process.env.API_PORT!=='4194')fail();
  const input=body===undefined?null:cleanContactInput(kind,id,body);if(requestId!==undefined)parseCustomerContactRequestId(requestId);
  let tx;
  try{
   const db=await dependencies(),pool=await db.getSqlPool(),q=db.getSqlDriver();assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);
   tx=new q.Transaction(pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx,{requestTimeout:30000});
   await req().input('mode',q.NVarChar(16),input?'Exclusive':'Shared').query("DECLARE @n int;EXEC @n=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=@mode,@LockOwner=N'Transaction',@LockTimeout=5000;IF @n<0 THROW 51967,'CLEAN_CONTACT_BUSY',1;");
   const r=req().input('kind',q.NVarChar(8),kind).input('entity_id',q.BigInt,id).input('actor_id',q.BigInt,actor.id);if(input)r.input('payload_json',q.NVarChar(q.MAX),JSON.stringify(input));
   const result=await r.execute(input?'dbo.usp_clean_contact_update':'dbo.usp_clean_contact_context');const contexts=result.recordsets.flat().filter(row=>Object.hasOwn(row,'context_json'));if(contexts.length!==1)fail();
   const context=cleanContactContext(JSON.parse(contexts[0].context_json),kind,id);let value=context;
   if(input){const rows=result.recordsets.flat().filter(row=>Object.hasOwn(row,'replayed'));if(rows.length!==1||typeof rows[0].replayed!=='boolean')fail();value={context,replayed:rows[0].replayed};}
   else if(requestId!==undefined){const rows=(await req().input('request',q.UniqueIdentifier,requestId).input('kind',q.NVarChar(8),kind).input('entity',q.BigInt,id).input('actor',q.BigInt,actor.id).query('SELECT request_id FROM dbo.clean_contact_requests WHERE request_id=@request AND kind=@kind AND entity_id=@entity AND actor_id=@actor')).recordset;value={context,committed:rows.length===1};}
   await tx.commit();return value;
  }catch(e){if(tx)try{await tx.rollback();}catch{}if(e.statusCode)throw e;const numbers=[e.number,e.originalError?.info?.number,...(e.precedingErrors??[]).map(x=>x.number)];if(numbers.includes(51968))fail('CLEAN_CONTACT_STALE',409);if(numbers.includes(51969))fail('CLEAN_CONTACT_REQUEST_CONFLICT',409);if(numbers.includes(51970))fail('CLEAN_CONTACT_FORBIDDEN',403);fail();}
 }
 return {context:(kind,id,actor)=>run(kind,id,actor),update:(kind,id,body,actor)=>run(kind,id,actor,body),recover:(kind,id,requestId,actor)=>run(kind,id,actor,undefined,requestId)};
}
