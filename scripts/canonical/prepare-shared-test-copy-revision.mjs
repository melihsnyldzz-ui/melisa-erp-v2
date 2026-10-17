import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildSharedCopyRevision} from './shared-test-copy-revision-sql.mjs';
const root='C:/Sirket/ERP/evidence/ERP-CRM-PREP-20261009/private/infra/';
const bundleBytes=fs.readFileSync(root+'shared-copy-install-bundle.json');
if(crypto.createHash('sha256').update(bundleBytes).digest('hex')!=='2ac113ae5203e3d41b4776a2e68dacead6eec36229b5b2bdb1bba7102c24ecc6')throw Error('SHARED_REVISION_BASE_BUNDLE_HASH');
// The original bundle contains credentials: only typed non-secret fields enter
// the output. No old artifact is rewritten and no new credential is generated.
const bundle=JSON.parse(bundleBytes),input=JSON.parse(fs.readFileSync(root+'shared-input.json','utf8'));
const artifact=buildSharedCopyRevision(bundle,input.schema);
const bytes=JSON.stringify(artifact,null,2)+'\n',out=root+'shared-copy-adapter-revision-01-v3.json';
fs.writeFileSync(out,bytes,{flag:'wx',encoding:'utf8'});
process.stdout.write(JSON.stringify({artifact:out,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),copyId:artifact.copyId,revisionHash:artifact.revision.revisionHash,changedObjects:artifact.replacements.map(m=>m.name),businessWrites:0})+'\n');
