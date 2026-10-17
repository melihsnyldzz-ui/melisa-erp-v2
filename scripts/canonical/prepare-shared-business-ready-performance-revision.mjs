import fs from 'node:fs';import crypto from 'node:crypto';
import {buildBusinessReadyPerformanceRevision} from './shared-business-ready-performance-revision-sql.mjs';
const root='C:/Sirket/ERP/evidence/ERP-CRM-EXPAND-20261009/private/infra';
function read(name,hash){const bytes=fs.readFileSync(root+'/'+name);if(crypto.createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('BUSINESS_READY_PERFORMANCE_FROZEN_ARTIFACT');return JSON.parse(bytes);}
const base=read('business-copy-install-bundle.json','b8596bf3faf14e89b85cfecefa936bf426ef6d9bd32b1c7ab41f8da220004500');
const old=read('business-ready-revision-install.json','460727dffad8913993c2f60c24cfe71ee066acf297f0a6526cb70c12cb0a589d');
const revision=buildBusinessReadyPerformanceRevision(base,old);const out=root+'/business-ready-performance-revision-install.json';const serialized=JSON.stringify(revision);fs.writeFileSync(out,serialized,{flag:'wx'});console.log(JSON.stringify({file:out,artifactSHA256:crypto.createHash('sha256').update(serialized).digest('hex'),revisionHash:revision.revision.revisionHash,copyId:revision.copyId,modules:1,businessWrites:0}));
