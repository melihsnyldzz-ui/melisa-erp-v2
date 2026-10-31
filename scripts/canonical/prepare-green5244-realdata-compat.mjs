// Source-only overlay preparation. No driver, service, profile, auth or deployment.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error('GREEN5244_'+c);};
const releases='C:/Sirket/ERP/releases/';
export const GREEN5244_PREP=Object.freeze({
 web:releases+'CLEAN-ERP-WEB-20261026-349fae-b6-10b6535a-B5LAZY-OFFLINE',webManifest:'ebb1ce99867a108f96b7fc2feea39b9904b0b023d052aa47a88c46f07f5150ed',
 data:releases+'CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778',dataManifest:'0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64',
 cleanApi:releases+'CLEAN-ERP-20261026-349fae354e2a-b6de5305-GREENCOMBINED-OFFLINE',cleanApiManifest:'3aa51a25970b0efe512e865b5572c0378931a5eb848e1ab81ab571f4de19178f',
 context:'C:/Sirket/ERP/evidence/ERP-GREENCOMBINED-APIWEB-PREFLIGHT-20261026/private/business-catalog-20261027/active-negative-read-context.json',
 identity:'C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/existing-user-binding-v2.json',
 unknown:'C:/Sirket/ERP/evidence/ERP-CARICOMPLETION01-20261008/private/review-20261027/card5536-contract.json',
 destination:'C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/source-candidate-v2',
 overlay:'apps/sites-workflow/src/workflow/currentProductCatalogModel.mjs'
});
const read=file=>{const stat=fs.lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink(),'REGULAR_FILE');return fs.readFileSync(file);};
function manifest(root,expected){const bytes=read(root+'/release-manifest.json');check(sha(bytes)===expected,'MANIFEST_PIN');return JSON.parse(bytes);}
function payload(root,m,file){const item=m.files.find(f=>f.path===file);check(item,'DECLARED_FILE');const bytes=read(root+'/'+file);check(sha(bytes)===item.sha256.toLowerCase(),'PAYLOAD_PIN');return bytes;}
export function prepareGreen5244RealdataSourceCandidate(){
 const p=GREEN5244_PREP;check(!fs.existsSync(p.destination),'DESTINATION_EXISTS');
 const web=manifest(p.web,p.webManifest),data=manifest(p.data,p.dataManifest),api=manifest(p.cleanApi,p.cleanApiManifest);
 check(web.frontendReadPatchCommit==='10b6535ab47f6fcab645f55dfd3266cf64864cfa'&&web.frontendPatchCommit==='b6de5305ba46478997ea77beaa41fdb1bb2b3af0'&&web.synthetic===true&&api.database==='MELISA_ERP_CLEAN_TEST_20261022'&&data.database==='MELISA_ERP_SIRKET_TEST_20260929_01','BASE_SCOPE');
 const before=payload(p.web,web,p.overlay),after=payload(p.data,data,p.overlay),context=JSON.parse(read(p.context)),identity=JSON.parse(read(p.identity)),unknown=JSON.parse(read(p.unknown));
 const sharedDependencies=['apps/api/src/services/currentProductCatalogContext.mjs','apps/api/src/services/finalCatalogContext.mjs'].map(file=>({path:file,bytes:payload(p.data,data,file)}));
 // These are pure shared validators imported by the frontend, not API server overlays.
 for(const dependency of sharedDependencies)check(!/\b(?:process\.env|fetch\(|readFile|ConnectionPool|createServer)\b/.test(dependency.bytes.toString('utf8')),'PURE_SHARED_VALIDATOR');
 check(context.runId==='PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a'&&context.actualT1===false,'CURRENT_DATA_CONTEXT');
 const runIds=new Set(context.ancestry.map(a=>a.runId));for(const run of ['PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7','PRODUCT-b1e30e7c-1349-47b0-b9e8-cad0ae164cc8',context.runId])check(runIds.has(run),'PRESERVED_STOCK_ANCESTRY');
 const names=['apps/sites-workflow/ornek-akis.html','apps/sites-workflow/src/styles/erp-modern.css',...['workCollections.js','workingCatalogSession.mjs','workCustomers.js','workSuppliers.js','currencyAccountPresentation.mjs','workSupplierPaymentsModel.mjs','testAdminSession.mjs','workCatalogModel.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n)];
 const preserved=names.map(file=>({path:file,sha256:sha(payload(p.web,web,file))}));
 const nativeUsers=identity.rows.find(r=>r.database===data.database)?.users,cleanUsers=identity.rows.find(r=>r.database===api.database)?.users;
 check(Array.isArray(nativeUsers)&&Array.isArray(cleanUsers),'EXISTING_USER_EVIDENCE');
 const userPresent=cleanUsers.some(c=>c.username==='semih'&&nativeUsers.some(n=>n.username===c.username&&n.role_code===c.role_code&&n.is_active&&n.role_active));
 const scalar=unknown.columns.find(c=>c.tableName==='customers'&&c.name==='balance');check(scalar?.is_nullable===false,'UNKNOWN_SCALAR_BOUNDARY');
 const body={schemaVersion:'melisa-green5244-realdata-source-overlay.v1',kind:'UNBUILT_SOURCE_OVERLAY_NOT_INSTALLABLE',installed:false,executionAllowed:false,sourceWrites:0,targetWrites:0,actualT1:false,
  bases:{web:{root:p.web,manifest:p.webManifest},data:{root:p.data,manifest:p.dataManifest},cleanApiReferenceOnly:{root:p.cleanApi,manifest:p.cleanApiManifest,notBusinessBackend:true}},
  target:{requestedWebPort:5244,assumedDatabase:data.database,server:'Semih\\MELISADEV',normalActorMapped:userPresent,selection:'REVIEW_ONLY_NOT_INSTALLED'},
  overlay:{path:p.overlay,beforeSha256:sha(before),afterSha256:sha(after),donor:'Existing accepted TEST125 catalog component; no new model implementation'},sharedDependencies:sharedDependencies.map(d=>({path:d.path,sha256:sha(d.bytes),purpose:'Frontend pure shared validator; not a running backend'})),preserved,
  contextEvidence:{file:p.context,sha256:sha(read(p.context)),runId:context.runId,productCount:context.productCount,priceCount:context.priceCount},
  blockers:['5244 session resolver only admits CLEAN/4194; no coherent real-data entry/actor binding exists',...(userPresent?[]:['Existing normal CLEAN user is not an equivalent existing user in TEST125; never map by numeric ID or borrow another role']),'customers/suppliers scalar balance NOT NULL/default0; UNKNOWN new-card storage/legacy DTO contract unresolved','New finance contexts include finite synthetic cohorts; a real-data backend adapter and same-DB write contract must be proved before enabling operations','Source overlay is not compiled; API/frontend/native package and controlled owner start/rollback binding are not assembled'],
  nextControlledTransition:['Prepare a reviewed single-DB backend/frontend/native package and exact existing actor mapping; do not pair CLEAN auth with TEST125 business reads','Preserve 5244 accepted CSS/finance lazy-read sources; compile the catalog overlay only after entry/backend contract is supported','Fresh exclusive ERP ownership, package/DB/T1false pins, profile before-images and current backup; no old maintenance receipt reuse','Switch only the explicitly admitted API+web pair; preserve5194 and CRM, no account/role/grant or financial/migration writes','Verify normal login, one-DB product/customer/supplier/currency reads and UNKNOWN/write denials; no human PASS by fixtures','On failed read-only postcheck return exact API/web startup/profile before-images with CAS; never restore/reset a business DB or borrow an old PID']};
 const result={...body,candidateHash:sha(Buffer.from(JSON.stringify(body)))};
 for(const item of [{path:p.overlay,bytes:after},...sharedDependencies]){fs.mkdirSync(path.dirname(p.destination+'/'+item.path),{recursive:true});fs.writeFileSync(p.destination+'/'+item.path,item.bytes,{flag:'wx'});}fs.writeFileSync(p.destination+'/candidate.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
