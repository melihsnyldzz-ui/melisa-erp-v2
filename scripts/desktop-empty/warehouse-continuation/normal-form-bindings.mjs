// Preparation-only pure compiler. Does not read files, create live proofs or invoke the consumer.
import {createHash} from 'node:crypto';
import {NORMAL_FORM_TARGET,NORMAL_FORM_KINDS,NORMAL_FORM_BROKER_SHA256,NORMAL_FORM_HOST_SHA256,normalFormDigest,assertWarehouseNormalFormEvidence} from './normal-form-contract.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function prepareWarehouseNormalFormManifest(moduleSha256){
 if(!moduleSha256||Object.values(moduleSha256).some(v=>!normalFormDigest(v)))throw Error('WAREHOUSE_NORMAL_FORM_PREPARATION_REJECTED');
 return {state:'WAREHOUSE_NORMAL_FORM_PREPARATION_ONLY',preparationOnly:true,ready:false,executionAuthorized:false,bindingGenerated:false,liveBindingProduced:false,requiresDocumentedTabIdBinding:true,invocationContract:'The documented readonly tab.id must match root expectedTabId and the network-off proof tabId before login and on each origin check. No browser discovery or page-supplied identity is used.',target:{...NORMAL_FORM_TARGET},moduleSha256:{...moduleSha256}};
}
export function compileWarehouseNormalFormBindings({nowMs,expiresAtMs,tabId,userRowVersion,moduleSha256,consumerFunctionSha256,sourceBytes}={}){
 const sources={},projections={},proofs={};
 for(const kind of NORMAL_FORM_KINDS){const bytes=sourceBytes?.[kind];if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>1024*1024)throw Error('WAREHOUSE_NORMAL_FORM_SOURCE_REQUIRED');sources[kind]=JSON.parse(bytes.toString('utf8'));const facts=kind==='execution-decision'?sources[kind].warehouseContinuationExecution:sources[kind];projections[kind]={state:'WAREHOUSE_NORMAL_FORM_PUBLIC_PROJECTION',kind,actualSourceFile:'normal-form-source-'+kind+'.json',actualSourceSha256:sha(bytes),facts};const projectionBytes=Buffer.from(JSON.stringify(projections[kind],null,2)+'\n');proofs[kind]={fileName:'normal-form-'+kind+'.json',sha256:sha(projectionBytes)};}
 const binding={state:'WAREHOUSE_CONTINUATION_NORMAL_FORM_LIVE_BINDINGS',preparationOnly:false,executionAuthorized:true,target:{...NORMAL_FORM_TARGET},origin:'http://127.0.0.1:5294/',createdAtMs:nowMs,expiresAtMs,tabId,userRowVersion,brokerSha256:NORMAL_FORM_BROKER_SHA256,hostSha256:NORMAL_FORM_HOST_SHA256,decisionSha256:projections['execution-decision'].actualSourceSha256,moduleSha256:{...moduleSha256},consumerFunctionSha256,proofs};
 assertWarehouseNormalFormEvidence(binding,projections,sources,nowMs);
 return {binding,projections,projectionBytes:Object.fromEntries(NORMAL_FORM_KINDS.map(k=>[k,Buffer.from(JSON.stringify(projections[k],null,2)+'\n')])),bindingBytes:Buffer.from(JSON.stringify(binding,null,2)+'\n')};
}
