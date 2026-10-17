import {copyAssert,SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';

export function assertSharedCopyRelease(release) {
  const p=release?.sharedTestCopy;
  const business=p?.database===BUSINESS_COPY_DATABASE;
  copyAssert(/^[a-f0-9]{40}$/.test(release?.sourceCommit??'')&&typeof release.packageId==='string'
    &&[SHARED_COPY_DATABASE,BUSINESS_COPY_DATABASE].includes(p?.database)&&p.apiPort===(business?4184:4174)&&p.nativePort===(business?4186:4176)&&p.webPort===(business?5234:5224)
    &&p.host==='127.0.0.1'&&p.lanHost==='192.168.1.46'&&p.nativeLoopbackOnly===true
    &&p.nativeWrites===false&&p.externalOperations===false&&p.actualT1===false,'SHARED_RELEASE_IDENTITY');
  return release;
}
