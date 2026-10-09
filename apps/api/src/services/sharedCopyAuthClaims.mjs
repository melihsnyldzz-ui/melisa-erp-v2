import {SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE,assertIsolatedCopyContext} from './isolatedOperationCopyContext.mjs';

// Called only with a bootstrap-registered context. User/role claims stay intact.
export function sharedCopyAuthClaims(context) {
  if (!context) return {};
  assertIsolatedCopyContext(context);
  return [SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE].includes(context.target.database)
    ? {database: context.target.database, isolatedOperationCopy: context.copyId}
    : {};
}
