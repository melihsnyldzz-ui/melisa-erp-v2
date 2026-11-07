// Pure validation only. A valid fixture is not proof of a real database.
export const REHEARSAL_SERVER='Semih\\MELISAERP';
export const REHEARSAL_DATABASE='MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210';
const keys=['adminPid','adminProcessBirth','adminSid','database','databaseCreateTime','databaseGuid','databaseId','environmentId','server','sqlProcessBirth','sqlProcessId'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const excluded=new Set(['c67f5317-9c0d-4831-aadd-fadc379a95d1','eb2888c2-51cb-4570-a933-397cf7e62806','94a8324f-124a-49e4-ad70-be3232989f47','fa7492c4-a52e-4d49-806e-f99bbafdd656','07e987d9-e7d6-49a5-9339-53ac93205545']);
const fail=()=>{throw Error('K0210_IDENTITY_REJECTED');};
export function validateRehearsalIdentity(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||!keys.includes(k)||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')))fail();
 const {server,database,databaseId,databaseGuid,databaseCreateTime,environmentId,adminPid,adminProcessBirth,adminSid,sqlProcessId,sqlProcessBirth}=value;
 const utc=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6,7}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s.slice(0,23)+'Z';
 if(server!==REHEARSAL_SERVER||database!==REHEARSAL_DATABASE||!Number.isSafeInteger(databaseId)||databaseId<=7||
    typeof databaseGuid!=='string'||typeof environmentId!=='string'||!uuid.test(databaseGuid)||!uuid.test(environmentId)||excluded.has(databaseGuid)||excluded.has(environmentId)||databaseGuid===environmentId||
    !Number.isSafeInteger(adminPid)||adminPid<1||!Number.isSafeInteger(sqlProcessId)||sqlProcessId<1||adminPid===sqlProcessId||!utc(adminProcessBirth)||!utc(sqlProcessBirth)||
    typeof adminSid!=='string'||!/^0x(?:[0-9A-F]{2}){8,85}$/.test(adminSid)||
    typeof databaseCreateTime!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/.test(databaseCreateTime)||
    !Number.isFinite(Date.parse(databaseCreateTime+'Z'))||new Date(databaseCreateTime+'Z').toISOString()!==databaseCreateTime+'Z')fail();
 return Object.freeze({...value});
}
