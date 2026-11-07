import sql from 'mssql';
import {getDesktopWritePool} from '../config/desktopWriteTlsConnector.mjs';
import {getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
import {desktopWorkflowRequestIdentity,lockDesktopResolution} from './desktopWorkflowRequestResolution.mjs';
import {createDesktopFinalCancellationExportFence} from './desktopFinalCancellationExportFence.mjs';
const fail=()=>{throw Error('DESKTOP_RESOLUTION_UNAVAILABLE');};
export function createDesktopWorkflowResolutionService({connector,auth}={}){
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool);
 const fence=createDesktopFinalCancellationExportFence();
 return auth.bindResolutionService({async resolve(actorId,input){
  if(!input||Object.keys(input).sort().join(',')!=='body,kind')fail();const {kind}=input,{body,hash,requestId,operation}=desktopWorkflowRequestIdentity(actorId,kind,input.body);
  const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;if(await verifySession({transaction:tx,actorId,permission:'sales.view'})!==true)fail();
   const query=(text,params={})=>{const r=new sql.Request(tx);for(const [k,v] of Object.entries(params))r.input(k,sql.NVarChar(4000),v);return r.query(text);};
   const tombstone=await lockDesktopResolution({sql,transaction:tx,requestId});
   if(tombstone&&(tombstone.actorId!==actorId||tombstone.kind!==kind||tombstone.hash!==hash))fail();
   const record=await query(`SELECT CONVERT(varchar(20),actor_id) actorId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`,{request:requestId});
   if(!Array.isArray(record?.recordset)||record.recordset.length>1||tombstone&&record.recordset.length)fail();
   if(record.recordset.length){const row=record.recordset[0];if(row.actorId!==actorId||row.operation!==operation||row.hash!==hash)fail();const result=JSON.parse(row.resultJson);if(result?.state!=='COMMITTED'||result.requestId!==requestId||typeof result.invoiceId!=='string'||kind!=='draft'&&result.invoiceId!==body.invoiceId)fail();if(kind==='cancel'&&(Object.keys(result).sort().join(',')!=='invoiceId,replayed,requestId,state,version,workflowState'||result.workflowState!=='CANCELLED'||result.replayed!==false||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version)||await fence.verify({invoiceId:body.invoiceId,actorId,requestId,payloadHash:hash})!==true))fail();if(kind==='draft'){const priced=Object.hasOwn(body,'pricing');if(Object.keys(result).sort().join(',')!==['state','requestId','invoiceId','workflowState','version','replayed',...(priced?['pricingProofRequired']:[])].sort().join(',')||priced&&result.pricingProofRequired!==true||result.workflowState!=='DRAFT'||result.replayed!==false||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version))fail();const {pricingProofRequired:_privateMarker,...visible}=result;await tx.commit();begun=false;return {...visible,replayed:true};}await tx.commit();begun=false;return {...result,replayed:true};}
   if(kind==='cancel'){
    const status=await fence.resolution({invoiceId:body.invoiceId,actorId,requestId,payloadHash:hash});
    if(status==='CANCELLATION_FENCED'){if(tombstone)fail();await tx.commit();begun=false;return {state:'REVIEW_REQUIRED',requestId,actorId,kind,resolution:'CANCELLATION_FENCE_REVIEW'};}
    if(status!=='NO_FENCE')fail();
   }
   if(!tombstone){await query(`INSERT dbo.desktop_sale_request_resolutions(request_id,actor_id,kind,payload_hash) VALUES(TRY_CONVERT(uniqueidentifier,@request),TRY_CONVERT(bigint,@actor),@kind,CONVERT(binary(32),@hash,2));`,{request:requestId,actor:actorId,kind,hash});const saved=await lockDesktopResolution({sql,transaction:tx,requestId});if(!saved||saved.actorId!==actorId||saved.kind!==kind||saved.hash!==hash)fail();}
   await tx.commit();begun=false;return {state:'NOT_COMMITTED',requestId,actorId,kind,resolution:'DURABLE_NO_COMMIT'};
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 }});
}
