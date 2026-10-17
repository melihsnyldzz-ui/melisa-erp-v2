import {terminalCartonSource} from './terminalCartonSource.mjs';
import {cartonId} from '../../../sites-workflow/src/workflow/cartonModel.mjs';
export function createTerminalCartonService({readSource,store,assertContext}={}){
 if(typeof readSource!=='function'||typeof assertContext!=='function'||!store)throw Error('CARTON_DEPENDENCIES_REQUIRED');
 async function source(id,actor){if(!cartonId(String(actor?.id))||!actor.permissions?.includes('sales.view'))throw Object.assign(new Error('Satış fişini inceleme yetkisi gerekli.'),{statusCode:403,code:'CARTON_FORBIDDEN'});if(!cartonId(id))throw Object.assign(new Error('Fiş kimliği geçersiz.'),{statusCode:400,code:'CARTON_ID'});await assertContext(actor);return terminalCartonSource(await readSource(id,actor));}
 return {async context(id,actor){return source(id,actor);},async load(id,actor){const s=await source(id,actor);return {source:s,state:await store.load(String(actor.id),s)};},async save(id,input,actor){const s=await source(id,actor);return {source:s,state:await store.save(String(actor.id),s,input)};}};
}
