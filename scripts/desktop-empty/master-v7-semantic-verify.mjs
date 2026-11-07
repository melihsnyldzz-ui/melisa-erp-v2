// Verify the trial's object-ID-independent SQL projections without granting
// authority or assuming that their claimed SQL origin is genuine.
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('MASTER_V7_SEMANTIC_INVALID');};
function read(s){try{const x=JSON.parse(s);if(!x||typeof x!=='object'||Array.isArray(x))fail();return x;}catch{fail();}}
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const cmp=(a,b)=>a<b?-1:a>b?1:0;
export function verifyDesktopFinanceV7Semantics({metadataJson,securityJson,metadataSemanticJson,securitySemanticJson,newTables}={}){
 const m=read(metadataJson),s=read(securityJson),sm=read(metadataSemanticJson),ss=read(securitySemanticJson);if(!Array.isArray(m.objects)||!Array.isArray(s.permissions)||!Array.isArray(newTables)||newTables.length!==3)fail();const map=new Map(),names=new Set();for(const n of newTables){if(!n||Object.keys(n).sort().join(',')!=='name,objectId'||!['finance_accounts','finance_account_movements','desktop_finance_requests'].includes(n.name)||names.has(n.name)||!Number.isSafeInteger(n.objectId)||n.objectId<1||map.has(n.objectId))fail();names.add(n.name);map.set(n.objectId,'dbo.'+n.name);}
 const expectedMeta=structuredClone(m);for(const o of expectedMeta.objects){if(!Number.isSafeInteger(o.parent_object_id)||o.parent_object_id<0)fail();const name=map.get(o.parent_object_id)??null;if(name)o.parent_object_id=null;o.v7_parent_name=name;}
 const expectedSecurity=structuredClone(s);for(const p of expectedSecurity.permissions){if(!Number.isSafeInteger(p.class)||!Number.isSafeInteger(p.major_id))fail();const name=p.class===1?map.get(p.major_id)??null:null;if(name)p.major_id=null;p.v7_major_name=name;}
 expectedSecurity.permissions.sort((a,b)=>cmp(a.class,b.class)||cmp(a.v7_major_name===null?0:1,b.v7_major_name===null?0:1)||cmp(a.v7_major_name??'',b.v7_major_name??'')||cmp(a.major_id??0,b.major_id??0)||cmp(a.minor_id,b.minor_id)||cmp(a.grantee_principal_id,b.grantee_principal_id)||cmp(a.grantor_principal_id,b.grantor_principal_id)||cmp(a.type,b.type)||cmp(a.state,b.state));
 if(!same(sm,expectedMeta)||!same(ss,expectedSecurity))fail();return Object.freeze({metadataSemanticSha256:createHash('sha256').update(metadataSemanticJson,'utf16le').digest('hex'),securitySemanticSha256:createHash('sha256').update(securitySemanticJson,'utf16le').digest('hex'),originVerified:false,admissionAllowed:false});
}
