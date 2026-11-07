import {DESKTOP_GOODS_LOCAL_ORIGIN_SQL} from './desktopGoodsLocalOrigin.mjs';
const fail=()=>{throw Error('DESKTOP_FINANCE_ORIGIN_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export async function assertDesktopFinanceLocalOrigin({sql,transaction,role,partyId}={}){
 if(!sql||!transaction||!['customer','supplier'].includes(role)||!id(partyId))fail();const operation=role+'.create';const result=await new sql.Request(transaction).input('operation',sql.NVarChar(24),operation).input('entityId',sql.NVarChar(20),partyId).query(DESKTOP_GOODS_LOCAL_ORIGIN_SQL);if(!Array.isArray(result?.recordset)||result.recordset.length!==1)fail();const r=result.recordset[0];if(!uuid(r.requestId)||!id(r.actorId)||r.operation!==operation||r.entityId!==partyId||r.journalRequestId!==r.requestId||r.journalActorId!==r.actorId||r.journalOperation!==operation||!/^[a-f0-9]{64}$/.test(r.payloadHash??'')||typeof r.responseJson!=='string'||r.responseJson.length>16384)fail();let body;try{body=JSON.parse(r.responseJson);}catch{fail();}if(body?.requestId!==r.requestId||body.operation!==operation||body.entity?.id!==partyId)fail();return true;
}
