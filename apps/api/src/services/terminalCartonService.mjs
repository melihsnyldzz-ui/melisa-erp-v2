import {terminalCartonSource} from './terminalCartonSource.mjs';
import {cartonId} from '../../../sites-workflow/src/workflow/cartonModel.mjs';
import {getCleanContext} from './cleanSyntheticContext.mjs';
import {isCleanPersonalWorkCandidate} from './cleanPersonnelManagement.mjs';
export function createTerminalCartonService({readSource,store,assertContext}={}){
 if(typeof readSource!=='function'||typeof assertContext!=='function'||!store)throw Error('CARTON_DEPENDENCIES_REQUIRED');
 async function source(id,actor){
  const forbidden=()=>Object.assign(new Error('Toplama göreviniz doğrulanamadı.'),{statusCode:403,code:'CARTON_FORBIDDEN'});
  if(!cartonId(String(actor?.id))||!actor.permissions?.includes('sales.view'))throw forbidden();
  if(!cartonId(id))throw Object.assign(new Error('Fiş kimliği geçersiz.'),{statusCode:400,code:'CARTON_ID'});
  const clean=!!getCleanContext();if(clean&&!isCleanPersonalWorkCandidate(actor,'packing'))throw forbidden();
  const proof=await assertContext(actor,...(clean?['packing']:[]));
  if(clean&&(proof?.canTerminalPacking!==true||String(proof.actorId)!==String(actor.id)||Number(proof.roleId)!==Number(actor.role.id)||!cartonId(String(proof.employeeId))))throw forbidden();
  return terminalCartonSource(await readSource(id,actor));
 }
 return {async context(id,actor){return source(id,actor);},async load(id,actor){const s=await source(id,actor);return {source:s,state:await store.load(String(actor.id),s)};},async save(id,input,actor){const s=await source(id,actor);return {source:s,state:await store.save(String(actor.id),s,input)};}};
}
