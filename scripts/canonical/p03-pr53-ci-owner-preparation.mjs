// Pure preparation only. The owner supplies pinned private inputs in memory;
// this module never reads credentials, writes files or changes a runtime.
import {
 buildCrm06StaffRefreshSuccessor,assertCrm06StaffRefreshSuccessor,
 crm06StaffSuccessorProfile,CRM06_STAFF_ERP_PR53_CI_PACKAGE,CRM06_STAFF_ERP_PR54_READS_PACKAGE,
 CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_INTEGRATED_CRM_INDEX,
 CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME,
} from './crm06-staff-refresh-successor.mjs';
import {assertCrm06StaffJournalPhysicalEvidence,crm06StaffJournalExcludedPaths,CRM06_STAFF_JOURNAL_PATH} from './crm06-staff-journal-preflight.mjs';
import {validateCompletionDependencyLock} from './terminal-completion-logon.mjs';
import {createHash} from 'node:crypto';
export const PR53_CI_OWNER_VARIANT='erp-crm-pr53-ci-20261018';
export const PR53_CI_OWNER_SUPERVISOR=Object.freeze({packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a',sourceCommit:'13bdf75a032ae8f694354a2e57b6ed382aec2f17',manifestSha256:'195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624'});
const reject=()=>{throw Error('P03_PR53_CI_PREPARATION_REJECTED');};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function preparePr53CiOwnerProfile({parentInputs,erpDependencyLockRef,erpDependencyLock,crmDependencyLockRef,crmDependencyLock,journalEvidenceRef,journalEvidence}){
 if(!parentInputs||Object.getPrototypeOf(parentInputs)!==Object.prototype)reject();
 const source=CRM06_STAFF_INTEGRATED_CRM_PACKAGE.sourceCommit,profile=crm06StaffSuccessorProfile(source,PR53_CI_OWNER_VARIANT);
 if(erpDependencyLockRef?.path!==profile.erpDependencyLockPath||crmDependencyLockRef?.path!==profile.dependencyLockPath||journalEvidenceRef?.path!==profile.journalEvidencePath||!/^[a-f0-9]{64}$/.test(journalEvidenceRef?.sha256??''))reject();
 validateCompletionDependencyLock(erpDependencyLock,CRM06_STAFF_ERP_PR53_CI_PACKAGE,'apps/api');
 validateCompletionDependencyLock(crmDependencyLock,CRM06_STAFF_INTEGRATED_CRM_PACKAGE,'apps/gateway');
 for(const [value,ref] of [[erpDependencyLock,erpDependencyLockRef],[crmDependencyLock,crmDependencyLockRef],[journalEvidence,journalEvidenceRef]])if(createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex')!==ref.sha256)reject();
 const evidence=assertCrm06StaffJournalPhysicalEvidence(journalEvidence,{path:CRM06_STAFF_JOURNAL_PATH,ownerSid:parentInputs.ownerSid,excludedPaths:crm06StaffJournalExcludedPaths(source,PR53_CI_OWNER_VARIANT),source,profileVariant:PR53_CI_OWNER_VARIANT});
 if(evidence.status!=='READY')reject();
 // These fields are always selected here; callers cannot override exact pins.
 const input={...parentInputs,crmPackagePin:{...CRM06_STAFF_INTEGRATED_CRM_PACKAGE},crmIndexSha256:CRM06_STAFF_INTEGRATED_CRM_INDEX,crmDependencyLockRef,supervisorPin:{...PR53_CI_OWNER_SUPERVISOR},journalEvidenceSha256:journalEvidenceRef.sha256,profileVariant:PR53_CI_OWNER_VARIANT,erpCandidate:{packagePin:{...CRM06_STAFF_ERP_PR53_CI_PACKAGE},dependencyLockRef:erpDependencyLockRef,nodeRuntimePin:{...CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME}}};
 const prepared=buildCrm06StaffRefreshSuccessor(input);
 const {baseline,parentActivation,parentAudit,parentSettings,parentHubPin,parentHubStartup,ownerSid}=parentInputs;
 assertCrm06StaffRefreshSuccessor({baseline,parentActivation,parentAudit,parentSettings,parentHubPin,parentHubStartup,ownerSid,currentActivation:prepared.activation,currentSettings:prepared.settings,currentHubPin:prepared.hubPin,currentHubStartup:prepared.hubStartup,receipt:prepared.receipt});
 if(!equal(prepared.settings.supervisor,PR53_CI_OWNER_SUPERVISOR)||prepared.receipt.installed!==false||prepared.receipt.humanAccepted!==false)reject();
 return prepared;
}

// Exact application candidate; no IO, no installation and no mutation of earlier profiles.
export function preparePr54ReadOwnerProfile({parentInputs,erpDependencyLockRef,erpDependencyLock,crmDependencyLockRef,crmDependencyLock,journalEvidenceRef,journalEvidence,supervisorPin}){
 if(!supervisorPin||!/^[a-f0-9]{40}$/.test(supervisorPin.sourceCommit??'')||!/^[a-f0-9]{64}$/.test(supervisorPin.manifestSha256??'')||supervisorPin.packageRoot!=='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261019-'+supervisorPin.sourceCommit.slice(0,12))reject();
 if(!parentInputs||Object.getPrototypeOf(parentInputs)!==Object.prototype)reject();
 const source=CRM06_STAFF_INTEGRATED_CRM_PACKAGE.sourceCommit,profile=crm06StaffSuccessorProfile(source,'erp-crm-pr54-reads-20261019');
 if(erpDependencyLockRef?.path!==profile.erpDependencyLockPath||crmDependencyLockRef?.path!==profile.dependencyLockPath||journalEvidenceRef?.path!==profile.journalEvidencePath||!/^[a-f0-9]{64}$/.test(journalEvidenceRef?.sha256??''))reject();
 validateCompletionDependencyLock(erpDependencyLock,CRM06_STAFF_ERP_PR54_READS_PACKAGE,'apps/api');
 validateCompletionDependencyLock(crmDependencyLock,CRM06_STAFF_INTEGRATED_CRM_PACKAGE,'apps/gateway');
 for(const [value,ref] of [[erpDependencyLock,erpDependencyLockRef],[crmDependencyLock,crmDependencyLockRef],[journalEvidence,journalEvidenceRef]])if(createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex')!==ref.sha256)reject();
 const evidence=assertCrm06StaffJournalPhysicalEvidence(journalEvidence,{path:CRM06_STAFF_JOURNAL_PATH,ownerSid:parentInputs.ownerSid,excludedPaths:crm06StaffJournalExcludedPaths(source,'erp-crm-pr54-reads-20261019'),source,profileVariant:'erp-crm-pr54-reads-20261019'});
 if(evidence.status!=='READY')reject();
 // These fields are always selected here; callers cannot override exact pins.
 const input={...parentInputs,crmPackagePin:{...CRM06_STAFF_INTEGRATED_CRM_PACKAGE},crmIndexSha256:CRM06_STAFF_INTEGRATED_CRM_INDEX,crmDependencyLockRef,supervisorPin:{...supervisorPin},journalEvidenceSha256:journalEvidenceRef.sha256,profileVariant:'erp-crm-pr54-reads-20261019',erpCandidate:{packagePin:{...CRM06_STAFF_ERP_PR54_READS_PACKAGE},dependencyLockRef:erpDependencyLockRef,nodeRuntimePin:{...CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME}}};
 const prepared=buildCrm06StaffRefreshSuccessor(input);
 const {baseline,parentActivation,parentAudit,parentSettings,parentHubPin,parentHubStartup,ownerSid}=parentInputs;
 assertCrm06StaffRefreshSuccessor({baseline,parentActivation,parentAudit,parentSettings,parentHubPin,parentHubStartup,ownerSid,currentActivation:prepared.activation,currentSettings:prepared.settings,currentHubPin:prepared.hubPin,currentHubStartup:prepared.hubStartup,receipt:prepared.receipt});
 if(!equal(prepared.settings.supervisor,supervisorPin)||prepared.receipt.installed!==false||prepared.receipt.humanAccepted!==false)reject();
 return prepared;
}
