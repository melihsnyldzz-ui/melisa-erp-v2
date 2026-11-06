// Durable rejection is serialized BEFORE the normal request journal. All
// lifecycle writers must take this same lock before they can mutate a sale.
import {createHash} from 'node:crypto';
import {normalizeDesktopWorkflowTransition} from './desktopSaleWorkflowTransactions.mjs';
const fail=()=>{throw Error('DESKTOP_REQUEST_RESOLUTION_REJECTED');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export function desktopWorkflowRequestIdentity(actorId,kind,raw){
 if(!id(actorId)||!raw||typeof raw!=='object'||Array.isArray(raw)||!['draft','transition','dispatch'].includes(kind))fail();
 const body=kind==='transition'?normalizeDesktopWorkflowTransition(raw):JSON.parse(JSON.stringify(raw));
 if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.requestId))fail();
 if(kind==='draft'&&Object.keys(body).sort().join(',')!=='customerId,documentDate,expectedRevision,items,requestId')fail();
 if(kind==='dispatch'&&Object.keys(body).sort().join(',')!=='customerId,expectedVersion,invoiceId,productIds,requestId')fail();
 const value=kind==='draft'?{actorId,request:body}:kind==='dispatch'?{actorId,c:body}:{actorId,...body};
 return {body,hash:createHash('sha256').update(JSON.stringify(value)).digest('hex'),requestId:body.requestId,operation:kind==='draft'?'CREATE_DRAFT':kind==='dispatch'?'DISPATCH':body.operation};
}
export async function lockDesktopResolution({sql,transaction,requestId}={}){
 const result=await new sql.Request(transaction).input('request',sql.NVarChar(36),requestId).query(`SELECT CONVERT(varchar(20),actor_id) actorId,kind,LOWER(CONVERT(varchar(64),payload_hash,2)) hash FROM dbo.desktop_sale_request_resolutions WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`);
 if(!Array.isArray(result?.recordset)||result.recordset.length>1)fail();return result.recordset[0]??null;
}
