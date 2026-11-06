import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';import {createHash} from 'node:crypto';
import {createDesktopFinalCancellationRoutes} from './desktopFinalCancellationRoutes.mjs';
import {desktopWorkflowRequestIdentity} from '../services/desktopWorkflowRequestResolution.mjs';
const command={requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8312',invoiceId:'13',expectedVersion:'0x0000000000000013',reason:'İskontolu satış denemesi'};
async function fixture(t){let permissions=['sales.view','sales.cancel'],result={state:'COMMITTED',requestId:command.requestId,invoiceId:'13',workflowState:'CANCELLED',version:'0x0000000000000014',replayed:false},calls=[];
 const app=express();app.use(express.json());app.use(createDesktopFinalCancellationRoutes({authenticateNormal:async()=>({kind:'normal',userId:'30002',permissions}),service:{async cancel(actor,body){calls.push({actor,body});return result;}}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const post=(body=command,{path='/api/desktop-sale/workflows/13/cancel-final',origin='http://127.0.0.1:5294'}={})=>new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:server.address().port,path,method:'POST',headers:{host:'127.0.0.1:4294',origin,'content-type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));});r.on('error',reject);r.end(JSON.stringify(body));});
 return {post,calls,setPermissions:p=>{permissions=p;},setResult:r=>{result=r;},result:()=>result};
}
test('final cancellation has a separate normal-session permission/path and returns verified first/replayed result',async t=>{
 const f=await fixture(t);assert.equal((await f.post()).status,201);assert.equal(f.calls[0].actor,'30002');assert.deepEqual(f.calls[0].body,command);
 f.setResult({...f.result(),replayed:true});assert.equal((await f.post()).status,200);
 for(const change of [{invoiceId:'14'},{workflowState:'COMPLETED'},{version:'bad'},{extra:true}]){f.setResult({...f.result(),...change});const response=await f.post();assert.equal(response.status,503);assert.equal(response.data.data.state,'UNKNOWN');assert.equal(response.data.data.requestId,command.requestId);}
});
test('sales.edit/finalize cannot cancel; forged fields, path mismatch and wrong origin never reach service',async t=>{
 const f=await fixture(t);f.setPermissions(['sales.view','sales.edit','sales.finalize']);assert.equal((await f.post()).status,503);f.setPermissions(['sales.view','sales.cancel']);
 for(const body of [{...command,actorId:'17'},{...command,amount:'0.0000'},{...command,invoiceId:'14'},{...command,reason:''},{...command,reason:'x'.repeat(251)}])assert.equal((await f.post(body)).status,503);
 assert.equal((await f.post(command,{origin:'http://elsewhere'})).status,503);assert.equal((await f.post(command,{path:'/api/desktop-sale/workflows/13/cancel-final?bypass=1'})).status,503);assert.equal(f.calls.length,0);
});
test('cancellation journal and resolver hash the same canonical four-field command, including exact reason/version',()=>{
 const identity=desktopWorkflowRequestIdentity('30002','cancel',command);assert.equal(identity.operation,'CANCEL_SALE');assert.equal(identity.hash,createHash('sha256').update(JSON.stringify({actorId:'30002',operation:'CANCEL_SALE',command})).digest('hex'));
 for(const delta of [{reason:'Başka gerekçe'},{expectedVersion:'0x0000000000000014'}])assert.notEqual(desktopWorkflowRequestIdentity('30002','cancel',{...command,...delta}).hash,identity.hash);
 assert.throws(()=>desktopWorkflowRequestIdentity('30002','cancel',{...command,accountId:'7'}));
});
