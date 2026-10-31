import {canonicalBusinessSaleReadService} from './canonicalBusinessSaleReadService.mjs';
import {canonicalBusinessPartyHistoryStore} from './canonicalBusinessPartyHistoryStore.mjs';
import {parsePartyHistoryQuery,partyHistoryResult,partyHistoryError} from './canonicalBusinessPartyHistoryModel.mjs';
export function createCanonicalBusinessPartyHistoryService({authorize=user=>canonicalBusinessSaleReadService.assertActor(user),store=canonicalBusinessPartyHistoryStore,clock=()=>new Date().toISOString()}={}){
 return {async read(query,user){
  const context=authorize(user),q=parsePartyHistoryQuery(query),required=q.kind==='customer'?['finance.view','customer.view','sales.view']:['finance.view','supplier.view','purchase.view'];
  if(!required.every(k=>user.permissions?.includes(k)))throw partyHistoryError('AUTH_PERMISSION_DENIED',403);
  const result=await store.read(q);if(authorize(user)!==context)throw partyHistoryError('BUSINESS_PARTY_HISTORY_READER_CHANGED',409);
  return partyHistoryResult(result,q,{readAt:clock()});
 }};
}
export const canonicalBusinessPartyHistoryService=createCanonicalBusinessPartyHistoryService();
