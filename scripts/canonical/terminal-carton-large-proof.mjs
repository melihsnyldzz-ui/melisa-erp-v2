import {createServer} from 'node:http';
import path from 'node:path';
import {terminalCartonSource} from '../../apps/api/src/services/terminalCartonSource.mjs';
import {createTerminalCartonService} from '../../apps/api/src/services/terminalCartonService.mjs';
import {createTerminalCartonFileStore,CARTON_DB02_DIRECTORY} from '../../apps/api/src/services/terminalCartonStore.mjs';

export const LARGE_PROOF_ID='8200200';
export const LARGE_PROOF_LABEL='Toplama provası · 200 ürün';
const fail=(code,statusCode=403)=>Object.assign(new Error('Toplama provası doğrulanamadı.'),{code,statusCode});
const proof=Object.freeze({synthetic:true,commercialEffects:false,label:LARGE_PROOF_LABEL});
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
const invoice=deepFreeze({id:LARGE_PROOF_ID,status:'finalized',documentNo:LARGE_PROOF_LABEL,customerName:'Sentetik toplama provası',items:Array.from({length:200},(_,n)=>({itemId:String(8200001+n),productId:String(8300001+n),stockCode:`${String(n+1).padStart(4,'0')} PROVA`,name:`Prova ürünü ${n+1}`,quantityExact3:'24.000',unit:{label:'ADET',factorExact8:'1.00000000',verified:true},barcodes:[`000${String(n+1).padStart(7,'0')}`]}))});
export function largeCartonProofSource(){return terminalCartonSource(invoice);}
function normalActor(actor){if(!actor||! /^[1-9]\d{0,18}$/.test(String(actor.id))||actor.isAdmin===true||actor.role?.code==='admin'||actor.active===false||actor.isActive===false||!actor.permissions?.includes('sales.view'))throw fail('PROOF_ACTOR');return actor;}
const staticPaths=new Set(['/proof','/proof/','/proof/client.js','/proof/client.css']);
async function inputBody(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2097152)throw fail('PROOF_BODY',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('PROOF_BODY',400);}}
// Explicit QA injection only. No listener, SQL dependency or production reader is created here.
export function createLargeCartonProofHandler({verifyActor,journalDirectory,assertDirectory,evidenceRoot='C:\\Sirket\\ERP\\evidence',staticAssets={}}={}){
 if(typeof verifyActor!=='function'||typeof assertDirectory!=='function'||typeof journalDirectory!=='string')throw fail('PROOF_CONFIG',503);
 const directory=path.resolve(journalDirectory),root=path.resolve(evidenceRoot),relative=path.relative(root,directory);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||directory.toLowerCase()===path.resolve(CARTON_DB02_DIRECTORY).toLowerCase())throw fail('PROOF_DIRECTORY',503);
 const assets=new Map();for(const [url,asset] of Object.entries(staticAssets)){if(!staticPaths.has(url)||!asset||!(typeof asset.content==='string'||Buffer.isBuffer(asset.content))||!['text/html; charset=utf-8','text/javascript; charset=utf-8','text/css; charset=utf-8'].includes(asset.contentType))throw fail('PROOF_STATIC',503);assets.set(url,{content:Buffer.from(asset.content),contentType:asset.contentType});}
 const store=createTerminalCartonFileStore({directory,assertDirectory,filesystemRootForOfflineTests:true});
 const service=createTerminalCartonService({store,assertContext:async actor=>normalActor(actor),readSource:async id=>{if(id!==LARGE_PROOF_ID)throw fail('PROOF_SOURCE',404);return invoice;}});
 return async(req,res)=>{const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');try{
  const actor=normalActor(await verifyActor(req.headers));
  if(assets.has(req.url)){if(req.method!=='GET')throw fail('PROOF_METHOD',405);const asset=assets.get(req.url);res.writeHead(200,{'content-type':asset.contentType});return res.end(asset.content);}
  if(req.url==='/proof/receipts'){if(req.method!=='GET')throw fail('PROOF_METHOD',405);return send(200,{success:true,data:{proof,receipts:[await service.context(LARGE_PROOF_ID,actor)]}});}
  const match=/^\/proof\/receipts\/([1-9]\d{0,18})(\/context)?$/.exec(req.url??'');
  if(!match)throw fail('PROOF_ROUTE',404);if(!['GET','POST'].includes(req.method)||match[2]&&req.method!=='GET')throw fail('PROOF_METHOD',405);
  const data=match[2]?{source:await service.context(match[1],actor)}:req.method==='POST'?await service.save(match[1],await inputBody(req),actor):await service.load(match[1],actor);
  return send(200,{success:true,data:{proof,...data}});
 }catch(error){return send([400,401,403,404,405,409,413,503].includes(error.statusCode)?error.statusCode:503,{success:false,error:{code:/^[A-Z_]+$/.test(error.code??'')?error.code:'PROOF_UNAVAILABLE',message:'Toplama provası doğrulanamadı.'}});}};
}
export function createLargeCartonProofServer(options){return createServer(createLargeCartonProofHandler(options));}
