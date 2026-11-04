import fs from 'node:fs';
import {webRuntimeFiles,webSha256} from '../../business-web-release.mjs';
import {buildSimpleWebPair} from '../../business-web-package.mjs';
export function simpleWebFixture(){
 const runtime=new Map(webRuntimeFiles.map(n=>[n,fs.readFileSync(new URL('../../../../'+n,import.meta.url))]));
 const make=slot=>{
  const bytes=new Map([...runtime].filter(([n])=>!n.endsWith('.ps1')));
  bytes.set('apps/sites-workflow/src/workflow/workTradeModel.mjs',fs.readFileSync(new URL('./workTradeModel.mjs',import.meta.url)));
  for(const[p,b]of [['index.html','index'],['ornek-akis.html',slot],['assets/'+slot+'.js','chunk-'+slot]])bytes.set('apps/sites-workflow/dist/'+p,Buffer.from(b));
  const manifestBytes=Buffer.from(JSON.stringify({sourceCommit:(slot==='next'?'2':'3').repeat(40),backendSourceCommit:'4'.repeat(40),backendPackageId:'SYNTHETIC-OFFLINE-API',backendManifestSha256:'5'.repeat(64),database:'MELISA_ERP_SIRKET_TEST_20260929_01',businessWorkfaceId:'ERP-5244-REALDATA-20261027',apiPort:4144,webPort:5244,actualT1:false,externalOperations:false,files:[...bytes].map(([path,b])=>({path,bytes:b.length,sha256:webSha256(b)}))}));
  return {bytes,manifestBytes,digest:webSha256(manifestBytes)};
 };
 const input={sourceCommit:'1'.repeat(40),runtime,candidate:make('next'),previous:make('old')};
 const pair=buildSimpleWebPair(input),release=pair.candidate.manifest;
 const settings={schema:'melisa-simple-web-settings.v1',releaseDigest:webSha256(pair.candidate.manifestBytes),nodeSha256:'6'.repeat(64),powerShellSha256:webSha256(Buffer.from('fixture-ps')),iisOrigin:'http://127.0.0.1:5254',tailPeers:['100.64.0.2'],maintenanceId:'SYNTHETIC-OFFLINE',runtimeStartAuthorized:true};
 const health={ok:true,environment:'CANONICAL_TEST',mode:'erp',port:4144,databaseName:release.backend.database,serverName:release.backend.server,loginName:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,databaseControl:0,liveDatabaseAccess:0,writes:true,sqlReadOnly:false,actualT1:false,externalOperations:false,automaticJobs:false,businessWorkfaceId:release.backend.workfaceId,normalSessionUserId:17,persistentNormalSession:true,businessSessionSignerDomain:'dedicated-business-key-v1',sourceCommit:release.backend.sourceCommit,packageId:release.backend.packageId};
 return {input,pair,release,settings,health};
}
