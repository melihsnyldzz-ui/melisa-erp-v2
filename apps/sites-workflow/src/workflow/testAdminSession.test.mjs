import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { shouldAutoOpenTestAdmin,resolveTestApiBase,isTestSessionTarget } from './testAdminSession.mjs';
const context = { location: { hostname: '127.0.0.1', protocol: 'http:', port: '5194' }, apiBase: 'http://127.0.0.1:4144', mode: null };
test('fresh TEST session opens admin; manual role acceptance survives reload', () => {
  assert.equal(shouldAutoOpenTestAdmin(context), true);
  assert.equal(shouldAutoOpenTestAdmin({ ...context, mode: 'admin' }), true);
  assert.equal(shouldAutoOpenTestAdmin({ ...context, mode: 'manual' }), false);
});
test('approved LAN resolves exact API and opens like loopback while explicit manual mode is preserved',()=>{
 const lan={...context,location:{...context.location,hostname:'192.168.1.46'}};assert.equal(resolveTestApiBase(lan),'http://192.168.1.46:4144');assert.equal(isTestSessionTarget(lan),true);assert.equal(shouldAutoOpenTestAdmin(lan),true);assert.equal(shouldAutoOpenTestAdmin({...lan,apiBase:'http://192.168.1.46:4144'}),true);assert.equal(resolveTestApiBase(context),context.apiBase);assert.equal(shouldAutoOpenTestAdmin({...lan,mode:'manual'}),false);
 for(const change of [{location:{...lan.location,hostname:'192.168.1.47'}},{location:{...lan.location,port:'5188'}},{location:{...lan.location,protocol:'https:'}},{apiBase:'http://192.168.1.46:4114'},{apiBase:'http://other:4144'},{apiBase:'http://127.0.0.1:4144/'},{location:context.location,apiBase:'http://192.168.1.46:4144'}])assert.equal(resolveTestApiBase({...lan,...change}),null);
});
test('LIVE, remote UI and non-TEST API never auto-open admin', () => {
  for (const change of [{ port: '5188' }, { hostname: '192.168.1.47' }, { protocol: 'https:' }])
    assert.equal(shouldAutoOpenTestAdmin({ ...context, location: { ...context.location, ...change } }), false);
  assert.equal(shouldAutoOpenTestAdmin({ ...context, apiBase: 'http://127.0.0.1:4114' }), false);
});
test('actual LAB admin action refuses unapproved LAN before clearing session or starting a request',async()=>{
 const source=await readFile(new URL('./testSales.js',import.meta.url),'utf8');const start=source.indexOf('async function openTestAdmin(){'),end=source.indexOf('let renderedHash=',start);assert.ok(start>=0&&end>start);
 const open=new Function('shouldAutoOpenTestAdmin','location','BASE','clearSession',source.slice(start,end)+';return openTestAdmin;')(shouldAutoOpenTestAdmin,{...context.location,hostname:'192.168.1.47'},'http://192.168.1.46:4144',()=>{throw Error('LAN must preserve normal session');});await open();
});
