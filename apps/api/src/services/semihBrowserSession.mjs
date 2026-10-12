// Cookie transport for an already password-verified dedicated TEST grant.
// No login, issuer, role mutation, DPAPI access or anonymous bootstrap lives here.
export const SEMIH_BROWSER_COOKIE='melisa-erp-semih-test-refresh';
export const SEMIH_BROWSER_PATH='/api/auth/semih-browser';
const options=Object.freeze({httpOnly:true,sameSite:'strict',secure:false,path:SEMIH_BROWSER_PATH});
const origins=new Map([['http://127.0.0.1:5234','127.0.0.1:4184'],['http://192.168.1.46:5234','192.168.1.46:4184']]);
const fail=(code,statusCode=401)=>Object.assign(Error('Browser TEST session is unavailable'),{code,statusCode});
export function semihBrowserRequestGuard(req,action){
 const origin=req.get('origin'),peer=req.socket?.remoteAddress,loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
 const lan=/^(?:::ffff:)?192\.168\.1\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(peer??'');
 if(!origins.has(origin)||req.get('host')!==origins.get(origin)||!loopback&&!lan||origin==='http://127.0.0.1:5234'&&!loopback)throw fail('AUTH_SEMIH_BROWSER_ORIGIN',403);
 const site=req.get('sec-fetch-site');if(site&&!['same-origin','same-site','none'].includes(site))throw fail('AUTH_SEMIH_BROWSER_ORIGIN',403);
 if(Object.keys(req.headers??{}).some(k=>k==='forwarded'||k==='x-real-ip'||k.startsWith('x-forwarded-')||k.startsWith('tailscale-')))throw fail('AUTH_SEMIH_BROWSER_ORIGIN',403);
 const seen=new Set();for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const key=req.rawHeaders[i].toLowerCase();if(['origin','host','cookie','authorization','content-type'].includes(key)){if(seen.has(key))throw fail('AUTH_SEMIH_BROWSER_ORIGIN',403);seen.add(key);}}
 if(req.originalUrl!==SEMIH_BROWSER_PATH+'/'+action)throw fail('AUTH_SEMIH_BROWSER_REQUEST',400);
 if(action==='remembered'){if(req.method!=='GET')throw fail('AUTH_SEMIH_BROWSER_REQUEST',400);return;}
 if(req.method!=='POST'||!req.is('application/json')||!req.body||Object.getPrototypeOf(req.body)!==Object.prototype)throw fail('AUTH_SEMIH_BROWSER_REQUEST',400);
 const keys=Object.keys(req.body);if(action==='enroll'?keys.length!==1||keys[0]!=='refreshToken':keys.length!==0)throw fail('AUTH_SEMIH_BROWSER_REQUEST',400);
}
export function semihBrowserCookie(req){
 const matches=String(req.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(SEMIH_BROWSER_COOKIE+'='));
 if(matches.length>1)throw fail('AUTH_SEMIH_BROWSER_COOKIE_INVALID');
 if(!matches.length)return null;
 const token=matches[0].slice(SEMIH_BROWSER_COOKIE.length+1);if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail('AUTH_SEMIH_BROWSER_COOKIE_INVALID');return token;
}
export function createSemihBrowserSessionHandlers({auth,ok,fail:respondFail}){
 const handle=action=>async(req,res)=>{try{
  res.set('Cache-Control','no-store');semihBrowserRequestGuard(req,action);
  if(action==='remembered')return ok(res,await auth.rememberedSemihBrowserUser(semihBrowserCookie(req)),{source:'protected-normal-browser-auth'});
  if(!auth.semihBrowserSessionEnabled())throw fail('AUTH_SEMIH_BROWSER_DISABLED',503);
  const cookie=semihBrowserCookie(req);let result;
  if(action==='enroll'){
   const parts=String(req.get('authorization')||'').split(' ');if(parts.length!==2||parts[0]!=='Bearer'||!parts[1])throw fail('AUTH_TOKEN_REQUIRED');
   result=await auth.enrollSemihBrowserSession(parts[1],req.body.refreshToken,cookie);
  }else if(action==='restore'){
   if(!cookie)throw fail('AUTH_SEMIH_BROWSER_SESSION_MISSING');result=await auth.restoreSemihBrowserSession(cookie);
  }else{
   result=await auth.logoutSemihBrowserSession(cookie);if(result?.loggedOut!==true)throw fail('AUTH_SEMIH_BROWSER_LOGOUT_FAILED',503);res.clearCookie(SEMIH_BROWSER_COOKIE,options);return ok(res,result,{source:'protected-normal-browser-auth'});
  }
  if(!Number.isSafeInteger(result.refreshExpiresAt)||result.refreshExpiresAt<=Date.now()||typeof result.refreshToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(result.refreshToken))throw fail('AUTH_SEMIH_BROWSER_RESULT_INVALID',503);
  res.cookie(SEMIH_BROWSER_COOKIE,result.refreshToken,{...options,expires:new Date(result.refreshExpiresAt)});
  const {refreshToken,...publicResult}=result;return ok(res,publicResult,{source:'protected-normal-browser-auth'});
 }catch(error){return respondFail(res,error.statusCode||503,error.code||'AUTH_SEMIH_BROWSER_UNAVAILABLE','Browser TEST session is unavailable');}};
 return Object.freeze({enroll:handle('enroll'),remembered:handle('remembered'),restore:handle('restore'),logout:handle('logout')});
}
