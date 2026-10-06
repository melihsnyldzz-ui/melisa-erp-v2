import {catalogClassificationStore} from './catalogClassificationStore.mjs';
import {workReportsReadStore} from './workReportsReadStore.mjs';
import {REPORT_SCOPE,reportFilters,reportCapabilities,reportError,reportCsv} from './workReportsModel.mjs';
export function createWorkReportsService({store=workReportsReadStore,classification=catalogClassificationStore,clock=()=>new Date(),freshActor=async id=>(await import('./authService.js')).getUserById(id)}={}){
 const actorNow=async actor=>{const current=await freshActor(actor?.id);if(!current||String(current.id)!==String(actor.id))throw reportError(403);return {...current,permissions:current.permissions.filter(p=>actor.permissions?.includes(p))};};
 return {async context(actor){const cap=reportCapabilities(await actorNow(actor));const {filters}=classification.selection({options:{}});return {sourceScope:REPORT_SCOPE,capabilities:cap,kinds:cap.kinds,currencies:['TRY','USD','EUR'],brands:filters.brands,types:filters.productTypes};},
 async report(query,actor,{exporting=false}={}){const f=reportFilters(query,clock()),cap=reportCapabilities(await actorNow(actor));if(!cap.kinds.includes(f.kind))throw reportError(403);const result=await store.read(f,{exporting});
 const {scope,...filters}=f;const data={filters,scope,rows:result.rows,pagination:{offset:exporting?0:f.offset,limit:exporting?result.total:f.limit,total:result.total,hasMore:!exporting&&f.offset+result.rows.length<result.total},currencyTotals:result.currencyTotals};
 if(cap.canViewCost&&f.kind==='sales')data.costCoverage={knownLineCount:Number(result.costCoverage?.knownLineCount||0),unknownLineCount:Number(result.costCoverage?.unknownLineCount||0),profitAvailable:false,reason:'İşlem maliyeti kaydı olan ve olmayan satırlar ayrıdır. Doğrulanmamış maliyetten kâr hesaplanmaz.'};
 if(!exporting)return data;return {fileName:`melisa-${f.kind}-${f.from}-${f.to}.csv`,content:reportCsv(data),rowCount:result.total,scope,filters,currencyTotals:data.currencyTotals};}
 };}
export const workReportsService=createWorkReportsService();
