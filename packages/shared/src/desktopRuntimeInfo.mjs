import {DESKTOP_EMPTY_V7_PROFILE_ID,DESKTOP_EMPTY_V7_TARGET} from './desktopEmptyProfile.mjs';
// Public installation identity only. Never extend this with credentials/paths.
const keys=['environment','profile','packageSha256','createdAt','server','database','schemaVersion','webOrigin','localOnly'];
export function isDesktopRuntimeInfo(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 const field=Object.getOwnPropertyDescriptor(v,'targetProfile');if(field&&(!field.enumerable||!Object.hasOwn(field,'value')))return false;
 if(Reflect.ownKeys(v).length!==keys.length+(field?.value===DESKTOP_EMPTY_V7_PROFILE_ID?1:0)||!keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');}))return false;
 return v.environment==='LOCAL_TEST'&&((v.profile==='desktop-master-v3'&&v.schemaVersion===3)||(v.profile==='desktop-master-v4'&&v.schemaVersion===4)||(v.profile==='desktop-master-v5'&&v.schemaVersion===5)||(v.profile==='desktop-master-v6'&&v.schemaVersion===6)||(v.profile==='desktop-master-v7'&&v.schemaVersion===7))&&typeof v.packageSha256==='string'&&/^[0-9a-f]{64}$/.test(v.packageSha256)&&typeof v.createdAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.createdAt)&&Number.isFinite(Date.parse(v.createdAt))&&new Date(v.createdAt).toISOString()===v.createdAt&&v.server==='Semih\\MELISAERP'&&((v.targetProfile===undefined&&v.database==='MELISA_ERP_DESKTOP_TEST_20261105')||(v.targetProfile===DESKTOP_EMPTY_V7_PROFILE_ID&&v.profile==='desktop-master-v7'&&v.schemaVersion===7&&v.database===DESKTOP_EMPTY_V7_TARGET.database))&&v.webOrigin==='http://127.0.0.1:5294'&&v.localOnly===true;
}
export function desktopRuntimeInfo({packageSha256,createdAt,schemaVersion=3,targetProfile=null}={}){
 if(targetProfile!==null&&targetProfile!==DESKTOP_EMPTY_V7_PROFILE_ID)throw Error('DESKTOP_RUNTIME_INFO_INVALID');
 const v={environment:'LOCAL_TEST',profile:schemaVersion===7?'desktop-master-v7':schemaVersion===6?'desktop-master-v6':schemaVersion===5?'desktop-master-v5':schemaVersion===4?'desktop-master-v4':'desktop-master-v3',packageSha256,createdAt,server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',schemaVersion,webOrigin:'http://127.0.0.1:5294',localOnly:true};
 if(targetProfile){v.targetProfile=targetProfile;v.database=DESKTOP_EMPTY_V7_TARGET.database;}
 if(!isDesktopRuntimeInfo(v))throw Error('DESKTOP_RUNTIME_INFO_INVALID');return Object.freeze(v);
}
