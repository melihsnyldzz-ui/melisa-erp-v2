import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {buildBusinessDailyRevision} from './shared-business-daily-revision-sql.mjs';
const root='C:/Sirket/ERP/evidence/ERP-CRM-EXPAND-20261009/private/infra';
const outRoot='C:/Sirket/ERP/evidence/ERP-FINAL04-20261010/private/source';
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const base=read('business-copy-install-bundle.json'),old3=read('business-effects-performance-revision-install.json'),input=read('business-copy-input.json'),profile=base.config.copyContext;
let selectedDaily;
if(process.argv[2]){const value=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));selectedDaily=value.selection??value;}
else{
 const suppliers=profile.suppliers.filter(s=>s.currency==='TRY'&&s.sourceKnown&&s.accountIdentityVerified&&!s.quarantined&&!s.excludedLL).sort((a,b)=>Number(a.accountId)-Number(b.accountId));
 const groups=suppliers.map(s=>({supplier:s,products:profile.products.filter(p=>p.supplierId===s.id&&p.purchaseInvoiceAccountId===s.accountId&&p.purchaseCurrency==='TRY'&&p.identityVerified&&p.sourceKnown&&!p.quarantined&&Number(p.stockExact3)>=1&&Number(p.purchasePriceExact8)>0&&Number(p.purchasePriceExact8)<=250&&p.quotes.filter(q=>q.currency==='TRY'&&q.type==='sale'&&q.mainUnit&&q.verified&&Number(q.priceExact8)>0&&Number(q.priceExact8)<=250).length===1).sort((a,b)=>Number(a.id)-Number(b.id))})).filter(g=>g.products.length>=1);
 if(!groups.length)throw Error('BUSINESS_DAILY_NO_VERIFIED_TRY_PAIR');
 const customer=profile.customers.filter(c=>c.currency==='TRY'&&c.sourceKnown&&c.accountIdentityVerified&&!c.quarantined&&!c.excludedLL).sort((a,b)=>Number(a.accountId)-Number(b.accountId))[0];if(!customer)throw Error('BUSINESS_DAILY_NO_VERIFIED_TRY_CUSTOMER');
 selectedDaily={currency:'TRY',productIds:groups[0].products.slice(0,2).map(p=>p.id),supplierAccountId:groups[0].supplier.accountId,customerAccountId:customer.accountId,financeAccountId:'20043'};
}
const artifact=buildBusinessDailyRevision({base,old3,schema:input.schema,selectedDaily});
fs.mkdirSync(outRoot,{recursive:true});
const out=process.argv[3]??path.join(outRoot,'business-daily-revision-install.json');
const serialized=JSON.stringify(artifact);fs.writeFileSync(out,serialized,{flag:'wx'});
const selectionFile=path.join(outRoot,'business-daily-selected-scope.json');if(!fs.existsSync(selectionFile))fs.writeFileSync(selectionFile,JSON.stringify({selection: selectedDaily,dailyScopeHash:artifact.revision.dailyScopeHash,selectionMethod:process.argv[2]?'EXPLICIT_OWNER_SELECTION':'DETERMINISTIC_PROFILE_TRY_CANDIDATE_REQUIRES_OWNER_REVIEW',actualT1:false,openingHumanAccepted:false,realFinancialOpeningAuthorized:false},null,2),{flag:'wx'});
console.log(JSON.stringify({artifact:out,artifactSHA256:crypto.createHash('sha256').update(serialized).digest('hex'),revisionHash:artifact.revision.revisionHash,dailyScopeHash:artifact.revision.dailyScopeHash,selectedDaily,modules:artifact.revision.modules.length,nativeChecksChanged:0,businessWrites:0,needsOwnerRehearsal:true}));
