import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
let calls;
const no=async()=>{throw Error('Unused auth method');};
const requireAuth=(req,res,next)=>{if(req.get('authorization')!=='Bearer fixture-access')return res.status(401).json({success:false});next();};
mock.module('../services/authService.js',{namedExports:{listTerminalLoginUsers:no,localPasswordlessAdminLogin:no,login:no,logout:no,refreshAccessToken:no,terminalLogin:no,confirmProtectedNormalSession:async(access,refresh)=>{calls.push([access,refresh]);if(refresh!=='fixture-refresh')throw Object.assign(Error('Pair differs'),{code:'AUTH_REFRESH_INVALID',statusCode:401});return {confirmed:true,user:{id:17,username:'erp-semih-test-20261012',role:{id:2,code:'admin'}},normalTestSessionId:'e1000001-0000-4000-8000-000000000001',expiresAt:12345};}}});
mock.module('../middleware/authMiddleware.js',{namedExports:{requireAuth}});
const {authRoutes}=await import('./authRoutes.js');
const {postProtectedSessionConfirm}=await import('../controllers/authController.js');
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
beforeEach(()=>{calls=[];});
test('route has existing normal Bearer middleware before confirmation; anonymous never reaches service',()=>{
 const route=authRoutes.stack.find(l=>l.route?.path==='/auth/session-confirm').route;
 assert.equal(route.methods.post,true);assert.equal(route.stack[0].handle,requireAuth);assert.equal(route.stack[1].handle,postProtectedSessionConfirm);
 const res=response();route.stack[0].handle({get:()=>''},res,()=>assert.fail('Must not call confirmation'));assert.equal(res.statusCode,401);assert.equal(calls.length,0);
});
test('controller accepts only refreshToken JSON body and current Bearer header without returning secrets',async()=>{
 const req={body:{refreshToken:'fixture-refresh'},get:()=> 'Bearer fixture-access'},res=response();await postProtectedSessionConfirm(req,res);
 assert.equal(res.body.data.confirmed,true);assert.equal(res.body.data.normalTestSessionId,'e1000001-0000-4000-8000-000000000001');assert.deepEqual(calls,[['fixture-access','fixture-refresh']]);assert.doesNotMatch(JSON.stringify(res.body),/fixture-access|fixture-refresh/);
 for(const body of [{refreshToken:'fixture-refresh',username:'override'},{refreshToken:'fixture-refresh',normalTestSessionId:'client-selected'},{refreshToken:'fixture-refresh',confirmed:true},{},null,[],{accessToken:'fixture-access'}]){const r=response();await postProtectedSessionConfirm({...req,body},r);assert.equal(r.statusCode,400);}
 assert.equal(calls.length,1);
});
test('missing Bearer or mismatched refresh rejects without token leakage',async()=>{
 const res=response();await postProtectedSessionConfirm({body:{refreshToken:'fixture-refresh'},get:()=>''},res);assert.equal(res.statusCode,401);assert.equal(calls.length,0);
 const bad=response();await postProtectedSessionConfirm({body:{refreshToken:'wrong-fixture'},get:()=> 'Bearer fixture-access'},bad);assert.equal(bad.statusCode,401);assert.equal(bad.body.error.code,'AUTH_REFRESH_INVALID');assert.doesNotMatch(JSON.stringify(bad.body),/wrong-fixture|fixture-access/);
});
