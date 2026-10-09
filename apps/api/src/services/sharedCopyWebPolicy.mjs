import {isolatedCopyTopology,BUSINESS_COPY_DATABASE,SHARED_COPY_DATABASE,copyAssert} from './isolatedOperationCopyContext.mjs';
// Photo loaders create browser object URLs from authenticated, verified JPEGs.
// Permit those URLs only as images; scripts, connections and objects stay pinned.
export const SHARED_WEB_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:4174 http://192.168.1.46:4174; connect-src 'self' http://127.0.0.1:4174 http://127.0.0.1:4176 http://192.168.1.46:4174; frame-src http://127.0.0.1:62600 http://localhost:62600 http://192.168.1.46:62600; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

export const BUSINESS_WEB_CSP=SHARED_WEB_CSP.replaceAll(':4174',':4184').replaceAll(':4176',':4186').replaceAll(':62600',':62700');
export function sharedWebCspFor(context){isolatedCopyTopology(context);copyAssert([BUSINESS_COPY_DATABASE,SHARED_COPY_DATABASE].includes(context.target.database),'SHARED_WEB_TARGET');return context.target.database===BUSINESS_COPY_DATABASE?BUSINESS_WEB_CSP:SHARED_WEB_CSP;}
