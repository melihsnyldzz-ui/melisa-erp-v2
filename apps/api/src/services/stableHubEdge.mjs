import http from 'node:http';
import {STABLE_HUB_ORIGIN} from './sharedCopyTransport.mjs';
import {isCanonicalTestWriteAllowed} from './canonicalTestRoutePolicy.mjs';
const authority=new URL(STABLE_HUB_ORIGIN).host;
const readMethods=new Set(['GET','HEAD']);
const forbidden=/^\/(?:api\/auth\/(?:test-admin|stage4-actor|local-passwordless-admin)|crm\/api\/(?:test-admin|test-personnel))(?:\/|$)/i;
const erpReads=/^\/api\/(?:auth\/(?:me|session)|home\/summary|catalog\/products(?:\/[1-9]\d*(?:\/photo)?)?|stock-products(?:\/[1-9]\d*)?|(?:customers|suppliers|customer-cards|supplier-cards|products|currency-rates|cash-registers|movements|sales-invoices|purchase-invoices)(?:\/[A-Za-z0-9_-]+){0,3}|work-(?:system|reports|sales|collections|receiving|purchases|supplier-payments)(?:\/[A-Za-z0-9_-]+){0,4}|work-suppliers\/(?:context|history)|test-daily\/(?:purchase|sales|fx(?:\/context)?|count|count-cancel|return-cancel))$/;
const crmReads=/^\/crm\/api\/live\/(?:health|auth\/me|crm\/(?:inbox|agents|sales-rules|conversations\/[1-9]\d*|catalog\/products(?:\/[A-Za-z0-9_-]+(?:\/photo)?)?|erp\/(?:drafts(?:\/[A-Za-z0-9_-]+)?|context|customers|v2\/(?:customers|drafts\/[A-Za-z0-9_-]+))))$/;
const crmOrderPost=/^\/crm\/api\/live\/crm\/erp\/(?:login|drafts|v2\/drafts)$/;
const inboundScope=/^\/api\/(?:work-(?:receiving|purchases|suppliers)(?:\/|$)|test-daily\/(?:count|purchase)(?:\/|$))/;
const conversationScope=/^\/crm\/api\/live\/crm\/catalog(?:\/|$)/;
const orderScope=/^\/crm\/api\/live\/crm\/erp(?:\/|$)/;
const erpStatic=new Set(['/ornek-akis.html','/terminal.html','/kullanim-egitimi.html','/stage4-runtime.js']);
const hubStatic=new Set(['/melisa-hub/','/melisa-hub/index.html','/melisa-hub/hub.css','/melisa-hub/hub.mjs','/melisa-hub/catalog.mjs','/melisa-hub/config.json','/melisa-hub/status.json']);
const asset=/^\/(?:assets|egitim-gorselleri)\/[A-Za-z0-9_.-]+\.(?:js|css|png|jpe?g|webp|svg|woff2)$/;
const crmAsset=/^\/crm\/assets\/[A-Za-z0-9_.-]+\.(?:js|css|png|jpe?g|webp|svg|woff2)$/;
const denied=()=>{throw Object.assign(Error('STABLE_EDGE_REQUEST_REJECTED'),{statusCode:403});};
export function stableEdgeRoute(method,rawUrl){
 if(typeof rawUrl!=='string'||rawUrl.length>8192||!rawUrl.startsWith('/')||rawUrl.startsWith('//')||/[\x00-\x20\\#]/.test(rawUrl))denied();
 const rawPath=rawUrl.split('?')[0];
 // Namespace names are ASCII. Never normalize an encoded traversal/bootstrap.
 if(/%|\/\/{2}|\/{2}|(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)||forbidden.test(rawPath))denied();
 const url=new URL(rawUrl,STABLE_HUB_ORIGIN);if(url.origin!==STABLE_HUB_ORIGIN)denied();
 if(readMethods.has(method)){
  if(rawPath==='/')return {redirect:'/melisa-hub/'};
  if(rawPath==='/crm')return {redirect:'/crm/'};
  if(hubStatic.has(rawPath))return {port:5234,path:url.pathname+url.search,kind:'hub'};
  if(erpStatic.has(rawPath)||asset.test(rawPath))return {port:5234,path:url.pathname+url.search,kind:'erp-web'};
  if(rawPath==='/crm/'||rawPath==='/crm/mobile-preview'||crmAsset.test(rawPath)||crmReads.test(rawPath))return {port:62700,path:url.pathname+url.search,kind:'crm'};
  if(erpReads.test(rawPath))return {port:4184,path:url.pathname+url.search,kind:'erp-api'};
 }
 if(method==='POST'){
  const normalErp=/^\/api\/(?:auth\/(?:login|terminal-login)|work-(?:sales|collections|receiving|purchases|supplier-payments)(?:\/|$)|test-daily\/(?:count|purchase)\/(?:draft|approve|reject|cancel)$)/;
  if(normalErp.test(rawPath)&&isCanonicalTestWriteAllowed(method,rawPath,{writes:true,mode:'erp'}))return {port:4184,path:url.pathname+url.search,kind:'erp-api'};
  if(rawPath==='/crm/api/live/auth/login'||rawPath==='/crm/api/live/crm/catalog/auth/sign-out'||crmOrderPost.test(rawPath))return {port:62700,path:url.pathname+url.search,kind:'crm'};
 }
 denied();
}
export function assertStableEdgeRequest(req){
 if(req.socket?.remoteAddress!=='127.0.0.1'||req.headers.host!==authority||req.headers['x-forwarded-host']!==authority||req.headers['x-forwarded-proto']!=='https'||req.headers.forwarded||req.headers['x-real-ip'])denied();
 const from=req.headers['x-forwarded-for'];
 if(typeof from!=='string'||from.includes(',')||(!/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.(?:\d{1,3})\.(?:\d{1,3})$/.test(from)&&!/^fd7a:115c:a1e0:[0-9a-f:]+$/i.test(from)))denied();
 if(from.includes('.')&&from.split('.').some(n=>Number(n)>255))denied();
 // Serve's authenticated tailnet context is not a commercial role or token.
 const login=req.headers['tailscale-user-login'];
 if(typeof login!=='string'||!login||login.length>320||/[\r\n\x00]/.test(login))denied();
 if(req.headers.origin!==undefined&&req.headers.origin!==STABLE_HUB_ORIGIN)denied();
 if(!readMethods.has(req.method)&&req.headers.origin!==STABLE_HUB_ORIGIN)denied();
 if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))denied();
 const seen=new Set();for(let i=0;i<(req.rawHeaders?.length??0);i+=2){const key=req.rawHeaders[i].toLowerCase();if(/^(host|origin|authorization|content-length|transfer-encoding|x-forwarded-|tailscale-|forwarded|x-melisa-|x-crm-|x-erp-)/.test(key)){if(seen.has(key))denied();seen.add(key);}}
 if(req.headers['transfer-encoding']||req.headers['content-length']!==undefined&&(!/^(?:0|[1-9]\d*)$/.test(req.headers['content-length'])||Number(req.headers['content-length'])>2097152))denied();
 if(!readMethods.has(req.method)&&req.headers['content-length']===undefined)denied();
 if(!readMethods.has(req.method)&&!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']??''))denied();
 const route=stableEdgeRoute(req.method,req.url);
 stableUpstreamHeaders(req.headers,route.port,route.kind,req.url?.split('?')[0]);
 return route;
}
export function stableUpstreamHeaders(headers,port,kind=null,pathname=''){
 const result={host:`127.0.0.1:${port}`};
 for(const name of ['accept','content-type','content-length','authorization','origin','sec-fetch-site'])if(typeof headers[name]==='string')result[name]=headers[name];
 // Only anonymous GET/HEAD Hub content gets a transport marker, never API auth.
 if(kind==='hub')result.origin=STABLE_HUB_ORIGIN;
 const positiveId=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v)&&Number.isSafeInteger(Number(v));
 const sid=headers['x-melisa-supplier-id'],currency=headers['x-melisa-currency'];
 if(sid!==undefined||currency!==undefined){
  if(kind!=='erp-api'||!inboundScope.test(pathname)||!positiveId(sid)||!['TRY','USD','EUR'].includes(currency))denied();
  result['x-melisa-supplier-id']=sid;result['x-melisa-currency']=currency;
 }
 const conversation=headers['x-crm-conversation-id'];
 if(conversation!==undefined){if(kind!=='crm'||!conversationScope.test(pathname)||!positiveId(conversation))denied();result['x-crm-conversation-id']=conversation;}
 const token=headers['x-erp-token'];
 if(token!==undefined){if(kind!=='crm'||!orderScope.test(pathname)||typeof token!=='string'||token.length>8192||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))denied();result['x-erp-token']=token;}
 // Original exact HTTPS Origin is preserved. It is never forged as localhost.
 return result;
}
export function stableResponseHeaders(headers,kind){
 const result={};for(const [name,value]of Object.entries(headers))if(!['set-cookie','location','connection','transfer-encoding','content-security-policy','access-control-allow-origin','access-control-allow-credentials'].includes(name.toLowerCase()))result[name]=value;
 result['cache-control']='no-store';result['x-content-type-options']='nosniff';result['referrer-policy']='same-origin';
 if(kind==='hub')result['content-security-policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'";
 if(kind==='erp-web')result['content-security-policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
 if(kind==='crm'){
  // The stable browser trust boundary is fixed; upstream cannot introduce an
  // external script, network, form, frame or cookie source. Existing inline
  // CRM bootstrap/style behavior remains explicit until separately reviewed.
  result['content-security-policy']="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";
 }
 return result;
}
export function createStableEdgeServer({requestImpl=http.request}={}){
 return http.createServer((req,res)=>{
  let route;try{route=assertStableEdgeRequest(req);}catch{res.writeHead(403,{'cache-control':'no-store'});res.end('Erişim doğrulanamadı.');return;}
  if(route.redirect){res.writeHead(302,{location:route.redirect,'cache-control':'no-store'});res.end();return;}
  const upstream=requestImpl({hostname:'127.0.0.1',port:route.port,path:route.path,method:req.method,headers:stableUpstreamHeaders(req.headers,route.port,route.kind,req.url.split('?')[0]),timeout:15000},reply=>{
   if(reply.statusCode>=300&&reply.statusCode<400){reply.resume();res.writeHead(502,{'cache-control':'no-store'});res.end('Bağlantı doğrulanamadı.');return;}
   res.writeHead(reply.statusCode,stableResponseHeaders(reply.headers,route.kind));reply.pipe(res);
  });
  upstream.once('error',()=>{if(!res.headersSent)res.writeHead(502,{'cache-control':'no-store'});res.end('Uygulamaya ulaşılamadı.');});
  upstream.once('timeout',()=>upstream.destroy());req.once('aborted',()=>upstream.destroy());req.pipe(upstream);
 });
}
