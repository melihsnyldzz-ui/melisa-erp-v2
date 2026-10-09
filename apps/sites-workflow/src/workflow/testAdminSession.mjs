export const testSessionModeKey = 'melisaTestSessionMode';
export function resolveTestApiBase({location,apiBase}){
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
  return isTestSessionTarget({location,apiBase}) && mode !== 'manual';
}
