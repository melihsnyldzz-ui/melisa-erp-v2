import crypto from 'node:crypto';
const fail=code=>{throw Error('P03_INVARIANCE_'+code);};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
}
export function p03CriticalContentDigest(snapshot){
 if(!snapshot||!Array.isArray(snapshot.tables)||snapshot.tables.length!==51||['modules','permissions','memberships','principals'].some(key=>!Array.isArray(snapshot[key])))fail('COVERAGE');
 const tables=[...snapshot.tables].sort((a,b)=>a.table.localeCompare(b.table,'en'));
 if(new Set(tables.map(x=>x.table)).size!==51||tables.some(x=>! /^(dbo|erp_migration)\.[a-zA-Z0-9_]+$/.test(x.table)||!Number.isSafeInteger(x.count)||x.count<0||!/^[a-f0-9]{64}$/.test(x.sha256)))fail('TABLES');
 const sort=rows=>rows.map(canonical).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);
 const payload={tables,...Object.fromEntries(['modules','permissions','memberships','principals'].map(key=>[key,sort(snapshot[key])]))};
 return {sha256:digest(JSON.stringify(canonical(payload))),tables:51,rows:tables.reduce((n,x)=>n+x.count,0),modules:payload.modules.length,permissions:payload.permissions.length,memberships:payload.memberships.length,principals:payload.principals.length,coverage:'51 critical tables, SQL modules, permissions, role memberships and principals; not all database content'};
}
export function compareP03CriticalContent(pre,post){
 if(pre?.database!=='MELISA_ERP_P03_PR54_PRE_20261018'||post?.database!=='MELISA_ERP_P03_PR54_POST_20261018')fail('CLONE_SCOPE');
 const before=p03CriticalContentDigest(pre),after=p03CriticalContentDigest(post);
 return {pass:before.sha256===after.sha256,before,after,currentDatabaseEqualityClaimed:false,commercialWritesPerformed:false};
}
