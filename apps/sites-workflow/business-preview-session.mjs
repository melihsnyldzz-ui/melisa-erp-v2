import {businessSaleBrowserRequestAllowed,businessSalePreviewRequestAllowed,businessSalePreviewSelectionAllowed,businessSaleReceiptRequestAllowed} from './src/workflow/businessWorkface.mjs';
// Same-origin HttpOnly transport for the existing normal ERP refresh store.
// No password/session journal, JWT signer or SQL connection.
// The explicitly approved login label semih resolves only to existing actor 17.
export const businessSessionCookie='melisa_erp_business_5244';
const refreshPattern=/^[A-Za-z0-9_-]{43}$/;
const emptyCookie=()=>`${businessSessionCookie}=; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0`;
function cookieValue(header){
 if(header===undefined)return null;if(typeof header!=='string'||header.length>8192)return null;
 const values=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith(businessSessionCookie+'='));
 if(values.length!==1)return null;const value=values[0].slice(businessSessionCookie.length+1);return refreshPattern.test(value)?value:null;
}
function json(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));}
export function createBusinessBrowserSessionTransport({fetchImpl=globalThis.fetch}={}){
 return async(req,res,next)=>{
  const path=req.url;
  if(businessSaleBrowserRequestAllowed(req.method,path)){
   // Cookie Path=/api/auth intentionally excludes these requests. Verify the
   // incoming access credential against the existing API, never decode/mint it.
   try{
    const authorization=req.headers.authorization;
    if(req.headers['x-melisa-session-transport']!==undefined||typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(authorization)){json(res,401,{success:false,error:{code:'AUTH_TOKEN_REQUIRED'}});return;}
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192){json(res,413,{success:false,error:{code:'BUSINESS_PREVIEW_BODY_LIMIT'}});return;}chunks.push(chunk);}
    const raw=Buffer.concat(chunks).toString('utf8');let body;
    if(req.method==='POST'){try{body=JSON.parse(raw);}catch{}if(!businessSalePreviewSelectionAllowed(body)){json(res,400,{success:false,error:{code:'BUSINESS_PREVIEW_INPUT'}});return;}}
    else if(raw.length){json(res,400,{success:false,error:{code:'BUSINESS_PREVIEW_INPUT'}});return;}
    const headers={Authorization:authorization,'Content-Type':'application/json','Cache-Control':'no-store'};
    const options={redirect:'error',cache:'no-store',headers,signal:AbortSignal.timeout(15000)};
    const auth=await fetchImpl('http://127.0.0.1:4144/api/auth/me',{...options,method:'GET'});
    const authText=await auth.text();if(authText.length>131072)throw Error('AUTH_RESPONSE_LIMIT');const identity=JSON.parse(authText);
    if(!auth.ok||identity?.success!==true||identity.meta?.source!=='jwt-auth'){json(res,401,{success:false,error:{code:'AUTH_SESSION_INVALID'}});return;}
    if(!(businessSalePreviewRequestAllowed(req.method,path,identity.data)||businessSaleReceiptRequestAllowed(req.method,path,identity.data))){json(res,403,{success:false,error:{code:'BUSINESS_PREVIEW_FORBIDDEN'}});return;}
    const response=await fetchImpl('http://127.0.0.1:4144'+path,{...options,signal:AbortSignal.timeout(15000),method:req.method,...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();if(text.length>131072)throw Error('BUSINESS_RESPONSE_LIMIT');const payload=JSON.parse(text);
    json(res,response.status,payload);return;
   }catch{json(res,503,{success:false,error:{code:'BUSINESS_PREVIEW_UNAVAILABLE'}});return;}
  }
  if(req.method!=='POST'||!/^\/api\/auth\/(?:login|refresh|logout|session-confirm)$/.test(path)||req.headers['x-melisa-session-transport']==='native')return next();
  try{
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>8192){json(res,413,{success:false,error:{code:'SESSION_BODY_TOO_LARGE'}});return;}chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(res,400,{success:false,error:{code:'SESSION_BODY_INVALID'}});return;}
   if(!body||Object.getPrototypeOf(body)!==Object.prototype){json(res,400,{success:false,error:{code:'SESSION_BODY_INVALID'}});return;}
   const login=path==='/api/auth/login',logout=path==='/api/auth/logout';
   if(login){if(Object.keys(body).sort().join(',')!=='password,username'||!['unified-semih-test','semih'].includes(body.username)||typeof body.password!=='string'){json(res,401,{success:false,error:{code:'AUTH_INVALID_CREDENTIALS'}});return;}body={...body,username:'unified-semih-test'};}
   else{
    // A caller cannot substitute a family/body token or read the HttpOnly value.
    if(Object.keys(body).length){json(res,400,{success:false,error:{code:'SESSION_BODY_INVALID'}});return;}
    const refreshToken=cookieValue(req.headers.cookie);if(!refreshToken){json(res,401,{success:false,error:{code:'AUTH_REFRESH_INVALID'}},logout?{'Set-Cookie':emptyCookie()}:{});return;}body={refreshToken};
   }
   const headers={'Content-Type':'application/json'};
   if(typeof req.headers.authorization==='string')headers.Authorization=req.headers.authorization;
   const response=await fetchImpl('http://127.0.0.1:4144'+path,{method:'POST',redirect:'error',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   const text=await response.text();if(text.length>131072)throw Error('SESSION_RESPONSE_LIMIT');const payload=JSON.parse(text);
   // A late rejected refresh/confirmation must not delete a newer cookie set
   // by another tab. The API still rejects every invalid/replayed credential;
   // only explicit logout is allowed to clear the browser's current cookie.
   if(!response.ok){json(res,response.status,payload,logout?{'Set-Cookie':emptyCookie()}:{});return;}
   const data=payload.data;
   if(login||path==='/api/auth/refresh'){
    if(data?.user?.id!==17||data.user.username!=='unified-semih-test'||data.user.role?.id!==17||data.user.role.code!=='unified_test_semih'||data.user.isAdmin===true||data.user.testAdminSession===true||!refreshPattern.test(data.refreshToken??'')||!Number.isSafeInteger(data.refreshExpiresAt)||data.refreshExpiresAt<=Date.now()||!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=Date.now())throw Error('SESSION_IDENTITY_INVALID');
    const cookie=`${businessSessionCookie}=${data.refreshToken}; Path=/api/auth; HttpOnly; SameSite=Strict; Expires=${new Date(data.refreshExpiresAt).toUTCString()}`;
    delete data.refreshToken;delete data.refreshExpiresAt;data.browserSession=true;json(res,200,payload,{'Set-Cookie':cookie});return;
   }
   json(res,response.status,payload,logout?{'Set-Cookie':emptyCookie()}:{});
  }catch{json(res,503,{success:false,error:{code:'SESSION_TRANSPORT_UNAVAILABLE'}});}
 };
}
