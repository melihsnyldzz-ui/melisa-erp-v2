import {webSha256,webRuntimeFiles,publicAssetPath,journalCreatorBytes,validateWebRelease,assertWebRollbackCompatible} from './business-web-release.mjs';
import {businessWorkfaceId} from './src/workflow/businessWorkface.mjs';

const need=(value,code)=>{if(!value)throw Error(code);};
export const simpleWebIisConfig=Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<configuration><system.webServer>
 <directoryBrowse enabled="false" />
 <urlCompression doStaticCompression="false" doDynamicCompression="false" />
 <staticContent><remove fileExtension=".js" /><mimeMap fileExtension=".js" mimeType="text/javascript" /><remove fileExtension=".mjs" /><mimeMap fileExtension=".mjs" mimeType="text/javascript" /></staticContent>
 <httpProtocol><customHeaders><add name="X-Content-Type-Options" value="nosniff" /></customHeaders></httpProtocol>
</system.webServer></configuration>
`);
// Pure producer: supplied bytes only. No process, socket, task, SQL or IIS API.
export function buildSimpleWebPair({sourceCommit,runtime,candidate,previous}){
 need(/^[a-f0-9]{40}$/.test(sourceCommit)&&runtime instanceof Map&&runtime.size===webRuntimeFiles.length,'WEB_PACKAGE_SOURCE');
 for(const name of webRuntimeFiles)need(Buffer.isBuffer(runtime.get(name))&&runtime.get(name).length>0,'WEB_PACKAGE_RUNTIME');
 function verify(input){
  need(Buffer.isBuffer(input.manifestBytes)&&webSha256(input.manifestBytes)===input.digest&&input.bytes instanceof Map,'WEB_PACKAGE_UI_MANIFEST');
  const manifest=JSON.parse(input.manifestBytes);
  need(/^[a-f0-9]{40}$/.test(manifest.sourceCommit)&&Array.isArray(manifest.files),'WEB_PACKAGE_UI_SCOPE');
  const selected=new Map();
  for(const f of manifest.files){
   const asset=f.path.startsWith('apps/sites-workflow/dist/')?f.path.slice('apps/sites-workflow/dist/'.length):null;
   const proof=['apps/sites-workflow/business-preview-session.mjs','apps/sites-workflow/src/workflow/businessWorkface.mjs','apps/sites-workflow/src/workflow/workTradeModel.mjs','apps/api/src/services/canonicalBusinessSaleReadModel.mjs','apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs'].includes(f.path);
   if(!asset&&!proof)continue;
   need(!selected.has(f.path)&&(!asset||publicAssetPath(asset)),'WEB_PACKAGE_UI_PATH');
   const bytes=input.bytes.get(f.path);need(Buffer.isBuffer(bytes)&&bytes.length===f.bytes&&webSha256(bytes)===f.sha256,'WEB_PACKAGE_UI_BYTES');selected.set(f.path,bytes);
  }
  for(const name of ['apps/sites-workflow/business-preview-session.mjs','apps/sites-workflow/src/workflow/businessWorkface.mjs','apps/api/src/services/canonicalBusinessSaleReadModel.mjs','apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs'])need(selected.get(name)?.equals(runtime.get(name)),'WEB_PACKAGE_PROTOCOL_DRIFT');
  const journal=selected.get('apps/sites-workflow/src/workflow/workTradeModel.mjs');need(journal,'WEB_PACKAGE_JOURNAL_MISSING');
  return {...input,manifest,selected,journal,journalHash:webSha256(journalCreatorBytes(journal))};
 }
 const next=verify(candidate),old=verify(previous);need(next.journalHash===old.journalHash,'WEB_PACKAGE_JOURNAL_DRIFT');
 const shared=['backendSourceCommit','backendPackageId','backendManifestSha256','database','businessWorkfaceId','apiPort','webPort'];
 need(shared.every(k=>next.manifest[k]===old.manifest[k])&&next.manifest.database==='MELISA_ERP_SIRKET_TEST_20260929_01'&&next.manifest.businessWorkfaceId===businessWorkfaceId&&next.manifest.apiPort===4144&&next.manifest.webPort===5244&&next.manifest.actualT1===false&&old.manifest.actualT1===false&&next.manifest.externalOperations===false&&old.manifest.externalOperations===false,'WEB_PACKAGE_BACKEND_DRIFT');
 const backend={origin:'http://127.0.0.1:4144',sourceCommit:next.manifest.backendSourceCommit,packageId:next.manifest.backendPackageId,manifestSha256:next.manifest.backendManifestSha256,server:'Semih\\MELISADEV',database:next.manifest.database,workfaceId:businessWorkfaceId,actorId:17,roleId:17,signerDomain:'dedicated-business-key-v1'};
 const protocol={version:1,workfaceId:businessWorkfaceId,browserPort:5244,cookieName:'melisa_erp_business_5244',cookiePath:'/api/auth',journalKey:'melisa-work-sale-v1:${host}:${actorId}',transportSha256:webSha256(runtime.get('apps/sites-workflow/business-preview-session.mjs')),workfaceSha256:webSha256(runtime.get('apps/sites-workflow/src/workflow/businessWorkface.mjs')),saleReadSha256:webSha256(runtime.get('apps/api/src/services/canonicalBusinessSaleReadModel.mjs')),partyReadSha256:webSha256(runtime.get('apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs')),journalCreatorSha256:next.journalHash};
 function release(selected,retained,slot){
  const files=new Map([...runtime].map(([p,b])=>['runtime/'+p,b]));files.set('ui/web.config',simpleWebIisConfig);
  for(const [p,b]of selected.selected)if(p.startsWith('apps/sites-workflow/dist/'))files.set('ui/'+p.slice('apps/sites-workflow/dist/'.length),b);
  // Retain old/new hashed chunks for already open tabs, but never old HTML.
  for(const input of [selected,retained])for(const[p,b]of input.selected)if(p.startsWith('apps/sites-workflow/dist/assets/')){const output='ui/'+p.slice('apps/sites-workflow/dist/'.length);need(!files.has(output)||files.get(output).equals(b),'WEB_PACKAGE_ASSET_COLLISION');files.set(output,b);}
  files.set('protocol/selected-work-trade.mjs',selected.journal);files.set('protocol/retained-work-trade.mjs',retained.journal);
  const manifest=validateWebRelease({schema:'melisa-simple-web-release.v1',releaseId:'WEB-SIMPLE-'+sourceCommit.slice(0,12)+'-'+slot,sourceCommit,uiSource:{sourceCommit:selected.manifest.sourceCommit,manifestSha256:selected.digest,retainedSourceCommit:retained.manifest.sourceCommit,retainedManifestSha256:retained.digest,journalSourceSha256:webSha256(selected.journal),retainedJournalSourceSha256:webSha256(retained.journal)},backend,protocol,files:[...files].sort(([a],[b])=>a.localeCompare(b,'en')).map(([p,b])=>({path:p,bytes:b.length,sha256:webSha256(b)})),activation:{installed:false,runtimeVerified:false,executionAuthority:false,actualT1:false,externalOperations:false}});
  return {manifest,files,manifestBytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n')};
 }
 const result={candidate:release(next,old,'CANDIDATE'),rollback:release(old,next,'ROLLBACK')};assertWebRollbackCompatible(result.candidate.manifest,result.rollback.manifest);return result;
}
