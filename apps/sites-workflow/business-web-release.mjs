import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {businessWorkfaceId} from './src/workflow/businessWorkface.mjs';
import {businessSessionCookie} from './business-preview-session.mjs';
import {cleanPreviewTailPeers} from './business-preview-boundary.mjs';

export const webReleaseSchema='melisa-simple-web-release.v1';
export const webAssetLimit=4*1024*1024;
export const webReleaseLimit=32*1024*1024;
export const webRuntimeFiles=Object.freeze([
 'apps/sites-workflow/business-web-gateway.mjs',
 'apps/sites-workflow/business-web-release.mjs',
 'apps/sites-workflow/business-preview-boundary.mjs',
 'apps/sites-workflow/business-preview-session.mjs',
 'apps/sites-workflow/src/workflow/businessWorkface.mjs',
 'apps/api/src/services/canonicalBusinessSaleReadModel.mjs',
 'apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs',
 'apps/sites-workflow/business-web-backend-proof.ps1',
]);
export const webSha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hex=(s,n)=>typeof s==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(s);
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');
const need=(ok,code)=>{if(!ok)throw Error(code);};
export function publicAssetPath(p){return typeof p==='string'&&/^[A-Za-z0-9_./-]+$/.test(p)&&!p.startsWith('/')&&!p.includes('//')&&p.split('/').every(s=>s!=='.'&&s!=='..'&&s)&&/\.(?:html|m?js|css|svg|png|jpg|jpeg|webp|ico|woff2?|ttf)$/.test(p);}
export function journalCreatorBytes(source){
 // Closed transitive helper set for createTradeJournal, including the optional
 // invoice witness. Unrelated preview/recovery UI additions are not this wire contract.
 const lines=source.toString('utf8').split(/\r?\n/),prefixes=['const bad=','export const tradeId=','export const tradeRevision=','const object=','const keys=','const canonicalId=','const canonicalUuid=','const canonicalWitness=','export function createTradeJournal('];
 const rows=prefixes.map(prefix=>{const found=lines.filter(s=>s.startsWith(prefix));need(found.length===1,'WEB_JOURNAL_SOURCE');return found[0];});
 need(rows.at(-1).endsWith('}'),'WEB_JOURNAL_SOURCE');return Buffer.from(rows.join('\n')+'\n');
}
export function validateWebRelease(m){
 need(keys(m,['schema','releaseId','sourceCommit','uiSource','backend','protocol','files','activation']),'WEB_RELEASE_SHAPE');
 need(m.schema===webReleaseSchema&&typeof m.releaseId==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(m.releaseId)&&hex(m.sourceCommit,40),'WEB_RELEASE_IDENTITY');
 need(keys(m.uiSource,['sourceCommit','manifestSha256','retainedSourceCommit','retainedManifestSha256','journalSourceSha256','retainedJournalSourceSha256'])&&hex(m.uiSource.sourceCommit,40)&&hex(m.uiSource.manifestSha256,64)&&hex(m.uiSource.retainedSourceCommit,40)&&hex(m.uiSource.retainedManifestSha256,64)&&hex(m.uiSource.journalSourceSha256,64)&&hex(m.uiSource.retainedJournalSourceSha256,64),'WEB_UI_SOURCE');
 const b=m.backend;
 need(keys(b,['origin','sourceCommit','packageId','manifestSha256','server','database','workfaceId','actorId','roleId','signerDomain'])&&b.origin==='http://127.0.0.1:4144'&&hex(b.sourceCommit,40)&&hex(b.manifestSha256,64)&&typeof b.packageId==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(b.packageId)&&b.server==='Semih\\MELISADEV'&&b.database==='MELISA_ERP_SIRKET_TEST_20260929_01'&&b.workfaceId===businessWorkfaceId&&b.actorId===17&&b.roleId===17&&b.signerDomain==='dedicated-business-key-v1','WEB_BACKEND_SCOPE');
 const p=m.protocol;
 need(keys(p,['version','workfaceId','browserPort','cookieName','cookiePath','journalKey','transportSha256','workfaceSha256','saleReadSha256','partyReadSha256','journalCreatorSha256'])&&p.version===1&&p.workfaceId===businessWorkfaceId&&p.browserPort===5244&&p.cookieName===businessSessionCookie&&p.cookiePath==='/api/auth'&&p.journalKey==='melisa-work-sale-v1:${host}:${actorId}'&&['transportSha256','workfaceSha256','saleReadSha256','partyReadSha256','journalCreatorSha256'].every(k=>hex(p[k],64)),'WEB_PROTOCOL_SCOPE');
 need(keys(m.activation,['installed','runtimeVerified','executionAuthority','actualT1','externalOperations'])&&Object.values(m.activation).every(v=>v===false),'WEB_PASSIVE_FLAGS');
 need(Array.isArray(m.files)&&m.files.length>=webRuntimeFiles.length+2&&m.files.length<=1024,'WEB_RELEASE_FILES');
 const seen=new Set();let total=0;
 for(const f of m.files){
  need(keys(f,['path','sha256','bytes'])&&typeof f.path==='string'&&hex(f.sha256,64)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=webAssetLimit,'WEB_RELEASE_FILE');
  need(!seen.has(f.path.toLowerCase())&&(f.path.startsWith('ui/')?f.path==='ui/web.config'||publicAssetPath(f.path.slice(3)):['protocol/selected-work-trade.mjs','protocol/retained-work-trade.mjs'].includes(f.path)||webRuntimeFiles.some(n=>f.path==='runtime/'+n)),'WEB_RELEASE_FILE_SCOPE');seen.add(f.path.toLowerCase());total+=f.bytes;
 }
 need(total<=webReleaseLimit&&m.files.some(f=>f.path==='ui/ornek-akis.html')&&m.files.some(f=>f.path==='ui/index.html')&&m.files.some(f=>f.path==='ui/web.config')&&webRuntimeFiles.every(n=>m.files.filter(f=>f.path==='runtime/'+n).length===1)&&m.files.find(f=>f.path==='protocol/selected-work-trade.mjs')?.sha256===m.uiSource.journalSourceSha256&&m.files.find(f=>f.path==='protocol/retained-work-trade.mjs')?.sha256===m.uiSource.retainedJournalSourceSha256,'WEB_RELEASE_CLOSURE');
 for(const [key,name]of [['transportSha256','business-preview-session.mjs'],['workfaceSha256','src/workflow/businessWorkface.mjs'],['saleReadSha256','../api/src/services/canonicalBusinessSaleReadModel.mjs'],['partyReadSha256','../api/src/services/canonicalBusinessPartyHistoryModel.mjs']]){
  const relative=name.startsWith('../')?'runtime/apps/'+name.slice(3):'runtime/apps/sites-workflow/'+name;
  need(m.files.find(f=>f.path===relative)?.sha256===p[key],'WEB_PROTOCOL_BYTES');
 }
 return m;
}
export function assertWebRollbackCompatible(current,previous){
 validateWebRelease(current);validateWebRelease(previous);
 need(JSON.stringify(current.backend)===JSON.stringify(previous.backend)&&JSON.stringify(current.protocol)===JSON.stringify(previous.protocol),'WEB_ROLLBACK_PAIR_INCOMPATIBLE');
 return true;
}
export function assertPlainWebPath(target){
 let p=path.resolve(target);for(;;){need(!fs.lstatSync(p).isSymbolicLink(),'WEB_RELEASE_REPARSE');const parent=path.dirname(p);if(parent===p)break;p=parent;}
 return path.resolve(target);
}
export function loadWebRelease(manifestPath,digest){
 need(hex(digest,64),'WEB_RELEASE_DIGEST');assertPlainWebPath(manifestPath);
 const bytes=fs.readFileSync(manifestPath);need(webSha256(bytes)===digest,'WEB_RELEASE_DIGEST');
 const manifest=validateWebRelease(JSON.parse(bytes)),root=path.dirname(path.resolve(manifestPath));
 for(const f of manifest.files){const full=path.resolve(root,f.path);need(full.startsWith(root+path.sep),'WEB_RELEASE_PATH');assertPlainWebPath(full);const s=fs.statSync(full),bytes=fs.readFileSync(full);need(s.isFile()&&s.nlink===1&&s.size===f.bytes&&webSha256(bytes)===f.sha256,'WEB_RELEASE_BYTES');if(f.path.startsWith('protocol/'))need(webSha256(journalCreatorBytes(bytes))===manifest.protocol.journalCreatorSha256,'WEB_JOURNAL_BYTES');}
 return {manifest,root,digest};
}
export function validateWebSettings(s,digest){
 need(keys(s,['schema','releaseDigest','nodeSha256','powerShellSha256','iisOrigin','tailPeers','maintenanceId','runtimeStartAuthorized'])&&s.schema==='melisa-simple-web-settings.v1'&&s.releaseDigest===digest&&hex(s.nodeSha256,64)&&hex(s.powerShellSha256,64)&&typeof s.maintenanceId==='string'&&/^[A-Za-z0-9-]{8,120}$/.test(s.maintenanceId)&&s.runtimeStartAuthorized===true,'WEB_START_NOT_AUTHORIZED');
 let u;try{u=new URL(s.iisOrigin);}catch{}
 need(u&&u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port&&Number(u.port)>=1024&&![1433,4144,4146,5194,5244].includes(Number(u.port))&&u.origin===s.iisOrigin,'WEB_IIS_LOOPBACK_SCOPE');
 need(Array.isArray(s.tailPeers)&&s.tailPeers.length>0,'WEB_PEERS_REQUIRED');cleanPreviewTailPeers(s.tailPeers.join(','));return s;
}
