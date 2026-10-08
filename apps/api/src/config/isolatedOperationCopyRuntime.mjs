import {assertIsolatedCopyContext,copyAssert,ISOLATED_COPY_DATABASE,ISOLATED_COPY_SERVER} from '../services/isolatedOperationCopyContext.mjs';

let registered;
let readonlyRegistered;
// Bootstrap-owned configuration; environment variables or request JSON cannot
// create a copy grant. Native engines additionally require a same-TX scope.
export function registerIsolatedOperationCopyRuntime(context, runtime) {
  assertIsolatedCopyContext(context);
  copyAssert(!registered && runtime?.database === ISOLATED_COPY_DATABASE
    && runtime.server === ISOLATED_COPY_SERVER && runtime.user === context.target.login
    && runtime.readOnly === false && runtime.trustedConnection === false
    && runtime.port === 4154 && runtime.externalProvidersDisabled === true,
  'ISOLATED_COPY_RUNTIME_REJECTED');
  registered = Object.freeze({context, runtime: Object.freeze({...runtime})});
  return context;
}
export function isIsolatedOperationCopyRuntime() {return !!registered;}
export function getIsolatedOperationCopyConfig() {
  copyAssert(registered, 'ISOLATED_COPY_RUNTIME_REQUIRED');
  return registered.context;
}
export function registerIsolatedCopyReadonlyRuntime(context, runtime) {
  assertIsolatedCopyContext(context);
  copyAssert(!registered&&!readonlyRegistered&&runtime?.database===ISOLATED_COPY_DATABASE
    &&runtime.server===ISOLATED_COPY_SERVER&&runtime.user==='melisa_stage4_copy_ro_20261008_01'
    &&runtime.port===4156&&runtime.readOnly===true&&runtime.trustedConnection===false
    &&runtime.externalProvidersDisabled===true,'ISOLATED_COPY_READER_REJECTED');
  readonlyRegistered=Object.freeze({context,runtime:Object.freeze({...runtime})});
}
export const isIsolatedCopyReadonlyRuntime=()=>!!readonlyRegistered;
export function getIsolatedCopyReadonlyRuntime(){copyAssert(readonlyRegistered,'ISOLATED_COPY_READER_REQUIRED');return readonlyRegistered;}
