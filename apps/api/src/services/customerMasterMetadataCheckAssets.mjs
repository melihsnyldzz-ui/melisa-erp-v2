import fs from 'node:fs';import {createHash} from 'node:crypto';
const assetPath='apps/api/client-assets/customer-master-metadata-check.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const unavailable=()=>{throw Error('CUSTOMER_METADATA_CHECK_ASSET_UNAVAILABLE');};
export const customerMasterMetadataCheckHtml='<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Melisa ERP · Kart bağlantısı kontrolü</title><style>body{margin:0;background:#f5f8f5;color:#19372d;font:16px system-ui}main{max-width:1000px;margin:32px auto;padding:24px;background:white;border:1px solid #d9e7df;border-radius:16px}button{min-height:48px;padding:10px 20px;border:0;border-radius:10px;background:#176347;color:white;font:inherit}button:disabled{opacity:.5}pre{overflow:auto;white-space:pre-wrap;word-break:break-word;padding:16px;background:#f3f7f4}h1{font-size:26px}</style><main id="customer-master-metadata-check"></main><script type="module" src="/api/customer-master-metadata-check/client.mjs"></script></html>';
export function validateCustomerMasterMetadataCheckAsset(manifest,bytes){
 const descriptor=manifest?.customerMasterMetadataOverlay,rows=manifest?.files?.filter(r=>r.path===assetPath);
 if(descriptor?.schemaVersion!=='melisa-c06-metadata-api-overlay.v1'||descriptor.kind!=='CUSTOMER_MASTER_METADATA_READ_ONLY'||!/^[a-f0-9]{40}$/.test(descriptor.sourceCommit??'')||descriptor.masterWriterEnabled!==false||descriptor.actualT1!==false||descriptor.externalOperations!==false||descriptor.clientAsset?.path!==assetPath||!/^[a-f0-9]{64}$/.test(descriptor.clientAsset?.sha256??'')||!Array.isArray(rows)||rows.length!==1||rows[0].sha256!==descriptor.clientAsset.sha256||!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>2*1024*1024||hash(bytes)!==descriptor.clientAsset.sha256)unavailable();
 return bytes.toString('utf8');
}
export function createCustomerMasterMetadataCheckAssets(release,{readAsset=()=>fs.readFileSync(new URL('../../client-assets/customer-master-metadata-check.js',import.meta.url))}={}){
 // Bind the already admitted startup manifest. Never trust a new disk manifest
 // supplied after startup to re-authorize changed JavaScript bytes.
 const manifest={customerMasterMetadataOverlay:structuredClone(release?.customerMasterMetadataOverlay),files:Array.isArray(release?.files)?structuredClone(release.files.filter(r=>r.path===assetPath)):[]};
 return ()=>({html:customerMasterMetadataCheckHtml,script:validateCustomerMasterMetadataCheckAsset(manifest,readAsset())});
}
