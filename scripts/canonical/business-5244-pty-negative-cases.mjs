import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
const dir=import.meta.dirname,sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const NEGATIVE_PROFILE='NATURAL_EXIT_NO_DEBUG_NO_Q';
export function negativeOwnerSource(bytes){
 if(sha(bytes)!=='b2f69232bb307aefc8f4b60c16d732ec2476e955997cd80f351b60b45d77d3d3')throw Error('NEGATIVE_BASE_SOURCE_CHANGED');
 let text=bytes.toString('utf8');
 for(const [before,after] of [['while($clock.ElapsedMilliseconds-lt180000)','while($clock.ElapsedMilliseconds-lt20000)'],["throw 'PTY_FIXTURE_OWNER_MAX_LIFETIME'",'return']]){
  if(text.split(before).length!==2)throw Error('NEGATIVE_LITERAL_NOT_UNIQUE');text=text.replace(before,after);
 }
 return Buffer.from(text);
}
export function prepareNegativeFixture(root,nonce){
 if(!/^[a-f0-9]{32}$/.test(nonce))throw Error('NEGATIVE_NONCE');
 const parent=fs.realpathSync.native(os.tmpdir()),full=fs.realpathSync.native(root);
 if(full!==root||path.dirname(full)!==parent||path.basename(full)!=='b6-pty-fixture-'+nonce||fs.lstatSync(full).isSymbolicLink()||fs.readdirSync(full).length)throw Error('NEGATIVE_OWN_EMPTY_TEMP_REQUIRED');
 for(let p=full;p;){if(fs.lstatSync(p).isSymbolicLink())throw Error('NEGATIVE_REPARSE');const next=path.dirname(p);if(next===p)break;p=next;}
 // Construct NEW disposable artifacts from the two reviewed text forms.
 // Git checkout line endings may vary; constructed bytes must still match
 // the exact public pins. No frozen/live artifact validator is normalized.
 const source=negativeOwnerSource(Buffer.from(fs.readFileSync(path.join(dir,'business-5244-pty-fixture.ps1'),'utf8').replaceAll('\r\n','\n')));
 const native=Buffer.from(fs.readFileSync(path.join(dir,'business-5244-pty-fixture-native.cs'),'utf8').replaceAll('\r\n','\n').replaceAll('\n','\r\n'));
 if(sha(native)!=='8fb376b871c77f7e5448873e4978b4fd5cb5b3f1da66bad64d01fce24b0fca5f')throw Error('NEGATIVE_NATIVE_CHANGED');
 const client=Buffer.from('[Console]::WriteLine("PTY_FIXTURE_CLIENT_PID="+$PID);[Console]::Out.Flush()\r\n');
 for(const [name,bytes] of [['business-5244-pty-fixture.ps1',source],['business-5244-pty-fixture-native.cs',native],['client.ps1',client]])fs.writeFileSync(path.join(full,name),bytes,{flag:'wx'});
 const manifest={schema:'melisa-b6-pty-negative-fixture.v1',profile:NEGATIVE_PROFILE,nonce,root:full,ownerNaturalExitMilliseconds:20000,controllerGuardMilliseconds:60000,sourceSha256:sha(source),nativeSha256:sha(native),clientSha256:sha(client),debugCalls:0,qCalls:0,runtimeGo:false,executionAuthority:false};
 fs.writeFileSync(path.join(full,'negative-profile.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
