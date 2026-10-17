import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildSharedCopyBundle} from './shared-test-copy-sql.mjs';
const root='C:/Sirket/ERP/evidence/ERP-CRM-PREP-20261009/private/infra';
const [inputPath,outputPath]=process.argv.slice(2);
for(const file of [inputPath,outputPath]){const r=file&&path.relative(path.resolve(root),path.resolve(file));if(!file||!path.isAbsolute(file)||r.startsWith('..')||path.isAbsolute(r))throw Error('SHARED_PRIVATE_ARTIFACT_PATH_REQUIRED');}
const bundle=buildSharedCopyBundle(JSON.parse(fs.readFileSync(inputPath,'utf8'))),bytes=Buffer.from(JSON.stringify(bundle));
fs.writeFileSync(outputPath,bytes,{flag:'wx'});
if(process.platform==='win32')execFileSync('pwsh',['-NoProfile','-NonInteractive','-File',path.join(import.meta.dirname,'protect-shared-test-private-file.ps1'),'-Path',outputPath],{stdio:'pipe'});
// Only its artifact hash and non-sensitive bounded totals are public.
console.log(JSON.stringify({bundleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),copyId:bundle.copyId,modules:bundle.moduleManifest.length,businessWrites:0}));
