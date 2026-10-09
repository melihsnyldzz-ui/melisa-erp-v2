import {SHARED_COPY_DATABASE,assertIsolatedCopyContext} from './isolatedOperationCopyContext.mjs';

// Called only with a bootstrap-registered context. User/role claims stay intact.
export function sharedCopyAuthClaims(context) {
  if (!context) return {};
  assertIsolatedCopyContext(context);
  return context.target.database === SHARED_COPY_DATABASE
    ? {database: context.target.database, isolatedOperationCopy: context.copyId}
    : {};
}
