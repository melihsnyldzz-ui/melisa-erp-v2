import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {BUSINESS_API_REQUIRED_FILES as files,projectBusinessCanonicalRoutePolicy,projectNativePartyUnknownBalance,verifyBusinessApiClosure} from './business-workface-api-closure.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function manifest(data){const rows=[...data].map(([path,b])=>({path,sha256:sha(b)}));return {files:rows,businessNormalSessionClosure:{version:1,files:rows}};}
test('packaged route projection adds only protected lifecycle opt-in and preserves all legacy decisions',async()=>{
 const current=await fs.readFile(new URL('../../apps/api/src/services/canonicalTestRoutePolicy.mjs',import.meta.url),'utf8'),original=current.replace(',protectedNormalAuth=false','').replace(/\n if\(protectedNormalAuth===true[^\n]+/,'');
 const source=projectBusinessCanonicalRoutePolicy(original),load=s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64')),[old,next]=await Promise.all([load(original),load(source)]);
 for(const route of ['/api/auth/refresh','/api/auth/logout','/api/auth/session-confirm']){assert.equal(old.isCanonicalTestWriteAllowed('POST',route,{writes:true,mode:'erp'}),false);assert.equal(next.isCanonicalTestWriteAllowed('POST',route,{writes:true,mode:'erp',protectedNormalAuth:true}),true);}
 for(const method of ['GET','POST','PUT','DELETE'])for(const route of ['/api/work-sales/preview','/api/work-sales/selected-context','/api/auth-admin/users','/api/auth/login'])for(const ctx of [{},{writes:true,mode:'erp'},{writes:false,mode:'native'}])assert.equal(next.isCanonicalTestWriteAllowed(method,route,ctx),old.isCanonicalTestWriteAllowed(method,route,ctx));
 assert.throws(()=>projectBusinessCanonicalRoutePolicy(current));
});
test('legacy party projection changes only the proven scalar occurrences, preserving unknown and original source',()=>{
 for(const [kind,n]of [['customer',2],['supplier',1]]){const original="import sql from 'mssql';\r\n"+('balance: Number(row.balance || 0),\r\n').repeat(n)+'preserved bytes';const result=projectNativePartyUnknownBalance(original,kind);assert.equal((result.match(/balance: nativePartyBalance\(row.balance\)/g)??[]).length,n);assert(result.endsWith('preserved bytes'));assert.throws(()=>projectNativePartyUnknownBalance(result,kind));}
});
test('closure rejects missing, byte-drifted and semantically old auth/unknown-balance payloads even with valid file hashes',async()=>{
 const data=new Map(await Promise.all(files.map(async p=>[p,await fs.readFile(new URL('../../'+p,import.meta.url))])));assert.equal((await verifyBusinessApiClosure(manifest(data),p=>data.get(p))).verifiedFiles,files.length);
 for(const p of files){const missing=new Map(data);missing.delete(p);await assert.rejects(()=>verifyBusinessApiClosure(manifest(missing),x=>missing.get(x)));await assert.rejects(()=>verifyBusinessApiClosure(manifest(data),x=>x===p?Buffer.concat([data.get(x),Buffer.from('// drift')]):data.get(x)));}
 for(const [p,change]of [['apps/api/src/middleware/authMiddleware.js',s=>s.replace('verifyNormalTestAccessSession(payload,currentUser);','')],['apps/api/src/routes/authRoutes.js',s=>s.replace("authRoutes.post('/auth/session-confirm',requireAuth,postProtectedSessionConfirm);",'')],['apps/api/src/services/customerService.js',s=>s.replaceAll('balance: nativePartyBalance(row.balance),','balance: Number(row.balance || 0),')]]){const old=new Map(data);old.set(p,Buffer.from(change(data.get(p).toString())));await assert.rejects(()=>verifyBusinessApiClosure(manifest(old),x=>old.get(x)));}
});
