import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseTerminalArtifactArgs,verifiedTerminalBytes,attachTerminalArtifact,terminalInstallHtml,TERMINAL_APK_PATH,TERMINAL_APK_SHA256,TERMINAL_APK_NAME} from './public-terminal-artifact.mjs';
const args=['--terminal-apk-path',TERMINAL_APK_PATH,'--terminal-apk-sha256',TERMINAL_APK_SHA256];
test('default build remains opt out; business option survives strict optional parsing',()=>{
 assert.deepEqual(parseTerminalArtifactArgs(['--stage4-copy']),{remaining:['--stage4-copy'],artifact:null});
 assert.deepEqual(parseTerminalArtifactArgs(['--business-test-copy',...args]),{remaining:['--business-test-copy'],artifact:{file:TERMINAL_APK_PATH,sha256:TERMINAL_APK_SHA256}});
});
test('reject incomplete, duplicate, unknown, unapproved or modified artifact arguments',()=>{
 for(const input of [args.slice(0,2),[...args,...args.slice(0,2)],['--terminal-apk-token','secret'],['--terminal-apk-path','C:\\private\\.env',...args.slice(2)],['--terminal-apk-path',TERMINAL_APK_PATH+'?download',...args.slice(2)],[...args.slice(0,3),'0'.repeat(64)],['--terminal-apk-path','deliveries/app.apk',...args.slice(2)]])assert.throws(()=>parseTerminalArtifactArgs(input));
});
test('actual file bytes must match approved digest and APK zip signature; mutation rejected',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'terminal-artifact-')),file=path.join(root,'fixture.apk'),bytes=Buffer.from('PK\x03\x04offline-test');
 try{fs.writeFileSync(file,bytes);const sha=createHash('sha256').update(bytes).digest('hex').toUpperCase();assert.deepEqual(verifiedTerminalBytes(file,sha),bytes);fs.appendFileSync(file,'tampered');assert.throws(()=>verifiedTerminalBytes(file,sha),/HASH_REJECTED/);fs.writeFileSync(file,'not APK');assert.throws(()=>verifiedTerminalBytes(file,createHash('sha256').update('not APK').digest('hex').toUpperCase()),/HASH_REJECTED/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('parent junction/symlink rejects file even if bytes match',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'terminal-link-')),real=path.join(root,'real'),link=path.join(root,'alias');
 try{fs.mkdirSync(real);const bytes=Buffer.from('PK\x03\x04fixture');fs.writeFileSync(path.join(real,'f.apk'),bytes);fs.symlinkSync(real,link,process.platform==='win32'?'junction':'dir');assert.throws(()=>verifiedTerminalBytes(path.join(link,'f.apk'),createHash('sha256').update(bytes).digest('hex').toUpperCase()),/LINK_REJECTED/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('attachment rejects other copy and DB scopes before reading or creating files',()=>{
 for(const target of [null,{kind:'shared',dist:'dist-shared'},{kind:'business',dist:'dist-business',database:'LIVE'}])assert.throws(()=>attachTerminalArtifact({releaseRoot:'not-created',target,artifact:{file:TERMINAL_APK_PATH,sha256:TERMINAL_APK_SHA256}}),/BUSINESS_TEST_ONLY/);
 assert.equal(attachTerminalArtifact({artifact:null}),null);
});
test('public guide links only fixed APK and digest; build attaches before immutable manifest',()=>{
 const html=terminalInstallHtml();assert.ok(html.includes('./downloads/'+TERMINAL_APK_NAME));assert.ok(html.includes(TERMINAL_APK_SHA256));assert.ok(html.includes('personel hesabınızla'));assert.ok(html.includes('USB bağlantısı gerekmez'));assert.ok(!html.includes('C:\\'));assert.ok(!html.includes('<script'));
 const build=fs.readFileSync(new URL('./build-package.mjs',import.meta.url),'utf8');assert.ok(build.indexOf('attachTerminalArtifact({')<build.indexOf('const files=walk(destination)'));
});
