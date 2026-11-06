// Execute the real CI runner with an in-memory child-process double. No Vite,
// shell, SQL, network, installed dependencies or filesystem writes are invoked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const runnerUrl=new URL('./run.mjs',import.meta.url);
const root=fileURLToPath(new URL('../../',runnerUrl));
const source=readFileSync(runnerUrl,'utf8').replace(/^import .*;\s*$/gm,'').replaceAll('import.meta.url','moduleUrl').replace(/^export (const|function) /gm,'$1 ');
function simulate(mode){
 const calls=[];let exit=null;
 const processDouble={argv:['node',fileURLToPath(runnerUrl),mode],execPath:'/fixed/node',platform:'linux',env:{PATH:'/safe/bin',HOME:'/safe/home',USERPROFILE:'/safe/user',PRIVATE_SECRET:'DO_NOT_PROPAGATE',VITE_API_BASE_URL:'http://DO_NOT_PROPAGATE',NODE_OPTIONS:'--require=DO_NOT_PROPAGATE'},exit:code=>{exit=code;throw Error('PROCESS_EXIT');}};
 const context={URL,path,fileURLToPath,moduleUrl:runnerUrl.href,process:processDouble,readdirSync:()=>[],spawnSync:(...args)=>{calls.push(args);return {status:0};},console:{log(){},error(){}}};
 vm.runInNewContext(source,context,{timeout:1000});return {calls,exit};
}
test('build mode invokes original two builds and one fixed guarded green build without inherited secrets',()=>{
 const {calls,exit}=simulate('build');assert.equal(exit,null);assert.equal(calls.length,3);
 const guard=path.join(root,'scripts/ci/offline-guard.cjs'),vite=app=>path.join(root,'apps',app,'node_modules/vite/bin/vite.js');
 const expected=[['web-admin',[vite('web-admin'),'build']],['sites-workflow',[vite('sites-workflow'),'build']],['sites-workflow',[vite('sites-workflow'),'build','--config','vite.desktop-write.config.mjs']]];
 for(let i=0;i<expected.length;i++){
  const [executable,args,options]=calls[i],[app,command]=expected[i];assert.equal(executable,'/fixed/node');assert.deepEqual(Array.from(args),['--require',guard,...command]);assert.equal(options.cwd,path.join(root,'apps',app));assert.equal(options.timeout,180000);assert.equal(options.stdio,'inherit');
  assert.equal(options.env.CI,'true');assert.equal(options.env.NODE_ENV,'production');assert.equal(options.env.NODE_OPTIONS,`--require="${guard.replaceAll('\\','/')}"`);assert.equal(options.env.PRIVATE_SECRET,undefined);assert.equal(options.env.VITE_API_BASE_URL,undefined);
  assert.deepEqual(Object.keys(options.env).sort(),['CI','HOME','NODE_ENV','NODE_OPTIONS','PATH','USERPROFILE'].sort());
 }
});
test('guard mode actually invokes the source-only regression test through offline guard',()=>{
 const {calls}=simulate('guard'),guard=path.join(root,'scripts/ci/offline-guard.cjs');
 const green=calls.filter(([,args])=>args.includes(path.join(root,'scripts/ci/desktop-green-build.test.mjs')));assert.equal(green.length,1);assert.deepEqual(Array.from(green[0][1]),['--require',guard,'--test',path.join(root,'scripts/ci/desktop-green-build.test.mjs')]);
});
test('workflow pins the same event head in all four checkouts and uploads only designated green web assets',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8').replaceAll('\r\n','\n');
 assert.equal((workflow.match(/uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/g)||[]).length,4);
 assert.equal((workflow.match(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g)||[]).length,4);
 const upload=workflow.split('      - name: Upload desktop green source build\n')[1]?.split('\n\n  secret-scan:')[0];assert.ok(upload);
 assert.match(upload,/uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);assert.match(upload,/name: desktop-green-\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.deepEqual([...upload.matchAll(/^\s+(apps\/sites-workflow\/dist-desktop-write-green\/[^\r\n]+)$/gm)].map(m=>m[1]),['apps/sites-workflow/dist-desktop-write-green/desktop-write-green.html','apps/sites-workflow/dist-desktop-write-green/assets/*.js','apps/sites-workflow/dist-desktop-write-green/assets/*.css']);
 assert.match(upload,/if-no-files-found: error/);assert.match(upload,/include-hidden-files: false/);assert.match(upload,/retention-days: 1/);
});
