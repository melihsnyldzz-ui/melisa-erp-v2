import {getCrmOrderCurrentContext} from './crmOrderCurrentContext.mjs';
const copyModule=getCrmOrderCurrentContext()?null:await import('./isolatedOperationCopyContext.mjs');

// Called only with a bootstrap-registered context. User/role claims stay intact.
export function sharedCopyAuthClaims(context) {
  if (!context) return {};
  if(!copyModule)throw Object.assign(new Error('Ayrılmış deneme işleminin kapsamı doğrulanamadı.'),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED',statusCode:503});
  const {SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE,assertIsolatedCopyContext}=copyModule;
  assertIsolatedCopyContext(context);
  return [SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE].includes(context.target.database)
    ? {database: context.target.database, isolatedOperationCopy: context.copyId}
    : {};
}
