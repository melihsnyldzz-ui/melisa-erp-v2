import test from 'node:test';import assert from 'node:assert/strict';
import {assertStableServeBefore,proposedStableServe,assertOnlyStableServeAdded,stableAccessCommands} from './hub-stable-access-plan.mjs';
const before={TCP:{443:{HTTPS:true},4112:{TCPForward:'192.168.1.46:4112'},8083:{TCPForward:'localhost:8083'}},Web:{'semih.tail295701.ts.net:443':{Handlers:{'/':{Proxy:'http://127.0.0.1:3100'}}}},AllowFunnel:{'semih.tail295701.ts.net:443':true}};
test('only new exact8443 HTTPS handler is accepted; existing443 Funnel and TCP handlers preserved',()=>{
 const after=proposedStableServe(before);assert.equal(assertOnlyStableServeAdded(before,after),true);assert.equal(after.AllowFunnel['semih.tail295701.ts.net:8443'],undefined);assert.deepEqual(after.TCP[4112],before.TCP[4112]);assert.deepEqual(after.Web['semih.tail295701.ts.net:443'],before.Web['semih.tail295701.ts.net:443']);
 for(const mutate of [a=>a.AllowFunnel['semih.tail295701.ts.net:8443']=true,a=>a.AllowFunnel['semih.tail295701.ts.net:8443']=false,a=>a.TCP[443]={HTTPS:false},a=>a.Web['semih.tail295701.ts.net:8443'].Handlers['/other']={Text:'foreign'},a=>a.Web['semih.tail295701.ts.net:8443'].Handlers['/'].Proxy='http://127.0.0.1:5194',a=>a.Foreground={foreign:{TCP:{443:{HTTPS:true}}}}]){const a=structuredClone(after);mutate(a);assert.throws(()=>assertOnlyStableServeAdded(before,a));}
});
test('before conflict in main, Foreground or Services8443 scope cannot be overwritten',()=>{
 for(const extra of [{TCP:{8443:{HTTPS:true}}},{Foreground:{other:{Web:{'other:8443':{}}}}},{Services:{'svc:other':{TCP:{8443:{TCPForward:'foreign'}}}}}])assert.throws(()=>assertStableServeBefore({...before,...extra}));
});
test('rollback is exact path removal and previous ForceDaemon mask only; no reset/up/reboot',()=>{
 const plan=stableAccessCommands();assert.deepEqual(plan.rollback,[['serve','--https=8443','--set-path=/','off'],['set','--unattended=false']]);assert.equal(plan.rebootApproved,false);assert.throws(()=>stableAccessCommands({forceDaemonBefore:true}));
});
