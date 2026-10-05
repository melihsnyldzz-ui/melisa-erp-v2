import {homeActorId,homeDate,homeError,homeSummaryDto} from './homeSummaryModel.mjs';
import {homeSummaryReadStore} from './homeSummaryReadStore.mjs';
export function createHomeSummaryService({store=homeSummaryReadStore,clock=()=>new Date()}={}){return {async summary(actor){
 if(!Array.isArray(actor?.permissions))throw homeError(403);const actorId=homeActorId(actor.id),now=clock(),date=homeDate(now);
 return homeSummaryDto(await store.read({actorId,sessionPermissions:actor.permissions,date}),{date,readAt:now.toISOString()});
}};}
export const homeSummaryService=createHomeSummaryService();
