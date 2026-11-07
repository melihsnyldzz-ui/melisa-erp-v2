// Private building block for a future transaction-owned goods store. This
// module issues no session, connector, transaction or native capability.
import {desktopGoodsRequestDisposition} from './desktopGoodsReceiptPlanning.mjs';
const fail=()=>{throw Error('DESKTOP_GOODS_JOURNAL_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export const DESKTOP_GOODS_JOURNAL_LOCK_SQL=`SELECT LOWER(CONVERT(varchar(36),request_id)) requestId,CONVERT(varchar(20),actor_id) actorId,operation,LOWER(CONVERT(varchar(64),body_hash,2)) bodyHash,state,CONVERT(varchar(20),receipt_id) entityId,response_json responseJson FROM dbo.desktop_goods_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@requestId;`;
export const DESKTOP_GOODS_JOURNAL_RESERVE_SQL=`INSERT dbo.desktop_goods_requests(request_id,actor_id,operation,body_hash,state) VALUES(@requestId,@actorId,@operation,@bodyHash,'pending');`;
export const DESKTOP_GOODS_JOURNAL_FINISH_SQL=`UPDATE dbo.desktop_goods_requests SET state='committed',receipt_id=@receiptId,response_json=@responseJson WHERE request_id=@requestId AND actor_id=@actorId AND operation=@operation AND body_hash=@bodyHash AND state='pending' AND receipt_id IS NULL AND response_json IS NULL;SELECT @@ROWCOUNT changed;`;
function request(sql,transaction,binding){if(!transaction||!sql||!binding||!/^[a-f0-9]{64}$/.test(binding.bodyHash??''))fail();return new sql.Request(transaction).input('requestId',sql.UniqueIdentifier,binding.requestId).input('actorId',sql.BigInt,binding.actorId).input('operation',sql.VarChar(24),binding.operation).input('bodyHash',sql.Binary(32),Buffer.from(binding.bodyHash,'hex'));}
// Caller must verify identity, permission, schema guard and physical
// transaction before use, and hold this transaction until commit/rollback.
export async function lockDesktopGoodsJournal({sql,transaction,binding}={}){
 const result=await request(sql,transaction,binding).query(DESKTOP_GOODS_JOURNAL_LOCK_SQL);if(!Array.isArray(result?.recordset)||result.recordset.length>1)fail();const row=result.recordset[0]??null;const disposition=desktopGoodsRequestDisposition(binding,row);
 if(disposition.kind==='new'){await request(sql,transaction,binding).query(DESKTOP_GOODS_JOURNAL_RESERVE_SQL);return Object.freeze({kind:'new'});}
 if(disposition.kind==='unknown_same_request_only')return Object.freeze({kind:'unknown_same_request_only'});
 if(typeof row.responseJson!=='string'||row.responseJson.length>65536)fail();let response;try{response=JSON.parse(row.responseJson);}catch{fail();}if(!response||typeof response!=='object'||Array.isArray(response)||response.requestId!==binding.requestId||response.state!=='COMMITTED'||response.receipt?.id!==row.entityId)fail();return Object.freeze({kind:'replay',response});
}
export async function finishDesktopGoodsJournal({sql,transaction,binding,receiptId,response}={}){
 if(!id(receiptId)||!response||response.requestId!==binding?.requestId||response.state!=='COMMITTED'||response.receipt?.id!==receiptId)fail();let encoded;try{encoded=JSON.stringify(response);}catch{fail();}if(typeof encoded!=='string'||encoded.length>65536)fail();const r=await request(sql,transaction,binding).input('receiptId',sql.BigInt,receiptId).input('responseJson',sql.NVarChar(sql.MAX),encoded).query(DESKTOP_GOODS_JOURNAL_FINISH_SQL);if(!Array.isArray(r?.recordset)||r.recordset.length!==1||r.recordset[0].changed!==1)fail();return true;
}
