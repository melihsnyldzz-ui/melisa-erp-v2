import {createHash} from 'node:crypto';
const fail=()=>{throw Error('BUSINESS_API_CLOSURE_REJECTED');};
export const BUSINESS_API_REQUIRED_FILES=Object.freeze([
 'apps/api/canonical-test-env.mjs','apps/api/canonical-test-listeners.mjs','apps/api/start-canonical-test.mjs',
 'apps/api/src/services/authService.js','apps/api/src/services/normalTestRefreshSession.mjs','apps/api/src/services/semihTestIdentityPolicy.mjs','apps/api/src/services/canonicalBusinessSessionContext.mjs',
 'apps/api/src/routes/authRoutes.js','apps/api/src/controllers/authController.js','apps/api/src/middleware/authMiddleware.js','apps/api/src/services/canonicalTestRoutePolicy.mjs',
 'apps/api/src/services/customerService.js','apps/api/src/services/supplierService.js','apps/api/src/services/nativePartyBalance.mjs',
]);
export function projectBusinessCanonicalRoutePolicy(source){
 const before="{writes=false,mode='native'}={}){",after="{writes=false,mode='native',protectedNormalAuth=false}={}){";
 const anchor=" if(!writes||mode!=='erp'||method!=='POST')return false;";
 if(typeof source!=='string'||source.split(before).length!==2||source.split(anchor).length!==2||source.includes('protectedNormalAuth'))fail();
 return source.replace(before,after).replace(anchor,anchor+"\n if(protectedNormalAuth===true&&/^\\/api\\/auth\\/(?:refresh|logout|session-confirm)$/.test(path))return true;");
}
export function projectNativePartyUnknownBalance(source,kind){
 const count=kind==='customer'?2:kind==='supplier'?1:0,anchor="import sql from 'mssql';",old='balance: Number(row.balance || 0),';
 if(!count||typeof source!=='string'||source.split(anchor).length!==2||source.split(old).length!==count+1||source.includes("from './nativePartyBalance.mjs'"))fail();
 return source.replace(anchor,anchor+"\nimport {nativePartyBalance} from './nativePartyBalance.mjs';").replaceAll(old,'balance: nativePartyBalance(row.balance),');
}
export async function verifyBusinessApiClosure(manifest,readFile){
 if(manifest?.businessNormalSessionClosure?.version!==1||!Array.isArray(manifest.files)||!Array.isArray(manifest.businessNormalSessionClosure.files))fail();
 const expected=manifest.businessNormalSessionClosure.files;if(expected.length!==BUSINESS_API_REQUIRED_FILES.length||new Set(expected.map(x=>x.path)).size!==expected.length)fail();
 const loaded=new Map();for(const file of BUSINESS_API_REQUIRED_FILES){const rows=manifest.files.filter(x=>x.path===file),pins=expected.filter(x=>x.path===file);if(rows.length!==1||pins.length!==1||rows[0].sha256!==pins[0].sha256)fail();const b=await readFile(file);if(createHash('sha256').update(b).digest('hex')!==pins[0].sha256)fail();loaded.set(file,b.toString('utf8'));}
 for(const [file,pattern]of [['apps/api/src/routes/authRoutes.js',/\.post\('\/auth\/session-confirm',\s*requireAuth,\s*postProtectedSessionConfirm\)/],['apps/api/src/controllers/authController.js',/export async function postProtectedSessionConfirm\(/],['apps/api/src/middleware/authMiddleware.js',/verifyNormalTestAccessSession\(payload,currentUser\)/],['apps/api/src/services/customerService.js',/balance: nativePartyBalance\(row.balance\)/],['apps/api/src/services/supplierService.js',/balance: nativePartyBalance\(row.balance\)/]])if(!pattern.test(loaded.get(file)))fail();
 const policy=await import('data:text/javascript;base64,'+Buffer.from(loaded.get('apps/api/src/services/canonicalTestRoutePolicy.mjs')).toString('base64'));
 for(const route of ['/api/auth/refresh','/api/auth/logout','/api/auth/session-confirm']){if(policy.isCanonicalTestWriteAllowed('POST',route,{writes:true,mode:'erp',protectedNormalAuth:true})!==true)fail();for(const ctx of [{writes:true,mode:'erp'},{writes:false,mode:'erp',protectedNormalAuth:true},{writes:true,mode:'native',protectedNormalAuth:true}])if(policy.isCanonicalTestWriteAllowed('POST',route,ctx)!==false)fail();}
 return {verifiedFiles:loaded.size,normalSessionRoutes:true,revocationMiddleware:true,unknownBalancePreserved:true};
}
