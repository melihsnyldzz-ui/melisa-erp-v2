// Exact remote transport for the existing DB02 copy. A browser setting cannot
// change its origin, API target, copy identity or enable TEST session minting.
export const SHARED_STABLE_ORIGIN='https://semih.tail295701.ts.net:8443';
export const SHARED_STABLE_DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
export function isSharedStableLocation(location){
 return location?.origin===SHARED_STABLE_ORIGIN&&location.protocol==='https:'
  &&location.hostname==='semih.tail295701.ts.net'&&location.port==='8443';
}
export function sharedStableApiBase({location,apiBase}={}){
 return isSharedStableLocation(location)&&apiBase===SHARED_STABLE_ORIGIN?SHARED_STABLE_ORIGIN:null;
}
export const isBusinessCopyLocation=location=>isSharedStableLocation(location)||location?.port==='5234';
