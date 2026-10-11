import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertIsolatedCopyContext,copyAssert,isolatedCopyJSON,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';

const keys=['schemaVersion','copyId','sealHash','base','performance','effects','daily','profit','nativeCheck','schema','selectedRevision'];
const exact=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===names.toSorted().join();
const runtimeRoot='C:\\Sirket\\ERP\\runtime\\';
// The optional startup input belongs to the operator's private runtime. It is
// neither an HTTP selection nor an environment switch. Native proof and
// canonical SQL regeneration still have to succeed before it can be registered.
export function validateBusinessSelectedSaleStartupPin(config,copy){
 assertIsolatedCopyContext(copy);
 const pin=config.businessSelectedSaleStartup;
 if(pin===undefined)return null;
 copyAssert(copy.target.database===BUSINESS_COPY_DATABASE&&config.businessDailyRevision&&config.businessDailyProfitRevision&&config.businessReadinessQueryPlanRevision===undefined,'SELECTED_STARTUP_TOPOLOGY');
 copyAssert(exact(pin,['path','sha256','revisionHash'])&&typeof pin.path==='string'&&path.win32.isAbsolute(pin.path)&&/^[A-Fa-f0-9]{64}$/.test(pin.sha256??'')&&/^[A-F0-9]{64}$/.test(pin.revisionHash??''),'SELECTED_STARTUP_PIN');
 const resolved=path.win32.resolve(pin.path);
 copyAssert(resolved.toLowerCase().startsWith(runtimeRoot.toLowerCase())&&path.win32.extname(resolved).toLowerCase()==='.json'&&!pin.path.split(/[\\/]/).includes('..'),'SELECTED_STARTUP_PRIVATE_PATH');
 return Object.freeze({...pin,path:resolved});
}
export function loadBusinessSelectedSaleStartup(config,copy,{readFile=fs.readFileSync}={}){
 const pin=validateBusinessSelectedSaleStartupPin(config,copy);
 if(!pin)return null;
 const bytes=readFile(pin.path);
 copyAssert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=16*1024*1024&&createHash('sha256').update(bytes).digest('hex').toLowerCase()===pin.sha256.toLowerCase(),'SELECTED_STARTUP_BYTES');
 let input;try{input=JSON.parse(bytes.toString('utf8'));}catch{copyAssert(false,'SELECTED_STARTUP_JSON');}
 copyAssert(exact(input,keys)&&input.schemaVersion==='melisa-selected-sale-startup-input.v1'&&input.copyId===copy.copyId&&input.sealHash===copy.sealHash&&input.selectedRevision?.revisionHash===pin.revisionHash&&Array.isArray(input.schema)&&input.schema.length>0,'SELECTED_STARTUP_INPUT');
 for(const [field,configured] of [['base',config.businessReadyRevision],['performance',config.businessReadyPerformanceRevision],['effects',config.businessEffectsPerformanceRevision],['daily',config.businessDailyRevision],['profit',config.businessDailyProfitRevision],['nativeCheck',config.businessDailyNativeCheck]]){
  const value=['daily','profit'].includes(field)?input[field]?.revision:input[field];
  copyAssert(isolatedCopyJSON(value)===isolatedCopyJSON(configured??null),'SELECTED_STARTUP_HISTORY');
 }
 return input;
}
