import test,{mock} from 'node:test';import assert from 'node:assert/strict';
const unused=async()=>{throw Error('Unused auth entry');};
const raw='A'.repeat(43);let calls=[];
const requireAuth=(req,res,next)=>req.get('authorization')==='Bearer access'?next():Object.assign(res,{statusCode:401});
mock.module('../services/authService.js',{namedExports:{listTerminalLoginUsers:unused,localPasswordlessAdminLogin:unused,login:unused,logout:unused,refreshAccessToken:unused,terminalLogin:unused,confirmProtectedNormalSession:unused,semihBrowserSessionEnabled:()=>true,rememberedSemihBrowserUser:async()=>({enabled:true,user:null}),enrollSemihBrowserSession:async(...args)=>{calls.push(args);return{user:{id:17},accessToken:'access',expiresAt:Date.now()+100000,refreshExpiresAt:Date.now()+200000,refreshToken:raw};},restoreSemihBrowserSession:unused,logoutSemihBrowserSession:unused}});
mock.module('../middleware/authMiddleware.js',{namedExports:{requireAuth}});
const {authRoutes}=await import('./authRoutes.js');
test('registered cookie enrollment retains normal Bearer middleware; other transport routes are exact dedicated handlers',async()=>{
 const path='/auth/semih-browser/',enroll=authRoutes.stack.find(x=>x.route?.path===path+'enroll').route;
 assert.equal(enroll.stack[0].handle,requireAuth);assert.equal(enroll.methods.post,true);
 const anonymous={get:()=>''},denied={};requireAuth(anonymous,denied,()=>assert.fail('Anonymous enrollment'));assert.equal(denied.statusCode,401);assert.equal(calls.length,0);
 for(const [action,method]of [['remembered','get'],['restore','post'],['logout','post']]){const route=authRoutes.stack.find(x=>x.route?.path===path+action).route;assert.equal(route.methods[method],true);assert.equal(route.stack.length,1);}
 const values={authorization:'Bearer access',origin:'http://192.168.1.46:5234',host:'192.168.1.46:4184','sec-fetch-site':'same-site'};
 const req={method:'POST',originalUrl:'/api'+path+'enroll',socket:{remoteAddress:'192.168.1.23'},headers:values,body:{refreshToken:raw},get:k=>values[k],is:()=>true};
 const res={set(){},cookie(name,value,options){this.cookieOptions=options;},json(body){this.body=body;return this;},status(n){this.statusCode=n;return this;}};
 await enroll.stack[1].handle(req,res);assert.equal(res.body.success,true);assert.equal(res.body.data.accessToken,'access');assert.equal(Object.hasOwn(res.body.data,'refreshToken'),false);assert.equal(res.cookieOptions.httpOnly,true);assert.deepEqual(calls,[['access',raw,null]]);
});
