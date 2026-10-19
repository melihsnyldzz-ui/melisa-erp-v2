// Source-only exporter. Reads a FIXED local Git commit; never imports business
// scripts, fetches a remote, inspects runtime files, or executes SQL.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SOURCE_SHA,SYNTHETIC_TARGET,sourceFileAllowed,buildSourceInventory,preparationDigest,compileSyntheticPreparation} from './full-synthetic-preparation.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const mode=process.argv[2];
if(process.argv.length!==3||!['--check','--write'].includes(mode))throw Error('USE_EXACTLY_CHECK_OR_WRITE');
const git=args=>{
  const r=spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SYSTEMROOT|WINDIR|HOME|USERPROFILE|LANG|LC_ALL|TEMP|TMP)$/i.test(k)))});
  if(r.error||r.status!==0)throw Error('PINNED_LOCAL_GIT_SOURCE_UNAVAILABLE');
  return r.stdout;
};
const paths=git(['ls-tree','-r','--name-only',SOURCE_SHA]).trim().split('\n').filter(sourceFileAllowed);
const manifest=buildSourceInventory(paths.map(path=>({path,text:git(['show',SOURCE_SHA+':'+path])})));
const profile={schemaVersion:'melisa-full-synthetic-profile.v1',sourceSha:SOURCE_SHA,inventoryDigest:preparationDigest(manifest),target:{...SYNTHETIC_TARGET},origin:{kind:'FRESH_SYNTHETIC',backupUsed:false,businessDataUsed:false},externalProvidersDisabled:true};
const plan=compileSyntheticPreparation(manifest,profile);
for(const [name,value]of [['erp-source-manifest.json',manifest],['synthetic-profile.json',profile],['synthetic-bootstrap-plan.json',plan]]){
  const destination=new URL('../../infra/cloud-full-test/'+name,import.meta.url),text=JSON.stringify(value,null,2)+'\n';
  if(mode==='--write')writeFileSync(destination,text);
  else if(readFileSync(destination,'utf8')!==text)throw Error('COMMITTED_PREPARATION_DIFFERS_FROM_PINNED_SOURCE');
}
console.log(JSON.stringify({sourceSha:SOURCE_SHA,files:manifest.files.length,objects:manifest.objects.length,reviewedMissingBaseDDL:manifest.reviewedMissingBaseDDL.length,unresolvedTemplates:manifest.unresolvedTemplates.length,inventoryDigest:profile.inventoryDigest,canApply:plan.canApply,canStart:plan.canStart,sqlApplied:false,mode}));
