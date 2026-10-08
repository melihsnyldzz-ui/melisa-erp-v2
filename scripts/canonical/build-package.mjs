import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';
import { renderMigrationProof } from './migration-proof.mjs';
const repo=path.resolve(import.meta.dirname,'../..');
const destination=path.resolve(process.argv[2]||'');
if(!process.argv[2]||fs.existsSync(destination))throw Error('NEW_ABSOLUTE_RELEASE_DESTINATION_REQUIRED');
if(cp.execFileSync('git',['status','--porcelain'],{cwd:repo}).toString().trim())throw Error('CLEAN_COMMITTED_SOURCE_REQUIRED');
const sourceCommit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo}).toString().trim();
const packageId='CANONICAL-TEST-'+sourceCommit.slice(0,12);
fs.mkdirSync(destination,{recursive:true});
const archive=path.join(destination,'source.tar');
const migrationFiles=cp.execFileSync('git',['ls-files','scripts/migration'],{cwd:repo}).toString().trim().split(/\r?\n/).filter(Boolean);
if(migrationFiles.some(file=>!/^scripts\/migration\/[a-z0-9._/-]+\.(mjs|sql|md)$/i.test(file)||/(?:^|\/)(?:private|exports?|evidence)(?:\/|\.)/i.test(file)))throw Error('MIGRATION_SOURCE_ALLOWLIST_REJECTED');
const migrationPaths=migrationFiles.length?['scripts/migration','ERP_MIGRATION_PLAN.md','STATUS.md']:[];
cp.execFileSync('git',['archive','--format=tar','--output='+archive,sourceCommit,'apps/api','apps/web-admin','apps/sites-workflow','packages','scripts/canonical','docs/erp-v2/canonical-20261003',...migrationPaths],{cwd:repo});
cp.execFileSync('tar',['-xf',archive,'-C',destination]);fs.unlinkSync(archive);
function npm(args,cwd,env=process.env){cp.execFileSync(process.env.ComSpec||'cmd.exe',['/d','/c','npm.cmd',...args],{cwd,env,stdio:'inherit'});}
npm(['ci','--no-audit','--no-fund'],destination+'/apps/api');
npm(['ci','--no-audit','--no-fund'],destination+'/apps/web-admin');
const env={...process.env,VITE_API_BASE_URL:'http://192.168.1.46:4114',VITE_MELISA_PILOT:'true',VITE_DEMO_MODE:'false',VITE_LOCAL_PASSWORDLESS_LOGIN:'false'};
npm(['run','build','--','--outDir','dist-baseline-proof'],destination+'/apps/web-admin',env);
const expected=JSON.parse(fs.readFileSync(repo+'/docs/erp-v2/canonical-20261003/web-rebuild-proof.json')).files;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const row of expected)if(sha(fs.readFileSync(destination+'/apps/web-admin/dist-baseline-proof/'+row.path))!==row.sha256)throw Error('BASELINE_REBUILD_MISMATCH:'+row.path);
npm(['run','build','--','--outDir','dist-test'],destination+'/apps/web-admin',{...env,VITE_API_BASE_URL:'http://127.0.0.1:4144'});
const index=destination+'/apps/web-admin/dist-test/index.html';
fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<title>','<title>TEST · ').replace('<body>','<body><div style="position:fixed;bottom:0;right:0;z-index:2147483647;background:#854d0e;color:white;padding:4px 12px;font:12px sans-serif">TEST · Salt okunur · '+sourceCommit.slice(0,12)+'</div>'));
npm(['ci','--no-audit','--no-fund'],destination+'/apps/sites-workflow');
npm(['run','build'],destination+'/apps/sites-workflow',{...env,VITE_API_BASE_URL:'http://127.0.0.1:4144',VITE_VEGA_PRODUCTS_BASE_URL:'http://127.0.0.1:4144',VITE_TEST_READ_ONLY:'false'});
// The normal working face carries product information, not package/debug labels.
for(const page of ['is-akisi-taslagi.html','legacy-admin.html']){
 const f=destination+'/apps/sites-workflow/dist/'+page;
 const label=page==='is-akisi-taslagi.html'?'TEST · SQL iş akışları · LIVE’dan ayrı':'TEST · Ayrı örnek ekran';
 fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('<title>','<title>TEST · ').replace('<body>','<body><div style="position:fixed;bottom:0;right:0;z-index:2147483647;background:#854d0e;color:white;padding:4px 12px;font:12px sans-serif">'+label+' · '+sourceCommit.slice(0,12)+'</div>'));
}
const stage4Copy=process.argv.includes('--stage4-copy');
if(stage4Copy)npm(['run','build','--','--outDir','dist-copy'],destination+'/apps/sites-workflow',{...env,VITE_API_BASE_URL:'http://127.0.0.1:4154',VITE_VEGA_PRODUCTS_BASE_URL:'http://127.0.0.1:4154',VITE_TEST_READ_ONLY:'false'});
if(migrationFiles.length){
 const summary=JSON.parse(fs.readFileSync(destination+'/docs/erp-v2/canonical-20261003/migration-public-summary.json','utf8'));
 fs.writeFileSync(destination+'/apps/sites-workflow/dist/migration-proof.html',renderMigrationProof(summary,sourceCommit));
}
function walk(root,rel=''){return fs.readdirSync(path.join(root,rel),{withFileTypes:true}).flatMap(d=>d.isSymbolicLink()?(()=>{throw Error('RELEASE_SYMLINK_REJECTED');})():['node_modules','.canonical-runtime'].includes(d.name)?[]:d.isDirectory()?walk(root,path.posix.join(rel,d.name)):[path.posix.join(rel,d.name)]);}
const files=walk(destination).map(file=>({path:file,sha256:sha(fs.readFileSync(destination+'/'+file))}));
fs.writeFileSync(destination+'/release-manifest.json',JSON.stringify({packageId,sourceCommit,node:process.version,builtAt:new Date().toISOString(),baselineReproduced:true,webUi:'sites-v70-sql',webStorage:'sql-business-records; browser-pending-requests-only',sitesSourceCommit:'d559243a62080c8de5ce9ba1e2ba2d6231c098b9',apiPort:4144,nativePort:4146,webPort:5194,database:'MELISA_ERP_SIRKET_TEST_20260929_01',writes:true,writeScope:'existing-named-test-records',nativeWrites:false,...(stage4Copy?{stage4Copy:{apiPort:4154,nativePort:4156,webPort:5204,loopbackOnly:true,database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01',nativeWrites:false,externalOperations:false,actualT1:false}}:{}),files},null,2));
console.log(JSON.stringify({packageId,sourceCommit,files:files.length,destination}));
