// Executes the real builder body with in-memory filesystem and inert compiler
// substitutes. No package archive, SQL, dependencies or runtime is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
const source=readFileSync(new URL('./build-master-v5-package.mjs',import.meta.url),'utf8').split('\n').filter(line=>!line.startsWith('import ')).join('\n').replaceAll('import.meta.url','moduleUrl');
const base='C:/Users/Xaser/Desktop/ERP/',file='scripts/desktop-empty/build-master-v5-package.mjs';
function simulate(args,checkout,{activePresent=false}={}){
 const reads=[],writes=[],outputs=[];let calls=0;
 const script=base+checkout+'/'+file;
 const context={createHash,path,Buffer,moduleUrl:script,fileURLToPath:u=>u,process:{argv:['node',script,...args],stdout:{write:s=>outputs.push(s)}},
 readFileSync:(f,encoding)=>{reads.push(f);const value=f.endsWith('desktop-write-green.html')?'<script src="/assets/main.js"></script><link href="/assets/main.css">':'synthetic';return encoding==='utf8'?value:Buffer.from(value);},
 readdirSync:dir=>{reads.push(dir);return [{name:'0001.sql'}];},lstatSync:()=>({isSymbolicLink:()=>false,isDirectory:()=>false}),
 writeFileSync:(f,b,options)=>writes.push({f,b:Buffer.from(b),options}),existsSync:f=>activePresent&&f===base+'kurulum/master-v5-package.json',mkdirSync:()=>{},
 inspectDesktopRuntimeTree:()=>{calls++;return {sha256:'d'.repeat(64)};},compileMasterV5Snapshot:()=>{calls++;return {sha256:'e'.repeat(64)};},DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT:'synthetic'};
 vm.runInNewContext(source,context,{timeout:1000});return {reads,writes,outputs,calls};
}
test('each fixed CLI mode scans the intended source while preserving R1 manifest and archive contract',()=>{
 for(const [args,checkout,expected] of [[[],'kaynak-r1','kaynak-r1'],[['--prepare-only'],'kaynak-birimler','kaynak-birimler'],[['--prepare-account-history-only'],'kaynak-hesap-gecmis','kaynak-hesap-gecmis']]){
  const r=simulate(args,checkout),out=r.writes.find(x=>x.f===base+'kurulum/master-v5-package.json');assert.ok(out);const pkg=JSON.parse(out.b.toString());
  assert.equal(pkg.sourceRoot,base+'kaynak-r1');assert.ok(pkg.sources[file]);assert.equal(pkg.snapshotSqlSha256,'e'.repeat(64));assert.equal(pkg.dependencySha256,'d'.repeat(64));assert.equal(r.calls,2);
  assert.ok(r.reads.filter(s=>s.includes('/infra/')||s.includes('/apps/')||s.includes('/scripts/')).every(s=>s.startsWith(base+expected+'/')));
  const archive=r.writes.find(x=>x.f.startsWith(base+'kurulum/master-v5-packages/'));assert.ok(archive);assert.equal(archive.options.flag,'wx');assert.deepEqual(archive.b,out.b);
 }
});
test('unknown and multiple arguments, arbitrary roots, and a foreign importing checkout reject before package IO',()=>{
 for(const args of [['--unknown'],['--prepare-only','--prepare-account-history-only'],['--prepare-account-history-only','--prepare-account-history-only'],['C:/other']])assert.throws(()=>simulate(args,'kaynak-hesap-gecmis'),/MASTER_V5_PACKAGE_ARGUMENTS/);
 for(const checkout of ['kaynak-r1','kaynak-birimler','other'])assert.throws(()=>simulate(['--prepare-account-history-only'],checkout),/MASTER_V5_PACKAGE_SOURCE_REJECTED/);
});
test('account-history candidate uses the real builder without reading or writing the active package',()=>{
 const r=simulate(['--prepare-account-history-candidate-only'],'kaynak-hesap-gecmis',{activePresent:true});
 const active=base+'kurulum/master-v5-package.json',candidate=base+'kurulum/master-v5-account-history-candidate-package.json';
 assert.equal(r.writes.some(w=>w.f===active),false);assert.equal(r.reads.includes(active),false);
 const out=r.writes.find(w=>w.f===candidate);assert.ok(out);const pkg=JSON.parse(out.b.toString());
 assert.equal(pkg.sourceRoot,base+'kaynak-r1');assert.ok(pkg.sources[file]);assert.equal(pkg.snapshotSqlSha256,'e'.repeat(64));assert.equal(pkg.dependencySha256,'d'.repeat(64));assert.equal(r.calls,2);
 assert.ok(r.reads.filter(s=>s.includes('/infra/')||s.includes('/apps/')||s.includes('/scripts/')).every(s=>s.startsWith(base+'kaynak-hesap-gecmis/')));
 const archived=r.writes.find(w=>w.f.startsWith(base+'kurulum/master-v5-packages/'));assert.ok(archived);assert.equal(archived.options.flag,'wx');assert.deepEqual(archived.b,out.b);
});
test('account-history candidate rejects foreign checkout and flag combinations before IO',()=>{
 for(const checkout of ['kaynak-r1','kaynak-birimler','other'])assert.throws(()=>simulate(['--prepare-account-history-candidate-only'],checkout),/MASTER_V5_PACKAGE_SOURCE_REJECTED/);
 for(const args of [['--prepare-account-history-candidate-only','--prepare-only'],['--prepare-account-history-candidate-only','--prepare-account-history-only']])assert.throws(()=>simulate(args,'kaynak-hesap-gecmis'),/MASTER_V5_PACKAGE_ARGUMENTS/);
});
