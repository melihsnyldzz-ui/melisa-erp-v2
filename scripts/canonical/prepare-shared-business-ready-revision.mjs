import fs from 'node:fs';import crypto from 'node:crypto';
import {buildBusinessReadyRevision} from './shared-business-ready-revision-sql.mjs';
const root='C:/Sirket/ERP/evidence/ERP-CRM-EXPAND-20261009/private/infra';
const base=root+'/business-copy-install-bundle.json';const bytes=fs.readFileSync(base);if(crypto.createHash('sha256').update(bytes).digest('hex')!=='b8596bf3faf14e89b85cfecefa936bf426ef6d9bd32b1c7ab41f8da220004500')throw Error('BUSINESS_READY_FROZEN_BASE_BUNDLE');
const revision=buildBusinessReadyRevision(JSON.parse(bytes));const out=root+'/business-ready-revision-install.json';if(fs.existsSync(out))throw Error('BUSINESS_READY_REVISION_ARTIFACT_EXISTS');const serialized=JSON.stringify(revision);fs.writeFileSync(out,serialized,{flag:'wx'});console.log(JSON.stringify({file:out,artifactSHA256:crypto.createHash('sha256').update(serialized).digest('hex'),revisionHash:revision.revision.revisionHash,copyId:revision.copyId,modules:1,businessWrites:0}));
