// Public installation identity only. Never extend this with credentials/paths.
const keys=['environment','profile','packageSha256','createdAt','server','database','schemaVersion','webOrigin','localOnly'];
export function isDesktopRuntimeInfo(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||!keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');}))return false;
 return v.environment==='LOCAL_TEST'&&((v.profile==='desktop-master-v3'&&v.schemaVersion===3)||(v.profile==='desktop-master-v4'&&v.schemaVersion===4)||(v.profile==='desktop-master-v5'&&v.schemaVersion===5))&&typeof v.packageSha256==='string'&&/^[0-9a-f]{64}$/.test(v.packageSha256)&&typeof v.createdAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.createdAt)&&Number.isFinite(Date.parse(v.createdAt))&&new Date(v.createdAt).toISOString()===v.createdAt&&v.server==='Semih\\MELISAERP'&&v.database==='MELISA_ERP_DESKTOP_TEST_20261105'&&v.webOrigin==='http://127.0.0.1:5294'&&v.localOnly===true;
}
export function desktopRuntimeInfo({packageSha256,createdAt,schemaVersion=3}={}){
 const v={environment:'LOCAL_TEST',profile:schemaVersion===5?'desktop-master-v5':schemaVersion===4?'desktop-master-v4':'desktop-master-v3',packageSha256,createdAt,server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',schemaVersion,webOrigin:'http://127.0.0.1:5294',localOnly:true};
 if(!isDesktopRuntimeInfo(v))throw Error('DESKTOP_RUNTIME_INFO_INVALID');return Object.freeze(v);
}
