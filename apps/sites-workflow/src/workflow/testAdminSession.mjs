import {isCleanCatalogLocation} from './cleanSyntheticCatalogModel.mjs';
import {isBusinessWorkfaceTarget} from './businessWorkface.mjs';
export const testSessionModeKey = 'melisaTestSessionMode';
export function resolveTestApiBase({location,apiBase,businessProfile=import.meta.env?.VITE_ERP_WORKFACE}){
 if(businessProfile!==undefined&&location?.port==='5244')return isBusinessWorkfaceTarget({location,apiBase,profile:businessProfile})?location.origin:null;
 if(location?.port==='5244'){
  if(!isCleanCatalogLocation(location)||apiBase!=='http://127.0.0.1:4194')return null;
  return ['127.0.0.1','localhost'].includes(location.hostname)?apiBase:`http://${location.hostname}:5244`;
 }
 if(location?.protocol==='http:'&&location.port==='5234'){
  if(['127.0.0.1','localhost'].includes(location.hostname))return apiBase==='http://127.0.0.1:4184'?apiBase:null;
  if(location.hostname==='192.168.1.46'&&['http://127.0.0.1:4184','http://192.168.1.46:4184'].includes(apiBase))return 'http://192.168.1.46:4184';
  return null;
 }
 if(location?.protocol==='http:'&&location.port==='5224'){
  if(['127.0.0.1','localhost'].includes(location.hostname))return apiBase==='http://127.0.0.1:4174'?apiBase:null;
  if(location.hostname==='192.168.1.46'&&['http://127.0.0.1:4174','http://192.168.1.46:4174'].includes(apiBase))return 'http://192.168.1.46:4174';
  return null;
 }
 if(location?.protocol==='http:'&&location.port==='5204'&&['127.0.0.1','localhost'].includes(location.hostname))return apiBase==='http://127.0.0.1:4154'?apiBase:null;
 if(location?.protocol!=='http:'||location.port!=='5194')return null;
 if(['127.0.0.1','localhost'].includes(location.hostname))return apiBase==='http://127.0.0.1:4144'?apiBase:null;
 if(location.hostname==='192.168.1.46'&&['http://127.0.0.1:4144','http://192.168.1.46:4144'].includes(apiBase))return 'http://192.168.1.46:4144';
 return null;
}
export function isTestSessionTarget(context){return resolveTestApiBase(context)!==null;}
export function shouldAutoOpenTestAdmin({ location, apiBase, mode }) {
  if(location?.port==='5244')return false;
  return isTestSessionTarget({location,apiBase}) && mode !== 'manual';
}
