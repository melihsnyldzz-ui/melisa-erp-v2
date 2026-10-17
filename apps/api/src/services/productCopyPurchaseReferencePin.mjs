import {createHash} from 'node:crypto';
import {assertIsolatedCopyContext,copyAssert,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';

// Pure startup validation. The native purchase readers keep their runtime and
// SQL dependencies outside the terminal feature's finite source graph.
const HEX=/^[a-f0-9]{64}$/;
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.toSorted().join(',');
const digest=value=>createHash('sha256').update(value).digest('hex');
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&!Number.isNaN(Date.parse(value));
const pinnedRun=(value,selectedRun=false)=>sameKeys(value,selectedRun?['runId','manifestHash','rowCount','rowsHash','sourceHash','sourceAsOf','parentRunId','parentManifestHash','parentRowsHash']:['runId','manifestHash','rowCount','rowsHash','sourceHash','sourceAsOf'])&&typeof value.runId==='string'&&value.runId.length>0&&value.runId.length<=80&&Number.isSafeInteger(value.rowCount)&&value.rowCount>0&&['manifestHash','rowsHash','sourceHash',...(selectedRun?['parentManifestHash','parentRowsHash']:[])].every(k=>HEX.test(value[k]))&&date(value.sourceAsOf)&&(!selectedRun||typeof value.parentRunId==='string'&&value.parentRunId.length>0);

export function validateProductCopyPurchaseReferencePin(copy,pin){
 assertIsolatedCopyContext(copy);
 copyAssert(copy.target.database===BUSINESS_COPY_DATABASE&&sameKeys(pin,['schemaVersion','copyId','copySealHash','server','database','parent','selected','descriptorHash'])&&pin.schemaVersion==='melisa-copy-purchase-reference-read.v1'&&pin.copyId===copy.copyId&&pin.copySealHash===copy.sealHash&&pin.server===copy.target.server&&pin.database===copy.target.database&&pinnedRun(pin.parent)&&pinnedRun(pin.selected,true)&&pin.selected.parentRunId===pin.parent.runId&&pin.selected.parentManifestHash===pin.parent.manifestHash&&pin.selected.parentRowsHash===pin.parent.rowsHash&&pin.parent.rowCount===16668&&pin.selected.rowCount===16667,'COPY_PURCHASE_REFERENCE_PIN');
 const {descriptorHash,...body}=pin;
 copyAssert(HEX.test(descriptorHash)&&digest(JSON.stringify(body))===descriptorHash,'COPY_PURCHASE_REFERENCE_PIN_HASH');
 return Object.freeze({...pin,parent:Object.freeze({...pin.parent}),selected:Object.freeze({...pin.selected})});
}
