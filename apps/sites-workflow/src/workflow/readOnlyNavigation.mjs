const pages=new Set(['home','approvals','stock','reports','settings']);
// The hook belongs to one validated read-only page mount, including its login/read phase.
export function installReadOnlyNavigation({host,root,page,isCurrent}={}){
 if(!pages.has(page)||!host||root?.isConnected!==true||typeof isCurrent!=='function')return ()=>{};
 let active=true;
 const hook=()=>active&&root.isConnected===true&&host.MelisaWorkingBeforeNavigate===hook&&isCurrent()===true;
 host.MelisaWorkingBeforeNavigate=hook;
 return ()=>{active=false;if(host.MelisaWorkingBeforeNavigate===hook)host.MelisaWorkingBeforeNavigate=null;};
}
