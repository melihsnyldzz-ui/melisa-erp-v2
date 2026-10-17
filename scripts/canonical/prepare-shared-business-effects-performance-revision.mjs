import fs from 'node:fs';import crypto from 'node:crypto';
import {buildBusinessEffectsPerformanceRevision} from './shared-business-effects-performance-revision-sql.mjs';
const root='C:/Sirket/ERP/evidence/ERP-CRM-EXPAND-20261009/private/infra';
function read(name,hash){const bytes=fs.readFileSync(root+'/'+name);if(hash&&crypto.createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('BUSINESS_EFFECTS_FROZEN_ARTIFACT');return JSON.parse(bytes);}
const base=read('business-copy-install-bundle.json','b8596bf3faf14e89b85cfecefa936bf426ef6d9bd32b1c7ab41f8da220004500');
const old1=read('business-ready-revision-install.json','460727dffad8913993c2f60c24cfe71ee066acf297f0a6526cb70c12cb0a589d');
const old2=read('business-ready-performance-revision-install.json','746ee438099de4a3d9116806d2cbcd247265162720f17722ef97906dad0ba157');
const capture=read('business-effects-baseline-capture.json');
const revision=buildBusinessEffectsPerformanceRevision(base,old1,old2,capture);const out=root+'/business-effects-performance-revision-install.json';const serialized=JSON.stringify(revision);fs.writeFileSync(out,serialized,{flag:'wx'});console.log(JSON.stringify({file:out,artifactSHA256:crypto.createHash('sha256').update(serialized).digest('hex'),revisionHash:revision.revision.revisionHash,copyId:revision.copyId,modules:2,residuals:37,businessWrites:0}));
