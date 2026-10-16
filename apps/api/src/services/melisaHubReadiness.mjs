import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const HUB_CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'";
const staticFiles=new Set(['index.html','hub.css','hub.mjs','catalog.mjs','progress/index.html','progress/model.mjs','progress/progress.mjs','progress/progress.css','progress/evidence.json']);
const trainingNames=new Set(['01-receiving.png','02-sales.png','03-purchases.png','04-collection.png','05-payment.png','06-return.png','07-count.png','08-crm.png']);
const forwarded=['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const validSource=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const originalSource='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';
const unavailable=()=>({state:'unknown',detail:'Kimlik veya erişim henüz doğrulanmadı.'});

export function hubRequestAllowed(req){
 return !forwarded.some(key=>req.headers[key]!==undefined)&&(!req.headers.origin||req.headers.origin===`http://${req.headers.host}`)&&(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']));
}
export function hubPublicConfig(status,host=null){
 const available=name=>status?.services?.[name]?.state==='reachable';
 let originalUrl=null;if(available('test125')&&['127.0.0.1:5234','localhost:5234','192.168.1.46:5234'].includes(host)){const url=new URL(`http://${host}/ornek-akis.html`);url.port='5194';originalUrl=url.href;}
 return {environment:'ISOLATED_TEST_COPY',erp:{enabled:available('erp'),validated:available('erp')},crm:{enabled:available('crm'),validated:available('crm'),port:62700},test125:{enabled:Boolean(originalUrl),validated:Boolean(originalUrl),port:5194,...(originalUrl?{url:originalUrl}:{})},live:{enabled:false},checkedAt:status.checkedAt,links:[]};
}
export function hubErpIdentityMatches(body,{context,apiSourceCommit}){
 return body?.ok===true&&body.environment==='ISOLATED_TEST_COPY'&&body.port===4184&&body.mode==='erp'&&body.copyId===context.copyId&&body.databaseName===context.target.database&&body.serverName===context.target.server&&body.sourceCommit===apiSourceCommit&&body.actualT1===false&&body.sysadmin===0&&body.databaseControl===0&&body.liveDatabaseAccess===0&&body.originalDatabaseAccess===0&&body.externalOperations===false&&body.automaticJobs===false;
}
export function hubTerminalIdentityMatches(body,{context,apiSourceCommit}){
 return hubErpIdentityMatches({...body,port:4184,mode:'erp'},{context,apiSourceCommit})&&body?.port===4186&&body.mode==='native'&&body.sqlReadOnly===true&&body.writes===false&&body.writeEnabled===false;
}
export function hubTest125IdentityMatches(web,api){
 const matches=(body,port)=>body?.ok===true&&body.environment==='CANONICAL_TEST'&&body.port===port&&body.sourceCommit===originalSource&&body.packageId===`CANONICAL-TEST-${originalSource.slice(0,12)}`;
 return matches(web,5194)&&matches(api,4144)&&api.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&api.serverName==='Semih\\MELISADEV'&&api.sysadmin===0&&api.databaseControl===0&&api.liveDatabaseAccess===0; // gitleaks:allow -- public source identity or synthetic fixture, not a credential
}
export function hubCrmIdentityMatches(body,sourceCommit,now=Date.now()){
 const age=now-Date.parse(body?.observedAt);
 return body?.sourceCommit===sourceCommit&&body.packageId===`crm-shared-test-${sourceCommit}`&&body.environment==='CANONICAL_TEST'&&Number.isFinite(age)&&age>=-5000&&age<120000&&body.startup?.state==='running'&&['server','catalog','orders'].every(name=>body.services?.[name]?.state==='running')&&['erp','native'].every(name=>body.dependencies?.[name]?.state==='ready');
}

// Read only an explicitly supplied private pin. No credentials or data APIs.
export function readHubRuntimePin(configPath){
 if(!configPath)return null;
 if(!path.isAbsolute(configPath))throw Error('HUB_CONFIG_ABSOLUTE_REQUIRED');
 const pin=JSON.parse(fs.readFileSync(configPath,'utf8'));
 const keys=['apiSourceCommit','crmSourceCommit','crmIndexSha256','crmHealthPath','trainingFiles'];
 if(Object.keys(pin).length!==keys.length||Object.keys(pin).some(key=>!keys.includes(key))||!validSource(pin.apiSourceCommit)||!validSource(pin.crmSourceCommit)||!validHash(pin.crmIndexSha256)||!path.isAbsolute(pin.crmHealthPath)||!Array.isArray(pin.trainingFiles)||pin.trainingFiles.length!==8)throw Error('HUB_CONFIG_PIN_REJECTED');
 const names=new Set();
 for(const file of pin.trainingFiles){if(Object.keys(file).length!==2||!trainingNames.has(file.name)||!validHash(file.sha256)||names.has(file.name))throw Error('HUB_TRAINING_PIN_REJECTED');names.add(file.name);}
 return pin;
}

export function verifyHubTraining(root,files){
 try{return !fs.lstatSync(path.join(root,'egitim-gorselleri')).isSymbolicLink()&&files?.length===8&&files.every(file=>{
  const target=path.join(root,'egitim-gorselleri',file.name);
  return !fs.lstatSync(target).isSymbolicLink()&&hash(fs.readFileSync(target))===file.sha256;
 })&&!fs.lstatSync(path.join(root,'kullanim-egitimi.html')).isSymbolicLink()&&fs.statSync(path.join(root,'kullanim-egitimi.html')).isFile();}catch{return false;}
}

export function createHubMiddleware({root,context,pin=null,fetchImpl=fetch,now=()=>Date.now(),readHealth=()=>JSON.parse(fs.readFileSync(pin.crmHealthPath,'utf8')),trainingValid=verifyHubTraining(root,pin?.trainingFiles)}={}){
 const hubRoot=path.join(root,'melisa-hub');let cache=null,pending=null,expires=0;
 async function getBytes(url,maxSize){
  const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(2000)});
  if(response.status!==200)throw Error('HUB_SERVICE_UNAVAILABLE');
  if(Number(response.headers.get('content-length'))>maxSize)throw Error('HUB_RESPONSE_TOO_LARGE');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxSize)throw Error('HUB_RESPONSE_TOO_LARGE');chunks.push(chunk);}
  return Buffer.concat(chunks);
 }
 async function probe(){
  const services={erp:unavailable(),crm:unavailable(),terminal:unavailable(),training:unavailable(),test125:unavailable(),live:{state:'unknown',detail:'Canlı geçiş onayı verilmedi.'}};
  if(pin){
   await Promise.all([
    (async()=>{try{const body=JSON.parse((await getBytes('http://127.0.0.1:4184/test-health',65536)).toString());if(hubErpIdentityMatches(body,{context,apiSourceCommit:pin.apiSourceCommit}))services.erp={state:'reachable',detail:'Çalışan izole uygulamaya erişiliyor.'};}catch{services.erp={state:'unreachable',detail:'Uygulamaya şu anda erişilemiyor.'};}})(),
    (async()=>{try{const body=readHealth();const bytes=await getBytes('http://127.0.0.1:62700/',1048576);if(hubCrmIdentityMatches(body,pin.crmSourceCommit,now())&&hash(bytes)===pin.crmIndexSha256)services.crm={state:'reachable',detail:'Çalışan uygulama ekranına erişiliyor.'};}catch{services.crm={state:'unreachable',detail:'Uygulamaya şu anda erişilemiyor.'};}})(),
    (async()=>{try{const body=JSON.parse((await getBytes('http://127.0.0.1:4186/test-health',65536)).toString());if(hubTerminalIdentityMatches(body,{context,apiSourceCommit:pin.apiSourceCommit})&&fs.statSync(path.join(root,'terminal.html')).isFile())services.terminal={state:'reachable',detail:'El terminali ekranına ve okuyucuya erişiliyor.'};}catch{services.terminal={state:'unreachable',detail:'El terminali bağlantısı şu anda hazır değil.'};}})(),
    (async()=>{try{const [web,api]=await Promise.all(['http://127.0.0.1:5194/test-health','http://127.0.0.1:4144/test-health'].map(async url=>JSON.parse((await getBytes(url,65536)).toString())));if(hubTest125IdentityMatches(web,api))services.test125={state:'reachable',detail:'Korunan önceki çalışma ortamına erişiliyor.'};}catch{services.test125={state:'unreachable',detail:'Önceki ortam bağlantısı şu anda doğrulanamıyor.'};}})()
   ]);
   if(trainingValid)services.training={state:'reachable',detail:'Sekiz kısa ders ve görsel hazır.'};
  }
  return {checkedAt:new Date(now()).toISOString(),services,acceptance:'pending'};
 }
 async function status(){
  if(cache&&now()<expires)return cache;
  if(!pending)pending=probe().then(value=>{cache=value;expires=now()+5000;return value;}).finally(()=>{pending=null;});
  return pending;
 }
 return async(req,res)=>{
  res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',HUB_CSP);
  if(!hubRequestAllowed(req))return res.sendStatus(403);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.set('Allow','GET, HEAD');return res.sendStatus(405);}
  if(req.originalUrl?.split('?')[0]==='/melisa-hub')return res.redirect(308,'/melisa-hub/');
  if(req.path==='/config.json')return res.json(hubPublicConfig(await status(),req.headers.host));
  if(req.path==='/status.json')return res.json(await status());
  const name=req.path==='/'?'index.html':req.path==='/progress/'?'progress/index.html':req.path.slice(1);
  if(!staticFiles.has(name))return res.sendStatus(404);
  const target=path.join(hubRoot,name);
  try{if(fs.lstatSync(hubRoot).isSymbolicLink()||name.startsWith('progress/')&&fs.lstatSync(path.join(hubRoot,'progress')).isSymbolicLink()||fs.lstatSync(target).isSymbolicLink()||!fs.statSync(target).isFile())return res.sendStatus(404);res.type(path.extname(target));if(req.method==='HEAD')return res.end();return res.send(fs.readFileSync(target));}catch{return res.sendStatus(404);}
 };
}
