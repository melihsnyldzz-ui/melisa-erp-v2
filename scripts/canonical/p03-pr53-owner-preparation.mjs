// Pure preparation only. The owner supplies pinned private inputs in memory;
// this module never reads credentials, writes files or changes a runtime.
import {
 buildCrm06StaffRefreshSuccessor,assertCrm06StaffRefreshSuccessor,
 crm06StaffSuccessorProfile,CRM06_STAFF_ERP_PR53_PACKAGE,
 CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_INTEGRATED_CRM_INDEX,
 CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME,
} from './crm06-staff-refresh-successor.mjs';
import {assertCrm06StaffJournalPhysicalEvidence,crm06StaffJournalExcludedPaths,CRM06_STAFF_JOURNAL_PATH} from './crm06-staff-journal-preflight.mjs';
import {validateCompletionDependencyLock} from './terminal-completion-logon.mjs';
import {createHash} from 'node:crypto';
export const PR53_OWNER_VARIANT='erp-crm-pr53-20261018';
export const PR53_OWNER_SUPERVISOR=Object.freeze({packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-8f1167229c8d',sourceCommit:'8f1167229c8d9c10844fc8e1be533487180d2071',manifestSha256:'bfb65fabcbd8eac606c7cf9572337759e53140f6701da0c58c7134b9cc0aa892'});
const reject=()=>{throw Error('P03_PR53_PREPARATION_REJECTED');};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function preparePr53OwnerProfile({parentInputs,erpDependencyLockRef,erpDependencyLock,crmDependencyLockRef,crmDependencyLock,journalEvidenceRef,journalEvidence}){
 if(!parentInputs||Object.getPrototypeOf(parentInputs)!==Object.prototype)reject();
 const source=CRM06_STAFF_INTEGRATED_CRM_PACKAGE.sourceCommit,profile=crm06StaffSuccessorProfile(source,PR53_OWNER_VARIANT);
 if(erpDependencyLockRef?.path!==profile.erpDependencyLockPath||crmDependencyLockRef?.path!==profile.dependencyLockPath||journalEvidenceRef?.path!==profile.journalEvidencePath||!/^[a-f0-9]{64}$/.test(journalEvidenceRef?.sha256??''))reject();
 validateCompletionDependencyLock(erpDependencyLock,CRM06_STAFF_ERP_PR53_PACKAGE,'apps/api');
 validateCompletionDependencyLock(crmDependencyLock,CRM06_STAFF_INTEGRATED_CRM_PACKAGE,'apps/gateway');
 for(const [value,ref] of [[erpDependencyLock,erpDependencyLockRef],[crmDependencyLock,crmDependencyLockRef],[journalEvidence,journalEvidenceRef]])if(createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex')!==ref.sha256)reject();
 const evidence=assertCrm06StaffJournalPhysicalEvidence(journalEvidence,{path:CRM06_STAFF_JOURNAL_PATH,ownerSid:parentInputs.ownerSid,excludedPaths:crm06StaffJournalExcludedPaths(source,PR53_OWNER_VARIANT),source,profileVariant:PR53_OWNER_VARIANT});
 if(evidence.status!=='READY')reject();
 // These fields are always selected here; callers cannot override exact pins.
 const input={...parentInputs,crmPackagePin:{...CRM06_STAFF_INTEGRATED_CRM_PACKAGE},crmIndexSha256:CRM06_STAFF_INTEGRATED_CRM_INDEX,crmDependencyLockRef,supervisorPin:{...PR53_OWNER_SUPERVISOR},journalEvidenceSha256:journalEvidenceRef.sha256,profileVariant:PR53_OWNER_VARIANT,erpCandidate:{packagePin:{...CRM06_STAFF_ERP_PR53_PACKAGE},dependencyLockRef:erpDependencyLockRef,nodeRuntimePin:{...CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME}}};
 const prepared=buildCrm06StaffRefreshSuccessor(input);
 const {baseline,parentActivation,parentAudit,parentSettings,parentHubPin,parentHubStartup,ownerSid}=parentInputs;
 assertCrm06StaffRefreshSuccessor({baseline,parentActivation,parentAudit,parentSettings,parentHubPin,parentHubStartup,ownerSid,currentActivation:prepared.activation,currentSettings:prepared.settings,currentHubPin:prepared.hubPin,currentHubStartup:prepared.hubStartup,receipt:prepared.receipt});
 if(!equal(prepared.settings.supervisor,PR53_OWNER_SUPERVISOR)||prepared.receipt.installed!==false||prepared.receipt.humanAccepted!==false)reject();
 return prepared;
}
