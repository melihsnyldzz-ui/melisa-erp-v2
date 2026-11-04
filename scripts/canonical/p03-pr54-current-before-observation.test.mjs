import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runPr54CurrentExtras} from './p03-pr54-current-before-observation.mjs';

test('current owner extras use stdin instead of a Windows-size argv containing process evidence',()=>{
 const text=fs.readFileSync(new URL('./p03-pr54-current-before-observation.mjs',import.meta.url),'utf8');
 assert.match(text,/child\.stdin\.end\(code\)/);
 assert.match(text,/child\.stdin\.on\('error',reject\)/);
 assert.doesNotMatch(text,/'-EncodedCommand'/);
 assert.match(text,/const result=await runPr54CurrentExtras\(code\)/);
 assert.match(text,/TASK_COM_IDENTITY/);assert.match(text,/\$r\.Path-cne/);
 assert.match(text,/Date\.now\(\)-Date\.parse\(proof\.observedAt\)>=0/);
});
test('Windows accepts a read-only program larger than the native argv ceiling',{skip:process.platform!=='win32'},async()=>{
 const out=await runPr54CurrentExtras('#'+'x'.repeat(50000)+'\n[Console]::Out.Write("STDIN_TRANSPORT_OK")');
 assert.equal(out.stdout,'STDIN_TRANSPORT_OK');assert.equal(out.stderr,'');
});
