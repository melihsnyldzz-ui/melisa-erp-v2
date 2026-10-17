import {getCrmOrderCurrentContext} from '../services/crmOrderCurrentContext.mjs';
// Only an already registered CRM context selects this boundary. Environment
// flags and unverified context JSON cannot suppress ERP validation/imports.
const copyModule=getCrmOrderCurrentContext()?null:await import('../services/isolatedOperationCopyContext.mjs');
const requireCopyModule=code=>{if(!copyModule)throw Object.assign(new Error('Ayrılmış deneme işleminin kapsamı doğrulanamadı.'),{code,statusCode:503});return copyModule;};

let registered;
let readonlyRegistered;
// Bootstrap-owned configuration; environment variables or request JSON cannot
// create a copy grant. Native engines additionally require a same-TX scope.
export function registerIsolatedOperationCopyRuntime(context, runtime) {
  const {assertIsolatedCopyContext,copyAssert,isolatedCopyTopology,ISOLATED_COPY_SERVER}=requireCopyModule('ISOLATED_COPY_RUNTIME_REJECTED');
  assertIsolatedCopyContext(context);
  const topology=isolatedCopyTopology(context);
  copyAssert(!registered && runtime?.database === context.target.database
    && runtime.server === ISOLATED_COPY_SERVER && runtime.user === context.target.login
    && runtime.readOnly === false && runtime.trustedConnection === false
    && runtime.port === topology.apiPort && runtime.externalProvidersDisabled === true,
  'ISOLATED_COPY_RUNTIME_REJECTED');
  registered = Object.freeze({context, runtime: Object.freeze({...runtime})});
  return context;
}
export function isIsolatedOperationCopyRuntime() {return !!registered;}
export function getIsolatedOperationCopyConfig() {
  const {copyAssert}=requireCopyModule('ISOLATED_COPY_RUNTIME_REQUIRED');
  copyAssert(registered, 'ISOLATED_COPY_RUNTIME_REQUIRED');
  return registered.context;
}
export function registerIsolatedCopyReadonlyRuntime(context, runtime) {
  const {assertIsolatedCopyContext,copyAssert,isolatedCopyTopology,ISOLATED_COPY_SERVER}=requireCopyModule('ISOLATED_COPY_READER_REJECTED');
  assertIsolatedCopyContext(context);
  const topology=isolatedCopyTopology(context);
  copyAssert(!registered&&!readonlyRegistered&&runtime?.database===context.target.database
    &&runtime.server===ISOLATED_COPY_SERVER&&runtime.user===topology.reader
    &&runtime.port===topology.nativePort&&runtime.readOnly===true&&runtime.trustedConnection===false
    &&runtime.externalProvidersDisabled===true,'ISOLATED_COPY_READER_REJECTED');
  readonlyRegistered=Object.freeze({context,runtime:Object.freeze({...runtime})});
}
export const isIsolatedCopyReadonlyRuntime=()=>!!readonlyRegistered;
export function getIsolatedCopyReadonlyRuntime(){const {copyAssert}=requireCopyModule('ISOLATED_COPY_READER_REQUIRED');copyAssert(readonlyRegistered,'ISOLATED_COPY_READER_REQUIRED');return readonlyRegistered;}
