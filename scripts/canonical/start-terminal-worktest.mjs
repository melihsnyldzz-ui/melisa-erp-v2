import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,lstat,realpath,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {featurePackageSpec,validateFeatureManifest,assertFeatureEntry,verifyFeatureSources} from './terminal-worktest-package.mjs';
import {validateSharedCopyBootstrap,publicSharedCopyScope} from '../../apps/api/src/services/sharedCopyBootstrap.mjs';
import {sharedWebCspFor} from '../../apps/api/src/services/sharedCopyWebPolicy.mjs';
import {terminalCartonSource} from '../../apps/api/src/services/terminalCartonSource.mjs';
import {createTerminalCartonFileStore,CARTON_DB02_DIRECTORY} from '../../apps/api/src/services/terminalCartonStore.mjs';
import {TERMINAL_WORKTEST_HOME_PATH,assertTerminalHomeActor,initializeTerminalHomeReadonly} from './terminal-worktest-home-readonly.mjs';

export const WORKTEST=Object.freeze({host:'127.0.0.1',port:5264,api:'http://127.0.0.1:4184',config:'C:\\Sirket\\ERP\\runtime\\ERP-FINAL04-20261010\\shared-copy-config.json',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',reader:'melisa_shared_test_ro_20261009_02',sourceRoot:'C:\\Sirket\\ERP\\melisa-erp-v2',dependencyRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-BUSINESS-TEST-20261010-a51b117\\apps\\api\\package.json'});
const origins=new Set(['http://127.0.0.1:5234','http://127.0.0.1:5264']);
// Only the gateway's original GET receives a cold historical-read budget; this does not speed up native checks.
const upstreamRequestMethod=new AsyncLocalStorage();
export function worktestStaticPath(raw){
 const url=new URL(raw,'http://127.0.0.1:5234');
 if(url.origin!=='http://127.0.0.1:5234')throw fail('WORKTEST_PATH',400);
 if(url.search){const entries=[...url.searchParams];if(entries.length!==1||entries[0][1]!=='1'||!(url.pathname==='/terminal.html'&&entries[0][0]==='worktest'||url.pathname==='/kullanim-egitimi.html'&&entries[0][0]==='terminal'))throw fail('WORKTEST_PATH',400);}
 return url.pathname==='/'?'terminal.html':url.pathname.slice(1);
}
const fail=(code,statusCode=503)=>Object.assign(new Error(code),{code,statusCode});
export function requestGuard(req){
 if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)||!['127.0.0.1:5234','127.0.0.1:5264'].includes(req.headers.host))throw fail('WORKTEST_PEER',403);
 if(Object.keys(req.headers).some(k=>k==='forwarded'||k.startsWith('x-forwarded-')||k.startsWith('tailscale-')))throw fail('WORKTEST_PROXY',403);
 if(req.headers.origin!==undefined&&!origins.has(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site')throw fail('WORKTEST_ORIGIN',403);
 if(req.method==='POST'&&!origins.has(req.headers.origin))throw fail('WORKTEST_ORIGIN',403);
 if(typeof req.url!=='string'||req.url.includes('%')||req.url.includes('\\')||req.url.includes('#')||req.url.includes('..'))throw fail('WORKTEST_PATH',400);
}
export function assertActor(actor,context){const sealed=context.actors.find(a=>a.id===String(actor?.id));if(!actor||!/^\d+$/.test(String(actor.id))||!sealed||sealed.role!==undefined&&actor.role?.code!==sealed.role||actor.isAdmin===true||actor.role?.code==='admin'||actor.active===false||actor.isActive===false||!actor.permissions?.includes('sales.view'))throw fail('CARTON_FORBIDDEN',403);return actor;}
export function assertSqlIdentity(row,context){if(row?.db!==WORKTEST.database||row.server!=='Semih\\MELISADEV'||row.login!==WORKTEST.reader||row.sysadmin!==0||row.control!==0||row.live!==0||row.original!==0||row.copyId?.toUpperCase()!==context.copyId.toUpperCase()||row.seal!==context.sealHash||row.actualT1!=='false'||row.sealed!==true)throw fail('WORKTEST_DB_IDENTITY');}
export function verifiedCustomerName(invoice,context){
 const matches=context?.customers?.filter(c=>c.id===invoice?.customerId&&c.currency===invoice?.currency)??[];
 if(matches.length!==1)throw fail('CARTON_CUSTOMER_SCOPE',409);
 const customer=matches[0];if(customer.sourceKnown!==true||!(/^[a-f0-9]{64}$/i.test(customer.sourceWitnessHash??'')))throw fail('CARTON_CUSTOMER_PROOF');
 const name=customer.name;return typeof name==='string'&&name.trim()&&name.length<=240&&!/[\u0000-\u001f]/.test(name)?name.trim():'Müşteri adı okunamadı';
}
export function enrichInvoice(invoice,header,rows,context){
 if(!invoice||invoice.status!=='finalized'||header?.status!=='finalized'||String(header.id)!==invoice.id||header.documentNo!==invoice.documentNo||header.customerId!==invoice.customerId||header.currency!==invoice.currency||rows.length!==invoice.items?.length)throw fail('CARTON_SOURCE_CHANGED',409);
 let p;try{p=JSON.parse(header.preview);}catch{throw fail('CARTON_SOURCE_PROOF');}
 if(p.copyId!==context.copyId||p.sealHash!==context.sealHash||p.operationOrigin!==context.operationOrigin||p.items?.length!==rows.length)throw fail('CARTON_SOURCE_PROOF');
 if(p.policyHash){const accounts=context.customers.filter(c=>c.id===invoice.customerId&&c.currency===invoice.currency);if(accounts.length!==1||p.selection?.customerId!==invoice.customerId||p.selection.currency!==invoice.currency||p.selection.customerAccountId!==accounts[0].accountId||p.currency!==invoice.currency||!Array.isArray(p.selection.items)||p.selection.items.length!==rows.length||p.selection.items.some((r,i)=>r.productId!==rows[i].productId||r.quantityExact3!==rows[i].quantityExact3||r.quoteId!==invoice.items[i].quoteId))throw fail('CARTON_SOURCE_PROOF');}
 const items=rows.map((r,i)=>{const a=invoice.items[i],original=p.items[i],product=context.products.find(x=>x.id===r.productId);
  if(!product||!original||['productId','stockCode','name','quantityExact3','unitPriceExact4','lineTotalExact4','currency'].some(k=>r[k]!==a[k])||['productId','stockCode','name','quantityExact3','unitPriceExact4','lineTotalExact4'].some(k=>r[k]!==original[k])||original.unit?.label!==product.unit||original.unit?.factorExact8!==product.unitFactorExact8||a.unit?.label!==original.unit.label||a.unit?.factorExact8!==original.unit.factorExact8||r.unitName!=null&&r.unitName!==original.unit.label||r.unitFactorExact8!=null&&r.unitFactorExact8!==original.unit.factorExact8||r.barcode&&!product.barcodes.includes(r.barcode))throw fail('CARTON_SOURCE_CHANGED',409);
  return {...a,itemId:r.itemId,unit:{...original.unit,verified:true},barcodes:[...product.barcodes]};});
 return terminalCartonSource({...invoice,customerName:verifiedCustomerName(invoice,context),items});
}
export const CARTON_IDENTITY_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') original,CONVERT(varchar(36),copy_id) copyId,seal_hash seal,sealed,JSON_VALUE(profile_json,'$.actualT1') actualT1 FROM dbo.stage4_copy_manifest WITH(HOLDLOCK) WHERE copy_id=@copy;`;
export const CARTON_SOURCE_SQL=`SELECT CONVERT(varchar(20),i.id) id,i.document_no documentNo,i.status,CONVERT(varchar(20),i.customer_id) customerId,i.document_currency currency,l.preview_json preview FROM dbo.sales_invoices i WITH(HOLDLOCK) JOIN dbo.work_sales_links l WITH(HOLDLOCK) ON l.invoice_id=i.id WHERE i.id=@id;
SELECT CONVERT(varchar(20),s.id) itemId,CONVERT(varchar(20),s.product_id) productId,s.stock_code_snapshot stockCode,s.product_name_snapshot name,s.barcode_snapshot barcode,s.unit_name unitName,CONVERT(varchar(64),CONVERT(decimal(28,8),s.unit_multiplier)) unitFactorExact8,CONVERT(varchar(64),CONVERT(decimal(18,3),s.quantity)) quantityExact3,CONVERT(varchar(64),CONVERT(decimal(18,4),s.unit_price)) unitPriceExact4,CONVERT(varchar(64),CONVERT(decimal(18,4),s.line_total)) lineTotalExact4,s.currency_code currency FROM dbo.sales_invoice_items s WITH(HOLDLOCK) WHERE s.sales_invoice_id=@id ORDER BY s.id;`;
export function createReadonlySourceLock({sql,pool,context}){return async(invoice,work)=>{const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);try{const identity=await new sql.Request(tx).input('copy',sql.UniqueIdentifier,context.copyId).query(CARTON_IDENTITY_SQL);if(identity.recordset.length!==1)throw fail('WORKTEST_DB_IDENTITY');assertSqlIdentity(identity.recordset[0],context);const data=await new sql.Request(tx).input('id',sql.BigInt,invoice.id).query(CARTON_SOURCE_SQL);if(data.recordsets[0].length!==1)throw fail('CARTON_SOURCE_CHANGED',409);const source=enrichInvoice(invoice,data.recordsets[0][0],data.recordsets[1],context);return await work(source);}finally{await tx.rollback();}};}
async function protectedPath(file,directory=false){const absolute=path.resolve(file);for(let cursor=absolute;;cursor=path.dirname(cursor)){const s=await lstat(cursor);if(s.isSymbolicLink()||cursor===absolute&&((directory?!s.isDirectory():!s.isFile())||!directory&&s.nlink!==1))throw fail('WORKTEST_FILE_UNSAFE');if(path.dirname(cursor)===cursor)break;}if((await realpath(absolute)).toLowerCase()!==absolute.toLowerCase())throw fail('WORKTEST_FILE_UNSAFE');return absolute;}
export async function assertPrivateCartonDirectory(){await protectedPath(CARTON_DB02_DIRECTORY,true);const ps="$ErrorActionPreference='Stop';$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$d=New-Object System.IO.DirectoryInfo('C:\\Sirket\\ERP\\runtime\\carton-packing-db02');$a=$d.GetAccessControl();if(!$a.AreAccessRulesProtected -or $a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid){throw 'ACL'};$r=$a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]);if($r.Count -eq 0){throw 'ACL'};foreach($x in $r){if($x.AccessControlType -ne 'Allow' -or $x.IdentityReference.Value -ne $sid){throw 'ACL'}}";try{await promisify(execFile)('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{windowsHide:true,timeout:8000,maxBuffer:1024});}catch{throw fail('CARTON_PRIVATE_DIRECTORY');}}
export async function readUpstream(pathname,authorization,{transport=fetch}={}){if(!/^Bearer [^\s]{1,8192}$/.test(authorization??'')||!(/^\/api\/auth\/me$|^\/api\/work-sales\/invoices(?:\/[1-9]\d{0,18}|\?page=(?:[1-9]|1\d|20)&limit=50)?$/.test(pathname)))throw fail('WORKTEST_AUTH',401);const deadline=upstreamRequestMethod.getStore()==='GET'&&pathname.startsWith('/api/work-sales/invoices')?20000:12000;let r;try{r=await transport(WORKTEST.api+pathname,{headers:{authorization},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(deadline)});}catch{throw fail('WORKTEST_API_UNAVAILABLE');}if(!r.ok)throw fail(r.status===401?'WORKTEST_AUTH':'WORKTEST_SCOPE',[401,403,404,409].includes(r.status)?r.status:503);const text=await r.text();if(Buffer.byteLength(text)>2097152)throw fail('WORKTEST_UPSTREAM_SIZE');let body;try{body=JSON.parse(text);}catch{throw fail('WORKTEST_API_DATA');}if(body.success!==true||!body.data)throw fail('WORKTEST_API_DATA');return body.data;}
export async function readScopedReceipts(upstream,authorization,context){
 const invoices=[],seen=new Set();let total;
 for(let page=1;page<=20;page++){
  const result=await upstream(`/api/work-sales/invoices?page=${page}&limit=50`,authorization),meta=result?.meta;
  if(!Array.isArray(result?.data)||!Number.isSafeInteger(meta?.total)||meta.total<0||meta.page!==page||meta.limit!==50)throw fail('WORKTEST_API_DATA');
  if(meta.total>1000)throw fail('WORKTEST_RECEIPT_SCOPE_LIMIT');
  if(total!==undefined&&meta.total!==total)throw fail('WORKTEST_RECEIPT_LIST_CHANGED',409);total=meta.total;
  if(result.data.length!==Math.min(50,Math.max(0,total-(page-1)*50)))throw fail('WORKTEST_RECEIPT_LIST_CHANGED',409);
  for(const row of result.data){if(!/^[1-9]\d{0,18}$/.test(row?.id??'')||seen.has(row.id)||!['draft','finalized','cancelled'].includes(row.status))throw fail('WORKTEST_RECEIPT_LIST_CHANGED',409);seen.add(row.id);invoices.push(row);}
  if(invoices.length===total)return invoices.filter(i=>i.status==='finalized').map(i=>({id:i.id,documentNo:i.documentNo,customerName:verifiedCustomerName(i,context)}));
 }
 throw fail('WORKTEST_RECEIPT_SCOPE_LIMIT');
}
async function bodyJSON(req){if(req.headers['content-type']!=='application/json'||req.headers['content-encoding']!==undefined)throw fail('WORKTEST_CONTENT_TYPE',415);let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>262144)throw fail('WORKTEST_BODY_SIZE',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks));}catch{throw fail('WORKTEST_JSON',400);}}
export function createWorktestHandler({context,bootstrap,csp,store,withSource,upstream=readUpstream,homeSummary,dist,webPins=null,guard=requestGuard,apiOnly=false}){return async(req,res)=>{const originalMethod=req.method,callUpstream=(pathname,authorization)=>upstreamRequestMethod.run(originalMethod,()=>upstream(pathname,authorization));const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');try{guard(req);if(apiOnly&&!req.url.startsWith('/api/'))throw fail('WORKTEST_ROUTE',404);if(req.url===TERMINAL_WORKTEST_HOME_PATH){if(req.method!=='GET')throw fail('WORKTEST_METHOD',405);if(!/^Bearer [^\s]{1,8192}$/.test(req.headers.authorization??''))throw fail('WORKTEST_AUTH',401);if(typeof homeSummary!=='function')throw fail('WORKTEST_HOME_UNAVAILABLE');const actor=assertTerminalHomeActor(await callUpstream('/api/auth/me',req.headers.authorization),context);return send(200,{success:true,data:await homeSummary(actor,req.headers.authorization)});}if(req.url.startsWith('/api/')){const match=/^\/api\/terminal-cartons\/receipts(?:\/([1-9]\d{0,18}))?$/.exec(req.url);if(!match||!['GET','POST'].includes(req.method)||req.method==='POST'&&!match[1])throw fail('WORKTEST_ROUTE',404);const authorization=req.headers.authorization,actor=assertActor(await callUpstream('/api/auth/me',authorization),context);if(!match[1]){return send(200,{success:true,data:await readScopedReceipts(callUpstream,authorization,context)});}const input=req.method==='POST'?await bodyJSON(req):undefined;const invoice=await callUpstream('/api/work-sales/invoices/'+match[1],authorization);const data=await withSource(invoice,async source=>({source,state:await(req.method==='POST'?store.save(String(actor.id),source,input):store.load(String(actor.id),source))}));return send(200,{success:true,data});}
 if(!['GET','HEAD'].includes(req.method))throw fail('WORKTEST_METHOD',405);if(req.url==='/stage4-runtime.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(req.method==='HEAD'?'':`window.__MELISA_OPERATION_COPY__=${JSON.stringify(bootstrap).replaceAll('<','\\u003c')};${typeof homeSummary==='function'?`window.__MELISA_TERMINAL_WORKTEST_HOME__=${JSON.stringify({path:TERMINAL_WORKTEST_HOME_PATH,copyId:context.copyId})};`:''}`);}if(req.url==='/worktest-health')return send(200,{success:true,mode:'TERMINAL_READONLY_CARTON_METADATA',port:5264,copyId:context.copyId});const relative=worktestStaticPath(req.url);if(!/^(?:terminal\.html|ornek-akis\.html|kullanim-egitimi\.html|workflow-[a-z-]+\.js|favicon\.svg|melisa-baby-watermark\.png|assets\/[A-Za-z0-9_.-]+\.(?:js|css|svg|png|jpe?g|webp|woff2?))$/.test(relative))throw fail('WORKTEST_ROUTE',404);const file=await protectedPath(path.join(dist,relative));if(!file.startsWith(path.resolve(dist)+path.sep))throw fail('WORKTEST_PATH',400);let content=await readFile(file);if(webPins&&(!webPins.has(relative)||createHash('sha256').update(content).digest('hex')!==webPins.get(relative)))throw fail('WORKTEST_PACKAGE_PIN');const extension=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2'})[extension]);if(extension==='.html')content=Buffer.from(content.toString().replace('<head>','<head><script src="/stage4-runtime.js"></script>'));res.end(req.method==='HEAD'?'':content);
 }catch(e){send(e.statusCode??503,{success:false,error:{code:typeof e.code==='string'&&/^(?:WORKTEST_|CARTON_)/.test(e.code)?e.code:'WORKTEST_UNAVAILABLE',message:'Koli hazırlığı bağlantısı doğrulanamadı.'}});}};}
