import {homeSummaryReadStore} from './homeSummaryReadStore.mjs';
import {createHomeSummaryService as createFactory} from './createHomeSummaryServiceFactory.mjs';
export function createHomeSummaryService({store=homeSummaryReadStore,clock=()=>new Date()}={}){return createFactory({store,clock});}
export const homeSummaryService=createHomeSummaryService();
