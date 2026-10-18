import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('supervisor dates remain a finite set including the PR53 preparation day',()=>{
 const source=fs.readFileSync(new URL('./build-crm06-supervisor-package.mjs',import.meta.url),'utf8');
 const dates=source.match(/expected=(\[[^\]]+\])\.map/);
 assert.ok(dates);
 const admitted=JSON.parse(dates[1].replaceAll("'",'"'));
 assert.deepEqual(admitted,['20261014','20261015','20261017','20261018']);
 assert.equal(admitted.includes('20261019'),false);
 assert.match(source,/commit\.slice\(0,12\)/);
 assert.match(source,/fs\.existsSync\(target\)/);
 assert.match(source,/CLEAN_COMMITTED_SOURCE_REQUIRED|status','--porcelain/);
});