export async function readPinnedFeatureDist(spec){
 const root=await protectedPath(spec.root,true),manifest=await readFile(await protectedPath(path.join(root,'release-manifest.json')));
 if(createHash('sha256').update(manifest).digest('hex')!==spec.manifestSha256)throw fail('WORKTEST_PACKAGE_PIN');
 const parsed=JSON.parse(manifest),pins=validateFeatureManifest(parsed,spec);
 await verifyFeatureSources(parsed,async relative=>readFile(await protectedPath(path.join(root,...relative.split('/')))));
 const dist=await protectedPath(path.join(root,'apps/sites-workflow/dist-business'),true),seen=new Set();
 async function walk(directory,relative=''){for(const entry of await readdir(directory,{withFileTypes:true})){const rel=relative+entry.name,file=await protectedPath(path.join(directory,entry.name),entry.isDirectory());if(entry.isDirectory())await walk(file,rel+'/');else{if(!pins.has(rel)||createHash('sha256').update(await readFile(file)).digest('hex')!==pins.get(rel))throw fail('WORKTEST_PACKAGE_PIN');seen.add(rel);}}}
 await walk(dist);if(seen.size!==pins.size)throw fail('WORKTEST_PACKAGE_PIN');return {dist,webPins:pins};
}
export async function startTerminalWorktest(args=process.argv.slice(2)){
 if(process.platform!=='win32')throw fail('WORKTEST_WINDOWS_REQUIRED');
 const spec=featurePackageSpec(args);if(spec)assertFeatureEntry(spec,fileURLToPath(import.meta.url));
 const web=spec?await readPinnedFeatureDist(spec):{dist:await protectedPath(path.join(WORKTEST.sourceRoot,'apps/sites-workflow/dist'),true),webPins:null};
 const config=JSON.parse(await readFile(await protectedPath(WORKTEST.config),'utf8')),{context}=validateSharedCopyBootstrap(config);
 if(context.target.database!==WORKTEST.database)throw fail('WORKTEST_DB_IDENTITY');
 await assertPrivateCartonDirectory();
 const manifestBytes=await readFile(await protectedPath(path.join(WORKTEST.dependencyRoot,'../../..','release-manifest.json')));
 if(createHash('sha256').update(manifestBytes).digest('hex')!=='b77180e5b366ea89ec613d253657108167118ffcdfdbbecc985f6bcc51047a21'||JSON.parse(manifestBytes).sourceCommit!=='a51b1170ade29494b3b446a44a8a62974eef687b')throw fail('WORKTEST_DEPENDENCY_PIN');
 const require=createRequire(await protectedPath(WORKTEST.dependencyRoot)),sql=require('mssql'),pool=await new sql.ConnectionPool({server:config.server,database:config.database,user:config.sqlUser,password:config.sqlPassword,pool:{max:2,min:0},connectionTimeout:8000,requestTimeout:8000,options:{encrypt:true,trustServerCertificate:true,appName:'MelisaTerminalWorktestReadonly'}}).connect();
 let homePool;
 try{
  const identity=await pool.request().input('copy',sql.UniqueIdentifier,context.copyId).query(CARTON_IDENTITY_SQL);
  if(identity.recordset.length!==1)throw fail('WORKTEST_DB_IDENTITY');assertSqlIdentity(identity.recordset[0],context);
  homePool=new sql.ConnectionPool({server:config.server,database:config.database,user:config.salesSqlUser,password:config.salesSqlPassword,pool:{max:2,min:0},connectionTimeout:8000,requestTimeout:20000,options:{encrypt:true,trustServerCertificate:true,appName:'MelisaTerminalWorktestHomeReadonly'}});await homePool.connect();
  const homeSummary=await initializeTerminalHomeReadonly({native:sql,pool:homePool,context,config});
  const store=createTerminalCartonFileStore({assertDirectory:assertPrivateCartonDirectory});
  const server=http.createServer(createWorktestHandler({context,bootstrap:publicSharedCopyScope(context),csp:sharedWebCspFor(context),store,withSource:createReadonlySourceLock({sql,pool,context}),homeSummary,...web}));
  server.requestTimeout=20000;server.headersTimeout=10000;server.maxConnections=16;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5264,'127.0.0.1',resolve);});return {server,pool,homePool};
 }catch(e){await Promise.allSettled([pool.close(),homePool?.close()]);throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){startTerminalWorktest().then(({server,pool,homePool})=>{console.log('TERMINAL_WORKTEST_READY_5264');for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>Promise.allSettled([pool.close(),homePool.close()]).finally(()=>process.exit(0))));}).catch(()=>{console.error('TERMINAL_WORKTEST_NOT_STARTED');process.exitCode=1;});}
