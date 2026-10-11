import {homeActorId,homeDate,homeError,homeSummaryDto} from './homeSummaryModel.mjs';
export function createHomeSummaryService({store,clock=()=>new Date()}={}){if(typeof store?.read!=='function')throw homeError();return {async summary(actor){
 if(!Array.isArray(actor?.permissions))throw homeError(403);const actorId=homeActorId(actor.id),now=clock(),date=homeDate(now);
 const raw=await store.read({actorId,sessionPermissions:actor.permissions,date}),dto=homeSummaryDto(raw,{date:raw.copyMeta?.date??date,readAt:now.toISOString()});
 if(raw.copyMeta)Object.assign(dto.meta,raw.copyMeta);
 return dto;
}};}
