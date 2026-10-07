// Server-only activation. Public request JSON never chooses a TEST profile.
import {GOAL8_DAY_SQL_PROFILE_META} from './goal8DaySqlProof.mjs';
export const GOAL8_DAY_PROFILE_ID='ERP-GOAL8-20261007';
export const GOAL8_DAY_PROFILE=Object.freeze({id:GOAL8_DAY_PROFILE_ID,date:'2026-10-07',productIds:['301985','325503'],supplierId:'13370',customerId:'30598',currency:'TRY'});
const unavailable=()=>{throw Object.assign(new Error('Sentetik günlük işlem profili doğrulanamadı.'),{code:'GOAL8_PROFILE_UNAVAILABLE',statusCode:503});};
export function goal8DayEnabled(runtime){
 const enabled=runtime?.goal8DayProfile??(process.env.MELISA_GOAL8_SYNTHETIC_DAY==='true');
 if(enabled!==true&&enabled!==false)unavailable();
 if(enabled&&runtime===undefined)goal8DayRuntimeSeal();
 return enabled;
}
export function goal8SqlProfileInstalled(){const installed=process.env.MELISA_GOAL8_SQL_PROFILE_INSTALLED==='true';if(installed)goal8DayRuntimeSeal();return installed;}
export function goal8DayRuntimeSeal(){
 try{const seal=JSON.parse(process.env.MELISA_GOAL8_SYNTHETIC_DAY_SEAL??'');
 if(! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(seal.dayId??'')||! /^[A-F0-9]{64}$/.test(seal.definitionHash??'')||! /^[a-f0-9]{40}$/.test(seal.sourceCommit??'')||typeof seal.packageId!=='string'||!seal.packageId.startsWith('CANONICAL-TEST-')||GOAL8_DAY_SQL_PROFILE_META?.id!==GOAL8_DAY_PROFILE_ID||seal.dayId!==GOAL8_DAY_SQL_PROFILE_META.dayId||seal.definitionHash!==GOAL8_DAY_SQL_PROFILE_META.definitionHash)unavailable();return seal;
 }catch{unavailable();}
}
export function assertGoal8Profile(raw,expected){
 if(!expected){if(raw?.testProfile!==undefined)unavailable();return false;}
 const p=raw?.testProfile;
 if(p?.id!==GOAL8_DAY_PROFILE_ID||p.sealed!==true||p.synthetic!==true||p.productId!=='325503'||p.supplierId!=='13370'||p.customerId!=='30598'||p.currency!=='TRY'||typeof p.accountId!=='string'||! /^[1-9]\d*$/.test(p.accountId)||! /^[A-F0-9]{64}$/.test(p.definitionHash??'')||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.dayId??''))unavailable();
 if(process.env.MELISA_GOAL8_SYNTHETIC_DAY==='true'){const seal=goal8DayRuntimeSeal();if(p.definitionHash!==seal.definitionHash||p.dayId!==seal.dayId)unavailable();}
 return true;
}
export function goal8DayPayload(payload,enabled,profile){if(enabled&&profile?.id!==GOAL8_DAY_PROFILE_ID)unavailable();return enabled?{...payload,testProfile:GOAL8_DAY_PROFILE_ID,testDayId:profile.dayId}:payload;}
