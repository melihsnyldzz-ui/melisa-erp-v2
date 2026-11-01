import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {negativeOwnerSource,prepareNegativeFixture,NEGATIVE_PROFILE} from './business-5244-pty-negative-cases.mjs';
test('negative fixture derivative changes only the two owned natural-exit literals, never the controller or native guard',()=>{
 const bytes=fs.readFileSync(path.join(import.meta.dirname,'business-5244-pty-fixture.ps1'));
 // Git checkout EOL normalization is allowed only before this exact public
 // fixture source pin; the byte-pinned runtime specimen remains immutable.
 const canonical=Buffer.from(bytes.toString().replaceAll('\r\n','\n'));
 const derived=negativeOwnerSource(canonical).toString();
 assert.equal(derived.replace('while($clock.ElapsedMilliseconds-lt20000)','while($clock.ElapsedMilliseconds-lt180000)').replace("  return\n }finally{","  throw 'PTY_FIXTURE_OWNER_MAX_LIFETIME'\n }finally{"),canonical.toString());
 assert.throws(()=>negativeOwnerSource(Buffer.from('foreign')),/NEGATIVE_BASE_SOURCE_CHANGED/);assert.equal(NEGATIVE_PROFILE,'NATURAL_EXIT_NO_DEBUG_NO_Q');
});
test('negative fixture refuses nonempty/foreign roots without changing any existing byte',()=>{
 const nonce=crypto.randomUUID().replaceAll('-',''),parent=fs.realpathSync.native(os.tmpdir()),root=path.join(parent,'b6-pty-fixture-'+nonce);fs.mkdirSync(root);fs.writeFileSync(path.join(root,'retained-proof'),'keep',{flag:'wx'});
 assert.throws(()=>prepareNegativeFixture(root,nonce),/NEGATIVE_OWN_EMPTY_TEMP_REQUIRED/);assert.equal(fs.readFileSync(path.join(root,'retained-proof'),'utf8'),'keep');assert.throws(()=>prepareNegativeFixture(root,'bad'),/NEGATIVE_NONCE/);
});
test('full passive negative preparation creates exact pinned artifacts once without starting a process',()=>{
 const nonce=crypto.randomUUID().replaceAll('-',''),root=path.join(fs.realpathSync.native(os.tmpdir()),'b6-pty-fixture-'+nonce);fs.mkdirSync(root);const m=prepareNegativeFixture(root,nonce),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 assert.equal(m.profile,NEGATIVE_PROFILE);assert.equal(m.sourceSha256,hash(fs.readFileSync(path.join(root,'business-5244-pty-fixture.ps1'))));assert.equal(m.nativeSha256,'8fb376b871c77f7e5448873e4978b4fd5cb5b3f1da66bad64d01fce24b0fca5f');assert.equal(m.nativeSha256,hash(fs.readFileSync(path.join(root,'business-5244-pty-fixture-native.cs'))));assert.equal(m.executionAuthority,false);assert.equal(m.runtimeGo,false);
 assert.deepEqual(fs.readdirSync(root).sort(),['business-5244-pty-fixture-native.cs','business-5244-pty-fixture.ps1','client.ps1','negative-profile.json']);assert.throws(()=>prepareNegativeFixture(root,nonce),/NEGATIVE_OWN_EMPTY_TEMP_REQUIRED/);
});
