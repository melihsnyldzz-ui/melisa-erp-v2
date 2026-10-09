import {copyAssert,SHARED_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';

export function assertSharedCopyRelease(release) {
  const p=release?.sharedTestCopy;
  copyAssert(/^[a-f0-9]{40}$/.test(release?.sourceCommit??'')&&typeof release.packageId==='string'
    &&p?.database===SHARED_COPY_DATABASE&&p.apiPort===4174&&p.nativePort===4176&&p.webPort===5224
    &&p.host==='127.0.0.1'&&p.lanHost==='192.168.1.46'&&p.nativeLoopbackOnly===true
    &&p.nativeWrites===false&&p.externalOperations===false&&p.actualT1===false,'SHARED_RELEASE_IDENTITY');
  return release;
}
