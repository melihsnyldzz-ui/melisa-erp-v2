import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {inspect} from 'node:util';
import {createDesktopWriteTlsConfig,getDesktopWritePool,DESKTOP_WRITE_CONNECTOR_LIMITS} from './desktopWriteTlsConnector.mjs';
import {createDesktopWriteApplication} from '../desktopWriteApplication.mjs';

const pemPath='C:\\Users\\Xaser\\Desktop\\ERP\\kurulum\\MELISAERP-sql-public.pem';
test('forged connector cannot construct writer application or expose a pool',()=>{
 assert.throws(()=>getDesktopWritePool({profile:'desktop-write-v2'}),{code:'DESKTOP_WRITE_CONNECTOR_REJECTED'});
 assert.throws(()=>createDesktopWriteApplication({connector:{profile:'desktop-write-v2'}}),{code:'DESKTOP_WRITE_CONNECTOR_REJECTED'});
});
test('invalid certificate and getter injection are refused before connection',()=>{
 assert.throws(()=>createDesktopWriteTlsConfig({password:'synthetic-only',publicCertificatePem:'bad'}),{code:'DESKTOP_WRITE_CONNECTOR_REJECTED'});
 let called=false;const input={password:'synthetic-only',get publicCertificatePem(){called=true;return 'bad';}};
 assert.throws(()=>createDesktopWriteTlsConfig(input),{code:'DESKTOP_WRITE_CONNECTOR_REJECTED'});assert.equal(called,false);
});
test('installed public PEM pins dedicated writer and redacts credentials without connecting',{skip:!existsSync(pemPath)},()=>{
 const password='synthetic-password-not-a-credential',pem=readFileSync(pemPath,'utf8');
 const c=createDesktopWriteTlsConfig({password,publicCertificatePem:pem});
 assert.equal(c.user,'melisa_desktop_test_writer_20261105');assert.equal(c.server,'127.0.0.1');assert.equal(c.port,51433);
 assert.equal(c.options.encrypt,true);assert.equal(c.options.trustServerCertificate,false);assert.equal(c.options.serverName,'SEMIH');
 assert.ok(!JSON.stringify(c).includes(password));assert.ok(!inspect(c).includes(password));
 assert.equal(DESKTOP_WRITE_CONNECTOR_LIMITS.realSqlVerified,false);
});
