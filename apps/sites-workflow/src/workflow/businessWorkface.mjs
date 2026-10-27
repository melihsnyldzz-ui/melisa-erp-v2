import {businessSaleReadPathAllowed} from '../../../api/src/services/canonicalBusinessSaleReadModel.mjs';
import {partyHistoryPathAllowed} from '../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs';
export const businessWorkfaceId='ERP-5244-REALDATA-20261027';
export function isBusinessWorkfaceTarget({location,apiBase,profile}){
 return profile===businessWorkfaceId&&apiBase==='http://127.0.0.1:4144'&&location?.protocol==='http:'&&location.port==='5244'&&['127.0.0.1','localhost','192.168.1.46','100.87.188.3'].includes(location.hostname)&&location.origin===`http://${location.hostname}:5244`;
}
// First real-data candidate is deliberately read-only except normal session
// lifecycle. Existing upstream SQL/API permissions remain the authority.
export function businessWorkfaceRequestAllowed(method,path){
 if(typeof path!=='string'||!path.startsWith('/api/')||path.includes('#')||path.includes('\\')||path.startsWith('//'))return false;
 const pathname=path.split('?')[0];if(pathname.includes('%')||pathname.includes('/../')||pathname.endsWith('/..'))return false;
 if(method==='POST')return /^\/api\/auth\/(?:login|refresh|logout|session-confirm)$/.test(pathname)&&path===pathname;
 if(!['GET','HEAD','OPTIONS'].includes(method))return false;
 if(pathname==='/api/business-sales/selection')return ['GET','HEAD'].includes(method)&&businessSaleReadPathAllowed(path);
 if(pathname.startsWith('/api/business-party-history/'))return ['GET','HEAD'].includes(method)&&partyHistoryPathAllowed(path);
 return /^\/api\/(?:auth\/me|catalog\/products(?:\/[1-9]\d*(?:\/photo)?)?|customer-cards|supplier-cards|(?:customers|suppliers)\/[1-9]\d*\/card|products\/[1-9]\d*\/purchase-reference|home\/summary|work-system\/summary|work-reports(?:\/(?:context|export))?)$/.test(pathname);
}
