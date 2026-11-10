import {DESKTOP_EMPTY_V7_PROFILE_ID,DESKTOP_EMPTY_V7_TARGET} from '../../../../packages/shared/src/desktopEmptyProfile.mjs';
// Server-issued normal-session identity only; no query/config profile selector.
// Never enumerate, migrate, relabel or delete another installation's data.
export function desktopTargetStorage(storage,locks,installation){
 if(installation===undefined)return {storage,locks,namespace:''};
 const expected={targetProfile:DESKTOP_EMPTY_V7_PROFILE_ID,environmentId:DESKTOP_EMPTY_V7_TARGET.environmentId,databaseGuid:DESKTOP_EMPTY_V7_TARGET.databaseGuid};
 if(!installation||Array.isArray(installation)||Reflect.ownKeys(installation).length!==3||Object.entries(expected).some(([k,v])=>{const d=Object.getOwnPropertyDescriptor(installation,k);return !d?.enumerable||!Object.hasOwn(d,'value')||d.value!==v;}))throw Error('DESKTOP_TARGET_STORAGE_REJECTED');
 const namespace='melisa.profile.'+expected.targetProfile+'.'+expected.environmentId+'.'+expected.databaseGuid+':';
 return {namespace,storage:Object.freeze({getItem:k=>storage.getItem(namespace+k),setItem:(k,v)=>storage.setItem(namespace+k,v),removeItem:k=>storage.removeItem(namespace+k)}),locks:Object.freeze({request:(name,options,fn)=>locks.request(namespace+name,options,fn)})};
}
