import test from 'node:test';
import assert from 'node:assert/strict';
import {safeInternalUrl, crmUrl, availability, semihContinueUrl} from '../public/melisa-hub/hub.mjs';
import {lessons as portalLessons} from '../public/melisa-hub/catalog.mjs';
import {lessons as sourceLessons} from './training-guide/lessons.mjs';

const lan = new URL('http://192.168.1.46:5234/melisa-hub/');
const dns = new URL('https://semih.tail295701.ts.net/melisa-hub/');
const verifiedCrm = {environment:'ISOLATED_TEST_COPY',crm:{enabled:true,validated:true,port:62700}};

test('Semih intent button only opens exact verified copy origin; intent carries no authority or secret',()=>{
 const config={environment:'ISOLATED_TEST_COPY',erp:{enabled:true,validated:true}};
 assert.equal(semihContinueUrl(config,lan),'http://192.168.1.46:5234/ornek-akis.html?semih=1#stock');
 assert.equal(semihContinueUrl(config,new URL('http://127.0.0.1:5234/melisa-hub/')),'http://127.0.0.1:5234/ornek-akis.html?semih=1#stock');
 for(const current of[dns,new URL('http://localhost:5234/melisa-hub/'),new URL('http://192.168.1.47:5234/melisa-hub/'),new URL('http://192.168.1.46:5194/melisa-hub/')])assert.equal(semihContinueUrl(config,current),null);
 assert.equal(semihContinueUrl({...config,environment:'LIVE'},lan),null);assert.equal(semihContinueUrl({},lan),null);
 assert.equal(crmUrl(verifiedCrm,new URL(lan.href+'?semih=1')),'http://192.168.1.46:62700/?semih=1');
});

test('navigation rejects credentials, foreign hosts, protocols and unrelated ports', () => {
  for (const value of [
    'javascript:alert(1)', 'data:text/html,unsafe', 'file:///C:/Sirket/private/report.html',
    'http://127.0.0.1:5234/', 'http://localhost:5234/',
    '//other.example/path', 'http://192.168.1.47:5234/',
    'http://100.84.179.20:5234/', 'https://another.tail295701.ts.net/',
    'http://192.168.1.46:62701/', 'http://192.168.1.46:1433/',
    'http://user:password@192.168.1.46:5234/', '/erp?access_token=example',
    '/erp?password=example', '/erp?auth_bypass=true', '\\unsafe\path',
  ]) assert.equal(safeInternalUrl(value, lan), null, value);
  assert.equal(safeInternalUrl('/terminal.html#products', lan), 'http://192.168.1.46:5234/terminal.html#products');
  assert.equal(safeInternalUrl('/kullanim-egitimi.html#receiving', dns), 'https://semih.tail295701.ts.net/kullanim-egitimi.html#receiving');
  assert.equal(safeInternalUrl('http://semih.tail295701.ts.net/', dns), null);
});

test('CRM requires audited TEST configuration and the fixed frontend port', () => {
  assert.equal(crmUrl(verifiedCrm, lan), 'http://192.168.1.46:62700/');
  for (const config of [null, {}, {...verifiedCrm,environment:'LIVE'},
    {...verifiedCrm,crm:{enabled:true,port:62700}},
    {...verifiedCrm,crm:{enabled:true,validated:true,port:62701}},
    {...verifiedCrm,crm:{enabled:true,validated:true,path:'//foreign.example/'}},
    {...verifiedCrm,crm:{enabled:true,validated:true,path:'/crm/?token=example'}},
  ]) assert.equal(crmUrl(config, lan), null);
  assert.equal(crmUrl(verifiedCrm, dns), null, 'HTTPS cannot silently open HTTP CRM');
  assert.equal(crmUrl({...verifiedCrm,crm:{enabled:true,validated:true,path:'/crm/'}}, dns), 'https://semih.tail295701.ts.net/crm/');
});

test('TEST125 exception cannot open chat or accounting services', () => {
  assert.equal(safeInternalUrl('http://192.168.1.46:5194/ornek-akis.html', lan, ['5234','5194']), 'http://192.168.1.46:5194/ornek-akis.html');
  assert.equal(safeInternalUrl('http://192.168.1.46:62701/', lan, ['5234','5194']), null);
  assert.equal(safeInternalUrl('http://192.168.1.47:5194/', lan, ['5234','5194']), null);
});

test('stale, missing, unknown and future health never appear green', () => {
  const now = Date.parse('2026-10-11T00:00:00Z');
  const status = offset => ({checkedAt:new Date(now+offset).toISOString(),services:{erp:{state:'reachable',detail:'HTTP only'}}});
  assert.equal(availability(status(0), 'erp', now).state, 'reachable');
  assert.equal(availability(status(-300001), 'erp', now).state, 'unknown');
  assert.equal(availability(status(60001), 'erp', now).state, 'unknown');
  assert.equal(availability(status(0), 'crm', now).state, 'unknown');
  assert.equal(availability(null, 'erp', now).state, 'unknown');
  assert.equal(availability({checkedAt:new Date(now).toISOString(),services:{erp:{state:'PASS'}}}, 'erp', now).state, 'unknown');
});

test('all eight portal lessons target the existing read-only education guide', () => {
  assert.equal(portalLessons.length, 8);
  assert.deepEqual(portalLessons.map(x=>x.id), sourceLessons.map(x=>x.id));
});
