// Capability results belong to the authenticated session, not the active page.
// Later requests and session reset invalidate earlier fulfilled or rejected work.
export function createDesktopSessionCapability({getUser,load,apply}={}){
 if(typeof getUser!=='function'||typeof load!=='function'||typeof apply!=='function')throw Error('DESKTOP_CAPABILITY_CONFIGURATION');
 let revision=0;
 const current=(user,token)=>token===revision&&user!==null&&getUser()===user;
 return Object.freeze({reset(){revision++;},async refresh(){const user=getUser(),token=++revision;if(!user)return;try{const value=await load();if(current(user,token))apply(value);}catch{if(current(user,token))apply(null);}}});
}
