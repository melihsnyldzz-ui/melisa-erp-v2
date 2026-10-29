// Fixed passive B6 owner packaging. No SQL, service/task, owner IPC or install.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const SCOPE='TEST125-API-B6-ca620bac-20261028';
const APP_SOURCE='ca620bac30f96034b33d4410dc43576a38a38707';
const SOURCE_ROOT=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
const RELEASES=String.raw`C:\Sirket\ERP\releases`;
const CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION');
const ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-SQLCOLLATION');
const PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\sql-collation-recovered-20261029`;
const PROOF=path.win32.join(PRIVATE,'owner-preparation');
const VERIFIED_PRODUCER=path.win32.join(PROOF,'verified-owner-producer.mjs');
// A distinct, finite producer generation. The historical SQLCOLLATION roots
// above remain literal history inputs, never aliases for these new outputs.
const REHEARSAL_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3');
const REHEARSAL_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3');
const REHEARSAL_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-native-rehearsal-debafecb-20261029`;
const REHEARSAL_PROOF=path.win32.join(REHEARSAL_PRIVATE,'owner-preparation-v3');
const REHEARSAL_VERIFIER=path.win32.join(REHEARSAL_PROOF,'verified-owner-producer.mjs');
const CANDIDATE_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY');
const CANDIDATE_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-DEBAFECB-APPLY');
const CANDIDATE_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-candidate-apply-debafecb-20261029`;
const CANDIDATE_PROOF=path.win32.join(CANDIDATE_PRIVATE,'owner-preparation');
const CANDIDATE_VERIFIER=path.win32.join(CANDIDATE_PROOF,'verified-owner-producer.mjs');
const CANDIDATE_PURPOSE='CandidateMetadataApply';
const CANDIDATE_CURRENT_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-PERMHASH-V3');
const CANDIDATE_CURRENT_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-PERMHASH-V3');
const CANDIDATE_CURRENT_CORE_HASH='cfc30ab5e3ef7774c92eb2085d66adabc1d0359d7343e63f8eb727ab7d40383f';
const CANDIDATE_CURRENT_ROUTER_HASH='a275fdbe5fc009feeb10f59c71cd915734303c91c2b4c31f2afad255c5de2f58';
const CANDIDATE_CURRENT_SOURCE='f18f7bbec0d95ac10e3be91bd5f7137819f16514';
const CANDIDATE_CURRENT_ENTRY_HASH='9d572b91c4923761318d1d4a3a72ee4fa30e2ba9a2d509ac5377fc502b41a22e';
const CANDIDATE_CURRENT_ROUTER_ENTRY_HASH='99c6c764aaadb702a740f297d1ed8e5564cdc42f862b9703c2cdab8dfee25379';
const CANDIDATE_INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'3f7d2484310246df0b01d8b1692d16fdfc70b75a4545c0344bcb941118110642',
 'current-erp-processes.before.json':'3e9a6a8f96185677a654a9b2bd7e890ab838773c424dcc35b1532b928f9f11b8',
 'current-task.before.xml':'e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'d30cabd363a571ee0e21627b9304a45358ea26f1b10cd4bb7fab71faa0d53b66',
 'current-entry-hold-capture.json':'760627aa903879b54a7e7a5d6d04ae260a104de14f15304924f2037f009268e6',
});
// Missing preparation data is a closed source blocker, not a caller option.
// Exact fresh capture hashes are filled only from the owner's read-only case.
const REHEARSAL_INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'2f066cc82af4fe23337a3469091aad40d6d065a66af72f60db34f2e16152c364',
 'current-erp-processes.before.json':'81862843a2595587771a8779b23a965b3139cbd8145680af52e4a663c7d2cc17',
 'current-task.before.xml':'e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'c2410cb9a80398f662096f65c694690ceddf49cedd90f792fbd465a38b49119f',
 'current-entry-hold-capture.json':'56e5dcf4fdd2aff555e7f1b3828e165cf587c57fde9aa66eafa2fbaa663111d0',
});
const WRITER_SCOPE='TEST125-API-B6-WRITER-20261029';
const WRITER_APP_SOURCE='1033566d594ad7c02b8469e5c9598541333cd500';
const WRITER_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2');
const WRITER_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2');
const WRITER_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029`;
const WRITER_PROOF=path.win32.join(WRITER_PRIVATE,'owner-preparation');
const WRITER_VERIFIER=path.win32.join(WRITER_PROOF,'verified-owner-producer.mjs');
const WRITER_PURPOSE='WriterProfileActivation';
const WRITER_PAIR_HASH='263a46c1fa9f7d208394e55996b721f696d1c8afc78ce489b64f1d27ec1b6c19';
const WRITER_CURRENT_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029');
const WRITER_CURRENT_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029');
const WRITER_CURRENT_CORE_HASH='cf470ca1587cfe38c79617f9fd312b3bac430636ff66d83a42dbec4a05d7ffee';
const WRITER_CURRENT_ROUTER_HASH='d0875d5ef6c847b2f8df63b6018d3ca5db4ef20bbbbe133cd1b3815e07963eaf';
const WRITER_CURRENT_SOURCE='16daf65071da498ae3cdd779157f7004244bb630';
const WRITER_CURRENT_ENTRY_HASH='f37217b0f6e74bf721160bd056c179e3208ae56f2e25b56656b56f08f333ef8c';
const WRITER_CURRENT_ROUTER_ENTRY_HASH='edd0191b0b8107766b1ab4a4ff44cec17e6bc7b69d5024098ae5fe67a3dc99c4';
const WRITER_INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'50b9a4f72cb0a9a59e3528be7c1ddf17c4505d6a0da98732de355ffa56dace65',
 'current-erp-processes.before.json':'48603c39c67aed102b0887d2a0824d5afc9e27aeade02bd4e0436a34a8f51334',
 'current-task.before.xml':'46fadd9b79c291a8f1aa3299ef5fdb7d8a2f8f26968acf5a92c8f462b77831ec',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'208bad4f906d910a2dc247f2cb08db0f2e47f07421b256997a93239cc0f967e6',
 'current-entry-hold-capture.json':'95b27499bd60bba1e32c3a173e5c573e434c9b31014f796ba62a0c7442dc440a',
});
// A passive, same-issuer-only recovery closure. It never restarts an owner or
// adopts serialized state; the new entry still requires the original live refs.
const WRITER_RECOVERY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-RECOVERY-20261029');
const WRITER_RECOVERY_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-v2-20261029`;
const WRITER_RECOVERY_PROOF=path.win32.join(WRITER_RECOVERY_PRIVATE,'recovery-preparation');
const WRITER_RECOVERY_VERIFIER=path.win32.join(WRITER_RECOVERY_PROOF,'verified-owner-producer.mjs');
const WRITER_RECOVERY_BASE_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-OWNER-20261029-V2');
const WRITER_RECOVERY_BASE_CORE_HASH='2d1047887212c9e131a53da0f7f865a48909c90f0d6b84756c589fc8fdbbcdd2';
const WRITER_RECOVERY_BASE_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WRITER-ROUTER-20261029-V2');
const WRITER_RECOVERY_BASE_ROUTER_HASH='7f44b5b61e4cc8867aa25a84a2820974b632c0bdba318711e67c8ef24c7b5602';
const WRITER_RECOVERY_CASE_HASH='9325bd0d6e00cb321ff1ee4e9b8aa9d67dd4bbc2bfb3c0ae8c072c26eaa0b268';
const WRITER_RECOVERY_SOURCE_FILES=Object.freeze(['business-5244-writer-postcas-recovery.ps1','test125-bound-api-quiescence.ps1','canonical-business-sale-maintenance.ps1']);

const WEBONLY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WEBONLY-OWNER-20261029');
const WEBONLY_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-WEBONLY-ROUTER-20261029');
const WEBONLY_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-workface-build-20261029`;
const WEBONLY_CAPTURE=path.win32.join(WEBONLY_PRIVATE,'current-capture-corrected');
const WEBONLY_PROOF=path.win32.join(WEBONLY_PRIVATE,'owner-preparation');
const WEBONLY_VERIFIER=path.win32.join(WEBONLY_PROOF,'verified-owner-producer.mjs');
const WEBONLY_PURPOSE='WebOnlyFrontendRefresh';
const WEBONLY_APP_SOURCE='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a';
const WEBONLY_PAIR_HASH='f1672081cc695941cd3691cde503a0bb27c1ab58537362fb6907a5cd5dc0d4e4';
const WEBONLY_BOUNDARY_HASH='29e427273264176273aa25d68a5f043d18b19d21b0171d496361a9871959a9b4';
const WEBONLY_BACKEND_HASH='560c735fcaffa6692f55543840f8106679b43b871e3c19f1990bdd17d46f9946';
const WEBONLY_CURRENT_HASH='121020af80ef660c4b9a0872f31dd4c3306bff81346f66797a6806bf6b1a4189';
const WEBONLY_CANDIDATE_HASH='5cebcda8e9937a4db7135bdd18e48fc1585e0d5b1854f63711fe546886ec4bf6';
const WEBONLY_INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'e480d77c835f3c2170589b9fbafec6da78dd2a19624d486d8822ad7b930d3a09',
 'current-erp-processes.before.json':'fe5a222107e2a056d649a26f1dfa86d576f6a3d29fe413731c995c7b295183db',
 'current-task.before.xml':'db1b10bc8f9089ad30b78ba775882536ee15e62b2714aa5c21794d746fdd2bf5',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'075bb030c4fd26a82bf349e95cfcda17d425d8b7ebc08d43fde3d86e75e38fdf',
 'current-entry-hold-capture.json':'c25b8e5a5a1f876406fadfb9bcd4ddffed264c61463d010487e1244682361067',
});

const CURRENT_SUPERSESSION_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029');
const CURRENT_SUPERSESSION_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\current-only-supersession-20261029`;
const CURRENT_SUPERSESSION_PROOF=path.win32.join(CURRENT_SUPERSESSION_PRIVATE,'owner-preparation');
const CURRENT_SUPERSESSION_VERIFIER=path.win32.join(CURRENT_SUPERSESSION_PROOF,'verified-owner-producer.mjs');
const CURRENT_SUPERSESSION_INPUTS=Object.freeze({
 'oldpending.before.bin':'7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab',
 'oldrecord.before.json':'3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74',
 'supersession-fixed-case.json':'8965df723ec4bdbbd12360129d54aab47484d67ad76d8c42f4ec7c7b67c6caf8',
 'current-entry-hold-capture.json':'311b3facefe4aa9c0e0629a1fe5ca2e87d11e04f2562a3a237a51be54c116a55',
 'protected-boundary.json':'a0edcc36f31103db37ae90ec3727ecd1f450eeb8bac1714c442b678cbfd45a3e',
});
const INITIALIZER_CLEAN_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029');
const INITIALIZER_CLEAN_PRIVATE=path.win32.join(CURRENT_SUPERSESSION_PRIVATE,'initializer-clean-20261029');
const INITIALIZER_CLEAN_PROOF=path.win32.join(INITIALIZER_CLEAN_PRIVATE,'owner-preparation');
const INITIALIZER_CLEAN_VERIFIER=path.win32.join(INITIALIZER_CLEAN_PROOF,'verified-owner-producer.mjs');
const INITIALIZER_CLEAN_INPUTS=Object.freeze({
 'initializer-fixed-case.json':'854d7b2e37e04eacf2c586dc195d50712255dd454e43918a2c4f7153451f3ce3',
 'initializer.pending.before.json':'5891a78ce6f5811cc443ce6fa0b1f894c53f12d63b426955e8aa008ac7bf23b4',
 'records.before.json':CURRENT_SUPERSESSION_INPUTS['oldrecord.before.json'],
 'entry-hold-capture.json':'7b93d26f5b927088921d577d6c4bee6856dc15efb5aac47aaf59aef6cb8bb854',
 'protected-boundary.json':'c737aedba3efd5e270f48a38cc84afd3e5080fe2b59c7c72e4c7245a940d15ff',
 'original-retirement.before.bin':CURRENT_SUPERSESSION_INPUTS['oldpending.before.bin'],
});
const INITIALIZER_ORIGINAL_CORE_HASH='727499c2f42fb8d542d408fa38a764541cd1ba2f7341586f14a46976e3c2b985';
const INITIALIZER_ORIGINAL_ENTRY_HASH='712bf4cf5777346c17c018f7cec89291da4b59e8ce47171234e66edfa3cacbf2';
const INITIALIZER_ORIGINAL_SOURCE='a16e14ac80d2d88304209fe7c5fc4e252ab02a43';
function currentBundleGeneration(initializerClean=false){
 if(typeof initializerClean!=='boolean')fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 return initializerClean?{core:INITIALIZER_CLEAN_CORE,privateRoot:INITIALIZER_CLEAN_PRIVATE,proof:INITIALIZER_CLEAN_PROOF,verifier:INITIALIZER_CLEAN_VERIFIER,inputs:INITIALIZER_CLEAN_INPUTS,kind:'CURRENT_INITIALIZER_CLEAN_BUNDLE',label:'initializer-clean',caseLeaf:'initializer-fixed-case.json',flag:'InitializerCleanRecovery',count:6}:{core:CURRENT_SUPERSESSION_CORE,privateRoot:CURRENT_SUPERSESSION_PRIVATE,proof:CURRENT_SUPERSESSION_PROOF,verifier:CURRENT_SUPERSESSION_VERIFIER,inputs:CURRENT_SUPERSESSION_INPUTS,kind:'CURRENT_ONLY_SUPERSESSION_BUNDLE',label:'supersession',caseLeaf:'supersession-fixed-case.json',flag:'CurrentOnlySupersession',count:5};
}
const SQLCOLLATION_CORE_HASH='e06fc655f1473a4fe998383f2d86e992e6761bf177393edc5379975c506ba2a0';
const SQLCOLLATION_ROUTER_HASH='2d5a2a5b2e680f3b6a7dd83d2b97704c55867bb7ee734850f05caeb9b1faa2ee';
const SQLCOLLATION_CURRENT_HASH='a622e726385ed2564709814400d2f5125fd8b62eee7290515905c07c02c310fd';
const SQLCOLLATION_ROUTER_ENTRY_HASH='1f197ebfe70280cdfd04e560c1bb2aa1445f801533a5abfbeee6a4e7c5514197';
const SQLCOLLATION_SOURCE='1700581e6d1986772ddebc903019848b2847d473';
const OLD_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-HASHCASE');
const OLD_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE');
const OLD_CORE_HASH='e9afdf730956822d1f1a94352c83bf0aeb4d5d891ea09aae07143e2fe17ad879';
const OLD_ROUTER_HASH='ef941287977c2913a8c4ca43cfa002e19f006d6239b9059a5c734cd0db6174e2';
const OLD_ENTRY_HASH='269ec4c3459c9e705165755f8afe9a949dd119a745e5d1f7a1585d6e60b6ef4f';
const OLD_ROUTER_ENTRY_HASH='e160fd137828a98f6b4faf814243159276a2707667885f4e321d2ed39abbf238';
const OLD_SOURCE='c6526e78e793d459141cc4fc22a33758f53658d0';
const OLD_ARGV_HASH='aba861a9f55eb0b2aa650bd7d68031da83b1c30e81c588cb83200bfc397c79e5';
const PRIOR_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029');
const PRIOR_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029');
const PRIOR_CORE_HASH='a38e5c00be6d460dc87b4c5d8128dec10f01c8cc4d2d3c76a425fa6d36286deb';
const PRIOR_ROUTER_HASH='90fd861b738e07d241ab27980d4ca50dcab7d667bebf4b2d591c0922b4a6006c';
const PRIOR_ENTRY_HASH='9c473098133f2a7c2b0720c74778d41878064641b201846699f6a53cb4649d8d';
const PRIOR_ROUTER_ENTRY_HASH='7b98143028e0337f4716840bdc9aa774823a95ac53dea5b18619b59dbcba1b21';
const PRIOR_SOURCE='971416ba0d38031a3469f2ee497d722f856a343c';
const RECOVERY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261028');
const RECOVERY_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261028');
const RECOVERY_CORE_HASH='f6c48a1626d281699e14d783b641fcc95ccf9a9de5ad286332b8a1d9e18da235';
const RECOVERY_ROUTER_HASH='7a06577497d6814b1306fb3d2c2755fde88c2e115f621994563f0b2ae6647e9b';
const RECOVERY_ENTRY_HASH='b9e9f0661c3349e8a1b56b17460bffbc776fa7990115cba1c04602a3367641cb';
const RECOVERY_ROUTER_ENTRY_HASH='9490f1b32a76ec21dcc14b1be50b193d96c081e7ed5d84dfa210265cf164957a';
const RECOVERY_SOURCE='9941db2cd35afa6e9a26852b70cbb1ef77515e01';
const HISTORY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-OWNER-b9416929-20261028');
const HISTORY_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-READ2B-ROUTER-b9416929-20261028');
const HISTORY_CORE_HASH='5f9e1c11fa3157b378ad2fb679ce380275adc72cac083b539503efc060e21502';
const HISTORY_ROUTER_HASH='e450a61b240063ec8555d015375b3564a5626341b692cc5d160d8947fd3e8feb';
const HISTORY_ROUTER_ENTRY_HASH='f4af241b6634cc7878f95858203a0d22e54862a20878106e7b3bd60811184b12';
const HISTORY_CURRENT_ENTRY_HASH='48067f305fd6488778ac321a04baf9a1d83077355801eff160f894db6564b9b6';
const INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'4eaa68d16be5260071f74ce7e41e33ce6adaa4c7097d661905968d4b5c1b9945',
 'current-erp-processes.before.json':'20dc7ae37497b88ce7f38039d76481b4f1e0f4e07c503737ec193e85c4be5f1f',
 'current-task.before.xml':'e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'64dae9de55b1634140958b36d7ab2958fe9cddb26ad98319f9094b4ab561f346',
 'current-entry-hold-capture.json':'e1bc4ffdce569590a0d3874a915a7a2a04502d5c470a837798d0548865077ac3',
});
export const BUSINESS_SALE_OWNER_SOURCE_FILES=Object.freeze([
 'business-5244-startup-exclusion.ps1','start-business-5244-web.ps1','business-5244-web-native.cs',
 'business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs','business-5244-retirement-state.ps1',
 'business-5244-maintenance-dispatch.ps1','start-business-5244-owned.ps1','test125-bound-api-quiescence.ps1',
 'test125-bound-maintenance-plan.ps1','start-owned-test.ps1','canonical-business-sale-maintenance.ps1',
]);
const REQUIRED_JOBS=['windows-startup-test','quality-build-test','secret-scan'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const fail=code=>{throw Error(code);};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const commit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const ps=v=>"'"+v.replaceAll("'","''")+"'";
function plainPath(p){for(let at=p;at;){const s=fs.lstatSync(at);if(s.isSymbolicLink())fail('B6_OWNER_REPARSE_REJECTED');const next=path.dirname(at);if(next===at)break;at=next;}}
function read(p){plainPath(p);return fs.readFileSync(p);}
function pinned(p,expected){const b=read(p);if(hash(b)!==expected)fail('B6_OWNER_INPUT_CHANGED');return b;}
function git(args,raw=false,input){return cp.execFileSync('git',args,{cwd:SOURCE_ROOT,windowsHide:true,...(raw?{}:{encoding:'utf8'}),...(input===undefined?{}:{input}),maxBuffer:8*1024*1024});}
function gh(endpoint){return JSON.parse(cp.execFileSync('gh',['api',endpoint],{cwd:SOURCE_ROOT,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024}));}
function committedSources(packagedCommit=null,currentSupersession=false,initializerClean=false,rehearsal=false,candidate=false,writer=false,writerRecovery=false,webOnly=false,steady=false){
 if(typeof steady!=='boolean'||steady&&(currentSupersession||initializerClean||rehearsal||candidate||writer||writerRecovery||webOnly))fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 if(typeof webOnly!=='boolean'||webOnly&&(currentSupersession||initializerClean||rehearsal||candidate||writer||writerRecovery))fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 if(typeof writerRecovery!=='boolean'||writerRecovery&&(currentSupersession||initializerClean||rehearsal||candidate||writer))fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 if(typeof rehearsal!=='boolean'||typeof candidate!=='boolean'||typeof writer!=='boolean'||writer&&(currentSupersession||initializerClean||rehearsal||candidate)||rehearsal&&(currentSupersession||initializerClean)||candidate&&(currentSupersession||initializerClean||rehearsal))fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 const ownPath=path.resolve(fileURLToPath(import.meta.url));
 const verifier=steady?STEADY_VERIFIER:webOnly?WEBONLY_VERIFIER:writerRecovery?WRITER_RECOVERY_VERIFIER:writer?WRITER_VERIFIER:candidate?CANDIDATE_VERIFIER:rehearsal?REHEARSAL_VERIFIER:initializerClean?INITIALIZER_CLEAN_VERIFIER:currentSupersession?CURRENT_SUPERSESSION_VERIFIER:VERIFIED_PRODUCER,verifyAction=steady?'--verify-steady':webOnly?'--verify-webonly':writerRecovery?'--verify-writer-recovery':writer?'--verify-writer':candidate?'--verify-candidate':rehearsal?'--verify-rehearsal':initializerClean?'--verify-initializer-clean-recovery':currentSupersession?'--verify-current-supersession':'--verify';
 if(process.platform!=='win32'||ownPath!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs')&&(ownPath!==verifier||process.argv.slice(2).join('|')!==verifyAction))fail('B6_OWNER_FIXED_SOURCE_REQUIRED');
 for(const args of [['remote','get-url','origin'],['remote','get-url','--push','origin']])if(git(args).trim()!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git')fail('B6_OWNER_ORIGIN_CHANGED');
 if(git(['branch','--show-current']).trim()!=='codex/erp-p03-pr53-candidate-20261018')fail('B6_OWNER_BRANCH_CHANGED');
 const repoHead=git(['rev-parse','HEAD']).trim();if(!commit(repoHead)||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_COMMITTED_CLEAN_SOURCE_REQUIRED');
 const head=packagedCommit??repoHead;if(!commit(head))fail('B6_OWNER_SOURCE_COMMIT_REJECTED');
 if(head!==repoHead){try{git(['merge-base','--is-ancestor',head,repoHead]);}catch{fail('B6_OWNER_SOURCE_NOT_CURRENT_ANCESTOR');}}
 const names=writerRecovery?[...WRITER_RECOVERY_SOURCE_FILES,'prepare-business-sale-owner-bundle.mjs']:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'start-business-5244-readpair-router.ps1','install-business-5244-readpair.ps1','prepare-business-sale-owner-bundle.mjs'];
 const files=new Map(),workingSourceHashes=[];
 for(const name of names){
  const relative='scripts/canonical/'+name;git(['ls-files','--error-unmatch','--',relative]);
  // check-attr does not execute filters. Reject every external clean/encoding
  // transform BEFORE hash-object; only literal text EOL conversion is admitted.
  const rawAttrs=git(['check-attr','-z','filter','working-tree-encoding','ident','text','eol','--',relative]).split('\0');
  if(rawAttrs.pop()!==''||rawAttrs.length!==15)fail('B6_OWNER_SOURCE_ATTRIBUTES_REJECTED');const attrs={};
  for(let n=0;n<rawAttrs.length;n+=3){if(rawAttrs[n]!==relative||Object.hasOwn(attrs,rawAttrs[n+1]))fail('B6_OWNER_SOURCE_ATTRIBUTES_REJECTED');attrs[rawAttrs[n+1]]=rawAttrs[n+2];}
  if(['filter','working-tree-encoding','ident'].some(k=>!['unspecified','unset'].includes(attrs[k]))||!['unspecified','set','auto','unset'].includes(attrs.text)||!['unspecified','lf','crlf'].includes(attrs.eol))fail('B6_OWNER_SOURCE_ATTRIBUTES_REJECTED');
  const b=git(['show',head+':'+relative],true),working=read(path.join(SOURCE_ROOT,relative));
  if(!Buffer.from(working.toString('utf8')).equals(working)||!working.equals(b)&&(attrs.text==='unset'||!Buffer.from(working.toString('utf8').replaceAll('\r\n','\n')).equals(b)))fail('B6_OWNER_WORKING_SOURCE_CHANGED');
  const objectId=git(['rev-parse',head+':'+relative]).trim();
  if(!commit(objectId)||git(['hash-object','--path',relative,'--stdin'],false,working).trim()!==objectId)fail('B6_OWNER_WORKING_SOURCE_CHANGED');
  files.set(name,b);workingSourceHashes.push({path:relative,gitBlobObjectId:objectId,gitBlobSha256:hash(b),workingSha256:hash(working),transform:working.equals(b)?'IDENTICAL':'GIT_TEXT_CRLF_TO_LF_ONLY'});
 }
 if(writerRecovery&&!files.get('business-5244-writer-postcas-recovery.ps1').toString('utf8').includes("$producerHash='"+hash(files.get('prepare-business-sale-owner-bundle.mjs'))+"'"))fail('B6_WRITER_RECOVERY_VERIFIER_PIN_MISMATCH');
 if(!writerRecovery&&!files.get('install-business-5244-readpair.ps1').toString('utf8').includes("Hold-B6ReadPairSource $producer '"+hash(files.get('prepare-business-sale-owner-bundle.mjs'))+"'"))fail('B6_OWNER_CONTROLLER_VERIFIER_PIN_MISMATCH');
 return {head,repoHead,files,workingSourceHashes};
}
function hostedSourceChecks(head){
 const endpoint='repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+head+'&per_page=100',all=gh(endpoint).workflow_runs;
 if(!Array.isArray(all))fail('B6_OWNER_CI_UNAVAILABLE');const result=[];
 for(const event of ['push','pull_request']){
  const run=all.filter(r=>r.head_sha===head&&r.path==='.github/workflows/ci.yml'&&r.event===event).sort((a,b)=>Number(b.id)-Number(a.id))[0];
  if(!run||run.status!=='completed'||run.conclusion!=='success'||!Number.isSafeInteger(run.id)||run.id<=0)fail('B6_OWNER_EXACT_HOSTED_CI_REQUIRED');
  const rows=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+run.id+'/jobs?filter=latest&per_page=100').jobs;
  if(!Array.isArray(rows))fail('B6_OWNER_CI_UNAVAILABLE');
  for(const name of REQUIRED_JOBS){const found=rows.filter(j=>j.name===name);if(found.length!==1||found[0].status!=='completed'||found[0].conclusion!=='success'||!Array.isArray(found[0].steps)||found[0].steps.length===0)fail('B6_OWNER_REQUIRED_JOB_NOT_SUCCESS');}
  result.push({event,runId:run.id,head,conclusion:'success',jobs:[...REQUIRED_JOBS]});
 }
 return result;
}
function predecessor(){
 const inputs=new Map(Object.entries(INPUTS).map(([name,sha])=>[name,pinned(path.join(PRIVATE,name),sha)])),capture=json(inputs.get('current-read2b-owner-capture.json')),task=json(inputs.get('current-task-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json'));
 if(capture.schema!=='melisa-b6-current-read2b-owner-capture.v1'||capture.predecessorEntryKind!=='ReadPairRouter'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.recordBeforeSha256!==INPUTS['current-erp-processes.before.json']||capture.recordBeforeFile!=='current-erp-processes.before.json'||capture.entry?.root!==OLD_ROUTER||capture.entry.leaf!=='start-business-5244-readpair-router.ps1'||capture.entry.sha256!==OLD_ROUTER_ENTRY_HASH||capture.entry.manifestSha256!==OLD_ROUTER_HASH||capture.router?.root!==OLD_ROUTER||capture.router.manifestSha256!==OLD_ROUTER_HASH||capture.router.entrySha256!==OLD_ROUTER_ENTRY_HASH||capture.core?.root!==OLD_CORE||capture.core.manifestSha256!==OLD_CORE_HASH||capture.core.sourceCommit!==OLD_SOURCE)fail('B6_OWNER_PREDECESSOR_CAPTURE_REJECTED');
 if(capture.owner?.pid!==22260||String(capture.owner.birth)!=='134377094829605064'||capture.owner.exe!==String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`||capture.owner.entry!==path.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1')||capture.owner.argvSha256!==OLD_ARGV_HASH||capture.child?.pid!==24520||String(capture.child.birth)!=='134377102174264511'||capture.child.parent!==22260||capture.nativeStatus?.nativePeerVerified!==true||capture.nativeStatus.stopAuthorized!==false||capture.nativeStatus.childObservationOnly!==true||capture.nativeStatus.reply!=='Status'||capture.nativeStatus.state?.phase!=='Running'||capture.nativeStatus.state.ownerPid!==capture.owner.pid||String(capture.nativeStatus.state.ownerBirth)!==String(capture.owner.birth)||capture.nativeStatus.state.childPid!==capture.child.pid||String(capture.nativeStatus.state.childBirth)!==String(capture.child.birth)||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0)fail('B6_OWNER_PREDECESSOR_CAPTURE_REJECTED');
 if(task.schema!=='melisa-b6-current-task-capture.v1'||task.readOnly!==true||task.stopCalls!==0||task.taskChanges!==0)fail('B6_OWNER_TASK_CAPTURE_REJECTED');
 const legacyRuntime=String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,entryPaths=['start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'].map(name=>path.join(legacyRuntime,name)).concat(String.raw`C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1`);
 const directEntries=[{path:path.join(HISTORY_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:HISTORY_ROUTER_ENTRY_HASH},{path:path.join(HISTORY_CORE,'run-current-owner.ps1'),sha256:HISTORY_CURRENT_ENTRY_HASH},{path:path.join(RECOVERY_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:RECOVERY_ROUTER_ENTRY_HASH},{path:path.join(RECOVERY_CORE,'run-current-owner.ps1'),sha256:RECOVERY_ENTRY_HASH},{path:path.join(PRIOR_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:PRIOR_ROUTER_ENTRY_HASH},{path:path.join(PRIOR_CORE,'run-current-owner.ps1'),sha256:PRIOR_ENTRY_HASH},{path:path.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:OLD_ROUTER_ENTRY_HASH},{path:path.join(OLD_CORE,'run-current-owner.ps1'),sha256:OLD_ENTRY_HASH}];
 if(entries.schema!=='melisa-b6-current-entry-hold-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==INPUTS['current-read2b-owner-capture.json']||entries.entries?.length!==6||entries.directEntries?.length!==8||entries.entries.some((e,n)=>e.path!==entryPaths[n]||e.afterEqualsBefore!==true||!hex(e.beforeSha256))||entries.directEntries.some((e,n)=>e.path!==directEntries[n].path||e.sha256!==directEntries[n].sha256)||entries.gate?.path!==path.join(legacyRuntime,'business-5244-startup-exclusion-ec316a63.ps1')||entries.gate.sha256!=='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0)fail('B6_OWNER_ENTRY_CAPTURE_REJECTED');
 // The active ReadPairRouter core and all THREE prior generations are sealed.
 // None of the 12/13/13/13 historical payloads or entry files is rewritten.
 for(const generation of [{root:HISTORY_CORE,sha:HISTORY_CORE_HASH,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES.filter(n=>n!=='canonical-business-sale-maintenance.ps1'),'run-current-owner.ps1']},{root:RECOVERY_CORE,sha:RECOVERY_CORE_HASH,source:RECOVERY_SOURCE,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1']},{root:PRIOR_CORE,sha:PRIOR_CORE_HASH,source:PRIOR_SOURCE,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1']},{root:OLD_CORE,sha:OLD_CORE_HASH,source:OLD_SOURCE,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1']}]){
  const core=json(pinned(path.join(generation.root,'owner-manifest.json'),generation.sha));
  if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==generation.names.sort().join('|'))fail('B6_OWNER_OLD_CORE_REJECTED');
  if(generation.source&&(core.finiteScope!==SCOPE||core.sourceCommit!==generation.source||core.actualT1!==false||core.externalOperations!==false))fail('B6_OWNER_OLD_CORE_REJECTED');
  if(generation.root===OLD_CORE&&(!Array.isArray(capture.core.files)||capture.core.files.length!==13||capture.core.files.some((f,n)=>f.path!==core.files[n].path||f.sha256!==core.files[n].sha256||f.bytes!==core.files[n].bytes)))fail('B6_OWNER_PREDECESSOR_CAPTURE_REJECTED');
  for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256))fail('B6_OWNER_OLD_CORE_REJECTED');const b=pinned(path.join(generation.root,f.path),f.sha256);if(b.length!==f.bytes)fail('B6_OWNER_OLD_CORE_REJECTED');}
 }
 for(const generation of [{root:HISTORY_ROUTER,sha:HISTORY_ROUTER_HASH,core:HISTORY_CORE,coreSha:HISTORY_CORE_HASH,entrySha:HISTORY_ROUTER_ENTRY_HASH},{root:RECOVERY_ROUTER,sha:RECOVERY_ROUTER_HASH,core:RECOVERY_CORE,coreSha:RECOVERY_CORE_HASH,entrySha:RECOVERY_ROUTER_ENTRY_HASH},{root:PRIOR_ROUTER,sha:PRIOR_ROUTER_HASH,core:PRIOR_CORE,coreSha:PRIOR_CORE_HASH,entrySha:PRIOR_ROUTER_ENTRY_HASH},{root:OLD_ROUTER,sha:OLD_ROUTER_HASH,core:OLD_CORE,coreSha:OLD_CORE_HASH,entrySha:OLD_ROUTER_ENTRY_HASH}]){
  const router=json(pinned(path.join(generation.root,'owner-manifest.json'),generation.sha));if(router.coreRoot!==generation.core||router.coreManifestSha256!==generation.coreSha||router.entry!=='start-business-5244-readpair-router.ps1'||router.entrySha256!==generation.entrySha)fail('B6_OWNER_OLD_ROUTER_REJECTED');pinned(path.join(generation.root,router.entry),generation.entrySha);
 }
 for(const entry of directEntries)pinned(entry.path,entry.sha256);
 return {inputs,capture};
}
function predecessorIdentity(){return {captureSha256:INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'ReadPairRouter',entry:{root:OLD_ROUTER,leaf:'start-business-5244-readpair-router.ps1',sha256:OLD_ROUTER_ENTRY_HASH,manifestSha256:OLD_ROUTER_HASH},routerRoot:OLD_ROUTER,routerManifestSha256:OLD_ROUTER_HASH,routerEntrySha256:OLD_ROUTER_ENTRY_HASH,coreRoot:OLD_CORE,coreManifestSha256:OLD_CORE_HASH};}
function currentSupersessionHistories(deferOwnedEntries=false){
 if(typeof deferOwnedEntries!=='boolean')fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 const generations=[
  {root:HISTORY_CORE,sha:HISTORY_CORE_HASH,router:HISTORY_ROUTER,routerSha:HISTORY_ROUTER_HASH,entrySha:HISTORY_ROUTER_ENTRY_HASH,currentSha:HISTORY_CURRENT_ENTRY_HASH,legacy:true},
  {root:RECOVERY_CORE,sha:RECOVERY_CORE_HASH,source:RECOVERY_SOURCE,router:RECOVERY_ROUTER,routerSha:RECOVERY_ROUTER_HASH,entrySha:RECOVERY_ROUTER_ENTRY_HASH,currentSha:RECOVERY_ENTRY_HASH},
  {root:PRIOR_CORE,sha:PRIOR_CORE_HASH,source:PRIOR_SOURCE,router:PRIOR_ROUTER,routerSha:PRIOR_ROUTER_HASH,entrySha:PRIOR_ROUTER_ENTRY_HASH,currentSha:PRIOR_ENTRY_HASH},
  {root:OLD_CORE,sha:OLD_CORE_HASH,source:OLD_SOURCE,router:OLD_ROUTER,routerSha:OLD_ROUTER_HASH,entrySha:OLD_ROUTER_ENTRY_HASH,currentSha:OLD_ENTRY_HASH},
  {root:CORE,sha:SQLCOLLATION_CORE_HASH,source:SQLCOLLATION_SOURCE,router:ROUTER,routerSha:SQLCOLLATION_ROUTER_HASH,entrySha:SQLCOLLATION_ROUTER_ENTRY_HASH,currentSha:SQLCOLLATION_CURRENT_HASH},
 ];
 const directEntries=[];
 for(const g of generations){
  const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES.filter(n=>!g.legacy||n!=='canonical-business-sale-maintenance.ps1'),'run-current-owner.ps1'].sort(),core=json(pinned(path.join(g.root,'owner-manifest.json'),g.sha));
  if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==names.join('|')||g.source&&(core.finiteScope!==SCOPE||core.sourceCommit!==g.source||core.actualT1!==false||core.externalOperations!==false))fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
  for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||(!deferOwnedEntries||f.path!=='run-current-owner.ps1')&&pinned(path.join(g.root,f.path),f.sha256).length!==f.bytes)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');}
  if(core.files.find(f=>f.path==='run-current-owner.ps1').sha256!==g.currentSha)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
  const router=json(pinned(path.join(g.router,'owner-manifest.json'),g.routerSha));
  if(router.coreRoot!==g.root||router.coreManifestSha256!==g.sha||router.entry!=='start-business-5244-readpair-router.ps1'||router.entrySha256!==g.entrySha)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
  if(!deferOwnedEntries)pinned(path.join(g.router,router.entry),g.entrySha);
  directEntries.push({path:path.join(g.router,router.entry),sha256:g.entrySha},{path:path.join(g.root,'run-current-owner.ps1'),sha256:g.currentSha});
 }
 return directEntries;
}
function currentSupersessionCase(deferOwnedEntries=false){
 if(typeof deferOwnedEntries!=='boolean')fail('B6_OWNER_FIXED_ACTION_REQUIRED');
 if(Object.values(CURRENT_SUPERSESSION_INPUTS).some(v=>!hex(v)))fail('B6_CURRENT_SUPERSESSION_CASE_NOT_PREPARED');
 const inputs=new Map(Object.entries(CURRENT_SUPERSESSION_INPUTS).map(([name,sha])=>[name,pinned(path.join(CURRENT_SUPERSESSION_PRIVATE,name),sha)]));
 const capture=json(inputs.get('supersession-fixed-case.json')),pending=json(inputs.get('oldpending.before.bin')),record=inputs.get('oldrecord.before.json'),entries=json(inputs.get('current-entry-hold-capture.json')),boundary=json(inputs.get('protected-boundary.json'));
 if(capture.schema!=='melisa-5244-current-supersession-case.v1'||capture.readOnly!==true||capture.executionAuthority!==false||capture.serviceCalls!==0||capture.sqlWrites!==0||capture.stopCalls!==0||capture.recordWrites!==0)fail('B6_CURRENT_SUPERSESSION_CASE_REJECTED');
 if(capture.target?.pid!==48212||capture.target.birth!=='134377121934062288'||capture.target.exe!==String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`||capture.target.entryPath!==path.join(ROUTER,'start-business-5244-readpair-router.ps1')||capture.target.argvSha256!=='182a8015aecc2575e4d3088231bc4b2295f4f5087ec0741d3878fd1d43f6336f'||typeof capture.target.sid!=='string'||!/^S-1-5-21-\d+-\d+-\d+-\d+$/.test(capture.target.sid))fail('B6_CURRENT_SUPERSESSION_TARGET_REJECTED');
 const active=capture.active;
 if(active?.coreRoot!==CORE||active.coreManifestSha256!==SQLCOLLATION_CORE_HASH||active.routerRoot!==ROUTER||active.routerManifestSha256!==SQLCOLLATION_ROUTER_HASH||active.routerEntrySha256!==SQLCOLLATION_ROUTER_ENTRY_HASH||active.coreEntrySha256!==SQLCOLLATION_CURRENT_HASH||active.coreSource!==SQLCOLLATION_SOURCE)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
 const directEntries=currentSupersessionHistories(deferOwnedEntries),core=json(pinned(path.join(CORE,'owner-manifest.json'),SQLCOLLATION_CORE_HASH));
 if(JSON.stringify(active.coreFiles)!==JSON.stringify(core.files))fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
 const pendingHash=CURRENT_SUPERSESSION_INPUTS['oldpending.before.bin'],recordHash=CURRENT_SUPERSESSION_INPUTS['oldrecord.before.json'];
 if(pending.schema!=='business-5244-retirement-before.v1'||pending.operationId!=='0cfa751c63644554a4faccd1f1e8d7c6'||pending.ownerPid!==capture.target.pid||pending.ownerBirth!==capture.target.birth||pending.childPid!==47092||pending.childBirth!=='134377122629606295'||pending.beforeSha256!==recordHash||typeof pending.beforeBase64!=='string'||!Buffer.from(pending.beforeBase64,'base64').equals(record)||Buffer.from(pending.beforeBase64,'base64').toString('base64')!==pending.beforeBase64)fail('B6_CURRENT_SUPERSESSION_PENDING_REJECTED');
 if(capture.pending?.path!==String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\5244-retirement.pending`||capture.pending.sha256!==pendingHash||capture.pending.bytes!==inputs.get('oldpending.before.bin').length||capture.pending.operationId!==pending.operationId||capture.pending.beforeRecordSha256!==recordHash||capture.record?.path!==String.raw`C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json`||capture.record.sha256!==recordHash||capture.record.bytes!==record.length||capture.record.actualRecordRead!==false)fail('B6_CURRENT_SUPERSESSION_PENDING_REJECTED');
 const rows=json(record),web=Array.isArray(rows)?rows.filter(r=>r.port===5244):[];
 if(web.length!==1||web[0].pid!==pending.childPid||web[0].root!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-2b744f5b-API-READ`||web[0].sourceCommit!=='2b744f5b9ebda05b1355602126b1a8e5f114be83')fail('B6_CURRENT_SUPERSESSION_PENDING_REJECTED');
 if(capture.current?.apiPackage!=='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'||capture.current.apiManifest!=='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'||capture.current.webManifest!=='91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd'||capture.current.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'||capture.current.server!=='Semih\\MELISADEV')fail('B6_CURRENT_SUPERSESSION_CURRENT_REJECTED');
 const protectedPaths=[String.raw`C:\Sirket\ERP\runtime\canonical-test\startup-config.json`,String.raw`C:\Sirket\ERP\config\TEST-20260929-01\runtime-private.json`,String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`];
 if(!Array.isArray(capture.protectedFiles)||capture.protectedFiles.length!==3||capture.protectedFiles.some((f,n)=>f.path!==protectedPaths[n]||!hex(f.sha256))||!Array.isArray(capture.protectedProcesses)||capture.protectedProcesses.length!==4||capture.protectedProcesses.map(p=>p.LocalPort).sort((a,b)=>a-b).join('|')!=='4144|4146|5194|5234'||capture.protectedProcesses.some(p=>!Number.isSafeInteger(p.OwningProcess)||p.OwningProcess<=0))fail('B6_CURRENT_SUPERSESSION_PROTECTION_REJECTED');
 if(boundary.schema!=='melisa-5244-current-supersession-boundary.v1'||boundary.readOnly!==true||boundary.executionAuthority!==false||boundary.caseSha256!==CURRENT_SUPERSESSION_INPUTS['supersession-fixed-case.json']||boundary.writes!==0||boundary.serviceCalls!==0||boundary.sqlCalls!==0||boundary.task?.name!=='Melisa-ERP-TEST-Canonical'||boundary.task.path!=='\\'||boundary.task.xmlSha256!=='e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a'||boundary.task.sddlSha256!=='cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4'||!Array.isArray(boundary.processes)||boundary.processes.length!==4||boundary.processes.some((p,n)=>p.pid!==capture.protectedProcesses[n].OwningProcess||typeof p.birth!=='string'||!/^\d{18}$/.test(p.birth)||!Number.isSafeInteger(p.parent)||p.parent<=0||![String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,String.raw`C:\Program Files\nodejs\node.exe`].includes(p.exe)||!hex(p.argvSha256)))fail('B6_CURRENT_SUPERSESSION_BOUNDARY_REJECTED');
 const runtime=String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,legacy=['start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'].map(n=>path.join(runtime,n)).concat(String.raw`C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1`);
 if(capture.entryCaptureSha256!==CURRENT_SUPERSESSION_INPUTS['current-entry-hold-capture.json']||entries.schema!=='melisa-b6-current-entry-hold-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==null||entries.entries?.length!==6||entries.directEntries?.length!==10||entries.entries.some((e,n)=>e.path!==legacy[n]||e.afterEqualsBefore!==true||!hex(e.beforeSha256))||entries.directEntries.some((e,n)=>e.path!==directEntries[n].path||e.sha256!==directEntries[n].sha256)||entries.gate?.path!==path.join(runtime,'business-5244-startup-exclusion-ec316a63.ps1')||entries.gate.sha256!=='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0)fail('B6_CURRENT_SUPERSESSION_ENTRY_REJECTED');
 if(!deferOwnedEntries)for(const e of entries.entries)pinned(e.path,e.beforeSha256);pinned(entries.gate.path,entries.gate.sha256);
 return {inputs,capture};
}
// A passive preparation may defer only the existing five core entry leaves,
// five router entry leaves and six legacy launchers held by the initializer.
// It never substitutes their bytes or converts captured hashes into admission.
function initializerPassiveValidation(){return {runtimeValidationComplete:false,originalContextAssertHeldRequired:true,postExitExclusiveEntryCount:17,deferredEntryCount:16};}
// These immutable captures describe a single failed initializer. They never
// establish live pending-file access, native exit, mutex ownership or Undo.
function initializerCleanCase(){
 const previous=currentSupersessionCase(true),g=currentBundleGeneration(true),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const inputs=new Map(Object.entries(g.inputs).map(([name,sha])=>[name,pinned(path.join(g.privateRoot,name),sha)]));
 const capture=json(inputs.get(g.caseLeaf)),pending=json(inputs.get('initializer.pending.before.json')),record=inputs.get('records.before.json'),entries=json(inputs.get('entry-hold-capture.json')),boundary=json(inputs.get('protected-boundary.json'));
 if(capture.schema!=='melisa-5244-current-initializer-clean-case.v1'||capture.readOnly!==true||capture.executionAuthority!==false||capture.nativeObservationRequired!==true||capture.preExitSameMutexRequired!==true||capture.serviceCalls!==0||capture.sqlWrites!==0||capture.stopCalls!==0||capture.recordWrites!==0)fail('B6_INITIALIZER_CLEAN_CASE_REJECTED');
 const target=capture.target;
 if(target?.pid!==42920||target.birth!=='134377286908585811'||target.exe!==previous.capture.target.exe||target.sid!==previous.capture.target.sid||target.entryPath!==path.join(CURRENT_SUPERSESSION_CORE,'run-current-owner.ps1')||target.argvSha256!=='aef65d46a0af05cc8b4f0e4f3df1482c55e48b7c119ec49e8bf990b4bc7d6b72')fail('B6_INITIALIZER_CLEAN_TARGET_REJECTED');
 const active=capture.active,core=json(pinned(path.join(CURRENT_SUPERSESSION_CORE,'owner-manifest.json'),INITIALIZER_ORIGINAL_CORE_HASH)),names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1','install-business-5244-readpair.ps1'].sort();
 if(active?.coreRoot!==CURRENT_SUPERSESSION_CORE||active.coreManifestSha256!==INITIALIZER_ORIGINAL_CORE_HASH||active.coreEntrySha256!==INITIALIZER_ORIGINAL_ENTRY_HASH||active.coreSource!==INITIALIZER_ORIGINAL_SOURCE||core.kind!=='CURRENT_ONLY_SUPERSESSION_BUNDLE'||core.finiteScope!==SCOPE||core.sourceCommit!==INITIALIZER_ORIGINAL_SOURCE||core.actualT1!==false||core.externalOperations!==false||core.initialSlot!=='Current'||core.installed!==false||core.recordingEnabled!==false||!same(core.files,active.coreFiles)||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==names.join('|'))fail('B6_INITIALIZER_CLEAN_SOURCE_REJECTED');
 for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||pinned(path.join(CURRENT_SUPERSESSION_CORE,f.path),f.sha256).length!==f.bytes)fail('B6_INITIALIZER_CLEAN_SOURCE_REJECTED');}
 if(core.files.find(f=>f.path==='run-current-owner.ps1').sha256!==INITIALIZER_ORIGINAL_ENTRY_HASH||!same(capture.current,previous.capture.current)||core.apiManifestSha256!==capture.current.apiManifest||core.appManifestSha256!==capture.current.webManifest)fail('B6_INITIALIZER_CLEAN_SOURCE_REJECTED');
 const expectedPending={schema:'business-5244-current-supersession.pending.v1',classification:'SUPERSESSION_NOT_ORIGINAL_COMMIT',operationId:'5197b99f29984394b07059bea9cc4823',originalOperationId:previous.capture.pending.operationId,originalPendingSha256:CURRENT_SUPERSESSION_INPUTS['oldpending.before.bin'],originalRecordsSha256:g.inputs['records.before.json'],ownerPid:42920,ownerBirth:target.birth};
 if(Object.keys(pending).sort().join('|')!==Object.keys(expectedPending).sort().join('|')||Object.entries(expectedPending).some(([key,value])=>pending[key]!==value)||!record.equals(previous.inputs.get('oldrecord.before.json'))||!inputs.get('original-retirement.before.bin').equals(previous.inputs.get('oldpending.before.bin'))||!same(capture.record,previous.capture.record)||capture.pending?.path!==previous.capture.pending.path||capture.pending.sha256!==g.inputs['initializer.pending.before.json']||capture.pending.bytes!==inputs.get('initializer.pending.before.json').length||capture.pending.operationId!==pending.operationId||capture.pending.expectedReconstructedBytesOnly!==true||capture.pending.actualReadAfterUndoRequired!==true)fail('B6_INITIALIZER_CLEAN_PENDING_REJECTED');
 const base=capture.pending.path+'.'+pending.operationId;
 if(capture.original?.recordCopyPath!==base+'.superseded-record.before'||capture.original.pendingCopyPath!==base+'.superseded-original'||capture.original.retirementOperationId!==expectedPending.originalOperationId||capture.original.retirementOwnerPid!==previous.capture.target.pid||capture.original.retirementOwnerBirth!==previous.capture.target.birth||capture.original.pendingSha256!==expectedPending.originalPendingSha256||capture.original.recordSha256!==g.inputs['records.before.json'])fail('B6_INITIALIZER_CLEAN_PENDING_REJECTED');
 const oldEntries=json(previous.inputs.get('current-entry-hold-capture.json')),oldBoundary=json(previous.inputs.get('protected-boundary.json'));
 if(capture.entryCaptureSha256!==g.inputs['entry-hold-capture.json']||entries.schema!==oldEntries.schema||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==null||!same(entries.entries,oldEntries.entries)||!same(entries.gate,oldEntries.gate)||entries.directEntries?.length!==11||!same(entries.directEntries.slice(0,10),oldEntries.directEntries)||!same(entries.directEntries[10],{path:target.entryPath,sha256:INITIALIZER_ORIGINAL_ENTRY_HASH})||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0)fail('B6_INITIALIZER_CLEAN_ENTRY_REJECTED');
 if(boundary.schema!=='melisa-5244-current-initializer-clean-boundary.v1'||boundary.readOnly!==true||boundary.executionAuthority!==false||boundary.caseSha256!==g.inputs[g.caseLeaf]||!same(boundary.task,oldBoundary.task)||!same(boundary.processes,oldBoundary.processes)||!same(capture.protectedFiles,previous.capture.protectedFiles)||!same(capture.protectedProcesses,previous.capture.protectedProcesses)||boundary.writes!==0||boundary.serviceCalls!==0||boundary.sqlCalls!==0)fail('B6_INITIALIZER_CLEAN_BOUNDARY_REJECTED');
 return {inputs,capture,privateLegacyInputs:previous.inputs,...initializerPassiveValidation()};
}
function trustedModuleImports(){return String.raw`
if($PSVersionTable.PSEdition-cne'Desktop'){throw 'B6_NATIVE_WINDOWS_POWERSHELL_REQUIRED'}
foreach($builtinName in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP','ScheduledTasks')){
 $builtinManifest=[IO.Path]::Combine($PSHOME,'Modules',$builtinName,($builtinName+'.psd1'))
 Microsoft.PowerShell.Core\Import-Module -Name $builtinManifest -Scope Local -ErrorAction Stop
}
`;}
function holdHelpers(){return trustedModuleImports()+String.raw`
$held=[Collections.Generic.List[IO.FileStream]]::new()
$verifiedInitExit=$false
function Hold-B6([string]$Path,[string]$Hash){
 for($part=$Path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_OWNER_REPARSE_REJECTED'}}
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$h=[Security.Cryptography.SHA256]::Create()
 try{$actual=[BitConverter]::ToString($h.ComputeHash($stream)).Replace('-','').ToLowerInvariant();$stream.Position=0;if($actual-cne$Hash.ToLowerInvariant()){throw 'B6_OWNER_PIN_CHANGED'};$held.Add($stream)}catch{$stream.Dispose();throw}finally{$h.Dispose()}
}
`;}
function initializationFailureTail(writerV2=false){return writerV2?String.raw`catch{
 if((Get-Business5244VerifiedInitializationExitCode $_.Exception)-ne73){throw}
 $failure=Get-Business5244VerifiedInitializationFailureDiagnostic $_.Exception
 if($null-ne$failure){[Console]::Error.WriteLine(([ordered]@{kind='business-5244-initialization-restored';failure=$failure}|ConvertTo-Json -Compress))}
 $verifiedInitExit=$true
}finally{foreach($stream in $held){$stream.Dispose()}}
if($verifiedInitExit){exit 73}
`:String.raw`catch{
 # Only the frozen supervisor's private issuer event can translate a failure
 # to this exit code. Exception text/Data or a serialized receipt is not proof.
 if((Get-Business5244VerifiedInitializationExitCode $_.Exception)-ne73){throw}
 $verifiedInitExit=$true
}finally{foreach($stream in $held){$stream.Dispose()}}
if($verifiedInitExit){exit 73}
`;}
function ownerGeneration(name='Legacy'){
 if(name==='Legacy')return {core:CORE,router:ROUTER,rehearsalOnly:false};
 if(name==='Rehearsal')return {core:REHEARSAL_CORE,router:REHEARSAL_ROUTER,rehearsalOnly:true};
 if(name==='WebOnly')return {core:WEBONLY_CORE,router:WEBONLY_ROUTER,rehearsalOnly:false,maintenancePurpose:WEBONLY_PURPOSE,scope:WRITER_SCOPE};
 if(name==='Writer')return {core:WRITER_CORE,router:WRITER_ROUTER,rehearsalOnly:false,maintenancePurpose:WRITER_PURPOSE,scope:WRITER_SCOPE};
 if(name==='Candidate')return {core:CANDIDATE_CORE,router:CANDIDATE_ROUTER,rehearsalOnly:false,maintenancePurpose:CANDIDATE_PURPOSE};
 fail('B6_OWNER_FIXED_GENERATION_REQUIRED');
}
function rehearsalCoreVerification(){
 if(Object.values(REHEARSAL_INPUTS).some(v=>!hex(v)))fail('B6_REHEARSAL_CAPTURE_NOT_PREPARED');
 const leaves=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 return String.raw`
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'SCOPE_LITERAL'-or$m.sourceCommit-cne$sourceCommit-or$m.rehearsalOnly-isnot[bool]-or!$m.rehearsalOnly-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.recordingEnabled-ne$false-or$m.runtimeValidationComplete-ne$false-or$m.postExitExclusiveBytesRequired-ne$true-or$m.postExitExclusiveEntryCount-ne18-or$m.apiPackageId-cne'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'-or$m.appPackageId-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'){throw 'B6_REHEARSAL_OWNER_IDENTITY_CHANGED'}
$names=@(LEAVES_LITERAL)
if(@($m.files).Count-ne13-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_REHEARSAL_OWNER_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_REHEARSAL_OWNER_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
if($m.predecessor.captureSha256-cne'CAPTURE_LITERAL'-or$m.predecessor.recordBeforeSha256-cne'RECORD_LITERAL'-or$m.predecessor.predecessorEntryKind-cne'CurrentInitializerClean'-or$m.predecessor.entry.root-cne'C:\Sirket\ERP\releases\ERP-BUSINESS-5244-CURRENT-INIT-CLEAN-20261029'-or$m.predecessor.entry.leaf-cne'run-current-owner.ps1'-or$m.predecessor.entry.sha256-cne'ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5'-or$m.predecessor.entry.manifestSha256-cne'6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0'-or$m.predecessor.entry.runtimeEntryBytesVerified-ne$false-or$m.predecessor.entry.postExitExclusiveBytesRequired-ne$true){throw 'B6_REHEARSAL_OWNER_PREDECESSOR_CHANGED'}
BEFORE_LITERAL
`.replaceAll('SCOPE_LITERAL',SCOPE).replace('LEAVES_LITERAL',leaves.map(ps).join(',')).replaceAll('CAPTURE_LITERAL',REHEARSAL_INPUTS['current-read2b-owner-capture.json']).replaceAll('RECORD_LITERAL',REHEARSAL_INPUTS['current-erp-processes.before.json']).replace('BEFORE_LITERAL',Object.entries(REHEARSAL_INPUTS).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(sha)).join('\n'));
}
function candidateCoreVerification(){
 if(Object.values(CANDIDATE_INPUTS).some(v=>!hex(v)))fail('B6_CANDIDATE_CAPTURE_NOT_PREPARED');
 const leaves=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 return String.raw`
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'SCOPE_LITERAL'-or$m.sourceCommit-cne$sourceCommit-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.maintenancePurpose-cne'CandidateMetadataApply'-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.recordingEnabled-ne$false-or$m.runtimeValidationComplete-ne$false-or$m.postExitExclusiveBytesRequired-ne$true-or$m.postExitExclusiveEntryCount-ne20-or$m.apiPackageId-cne'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'-or$m.appPackageId-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'){throw 'B6_CANDIDATE_OWNER_IDENTITY_CHANGED'}
$names=@(LEAVES_LITERAL)
if(@($m.files).Count-ne13-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_CANDIDATE_OWNER_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_CANDIDATE_OWNER_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
if($m.predecessor.captureSha256-cne'CAPTURE_LITERAL'-or$m.predecessor.recordBeforeSha256-cne'RECORD_LITERAL'-or$m.predecessor.predecessorEntryKind-cne'ReadPairRouter'-or$m.predecessor.coreRoot-cne'CURRENT_CORE_LITERAL'-or$m.predecessor.coreManifestSha256-cne'CURRENT_CORE_HASH_LITERAL'-or$m.predecessor.routerRoot-cne'CURRENT_ROUTER_LITERAL'-or$m.predecessor.routerManifestSha256-cne'CURRENT_ROUTER_HASH_LITERAL'-or$m.predecessor.entry.root-cne'CURRENT_ROUTER_LITERAL'-or$m.predecessor.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$m.predecessor.entry.sha256-cne'CURRENT_ENTRY_HASH_LITERAL'-or$m.predecessor.entry.manifestSha256-cne'CURRENT_ROUTER_HASH_LITERAL'){throw 'B6_CANDIDATE_OWNER_PREDECESSOR_CHANGED'}
BEFORE_LITERAL
`.replaceAll('SCOPE_LITERAL',SCOPE).replace('LEAVES_LITERAL',leaves.map(ps).join(',')).replaceAll('CAPTURE_LITERAL',CANDIDATE_INPUTS['current-read2b-owner-capture.json']).replaceAll('RECORD_LITERAL',CANDIDATE_INPUTS['current-erp-processes.before.json']).replaceAll('CURRENT_CORE_LITERAL',CANDIDATE_CURRENT_CORE).replaceAll('CURRENT_CORE_HASH_LITERAL',CANDIDATE_CURRENT_CORE_HASH).replaceAll('CURRENT_ROUTER_LITERAL',CANDIDATE_CURRENT_ROUTER).replaceAll('CURRENT_ROUTER_HASH_LITERAL',CANDIDATE_CURRENT_ROUTER_HASH).replaceAll('CURRENT_ENTRY_HASH_LITERAL',CANDIDATE_CURRENT_ROUTER_ENTRY_HASH).replace('BEFORE_LITERAL',Object.entries(CANDIDATE_INPUTS).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(sha)).join('\n'));
}
function writerCoreVerification(){
 if(Object.values(WRITER_INPUTS).some(v=>!hex(v)))fail('B6_WRITER_CAPTURE_NOT_PREPARED');
 const leaves=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 return String.raw`
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'SCOPE_LITERAL'-or$m.sourceCommit-cne$sourceCommit-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.maintenancePurpose-cne'WriterProfileActivation'-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.recordingEnabled-ne$false-or$m.runtimeValidationComplete-ne$false-or$m.postExitExclusiveBytesRequired-ne$true-or$m.postExitExclusiveEntryCount-ne24-or$m.apiPackageId-cne'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028'-or$m.appPackageId-cne'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028'){throw 'B6_WRITER_OWNER_IDENTITY_CHANGED'}
$names=@(LEAVES_LITERAL)
if(@($m.files).Count-ne13-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_WRITER_OWNER_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_WRITER_OWNER_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
if($m.predecessor.captureSha256-cne'CAPTURE_LITERAL'-or$m.predecessor.recordBeforeSha256-cne'RECORD_LITERAL'-or$m.predecessor.predecessorEntryKind-cne'CurrentCore'-or$m.predecessor.coreRoot-cne'CURRENT_CORE_LITERAL'-or$m.predecessor.coreManifestSha256-cne'CURRENT_CORE_HASH_LITERAL'-or$m.predecessor.routerRoot-cne'CURRENT_ROUTER_LITERAL'-or$m.predecessor.routerManifestSha256-cne'CURRENT_ROUTER_HASH_LITERAL'-or$m.predecessor.entry.root-cne'CURRENT_CORE_LITERAL'-or$m.predecessor.entry.leaf-cne'run-current-owner.ps1'-or$m.predecessor.entry.sha256-cne'CURRENT_ENTRY_HASH_LITERAL'-or$m.predecessor.entry.manifestSha256-cne'CURRENT_CORE_HASH_LITERAL'){throw 'B6_WRITER_OWNER_PREDECESSOR_CHANGED'}
if($m.packagePair.path-cne'writer-package-pair.json'-or$m.packagePair.sha256-cne'PAIR_HASH_LITERAL'){throw 'B6_WRITER_PACKAGE_PAIR_CHANGED'}
Hold-B6 (Join-Path $core 'writer-package-pair.json') 'PAIR_HASH_LITERAL'
BEFORE_LITERAL
`.replaceAll('SCOPE_LITERAL',WRITER_SCOPE).replace('LEAVES_LITERAL',leaves.map(ps).join(',')).replaceAll('CAPTURE_LITERAL',WRITER_INPUTS['current-read2b-owner-capture.json']).replaceAll('RECORD_LITERAL',WRITER_INPUTS['current-erp-processes.before.json']).replaceAll('CURRENT_CORE_LITERAL',WRITER_CURRENT_CORE).replaceAll('CURRENT_CORE_HASH_LITERAL',WRITER_CURRENT_CORE_HASH).replaceAll('CURRENT_ROUTER_LITERAL',WRITER_CURRENT_ROUTER).replaceAll('CURRENT_ROUTER_HASH_LITERAL',WRITER_CURRENT_ROUTER_HASH).replaceAll('CURRENT_ENTRY_HASH_LITERAL',WRITER_CURRENT_ENTRY_HASH).replaceAll('PAIR_HASH_LITERAL',WRITER_PAIR_HASH).replace('BEFORE_LITERAL',Object.entries(WRITER_INPUTS).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(sha)).join('\n'));
}
function coreVerification(generation='Legacy'){if(generation==='WebOnly')return webOnlyCoreVerification();if(generation==='Writer')return writerCoreVerification();if(generation==='Candidate')return candidateCoreVerification();if(generation==='Rehearsal')return rehearsalCoreVerification();ownerGeneration(generation);const leaves=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();return String.raw`
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'SCOPE_LITERAL'-or$m.sourceCommit-cne$sourceCommit-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.apiPackageId-cne'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'-or$m.appPackageId-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'){throw 'B6_OWNER_IDENTITY_CHANGED'}
$names=@(LEAVES_LITERAL)
if(@($m.files).Count-ne13-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_OWNER_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_OWNER_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
if($m.predecessor.captureSha256-cne'CAPTURE_LITERAL'-or$m.predecessor.recordBeforeSha256-cne'RECORD_LITERAL'-or$m.predecessor.predecessorEntryKind-cne'ReadPairRouter'-or$m.predecessor.entry.root-cne'ENTRY_ROOT_LITERAL'-or$m.predecessor.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$m.predecessor.entry.sha256-cne'ENTRY_HASH_LITERAL'-or$m.predecessor.entry.manifestSha256-cne'ENTRY_MANIFEST_LITERAL'){throw 'B6_OWNER_PREDECESSOR_CHANGED'}
BEFORE_LITERAL
`.replaceAll('SCOPE_LITERAL',SCOPE).replace('LEAVES_LITERAL',leaves.map(ps).join(',')).replaceAll('CAPTURE_LITERAL',INPUTS['current-read2b-owner-capture.json']).replaceAll('RECORD_LITERAL',INPUTS['current-erp-processes.before.json']).replaceAll('ENTRY_ROOT_LITERAL',OLD_ROUTER).replaceAll('ENTRY_HASH_LITERAL',OLD_ROUTER_ENTRY_HASH).replaceAll('ENTRY_MANIFEST_LITERAL',OLD_ROUTER_HASH).replace('BEFORE_LITERAL',Object.entries(INPUTS).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(sha)).join('\n'));}
function ownerRouting(rehearsalOnly,scope=SCOPE){
 if(typeof rehearsalOnly!=='boolean')fail('B6_OWNER_FIXED_GENERATION_REQUIRED');
 if(rehearsalOnly)return `if($mode-cne'PrepareCurrent'){throw 'B6_REHEARSAL_CURRENT_PAIR_REQUIRED'}\nStart-Business5244OwnedSupervisor -InitialSlot Current -PrepareReadPair -ScopeName ${ps(scope)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}`;
 return `if($mode-ceq'PrepareCurrent'){Start-Business5244OwnedSupervisor -InitialSlot Current -PrepareReadPair -ScopeName ${ps(scope)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}else{Start-Business5244OwnedSupervisor -InitialSlot ReadPair -ScopeName ${ps(scope)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}`;
}
function renderCurrent(head,generation='Legacy'){const g=ownerGeneration(generation),scope=g.scope??SCOPE;return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256)\nSet-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$core=${ps(g.core)};$sourceCommit=${ps(head)}\nif($PSScriptRoot-cne$core){throw 'B6_OWNER_ROOT_CHANGED'}\n${holdHelpers()}try{\nHold-B6 (Join-Path $core 'owner-manifest.json') $ManifestSha256\n${coreVerification(generation)}\n. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName ${ps(scope)}\n${generation==='Writer'?". (Join-Path $core 'start-owned-test.ps1') -Library\n":''}Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName ${ps(scope)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}\n}${initializationFailureTail(generation==='Writer')}`);}
function renderRouter(head,coreHash,libraryHash,generation='Legacy'){if(generation==='WebOnly')return renderWebOnlyRouter(head,coreHash,libraryHash);const g=ownerGeneration(generation),scope=g.scope??SCOPE;if(!commit(head)||!hex(coreHash)||!hex(libraryHash))fail('B6_OWNER_RENDER_PIN_REJECTED');return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,[ValidateSet(${ps(scope)})][string]$ScopeName=${ps(scope)})\nSet-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$core=${ps(g.core)};$root=${ps(g.router)};$sourceCommit=${ps(head)}\nif($PSScriptRoot-cne$root-or$ScopeName-cne${ps(scope)}){throw 'B6_ROUTER_ROOT_CHANGED'}\n${holdHelpers()}try{\nHold-B6 (Join-Path $root 'owner-manifest.json') $ManifestSha256\n$r=Get-Content -LiteralPath (Join-Path $root 'owner-manifest.json') -Raw|ConvertFrom-Json\nif($r.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$r.finiteScope-cne${ps(scope)}-or$r.entrySourceCommit-cne$sourceCommit-or$r.coreRoot-cne$core-or$r.coreManifestSha256-cne${ps(coreHash)}-or$r.routerLibrarySha256-cne${ps(libraryHash)}-or$r.actualT1-ne$false-or$r.externalOperations-ne$false){throw 'B6_ROUTER_IDENTITY_CHANGED'}${g.rehearsalOnly?"\nif($r.rehearsalOnly-isnot[bool]-or!$r.rehearsalOnly){throw 'B6_REHEARSAL_ROUTER_REQUIRED'}":''}${g.maintenancePurpose?"\nif($r.rehearsalOnly-isnot[bool]-or$r.rehearsalOnly-or$r.maintenancePurpose-cne"+ps(g.maintenancePurpose)+"){throw 'B6_CANDIDATE_ROUTER_REQUIRED'}":''}\nHold-B6 (Join-Path $root 'start-business-5244-readpair-router.ps1') $r.entrySha256\nHold-B6 (Join-Path $root 'readpair-router-library.ps1') ${ps(libraryHash)}\nHold-B6 (Join-Path $core 'owner-manifest.json') ${ps(coreHash)}\n${coreVerification(generation)}\n. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName ${ps(scope)}\n. (Join-Path $core 'start-owned-test.ps1') -Library\n. (Join-Path $core 'test125-bound-api-quiescence.ps1')\n. (Join-Path $root 'readpair-router-library.ps1') -Library -ScopeName ${ps(scope)}\n$config=Read-ErpStartupConfig 'C:\\Sirket\\ERP\\runtime\\canonical-test\\startup-config.json'\n$mode=Get-Business5244ReadPairRouterMode $config -ScopeName ${ps(scope)}\n${ownerRouting(g.rehearsalOnly,scope)}\n}${initializationFailureTail(generation==='Writer')}`);}
function writeLeaf(root,name,b){if(/[\\/]/.test(name))fail('B6_OWNER_OUTPUT_LEAF_REJECTED');plainPath(root);const p=path.join(root,name),fd=fs.openSync(p,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(hash(read(p))!==hash(b))fail('B6_OWNER_OUTPUT_READBACK_FAILED');}
function rehearsalPredecessor(){
 if(Object.values(REHEARSAL_INPUTS).some(v=>!hex(v)))fail('B6_REHEARSAL_CAPTURE_NOT_PREPARED');
 const inputs=new Map(Object.entries(REHEARSAL_INPUTS).map(([name,sha])=>[name,pinned(path.join(REHEARSAL_PRIVATE,name),sha)]));
 const capture=json(inputs.get('current-read2b-owner-capture.json')),task=json(inputs.get('current-task-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json'));
 const coreRoot=INITIALIZER_CLEAN_CORE,manifestHash='6440b313e11bf61a4efaf11c1067630f08632169e6fbbf7c866d0b63e22da2f0',source='1e6ff9f0fa4467cb532c26182b1334558b13bfaa',entryHash='ebc933faf015aadc32be74f7abeaef66252ef3bc72dc52ebac265ced9ed577e5';
 const exe=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,ownerArgv='"'+exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.join(coreRoot,'run-current-owner.ps1')+' -ManifestSha256 '+manifestHash.toUpperCase()+' -ScopeName '+SCOPE;
 if(capture.schema!=='melisa-b6-current-read2b-owner-capture.v1'||capture.predecessorEntryKind!=='CurrentInitializerClean'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.recordPath!==String.raw`C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json`||capture.recordBeforeSha256!==REHEARSAL_INPUTS['current-erp-processes.before.json']||capture.recordBeforeFile!=='current-erp-processes.before.json'||capture.entry?.root!==coreRoot||capture.entry.leaf!=='run-current-owner.ps1'||capture.entry.sha256!==entryHash||capture.entry.manifestSha256!==manifestHash||capture.entry.runtimeEntryBytesVerified!==false||capture.entry.postExitExclusiveBytesRequired!==true||capture.owner?.pid!==31212||capture.owner.birth!=='134377334934998450'||capture.owner.exe!==exe||capture.owner.argv!==ownerArgv||capture.child?.pid!==44612||capture.child.birth!=='134377336265107097'||capture.child.parent!==31212)fail('B6_REHEARSAL_PREDECESSOR_REJECTED');
 const entryKeys=['sha256','postExitExclusiveBytesRequired','leaf','root','manifestSha256','runtimeEntryBytesVerified'];
 if(Object.keys(capture.entry).sort().join('|')!==entryKeys.sort().join('|'))fail('B6_REHEARSAL_PREDECESSOR_REJECTED');
 const status=capture.nativeStatus;
 if(status?.nativePeerVerified!==true||status.stopAuthorized!==false||status.childObservationOnly!==true||status.reply!=='Status'||status.state?.phase!=='Running'||status.state.ownerPid!==capture.owner.pid||String(status.state.ownerBirth)!==capture.owner.birth||status.state.childPid!==capture.child.pid||String(status.state.childBirth)!==capture.child.birth||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0)fail('B6_REHEARSAL_PREDECESSOR_REJECTED');
 if(capture.installedApiManifest!=='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'||capture.installedWebManifest!=='91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd')fail('B6_REHEARSAL_CURRENT_PAIR_REJECTED');
 const core=json(pinned(path.join(coreRoot,'owner-manifest.json'),manifestHash)),names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1','install-business-5244-readpair.ps1'].sort();
 if(core.kind!=='CURRENT_INITIALIZER_CLEAN_BUNDLE'||core.finiteScope!==SCOPE||core.sourceCommit!==source||core.initialSlot!=='Current'||core.actualT1!==false||core.externalOperations!==false||core.installed!==false||core.recordingEnabled!==false||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==names.join('|'))fail('B6_REHEARSAL_CURRENT_SOURCE_REJECTED');
 for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.path!=='run-current-owner.ps1'&&pinned(path.join(coreRoot,f.path),f.sha256).length!==f.bytes)fail('B6_REHEARSAL_CURRENT_SOURCE_REJECTED');}
 if(core.files.find(f=>f.path==='run-current-owner.ps1').sha256!==entryHash)fail('B6_REHEARSAL_CURRENT_SOURCE_REJECTED');
 const rows=json(inputs.get('current-erp-processes.before.json')),web=Array.isArray(rows)?rows.filter(r=>r.port===5244):[];
 if(web.length!==1||web[0].pid!==44612||web[0].root!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-2b744f5b-API-READ`||web[0].sourceCommit!=='2b744f5b9ebda05b1355602126b1a8e5f114be83'||Object.entries(capture.webRecord??{}).some(([key,value])=>web[0][key]!==value))fail('B6_REHEARSAL_CURRENT_RECORD_REJECTED');
 if(task.schema!=='melisa-b6-task-capture.v1'||task.readOnly!==true||task.taskPath!=='\\Melisa-ERP-TEST-Canonical'||task.instanceCount!==1||task.enginePid!==46232||task.xmlSha256!==REHEARSAL_INPUTS['current-task.before.xml']||task.sddlSha256!==REHEARSAL_INPUTS['current-task.before.sddl']||task.writes!==0)fail('B6_REHEARSAL_TASK_CAPTURE_REJECTED');
 const prior=json(pinned(path.join(INITIALIZER_CLEAN_PRIVATE,'entry-hold-capture.json'),INITIALIZER_CLEAN_INPUTS['entry-hold-capture.json']));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const entryCaptureKeys=['schema','observedAt','readOnly','executionAuthority','ownerCaptureSha256','gate','entries','directEntries','entryWrites','serviceCalls','sqlCalls','postExitExclusiveEntryCount','runtimeValidationComplete'];
 if(Object.keys(entries).sort().join('|')!==entryCaptureKeys.sort().join('|')||typeof entries.observedAt!=='string'||entries.observedAt!=='2026-10-29T02:58:01.7051987Z')fail('B6_REHEARSAL_ENTRY_CAPTURE_REJECTED');
 if(entries.schema!=='melisa-b6-rehearsal-current-entry-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==REHEARSAL_INPUTS['current-read2b-owner-capture.json']||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0||entries.runtimeValidationComplete!==false||entries.postExitExclusiveEntryCount!==18||entries.entries?.length!==6||entries.directEntries?.length!==12||!same(entries.entries,prior.entries)||!same(entries.directEntries.slice(0,11),prior.directEntries)||!same(entries.directEntries[11],{path:path.join(coreRoot,'run-current-owner.ps1'),sha256:entryHash})||!same(entries.gate,prior.gate))fail('B6_REHEARSAL_ENTRY_CAPTURE_REJECTED');
 // Only metadata is available for these eighteen held entry leaves. Their
 // exact bytes remain a mandatory post-exit exclusive-runtime check.
 if(prior.entries?.length!==6||prior.directEntries?.length!==11||prior.schema!=='melisa-b6-current-entry-hold-capture.v1'||prior.executionAuthority!==false||!same(prior.directEntries.slice(0,10),currentSupersessionHistories(true))||!same(prior.directEntries[10],{path:path.join(CURRENT_SUPERSESSION_CORE,'run-current-owner.ps1'),sha256:INITIALIZER_ORIGINAL_ENTRY_HASH}))fail('B6_REHEARSAL_ENTRY_HISTORY_REJECTED');
 if(entries.gate.path!==String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\business-5244-startup-exclusion-ec316a63.ps1`||entries.gate.sha256!=='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12')fail('B6_REHEARSAL_ENTRY_HISTORY_REJECTED');
 pinned(entries.gate.path,entries.gate.sha256);
 return {inputs,capture};
}
function rehearsalPredecessorIdentity(capture){return {captureSha256:REHEARSAL_INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:REHEARSAL_INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'CurrentInitializerClean',entry:{...capture.entry},coreRoot:capture.entry.root,coreManifestSha256:capture.entry.manifestSha256};}
function rehearsalPassiveMetadata(){return {runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:18};}
function rehearsalPayload(source,ci,before){
 const coreFiles=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(name=>[name,source.files.get(name)]));coreFiles.set('run-current-owner.ps1',renderCurrent(source.head,'Rehearsal'));
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:SCOPE,sourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',rehearsalOnly:true,...rehearsalPassiveMetadata(),apiPackageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213',appPackageId:'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ',apiPort:4144,nativePort:4146,webPort:5244,actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,predecessor:rehearsalPredecessorIdentity(before.capture),beforeImages:Object.entries(REHEARSAL_INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...coreFiles].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 const coreBytes=bytes(manifest),library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,hash(coreBytes),hash(library),'Rehearsal');
 const routerManifest={kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:SCOPE,entrySourceCommit:source.head,coreRoot:REHEARSAL_CORE,coreManifestSha256:hash(coreBytes),routerLibrarySha256:hash(library),readPairMaintenanceEnabled:true,rehearsalOnly:true,...rehearsalPassiveMetadata(),actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:hash(entry),captureSha256:REHEARSAL_INPUTS['current-read2b-owner-capture.json']};
 return {coreFiles,coreBytes,routerBytes:bytes(routerManifest),library,entry};
}
export function prepareBusinessSaleRehearsalBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,false,false,true),ci=hostedSourceChecks(source.head),before=rehearsalPredecessor(),payload=rehearsalPayload(source,ci,before);
 for(const root of [REHEARSAL_CORE,REHEARSAL_ROUTER,REHEARSAL_PROOF]){if(fs.existsSync(root))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [name,sha]of Object.entries(REHEARSAL_INPUTS))pinned(path.join(REHEARSAL_PRIVATE,name),sha);
 for(const root of [REHEARSAL_CORE,REHEARSAL_ROUTER,REHEARSAL_PROOF])fs.mkdirSync(root);
 for(const [name,b]of payload.coreFiles)writeLeaf(REHEARSAL_CORE,name,b);for(const [name,b]of before.inputs)writeLeaf(REHEARSAL_CORE,name,b);writeLeaf(REHEARSAL_CORE,'owner-manifest.json',payload.coreBytes);
 writeLeaf(REHEARSAL_ROUTER,'readpair-router-library.ps1',payload.library);writeLeaf(REHEARSAL_ROUTER,'start-business-5244-readpair-router.ps1',payload.entry);writeLeaf(REHEARSAL_ROUTER,'owner-manifest.json',payload.routerBytes);
 const result={schema:'melisa-b6-rehearsal-owner-preparation.v1',...rehearsalPassiveMetadata(),ownerSourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,rehearsalOnly:true,coreRoot:REHEARSAL_CORE,coreManifestSha256:hash(payload.coreBytes),routerRoot:REHEARSAL_ROUTER,routerManifestSha256:hash(payload.routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),coreFiles:13,beforeImages:6,installed:false,recordingEnabled:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,hostedCi:ci};
 writeLeaf(REHEARSAL_PROOF,'preparation-receipt.json',bytes(result));writeLeaf(REHEARSAL_PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(REHEARSAL_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleRehearsalBundle(){
 const receipt=json(read(path.join(REHEARSAL_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,false,false,true),ci=hostedSourceChecks(source.head),before=rehearsalPredecessor();
 if(receipt.schema!=='melisa-b6-rehearsal-owner-preparation.v1'||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==APP_SOURCE||receipt.rehearsalOnly!==true||Object.entries(rehearsalPassiveMetadata()).some(([key,value])=>receipt[key]!==value)||receipt.coreRoot!==REHEARSAL_CORE||receipt.routerRoot!==REHEARSAL_ROUTER||receipt.coreFiles!==13||receipt.beforeImages!==6||receipt.installed!==false||receipt.recordingEnabled!==false||receipt.executable!==false||receipt.executionAuthority!==false||receipt.sqlCalls!==0||receipt.serviceCalls!==0||receipt.ownerCalls!==0||receipt.taskChanges!==0||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!Array.isArray(receipt.hostedCi)||receipt.hostedCi.length!==2||receipt.hostedCi.some((row,n)=>row.event!==ci[n].event||row.head!==source.head||row.conclusion!=='success'||!Number.isSafeInteger(row.runId)||row.runId<1||JSON.stringify(row.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_REHEARSAL_PREPARED_METADATA_CHANGED');
 const expected=rehearsalPayload(source,receipt.hostedCi,before);
 if(receipt.coreManifestSha256!==hash(expected.coreBytes)||receipt.routerManifestSha256!==hash(expected.routerBytes)||!read(path.join(REHEARSAL_CORE,'owner-manifest.json')).equals(expected.coreBytes)||!read(path.join(REHEARSAL_ROUTER,'owner-manifest.json')).equals(expected.routerBytes))fail('B6_REHEARSAL_PREPARED_METADATA_CHANGED');
 for(const [name,b]of expected.coreFiles)if(!read(path.join(REHEARSAL_CORE,name)).equals(b))fail('B6_REHEARSAL_PREPARED_SOURCE_CHANGED');
 for(const [name,b]of before.inputs)if(!read(path.join(REHEARSAL_CORE,name)).equals(b))fail('B6_REHEARSAL_PREPARED_CAPTURE_CHANGED');
 if(!read(path.join(REHEARSAL_ROUTER,'readpair-router-library.ps1')).equals(expected.library)||!read(path.join(REHEARSAL_ROUTER,'start-business-5244-readpair-router.ps1')).equals(expected.entry)||!read(REHEARSAL_VERIFIER).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(path.join(REHEARSAL_PROOF,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_REHEARSAL_PREPARED_SOURCE_CHANGED');
 return {schema:'melisa-b6-rehearsal-owner-verification.v1',...rehearsalPassiveMetadata(),ownerSourceCommit:source.head,currentRepoHead:source.repoHead,rehearsalOnly:true,coreRoot:REHEARSAL_CORE,coreManifestSha256:hash(expected.coreBytes),routerRoot:REHEARSAL_ROUTER,routerManifestSha256:hash(expected.routerBytes),installerSourceSha256:receipt.installerSourceSha256,coreFiles:13,beforeImages:6,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};
}
function candidatePredecessor(){
 if(Object.values(CANDIDATE_INPUTS).some(v=>!hex(v)))fail('B6_CANDIDATE_CAPTURE_NOT_PREPARED');
 const inputs=new Map(Object.entries(CANDIDATE_INPUTS).map(([name,sha])=>[name,pinned(path.join(CANDIDATE_PRIVATE,name),sha)]));
 const capture=json(inputs.get('current-read2b-owner-capture.json')),task=json(inputs.get('current-task-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json'));
 const exe=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,ownerArgv='"'+exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.join(CANDIDATE_CURRENT_ROUTER,'start-business-5244-readpair-router.ps1')+' -ManifestSha256 '+CANDIDATE_CURRENT_ROUTER_HASH.toUpperCase()+' -ScopeName '+SCOPE+' ';
 if(capture.schema!=='melisa-b6-current-read2b-owner-capture.v1'||capture.predecessorEntryKind!=='ReadPairRouter'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.recordPath!==String.raw`C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json`||capture.recordBeforeSha256!==CANDIDATE_INPUTS['current-erp-processes.before.json']||capture.recordBeforeFile!=='current-erp-processes.before.json'||capture.core?.root!==CANDIDATE_CURRENT_CORE||capture.core.manifestSha256!==CANDIDATE_CURRENT_CORE_HASH||capture.router?.root!==CANDIDATE_CURRENT_ROUTER||capture.router.manifestSha256!==CANDIDATE_CURRENT_ROUTER_HASH||capture.entry?.root!==CANDIDATE_CURRENT_ROUTER||capture.entry.leaf!=='start-business-5244-readpair-router.ps1'||capture.entry.sha256!==CANDIDATE_CURRENT_ROUTER_ENTRY_HASH||capture.entry.manifestSha256!==CANDIDATE_CURRENT_ROUTER_HASH||capture.entry.runtimeEntryBytesVerified!==false||capture.entry.postExitExclusiveBytesRequired!==true||capture.core.sourceCommit!==CANDIDATE_CURRENT_SOURCE||capture.router.coreRoot!==CANDIDATE_CURRENT_CORE||capture.router.coreManifestSha256!==CANDIDATE_CURRENT_CORE_HASH||capture.router.entrySha256!==CANDIDATE_CURRENT_ROUTER_ENTRY_HASH||capture.owner?.pid!==38992||capture.owner.birth!=='134377492746263010'||capture.owner.exe!==exe||capture.owner.argv!==ownerArgv||capture.child?.pid!==46984||capture.child.birth!=='134377502264500436'||capture.child.parent!==38992)fail('B6_CANDIDATE_PREDECESSOR_REJECTED');
 if(Object.keys(capture.entry).sort().join('|')!==['sha256','postExitExclusiveBytesRequired','leaf','root','manifestSha256','runtimeEntryBytesVerified'].sort().join('|'))fail('B6_CANDIDATE_PREDECESSOR_REJECTED');
 const status=capture.nativeStatus;
 if(status?.nativePeerVerified!==true||status.stopAuthorized!==false||status.childObservationOnly!==true||status.reply!=='Status'||status.state?.phase!=='Running'||status.state.ownerPid!==capture.owner.pid||String(status.state.ownerBirth)!==capture.owner.birth||status.state.childPid!==capture.child.pid||String(status.state.childBirth)!==capture.child.birth||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0)fail('B6_CANDIDATE_PREDECESSOR_REJECTED');
 if(capture.installedApiManifest!=='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'||capture.installedWebManifest!=='91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd')fail('B6_CANDIDATE_CURRENT_PAIR_REJECTED');
 const core=json(pinned(path.join(CANDIDATE_CURRENT_CORE,'owner-manifest.json'),CANDIDATE_CURRENT_CORE_HASH)),router=json(pinned(path.join(CANDIDATE_CURRENT_ROUTER,'owner-manifest.json'),CANDIDATE_CURRENT_ROUTER_HASH)),names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||core.finiteScope!==SCOPE||core.sourceCommit!==CANDIDATE_CURRENT_SOURCE||core.rehearsalOnly!==true||core.actualT1!==false||core.externalOperations!==false||core.installed!==false||core.recordingEnabled!==false||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==names.join('|'))fail('B6_CANDIDATE_CURRENT_SOURCE_REJECTED');
 for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.path!=='run-current-owner.ps1'&&pinned(path.join(CANDIDATE_CURRENT_CORE,f.path),f.sha256).length!==f.bytes)fail('B6_CANDIDATE_CURRENT_SOURCE_REJECTED');}
 if(!Array.isArray(capture.core.files)||capture.core.files.length!==13||capture.core.files.some((row,n)=>row.path!==core.files[n].path||row.sha256!==core.files[n].sha256||row.bytes!==core.files[n].bytes))fail('B6_CANDIDATE_CURRENT_SOURCE_REJECTED');
 if(core.files.find(f=>f.path==='run-current-owner.ps1').sha256!==CANDIDATE_CURRENT_ENTRY_HASH||router.kind!=='BUSINESS5244_READ_PAIR_ROUTER'||router.finiteScope!==SCOPE||router.entrySourceCommit!==CANDIDATE_CURRENT_SOURCE||router.coreRoot!==CANDIDATE_CURRENT_CORE||router.coreManifestSha256!==CANDIDATE_CURRENT_CORE_HASH||router.entry!=='start-business-5244-readpair-router.ps1'||router.entrySha256!==CANDIDATE_CURRENT_ROUTER_ENTRY_HASH||router.rehearsalOnly!==true||router.actualT1!==false||router.externalOperations!==false||!hex(router.routerLibrarySha256))fail('B6_CANDIDATE_CURRENT_SOURCE_REJECTED');
 pinned(path.join(CANDIDATE_CURRENT_ROUTER,'readpair-router-library.ps1'),router.routerLibrarySha256);
 const rows=json(inputs.get('current-erp-processes.before.json')),web=Array.isArray(rows)?rows.filter(r=>r.port===5244):[];
 if(web.length!==1||web[0].pid!==46984||web[0].root!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-2b744f5b-API-READ`||web[0].sourceCommit!=='2b744f5b9ebda05b1355602126b1a8e5f114be83'||Object.entries(capture.webRecord??{}).some(([key,value])=>web[0][key]!==value))fail('B6_CANDIDATE_CURRENT_RECORD_REJECTED');
 if(task.schema!=='melisa-b6-task-capture.v1'||task.readOnly!==true||task.taskPath!=='\\Melisa-ERP-TEST-Canonical'||task.instanceCount!==1||task.enginePid!==5612||task.instanceGuid!=='{B6F6D609-D59A-4E00-97C4-ACA106C7C875}'||task.xmlSha256!==CANDIDATE_INPUTS['current-task.before.xml']||task.sddlSha256!==CANDIDATE_INPUTS['current-task.before.sddl']||task.writes!==0)fail('B6_CANDIDATE_TASK_CAPTURE_REJECTED');
 const prior=json(pinned(path.join(REHEARSAL_PRIVATE,'current-entry-hold-capture.json'),REHEARSAL_INPUTS['current-entry-hold-capture.json'])),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const entryKeys=['schema','observedAt','readOnly','executionAuthority','ownerCaptureSha256','gate','entries','directEntries','entryWrites','serviceCalls','sqlCalls','postExitExclusiveEntryCount','runtimeValidationComplete'];
 if(Object.keys(entries).sort().join('|')!==entryKeys.sort().join('|')||entries.observedAt!=='2026-10-29T12:40:46.8158553Z')fail('B6_CANDIDATE_ENTRY_CAPTURE_REJECTED');
 const sameEntry=(row,p,sha)=>row&&Object.keys(row).sort().join('|')==='path|sha256'&&row.path===p&&row.sha256===sha;
 if(entries.schema!=='melisa-b6-candidate-current-entry-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==CANDIDATE_INPUTS['current-read2b-owner-capture.json']||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0||entries.runtimeValidationComplete!==false||entries.postExitExclusiveEntryCount!==20||entries.entries?.length!==6||entries.directEntries?.length!==14||!same(entries.entries,prior.entries)||!same(entries.directEntries.slice(0,12),prior.directEntries)||!sameEntry(entries.directEntries[12],path.join(CANDIDATE_CURRENT_CORE,'run-current-owner.ps1'),CANDIDATE_CURRENT_ENTRY_HASH)||!sameEntry(entries.directEntries[13],path.join(CANDIDATE_CURRENT_ROUTER,'start-business-5244-readpair-router.ps1'),CANDIDATE_CURRENT_ROUTER_ENTRY_HASH)||!same(entries.gate,prior.gate))fail('B6_CANDIDATE_ENTRY_CAPTURE_REJECTED');
 if(prior.schema!=='melisa-b6-rehearsal-current-entry-capture.v1'||prior.entries?.length!==6||prior.directEntries?.length!==12||prior.executionAuthority!==false||prior.postExitExclusiveEntryCount!==18||prior.runtimeValidationComplete!==false)fail('B6_CANDIDATE_ENTRY_HISTORY_REJECTED');
 pinned(entries.gate.path,entries.gate.sha256);
 return {inputs,capture};
}
function candidatePredecessorIdentity(capture){return {captureSha256:CANDIDATE_INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:CANDIDATE_INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'ReadPairRouter',entry:{...capture.entry},coreRoot:capture.core.root,coreManifestSha256:capture.core.manifestSha256,routerRoot:capture.router.root,routerManifestSha256:capture.router.manifestSha256};}
function candidatePassiveMetadata(){return {runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:20};}
function candidatePayload(source,ci,before){
 const coreFiles=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(name=>[name,source.files.get(name)]));coreFiles.set('run-current-owner.ps1',renderCurrent(source.head,'Candidate'));
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:SCOPE,sourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',rehearsalOnly:false,maintenancePurpose:CANDIDATE_PURPOSE,...candidatePassiveMetadata(),apiPackageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213',appPackageId:'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ',apiPort:4144,nativePort:4146,webPort:5244,actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,predecessor:candidatePredecessorIdentity(before.capture),beforeImages:Object.entries(CANDIDATE_INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...coreFiles].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 const coreBytes=bytes(manifest),library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,hash(coreBytes),hash(library),'Candidate');
 const routerManifest={kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:SCOPE,entrySourceCommit:source.head,coreRoot:CANDIDATE_CORE,coreManifestSha256:hash(coreBytes),routerLibrarySha256:hash(library),readPairMaintenanceEnabled:true,rehearsalOnly:false,maintenancePurpose:CANDIDATE_PURPOSE,...candidatePassiveMetadata(),actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:hash(entry),captureSha256:CANDIDATE_INPUTS['current-read2b-owner-capture.json']};
 return {coreFiles,coreBytes,routerBytes:bytes(routerManifest),library,entry};
}
export function prepareBusinessSaleCandidateBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,false,false,false,true),ci=hostedSourceChecks(source.head),before=candidatePredecessor(),payload=candidatePayload(source,ci,before);
 for(const root of [CANDIDATE_CORE,CANDIDATE_ROUTER,CANDIDATE_PROOF]){if(fs.existsSync(root))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [name,sha]of Object.entries(CANDIDATE_INPUTS))pinned(path.join(CANDIDATE_PRIVATE,name),sha);
 for(const root of [CANDIDATE_CORE,CANDIDATE_ROUTER,CANDIDATE_PROOF])fs.mkdirSync(root);
 for(const [name,b]of payload.coreFiles)writeLeaf(CANDIDATE_CORE,name,b);for(const [name,b]of before.inputs)writeLeaf(CANDIDATE_CORE,name,b);writeLeaf(CANDIDATE_CORE,'owner-manifest.json',payload.coreBytes);
 writeLeaf(CANDIDATE_ROUTER,'readpair-router-library.ps1',payload.library);writeLeaf(CANDIDATE_ROUTER,'start-business-5244-readpair-router.ps1',payload.entry);writeLeaf(CANDIDATE_ROUTER,'owner-manifest.json',payload.routerBytes);
 const result={schema:'melisa-b6-candidate-owner-preparation.v1',...candidatePassiveMetadata(),ownerSourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,rehearsalOnly:false,maintenancePurpose:CANDIDATE_PURPOSE,coreRoot:CANDIDATE_CORE,coreManifestSha256:hash(payload.coreBytes),routerRoot:CANDIDATE_ROUTER,routerManifestSha256:hash(payload.routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),coreFiles:13,beforeImages:6,installed:false,recordingEnabled:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,hostedCi:ci};
 writeLeaf(CANDIDATE_PROOF,'preparation-receipt.json',bytes(result));writeLeaf(CANDIDATE_PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(CANDIDATE_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleCandidateBundle(){
 const receipt=json(read(path.join(CANDIDATE_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,false,false,false,true),ci=hostedSourceChecks(source.head),before=candidatePredecessor();
 if(receipt.schema!=='melisa-b6-candidate-owner-preparation.v1'||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==APP_SOURCE||receipt.rehearsalOnly!==false||receipt.maintenancePurpose!==CANDIDATE_PURPOSE||Object.entries(candidatePassiveMetadata()).some(([key,value])=>receipt[key]!==value)||receipt.coreRoot!==CANDIDATE_CORE||receipt.routerRoot!==CANDIDATE_ROUTER||receipt.coreFiles!==13||receipt.beforeImages!==6||receipt.installed!==false||receipt.recordingEnabled!==false||receipt.executable!==false||receipt.executionAuthority!==false||receipt.sqlCalls!==0||receipt.serviceCalls!==0||receipt.ownerCalls!==0||receipt.taskChanges!==0||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!Array.isArray(receipt.hostedCi)||receipt.hostedCi.length!==2||receipt.hostedCi.some((row,n)=>row.event!==ci[n].event||row.head!==source.head||row.conclusion!=='success'||!Number.isSafeInteger(row.runId)||row.runId<1||JSON.stringify(row.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_CANDIDATE_PREPARED_METADATA_CHANGED');
 const expected=candidatePayload(source,receipt.hostedCi,before);
 if(receipt.coreManifestSha256!==hash(expected.coreBytes)||receipt.routerManifestSha256!==hash(expected.routerBytes)||!read(path.join(CANDIDATE_CORE,'owner-manifest.json')).equals(expected.coreBytes)||!read(path.join(CANDIDATE_ROUTER,'owner-manifest.json')).equals(expected.routerBytes))fail('B6_CANDIDATE_PREPARED_METADATA_CHANGED');
 for(const [name,b]of expected.coreFiles)if(!read(path.join(CANDIDATE_CORE,name)).equals(b))fail('B6_CANDIDATE_PREPARED_SOURCE_CHANGED');
 for(const [name,b]of before.inputs)if(!read(path.join(CANDIDATE_CORE,name)).equals(b))fail('B6_CANDIDATE_PREPARED_CAPTURE_CHANGED');
 if(!read(path.join(CANDIDATE_ROUTER,'readpair-router-library.ps1')).equals(expected.library)||!read(path.join(CANDIDATE_ROUTER,'start-business-5244-readpair-router.ps1')).equals(expected.entry)||!read(CANDIDATE_VERIFIER).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(path.join(CANDIDATE_PROOF,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_CANDIDATE_PREPARED_SOURCE_CHANGED');
 return {schema:'melisa-b6-candidate-owner-verification.v1',...candidatePassiveMetadata(),ownerSourceCommit:source.head,currentRepoHead:source.repoHead,rehearsalOnly:false,maintenancePurpose:CANDIDATE_PURPOSE,coreRoot:CANDIDATE_CORE,coreManifestSha256:hash(expected.coreBytes),routerRoot:CANDIDATE_ROUTER,routerManifestSha256:hash(expected.routerBytes),installerSourceSha256:receipt.installerSourceSha256,coreFiles:13,beforeImages:6,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};
}
function writerPackagePair(){
 if(!hex(WRITER_PAIR_HASH))fail('B6_WRITER_PAIR_NOT_PREPARED');
 const pairBytes=pinned(path.join(WRITER_PRIVATE,'writer-package-pair.json'),WRITER_PAIR_HASH),pair=json(pairBytes);
 const exact=(v,keys)=>v&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
 if(!exact(pair,['schema','scope','purpose','current','candidate'])||pair.schema!=='melisa-b6-writer-package-pair.v1'||pair.scope!==WRITER_SCOPE||pair.purpose!==WRITER_PURPOSE)fail('B6_WRITER_PACKAGE_PAIR_REJECTED');
 const roots={current:{api:'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028',web:'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028',componentManifestSha256:'85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d',webHash:'3881c27d0dd5ae126ead89d72a5ae28614386b040183eec3f1486c73f5bd0877',webSource:APP_SOURCE},candidate:{api:'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029',web:'ERP-BUSINESS-WEB-5244-B6-WRITER-20261029',componentManifestSha256:'560c735fcaffa6692f55543840f8106679b43b871e3c19f1990bdd17d46f9946',webHash:'121020af80ef660c4b9a0872f31dd4c3306bff81346f66797a6806bf6b1a4189',webSource:WRITER_APP_SOURCE}};
 for(const mode of ['current','candidate']){
  const actual=pair[mode],fixed=roots[mode];if(!exact(actual,['api','web'])||!exact(actual.api,['root','packageId','manifestSha256','sourceCommit','configPath'])||!exact(actual.web,['root','packageId','manifestSha256','frontendSourceCommit','backendPackageId','backendManifestSha256']))fail('B6_WRITER_PACKAGE_PAIR_REJECTED');
  const a=actual.api,w=actual.web;if(a.root!==path.join(RELEASES,fixed.api)||a.packageId!==fixed.api||a.manifestSha256!==fixed.componentManifestSha256||a.sourceCommit!=='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'||a.configPath!==String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`||w.root!==path.join(RELEASES,fixed.web)||w.packageId!==fixed.web||w.manifestSha256!==fixed.webHash||w.frontendSourceCommit!==fixed.webSource||w.backendPackageId!==fixed.api||w.backendManifestSha256!==fixed.componentManifestSha256)fail('B6_WRITER_PACKAGE_PAIR_REJECTED');
  const am=json(pinned(path.join(a.root,'release-manifest.json'),a.manifestSha256)),wm=json(pinned(path.join(w.root,'release-manifest.json'),w.manifestSha256));
  if(am.packageId!==a.packageId||am.sourceCommit!==a.sourceCommit||wm.packageId!==w.packageId||wm.sourceCommit!==w.frontendSourceCommit||wm.backendPackageId!==a.packageId||wm.backendManifestSha256!==a.manifestSha256||am.actualT1!==false||am.externalOperations!==false||wm.actualT1!==false||wm.externalOperations!==false)fail('B6_WRITER_PACKAGE_MANIFEST_REJECTED');
  if(mode==='candidate'&&(am.businessSaleCandidate?.kind!=='ADMITTED_B6_WRITER'||am.businessSaleCandidate.recordingEnabled!==true||am.businessSaleWriterActivation?.purpose!==WRITER_PURPOSE||am.businessSaleWriterActivation.sourceCommit!==WRITER_APP_SOURCE||wm.businessSaleCandidate?.recordingEnabled!==true))fail('B6_WRITER_PACKAGE_PURPOSE_REJECTED');
 }
 return {bytes:pairBytes,pair};
}
function writerPredecessor(){
 if(Object.values(WRITER_INPUTS).some(v=>!hex(v)))fail('B6_WRITER_CAPTURE_NOT_PREPARED');
 const inputs=new Map(Object.entries(WRITER_INPUTS).map(([name,sha])=>[name,pinned(path.join(WRITER_PRIVATE,name),sha)]));
 const capture=json(inputs.get('current-read2b-owner-capture.json')),task=json(inputs.get('current-task-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json'));
 const exe=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,ownerArgv='"'+exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.join(WRITER_CURRENT_CORE,'run-current-owner.ps1')+' -ManifestSha256 '+WRITER_CURRENT_CORE_HASH.toUpperCase()+' ';
 if(capture.schema!=='melisa-b6-writer-current-owner-capture.v1'||capture.predecessorEntryKind!=='CurrentCore'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.recordPath!==String.raw`C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json`||capture.recordBeforeSha256!==WRITER_INPUTS['current-erp-processes.before.json']||capture.recordBeforeFile!=='current-erp-processes.before.json'||capture.core?.root!==WRITER_CURRENT_CORE||capture.core.manifestSha256!==WRITER_CURRENT_CORE_HASH||capture.router?.root!==WRITER_CURRENT_ROUTER||capture.router.manifestSha256!==WRITER_CURRENT_ROUTER_HASH||capture.entry?.root!==WRITER_CURRENT_CORE||capture.entry.leaf!=='run-current-owner.ps1'||capture.entry.sha256!==WRITER_CURRENT_ENTRY_HASH||capture.entry.manifestSha256!==WRITER_CURRENT_CORE_HASH||capture.entry.runtimeEntryBytesVerified!==false||capture.entry.postExitExclusiveBytesRequired!==true||capture.core.sourceCommit!==WRITER_CURRENT_SOURCE||capture.router.coreRoot!==WRITER_CURRENT_CORE||capture.router.coreManifestSha256!==WRITER_CURRENT_CORE_HASH||capture.router.entrySha256!==WRITER_CURRENT_ROUTER_ENTRY_HASH||capture.owner?.pid!==17372||capture.owner.birth!=='134377623115780499'||capture.owner.exe!==exe||capture.owner.argv!==ownerArgv||capture.child?.pid!==14836||capture.child.birth!=='134377623535118145'||capture.child.parent!==17372)fail('B6_WRITER_PREDECESSOR_REJECTED');
 if(Object.keys(capture.entry).sort().join('|')!==['sha256','postExitExclusiveBytesRequired','leaf','root','manifestSha256','runtimeEntryBytesVerified'].sort().join('|'))fail('B6_WRITER_PREDECESSOR_REJECTED');
 const tl=capture.taskLauncher;
 if(!tl||Object.keys(tl).sort().join('|')!==['path','sha256','bytes','coreRoot','coreManifestSha256'].sort().join('|')||tl.path!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY\start-owned-test.ps1`||tl.sha256!=='1728c4d5dcc7eab597640550d068f84140a37d2820620a0a24bcdd3f8e39a917'||tl.bytes!==26901||tl.coreRoot!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-OWNER-20261029-DEBAFECB-APPLY`||tl.coreManifestSha256!=='554e46b609961ab3a9186460d09901a050212503770a0eaab7c7cc003b37e41e')fail('B6_WRITER_TASK_LAUNCHER_REJECTED');
 if(pinned(tl.path,tl.sha256).length!==tl.bytes)fail('B6_WRITER_TASK_LAUNCHER_REJECTED');
 const status=capture.nativeStatus;
 if(status?.nativePeerVerified!==true||status.stopAuthorized!==false||status.childObservationOnly!==true||status.reply!=='Status'||status.state?.phase!=='Running'||status.state.ownerPid!==capture.owner.pid||String(status.state.ownerBirth)!==capture.owner.birth||status.state.childPid!==capture.child.pid||String(status.state.childBirth)!==capture.child.birth||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0)fail('B6_WRITER_PREDECESSOR_REJECTED');
 if(capture.installedApiManifest!=='85ff1157f4d1ed69582d4a08dead319518d1c79c4ea74ea0f2a0606037a1289d'||capture.installedWebManifest!=='3881c27d0dd5ae126ead89d72a5ae28614386b040183eec3f1486c73f5bd0877')fail('B6_WRITER_CURRENT_PAIR_REJECTED');
 const core=json(pinned(path.join(WRITER_CURRENT_CORE,'owner-manifest.json'),WRITER_CURRENT_CORE_HASH)),router=json(pinned(path.join(WRITER_CURRENT_ROUTER,'owner-manifest.json'),WRITER_CURRENT_ROUTER_HASH)),names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||core.finiteScope!==WRITER_SCOPE||core.sourceCommit!==WRITER_CURRENT_SOURCE||core.rehearsalOnly!==false||core.maintenancePurpose!==WRITER_PURPOSE||core.actualT1!==false||core.externalOperations!==false||core.installed!==false||core.recordingEnabled!==false||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==names.join('|'))fail('B6_WRITER_CURRENT_SOURCE_REJECTED');
 for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.path!=='run-current-owner.ps1'&&pinned(path.join(WRITER_CURRENT_CORE,f.path),f.sha256).length!==f.bytes)fail('B6_WRITER_CURRENT_SOURCE_REJECTED');}
 if(!Array.isArray(capture.core.files)||capture.core.files.length!==13||capture.core.files.some((row,n)=>row.path!==core.files[n].path||row.sha256!==core.files[n].sha256||row.bytes!==core.files[n].bytes))fail('B6_WRITER_CURRENT_SOURCE_REJECTED');
 if(core.files.find(f=>f.path==='run-current-owner.ps1').sha256!==WRITER_CURRENT_ENTRY_HASH||router.kind!=='BUSINESS5244_READ_PAIR_ROUTER'||router.finiteScope!==WRITER_SCOPE||router.entrySourceCommit!==WRITER_CURRENT_SOURCE||router.coreRoot!==WRITER_CURRENT_CORE||router.coreManifestSha256!==WRITER_CURRENT_CORE_HASH||router.entry!=='start-business-5244-readpair-router.ps1'||router.entrySha256!==WRITER_CURRENT_ROUTER_ENTRY_HASH||router.rehearsalOnly!==false||router.maintenancePurpose!==WRITER_PURPOSE||router.actualT1!==false||router.externalOperations!==false||!hex(router.routerLibrarySha256))fail('B6_WRITER_CURRENT_SOURCE_REJECTED');
 pinned(path.join(WRITER_CURRENT_ROUTER,'readpair-router-library.ps1'),router.routerLibrarySha256);
 const rows=json(inputs.get('current-erp-processes.before.json')),web=Array.isArray(rows)?rows.filter(r=>r.port===5244):[];
 if(web.length!==1||web[0].pid!==14836||web[0].root!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028`||web[0].sourceCommit!=='ca620bac30f96034b33d4410dc43576a38a38707'||Object.entries(capture.webRecord??{}).some(([key,value])=>web[0][key]!==value))fail('B6_WRITER_CURRENT_RECORD_REJECTED');
 if(task.schema!=='melisa-b6-task-capture.v1'||task.readOnly!==true||task.taskPath!=='\\Melisa-ERP-TEST-Canonical'||task.instanceCount!==1||task.enginePid!==12504||task.instanceGuid!=='{84ACACC6-03BD-4F6E-9143-75F37FF5EF85}'||task.xmlSha256!==WRITER_INPUTS['current-task.before.xml']||task.sddlSha256!==WRITER_INPUTS['current-task.before.sddl']||task.writes!==0)fail('B6_WRITER_TASK_CAPTURE_REJECTED');
 const prior=json(pinned(path.join(String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-writer-activation-20261029`,'current-entry-hold-capture.json'),'4891f1e095cd0cfaef9221e56a16af29c2b234a9909009db47e00c533c9b957c')),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const entryKeys=['schema','observedAt','readOnly','executionAuthority','ownerCaptureSha256','gate','entries','directEntries','entryWrites','serviceCalls','sqlCalls','postExitExclusiveEntryCount','runtimeValidationComplete'];
 if(Object.keys(entries).sort().join('|')!==entryKeys.sort().join('|')||entries.observedAt!=='2026-10-29T15:56:21.1118226Z')fail('B6_WRITER_ENTRY_CAPTURE_REJECTED');
 const sameEntry=(row,p,sha)=>row&&Object.keys(row).sort().join('|')==='path|sha256'&&row.path===p&&row.sha256===sha;
 if(entries.schema!=='melisa-b6-writer-current-entry-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==WRITER_INPUTS['current-read2b-owner-capture.json']||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0||entries.runtimeValidationComplete!==false||entries.postExitExclusiveEntryCount!==24||entries.entries?.length!==6||entries.directEntries?.length!==18||!same(entries.entries,prior.entries)||!same(entries.directEntries.slice(0,16),prior.directEntries)||!sameEntry(entries.directEntries[16],path.join(WRITER_CURRENT_CORE,'run-current-owner.ps1'),WRITER_CURRENT_ENTRY_HASH)||!sameEntry(entries.directEntries[17],path.join(WRITER_CURRENT_ROUTER,'start-business-5244-readpair-router.ps1'),WRITER_CURRENT_ROUTER_ENTRY_HASH)||!same(entries.gate,prior.gate))fail('B6_WRITER_ENTRY_CAPTURE_REJECTED');
 if(prior.schema!=='melisa-b6-writer-current-entry-capture.v1'||prior.entries?.length!==6||prior.directEntries?.length!==16||prior.executionAuthority!==false||prior.postExitExclusiveEntryCount!==22||prior.runtimeValidationComplete!==false)fail('B6_WRITER_ENTRY_HISTORY_REJECTED');
 pinned(entries.gate.path,entries.gate.sha256);
 return {inputs,capture};
}
function writerPredecessorIdentity(capture){return {captureSha256:WRITER_INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:WRITER_INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'CurrentCore',entry:{...capture.entry},coreRoot:capture.core.root,coreManifestSha256:capture.core.manifestSha256,routerRoot:capture.router.root,routerManifestSha256:capture.router.manifestSha256};}
function writerPassiveMetadata(){return {runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:24};}
function writerPayload(source,ci,before){
 const pair=writerPackagePair(),coreFiles=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(name=>[name,source.files.get(name)]));coreFiles.set('run-current-owner.ps1',renderCurrent(source.head,'Writer'));
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:WRITER_SCOPE,sourceCommit:source.head,businessSaleSourceCommit:WRITER_APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',rehearsalOnly:false,maintenancePurpose:WRITER_PURPOSE,...writerPassiveMetadata(),apiPackageId:'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028',appPackageId:'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028',apiPort:4144,nativePort:4146,webPort:5244,actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,predecessor:writerPredecessorIdentity(before.capture),packagePair:{path:'writer-package-pair.json',sha256:WRITER_PAIR_HASH,bytes:pair.bytes.length},beforeImages:Object.entries(WRITER_INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...coreFiles].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 const coreBytes=bytes(manifest),library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,hash(coreBytes),hash(library),'Writer');
 const routerManifest={kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:WRITER_SCOPE,entrySourceCommit:source.head,coreRoot:WRITER_CORE,coreManifestSha256:hash(coreBytes),routerLibrarySha256:hash(library),readPairMaintenanceEnabled:true,rehearsalOnly:false,maintenancePurpose:WRITER_PURPOSE,...writerPassiveMetadata(),actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:hash(entry),captureSha256:WRITER_INPUTS['current-read2b-owner-capture.json']};
 return {coreFiles,coreBytes,routerBytes:bytes(routerManifest),library,entry,pairBytes:pair.bytes};
}
export function prepareBusinessSaleWriterBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=writerPredecessor(),payload=writerPayload(source,ci,before);
 for(const root of [WRITER_CORE,WRITER_ROUTER,WRITER_PROOF]){if(fs.existsSync(root))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [name,sha]of Object.entries(WRITER_INPUTS))pinned(path.join(WRITER_PRIVATE,name),sha);
 for(const root of [WRITER_CORE,WRITER_ROUTER,WRITER_PROOF])fs.mkdirSync(root);
 for(const [name,b]of payload.coreFiles)writeLeaf(WRITER_CORE,name,b);for(const [name,b]of before.inputs)writeLeaf(WRITER_CORE,name,b);writeLeaf(WRITER_CORE,'owner-manifest.json',payload.coreBytes);writeLeaf(WRITER_CORE,'writer-package-pair.json',payload.pairBytes);
 writeLeaf(WRITER_ROUTER,'readpair-router-library.ps1',payload.library);writeLeaf(WRITER_ROUTER,'start-business-5244-readpair-router.ps1',payload.entry);writeLeaf(WRITER_ROUTER,'owner-manifest.json',payload.routerBytes);
 const result={schema:'melisa-b6-writer-owner-preparation.v1',...writerPassiveMetadata(),ownerSourceCommit:source.head,businessSaleSourceCommit:WRITER_APP_SOURCE,rehearsalOnly:false,maintenancePurpose:WRITER_PURPOSE,coreRoot:WRITER_CORE,coreManifestSha256:hash(payload.coreBytes),routerRoot:WRITER_ROUTER,routerManifestSha256:hash(payload.routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),coreFiles:13,beforeImages:6,installed:false,recordingEnabled:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,hostedCi:ci};
 writeLeaf(WRITER_PROOF,'preparation-receipt.json',bytes(result));writeLeaf(WRITER_PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(WRITER_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleWriterBundle(){
 const receipt=json(read(path.join(WRITER_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=writerPredecessor();
 if(receipt.schema!=='melisa-b6-writer-owner-preparation.v1'||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==WRITER_APP_SOURCE||receipt.rehearsalOnly!==false||receipt.maintenancePurpose!==WRITER_PURPOSE||Object.entries(writerPassiveMetadata()).some(([key,value])=>receipt[key]!==value)||receipt.coreRoot!==WRITER_CORE||receipt.routerRoot!==WRITER_ROUTER||receipt.coreFiles!==13||receipt.beforeImages!==6||receipt.installed!==false||receipt.recordingEnabled!==false||receipt.executable!==false||receipt.executionAuthority!==false||receipt.sqlCalls!==0||receipt.serviceCalls!==0||receipt.ownerCalls!==0||receipt.taskChanges!==0||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!Array.isArray(receipt.hostedCi)||receipt.hostedCi.length!==2||receipt.hostedCi.some((row,n)=>row.event!==ci[n].event||row.head!==source.head||row.conclusion!=='success'||!Number.isSafeInteger(row.runId)||row.runId<1||JSON.stringify(row.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_WRITER_PREPARED_METADATA_CHANGED');
 const expected=writerPayload(source,receipt.hostedCi,before);
 if(receipt.coreManifestSha256!==hash(expected.coreBytes)||receipt.routerManifestSha256!==hash(expected.routerBytes)||!read(path.join(WRITER_CORE,'owner-manifest.json')).equals(expected.coreBytes)||!read(path.join(WRITER_ROUTER,'owner-manifest.json')).equals(expected.routerBytes))fail('B6_WRITER_PREPARED_METADATA_CHANGED');
 if(!read(path.join(WRITER_CORE,'writer-package-pair.json')).equals(expected.pairBytes))fail('B6_WRITER_PREPARED_PACKAGE_PAIR_CHANGED');
 for(const [name,b]of expected.coreFiles)if(!read(path.join(WRITER_CORE,name)).equals(b))fail('B6_WRITER_PREPARED_SOURCE_CHANGED');
 for(const [name,b]of before.inputs)if(!read(path.join(WRITER_CORE,name)).equals(b))fail('B6_WRITER_PREPARED_CAPTURE_CHANGED');
 if(!read(path.join(WRITER_ROUTER,'readpair-router-library.ps1')).equals(expected.library)||!read(path.join(WRITER_ROUTER,'start-business-5244-readpair-router.ps1')).equals(expected.entry)||!read(WRITER_VERIFIER).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(path.join(WRITER_PROOF,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_WRITER_PREPARED_SOURCE_CHANGED');
 return {schema:'melisa-b6-writer-owner-verification.v1',...writerPassiveMetadata(),ownerSourceCommit:source.head,currentRepoHead:source.repoHead,rehearsalOnly:false,maintenancePurpose:WRITER_PURPOSE,coreRoot:WRITER_CORE,coreManifestSha256:hash(expected.coreBytes),routerRoot:WRITER_ROUTER,routerManifestSha256:hash(expected.routerBytes),installerSourceSha256:receipt.installerSourceSha256,coreFiles:13,beforeImages:6,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};
}
function writerRecoveryBefore(){
 if(!hex(WRITER_RECOVERY_CASE_HASH))fail('B6_WRITER_RECOVERY_CASE_NOT_PREPARED');
 const fixedCaseBytes=pinned(path.join(WRITER_RECOVERY_PRIVATE,'writer-postcas-fixed-case.json'),WRITER_RECOVERY_CASE_HASH),fixedCase=json(fixedCaseBytes);
 if(fixedCase.schema!=='melisa-b6-writer-postcas-fixed-case.v1'||fixedCase.scope!==WRITER_SCOPE||fixedCase.purpose!=='CompleteHeldWriterCandidateAfterCas'||fixedCase.readOnly!==true||fixedCase.executionAuthority!==false||fixedCase.actualT1!==false||fixedCase.externalOperations!==false||fixedCase.ownerPid!==45612||fixedCase.ownerBirth!=='134377648982508423'||fixedCase.expectedFailureCode!=='TEST125_API_CONFIG_CHANGED'||fixedCase.baseCoreManifestSha256!==WRITER_RECOVERY_BASE_CORE_HASH||fixedCase.baseRouterManifestSha256!==WRITER_RECOVERY_BASE_ROUTER_HASH)fail('B6_WRITER_RECOVERY_CASE_REJECTED');
 const fields=['schema','scope','purpose','ownerPid','ownerBirth','webChildPid','webChildBirth','operationId','planHash','recordsSha256','pendingSha256','beforeSha256','startupCandidateSha256','apiProfileCandidateSha256','taskCandidateSignature','taskSddlHash','baseCoreManifestSha256','baseRouterManifestSha256','expectedFailureCode','readOnly','executionAuthority','actualT1','externalOperations'];
 if(Object.keys(fixedCase).sort().join('|')!==fields.sort().join('|')||fixedCase.webChildPid!==41076||fixedCase.webChildBirth!=='134377649729628304'||typeof fixedCase.operationId!=='string'||!/^[a-f0-9]{32}$/.test(fixedCase.operationId)||['planHash','recordsSha256','pendingSha256','beforeSha256','startupCandidateSha256','apiProfileCandidateSha256','taskCandidateSignature','taskSddlHash'].some(name=>!hex(fixedCase[name])))fail('B6_WRITER_RECOVERY_CASE_REJECTED');
 const core=json(pinned(path.join(WRITER_RECOVERY_BASE_CORE,'owner-manifest.json'),WRITER_RECOVERY_BASE_CORE_HASH)),router=json(pinned(path.join(WRITER_RECOVERY_BASE_ROUTER,'owner-manifest.json'),WRITER_RECOVERY_BASE_ROUTER_HASH)),names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||core.finiteScope!==WRITER_SCOPE||core.sourceCommit!=='d0b457f2ee9911dc2bf0b453723a91264ff551b6'||core.maintenancePurpose!==WRITER_PURPOSE||core.rehearsalOnly!==false||core.recordingEnabled!==false||core.actualT1!==false||core.externalOperations!==false||core.packagePair?.sha256!==WRITER_PAIR_HASH||!Array.isArray(core.files)||core.files.length!==13||core.files.map(f=>f.path).sort().join('|')!==names.join('|')||router.kind!=='BUSINESS5244_READ_PAIR_ROUTER'||router.finiteScope!==WRITER_SCOPE||router.coreRoot!==WRITER_RECOVERY_BASE_CORE||router.coreManifestSha256!==WRITER_RECOVERY_BASE_CORE_HASH||router.entrySourceCommit!==core.sourceCommit||router.maintenancePurpose!==WRITER_PURPOSE||router.actualT1!==false||router.externalOperations!==false)fail('B6_WRITER_RECOVERY_BASE_REJECTED');
 for(const row of core.files){if(typeof row.path!=='string'||/[\\/]/.test(row.path)||!hex(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<1||pinned(path.join(WRITER_RECOVERY_BASE_CORE,row.path),row.sha256).length!==row.bytes)fail('B6_WRITER_RECOVERY_BASE_REJECTED');}
 pinned(path.join(WRITER_RECOVERY_BASE_CORE,'writer-package-pair.json'),WRITER_PAIR_HASH);
 return {fixedCaseBytes,core};
}
function writerRecoveryManifest(source,ci,before){return {kind:'BUSINESS5244_WRITER_POSTCAS_RECOVERY',scope:WRITER_SCOPE,sourceCommit:source.head,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',baseCoreRoot:WRITER_RECOVERY_BASE_CORE,baseCoreManifestSha256:WRITER_RECOVERY_BASE_CORE_HASH,baseRouterRoot:WRITER_RECOVERY_BASE_ROUTER,baseRouterManifestSha256:WRITER_RECOVERY_BASE_ROUTER_HASH,fixedCase:{path:'writer-postcas-fixed-case.json',sha256:WRITER_RECOVERY_CASE_HASH,bytes:before.fixedCaseBytes.length},originalSourceFiles:before.core.files,files:WRITER_RECOVERY_SOURCE_FILES.map(name=>({path:name,sha256:hash(source.files.get(name)),bytes:source.files.get(name).length})),hostedCi:ci,actualT1:false,externalOperations:false,installed:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,writes:0};}
function writerRecoveryVerification(source,manifestBytes){return {schema:'melisa-b6-writer-recovery-verification.v1',coreRoot:WRITER_RECOVERY_CORE,coreManifestSha256:hash(manifestBytes),sourceCommit:source.head,files:3,baseCoreManifestSha256:WRITER_RECOVERY_BASE_CORE_HASH,fixedCaseSha256:WRITER_RECOVERY_CASE_HASH,installed:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,writes:0};}
export function prepareBusinessSaleWriterRecoveryBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,false,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=writerRecoveryBefore(),manifestBytes=bytes(writerRecoveryManifest(source,ci,before));
 for(const root of [WRITER_RECOVERY_CORE,WRITER_RECOVERY_PROOF]){if(fs.existsSync(root))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 pinned(path.join(WRITER_RECOVERY_PRIVATE,'writer-postcas-fixed-case.json'),WRITER_RECOVERY_CASE_HASH);
 for(const root of [WRITER_RECOVERY_CORE,WRITER_RECOVERY_PROOF])fs.mkdirSync(root);
 for(const name of WRITER_RECOVERY_SOURCE_FILES)writeLeaf(WRITER_RECOVERY_CORE,name,source.files.get(name));
 writeLeaf(WRITER_RECOVERY_CORE,'writer-postcas-fixed-case.json',before.fixedCaseBytes);writeLeaf(WRITER_RECOVERY_CORE,'owner-manifest.json',manifestBytes);
 const receipt={...writerRecoveryVerification(source,manifestBytes),schema:'melisa-b6-writer-recovery-preparation.v1',sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),hostedCi:ci};
 writeLeaf(WRITER_RECOVERY_PROOF,'preparation-receipt.json',bytes(receipt));writeLeaf(WRITER_RECOVERY_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return receipt;
}
export function verifyBusinessSaleWriterRecoveryBundle(){
 const receipt=json(read(path.join(WRITER_RECOVERY_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.sourceCommit,false,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=writerRecoveryBefore(),manifestBytes=bytes(writerRecoveryManifest(source,ci,before)),expected=writerRecoveryVerification(source,manifestBytes);
 const expectedReceipt={...expected,schema:'melisa-b6-writer-recovery-preparation.v1',sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),hostedCi:ci};
 if(JSON.stringify(receipt)!==JSON.stringify(expectedReceipt)||!read(path.join(WRITER_RECOVERY_CORE,'owner-manifest.json')).equals(manifestBytes)||!read(path.join(WRITER_RECOVERY_CORE,'writer-postcas-fixed-case.json')).equals(before.fixedCaseBytes)||!read(path.join(WRITER_RECOVERY_PROOF,'verified-owner-producer.mjs')).equals(source.files.get('prepare-business-sale-owner-bundle.mjs')))fail('B6_WRITER_RECOVERY_PAYLOAD_CHANGED');
 for(const name of WRITER_RECOVERY_SOURCE_FILES)if(!read(path.join(WRITER_RECOVERY_CORE,name)).equals(source.files.get(name)))fail('B6_WRITER_RECOVERY_PAYLOAD_CHANGED');
 return expected;
}

export function prepareBusinessSaleOwnerBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(),ci=hostedSourceChecks(source.head),before=predecessor();
 for(const dir of [CORE,ROUTER,PROOF]){if(fs.existsSync(dir))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(dir));}
 const coreFiles=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(n=>[n,source.files.get(n)]));coreFiles.set('run-current-owner.ps1',renderCurrent(source.head));
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:SCOPE,sourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',initialSlot:'Current',readPairMaintenanceEnabled:true,appPackageId:'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ',appManifestSha256:'91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd',apiPackageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213',candidateApiPackageId:'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028',candidateWebPackageId:'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028',apiPort:4144,nativePort:4146,webPort:5244,database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,predecessor:predecessorIdentity(),beforeImages:Object.entries(INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...coreFiles].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 const coreBytes=bytes(manifest),coreHash=hash(coreBytes),library=source.files.get('start-business-5244-readpair-router.ps1'),routerEntry=renderRouter(source.head,coreHash,hash(library));
 const routerManifest={kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:SCOPE,entrySourceCommit:source.head,coreRoot:CORE,coreManifestSha256:coreHash,routerLibrarySha256:hash(library),readPairMaintenanceEnabled:true,actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:hash(routerEntry),captureSha256:INPUTS['current-read2b-owner-capture.json']};const routerBytes=bytes(routerManifest);
 // Recheck source/capture before the first create; no mutable working file is copied.
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');for(const [name,sha] of Object.entries(INPUTS))pinned(path.join(PRIVATE,name),sha);
 for(const dir of [CORE,ROUTER,PROOF])fs.mkdirSync(dir);
 for(const [name,b] of coreFiles)writeLeaf(CORE,name,b);for(const [name,b] of before.inputs)writeLeaf(CORE,name,b);writeLeaf(CORE,'owner-manifest.json',coreBytes);
 writeLeaf(ROUTER,'readpair-router-library.ps1',library);writeLeaf(ROUTER,'start-business-5244-readpair-router.ps1',routerEntry);writeLeaf(ROUTER,'owner-manifest.json',routerBytes);
 const result={schema:'melisa-b6-passive-owner-preparation.v1',ownerSourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,coreRoot:CORE,coreManifestSha256:coreHash,routerRoot:ROUTER,routerManifestSha256:hash(routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),sourceFiles:BUSINESS_SALE_OWNER_SOURCE_FILES.length,sourceHashes:source.workingSourceHashes,coreFiles:coreFiles.size,beforeImages:before.inputs.size,installed:false,recordingEnabled:false,executable:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,controllerSourceBound:true,executionAuthority:false,blocker:'FRESH_NATIVE_AND_OWNER_ADMISSION_REQUIRED',hostedCi:ci};
 writeLeaf(PROOF,'preparation-receipt.json',bytes(result));writeLeaf(PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleOwnerBundle(){
 const receipt=json(read(path.join(PROOF,'preparation-receipt.json')));
 const source=committedSources(receipt.ownerSourceCommit);hostedSourceChecks(source.head);const before=predecessor();
 const coreBytes=read(path.join(CORE,'owner-manifest.json')),manifest=json(coreBytes),routerBytes=read(path.join(ROUTER,'owner-manifest.json')),routerManifest=json(routerBytes);
 if(receipt.schema!=='melisa-b6-passive-owner-preparation.v1'||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==APP_SOURCE||receipt.coreRoot!==CORE||receipt.routerRoot!==ROUTER||receipt.coreManifestSha256!==hash(coreBytes)||receipt.routerManifestSha256!==hash(routerBytes)||manifest.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||manifest.finiteScope!==SCOPE||manifest.sourceCommit!==source.head||manifest.businessSaleSourceCommit!==APP_SOURCE||manifest.files?.length!==13)fail('B6_OWNER_PREPARED_IDENTITY_CHANGED');
 const expectedBefore=Object.entries(INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length}));
 const expectedPredecessor=predecessorIdentity();
 if(JSON.stringify(manifest.beforeImages)!==JSON.stringify(expectedBefore)||JSON.stringify(manifest.predecessor)!==JSON.stringify(expectedPredecessor)||manifest.sourcePolicy!=='COMMITTED_GIT_BLOBS_ONLY'||manifest.actualT1!==false||manifest.externalOperations!==false||manifest.installed!==false||manifest.recordingEnabled!==false||manifest.apiPackageId!=='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'||manifest.appPackageId!=='ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(VERIFIED_PRODUCER).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||receipt.controllerSourceBound!==true||receipt.executionAuthority!==false||receipt.executable!==false||routerManifest.actualT1!==false||routerManifest.externalOperations!==false||routerManifest.captureSha256!==INPUTS['current-read2b-owner-capture.json'])fail('B6_OWNER_PREPARED_METADATA_CHANGED');
 const expected=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(name=>[name,source.files.get(name)]));expected.set('run-current-owner.ps1',renderCurrent(source.head));
 for(const [name,b] of expected){const rows=manifest.files.filter(r=>r.path===name);if(rows.length!==1||rows[0].sha256!==hash(b)||rows[0].bytes!==b.length||!read(path.join(CORE,name)).equals(b))fail('B6_OWNER_PREPARED_SOURCE_CHANGED');}
 for(const [name,b] of before.inputs)if(!read(path.join(CORE,name)).equals(b))fail('B6_OWNER_PREPARED_BEFORE_IMAGE_CHANGED');
 const library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,hash(coreBytes),hash(library));
 if(routerManifest.kind!=='BUSINESS5244_READ_PAIR_ROUTER'||routerManifest.finiteScope!==SCOPE||routerManifest.entrySourceCommit!==source.head||routerManifest.coreRoot!==CORE||routerManifest.coreManifestSha256!==hash(coreBytes)||routerManifest.routerLibrarySha256!==hash(library)||routerManifest.entrySha256!==hash(entry)||!read(path.join(ROUTER,'readpair-router-library.ps1')).equals(library)||!read(path.join(ROUTER,'start-business-5244-readpair-router.ps1')).equals(entry)||!read(path.join(PROOF,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_OWNER_PREPARED_ROUTER_CHANGED');
 return {schema:'melisa-b6-passive-owner-verification.v1',ownerSourceCommit:source.head,currentRepoHead:source.repoHead,sourceHashes:source.workingSourceHashes,coreManifestSha256:hash(coreBytes),routerManifestSha256:hash(routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),coreFiles:13,beforeImages:before.inputs.size,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0};
}
function renderCurrentSupersession(head,installerHash,initializerClean=false){
 const g=currentBundleGeneration(initializerClean);
 if(!commit(head)||!hex(installerHash))fail('B6_CURRENT_SUPERSESSION_RENDER_PIN_REJECTED');
 const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1','install-business-5244-readpair.ps1'].sort();
 return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,[Parameter(Mandatory)][ValidateSet(${ps(SCOPE)})][string]$ScopeName)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$core=${ps(g.core)};$sourceCommit=${ps(head)}
if($PSScriptRoot-cne$core-or$ScopeName-cne${ps(SCOPE)}){throw 'B6_CURRENT_SUPERSESSION_ROOT_CHANGED'}
${holdHelpers()}try{
Hold-B6 (Join-Path $core 'owner-manifest.json') $ManifestSha256
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'${g.kind}'-or$m.finiteScope-cne${ps(SCOPE)}-or$m.sourceCommit-cne$sourceCommit-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.initialSlot-cne'Current'-or$m.apiManifestSha256-cne'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'-or$m.appManifestSha256-cne'91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd'){throw 'B6_CURRENT_SUPERSESSION_IDENTITY_CHANGED'}
$names=@(${names.map(ps).join(',')})
if(@($m.files).Count-ne14-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_CURRENT_SUPERSESSION_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_CURRENT_SUPERSESSION_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
${Object.entries(g.inputs).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(String(sha))).join('\n')}
Hold-B6 (Join-Path $core 'install-business-5244-readpair.ps1') ${ps(installerHash)}
& (Join-Path $core 'install-business-5244-readpair.ps1') -${g.flag} -SourceSha256 ${ps(installerHash)} -ScopeName ${ps(SCOPE)}
}finally{foreach($stream in $held){$stream.Dispose()}}
`);
}
function currentSupersessionPayload(source,ci,before){
 const installer=source.files.get('install-business-5244-readpair.ps1'),files=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(n=>[n,source.files.get(n)]));
 files.set('run-current-owner.ps1',renderCurrentSupersession(source.head,hash(installer)));files.set('install-business-5244-readpair.ps1',installer);
 const manifest={kind:'CURRENT_ONLY_SUPERSESSION_BUNDLE',finiteScope:SCOPE,sourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',initialSlot:'Current',apiPackageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213',apiManifestSha256:'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090',appPackageId:'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ',appManifestSha256:'91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd',apiPort:4144,nativePort:4146,webPort:5244,database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,caseSha256:CURRENT_SUPERSESSION_INPUTS['supersession-fixed-case.json'],beforeImages:Object.entries(CURRENT_SUPERSESSION_INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...files].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 return {files,manifest};
}
function selectedCurrentPayload(source,ci,before,initializerClean){
 if(!initializerClean)return currentSupersessionPayload(source,ci,before);
 const g=currentBundleGeneration(true),payload=currentSupersessionPayload(source,ci,{inputs:before.privateLegacyInputs});
 payload.files.set('run-current-owner.ps1',renderCurrentSupersession(source.head,hash(source.files.get('install-business-5244-readpair.ps1')),true));
 Object.assign(payload.manifest,initializerPassiveValidation());
 payload.manifest.kind=g.kind;
 payload.manifest.caseSha256=g.inputs[g.caseLeaf];
 payload.manifest.beforeImages=Object.entries(g.inputs).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length}));
 payload.manifest.files=[...payload.files].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path));
 return payload;
}
export function prepareBusinessSaleCurrentSupersessionBundle(){return prepareCurrentBundle(false);}
export function prepareBusinessSaleInitializerCleanRecoveryBundle(){return prepareCurrentBundle(true);}
function prepareCurrentBundle(initializerClean){
 const g=currentBundleGeneration(initializerClean);
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,true,initializerClean),ci=hostedSourceChecks(source.head),before=initializerClean?initializerCleanCase():currentSupersessionCase(),payload=selectedCurrentPayload(source,ci,before,initializerClean),manifestBytes=bytes(payload.manifest);
 for(const dir of [g.core,g.proof]){if(fs.existsSync(dir))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(dir));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [name,sha] of Object.entries(g.inputs))pinned(path.join(g.privateRoot,name),sha);
 for(const dir of [g.core,g.proof])fs.mkdirSync(dir);
 for(const [name,b] of payload.files)writeLeaf(g.core,name,b);for(const [name,b] of before.inputs)writeLeaf(g.core,name,b);writeLeaf(g.core,'owner-manifest.json',manifestBytes);
 const result={...(initializerClean?initializerPassiveValidation():{}),schema:initializerClean?'melisa-initializer-clean-recovery-passive-preparation.v1':'melisa-current-supersession-passive-preparation.v1',ownerSourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,coreRoot:g.core,coreManifestSha256:hash(manifestBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),sourceHashes:source.workingSourceHashes,coreFiles:13,installerFiles:1,beforeImages:before.inputs.size,installed:false,recordingEnabled:false,executable:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,hostedCi:ci};
 writeLeaf(g.proof,'preparation-receipt.json',bytes(result));writeLeaf(g.proof,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(g.proof,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleCurrentSupersessionBundle(){return verifyCurrentBundle(false);}
export function verifyBusinessSaleInitializerCleanRecoveryBundle(){return verifyCurrentBundle(true);}
function verifyCurrentBundle(initializerClean){
 const g=currentBundleGeneration(initializerClean);
 const receipt=json(read(path.join(g.proof,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,true,initializerClean),ci=hostedSourceChecks(source.head),before=initializerClean?initializerCleanCase():currentSupersessionCase();
 const actualManifest=read(path.join(g.core,'owner-manifest.json')),manifest=json(actualManifest);
 if(!Array.isArray(manifest.hostedCi)||manifest.hostedCi.length!==2||manifest.hostedCi.some((r,n)=>r.event!==ci[n].event||r.head!==source.head||r.conclusion!=='success'||!Number.isSafeInteger(r.runId)||r.runId<1||JSON.stringify(r.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_CURRENT_SUPERSESSION_CI_CHANGED');
 const expected=selectedCurrentPayload(source,manifest.hostedCi,before,initializerClean);
 if(receipt.schema!==(initializerClean?'melisa-initializer-clean-recovery-passive-preparation.v1':'melisa-current-supersession-passive-preparation.v1')||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==APP_SOURCE||receipt.coreRoot!==g.core||receipt.coreManifestSha256!==hash(actualManifest)||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||receipt.coreFiles!==13||receipt.installerFiles!==1||receipt.beforeImages!==g.count||initializerClean&&Object.entries(initializerPassiveValidation()).some(([key,value])=>receipt[key]!==value)||receipt.installed!==false||receipt.recordingEnabled!==false||receipt.executable!==false||!actualManifest.equals(bytes(expected.manifest)))fail('B6_CURRENT_SUPERSESSION_PREPARED_CHANGED');
 for(const [name,b] of expected.files)if(!read(path.join(g.core,name)).equals(b))fail('B6_OWNER_PREPARED_SOURCE_CHANGED');
 for(const [name,b] of before.inputs)if(!read(path.join(g.core,name)).equals(b))fail('B6_OWNER_PREPARED_BEFORE_IMAGE_CHANGED');
 if(!read(g.verifier).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(path.join(g.proof,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_OWNER_PREPARED_SOURCE_CHANGED');
 return {...(initializerClean?initializerPassiveValidation():{}),schema:initializerClean?'melisa-initializer-clean-recovery-passive-verification.v1':'melisa-current-supersession-passive-verification.v1',ownerSourceCommit:source.head,currentRepoHead:source.repoHead,coreRoot:g.core,coreManifestSha256:hash(actualManifest),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),coreFiles:13,installerFiles:1,beforeImages:g.count,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};
}
const STEADY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-STEADY-OWNER-20261029');
const STEADY_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-steady-startup-20261029`;
const STEADY_PROOF=path.win32.join(STEADY_PRIVATE,'owner-preparation');
const STEADY_VERIFIER=path.win32.join(STEADY_PROOF,'verified-owner-producer.mjs');
const STEADY_INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'62d3882ceef3caf71a263ad51e036453eee2d59dbe871b8ccd2a03f3ad9756f8',
 'current-erp-processes.before.json':'81efde75eaa32a219e64f72b4455fa0dc7f103b2dceaf328a3615ce58ee8a05a',
 'current-task.before.xml':'db1b10bc8f9089ad30b78ba775882536ee15e62b2714aa5c21794d746fdd2bf5',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'075bb030c4fd26a82bf349e95cfcda17d425d8b7ebc08d43fde3d86e75e38fdf',
 'current-entry-hold-capture.json':'b9bbf950b04c9ec57bf1e4ec321d1b008cd82098276f8532e3354da40d87bd63'
});
function steadyBefore(){
 const names=['current-read2b-owner-capture.json','current-erp-processes.before.json','current-task.before.xml','current-task.before.sddl','current-task-capture.json','current-entry-hold-capture.json'];
 if(Object.keys(STEADY_INPUTS).sort().join('|')!==names.sort().join('|')||Object.values(STEADY_INPUTS).some(v=>!hex(v)))fail('B6_STEADY_CAPTURE_NOT_PREPARED');
 const inputs=new Map(Object.entries(STEADY_INPUTS).map(([n,h])=>[n,pinned(path.join(STEADY_PRIVATE,n),h)])),capture=json(inputs.get('current-read2b-owner-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json'));
 if(capture.readOnly!==true||capture.stopAuthorized!==false||capture.owner?.pid!==3608||capture.child?.pid!==52476||capture.child.parent!==3608||capture.installedApiManifest!==WEBONLY_BACKEND_HASH||capture.installedWebManifest!==WEBONLY_CANDIDATE_HASH||capture.recordBeforeSha256!==STEADY_INPUTS['current-erp-processes.before.json']||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0||capture.nativeStatus?.nativePeerVerified!==true||capture.nativeStatus.stopAuthorized!==false||capture.nativeStatus.state?.phase!=='Running'||capture.nativeStatus.state.ownerPid!==capture.owner.pid||capture.nativeStatus.state.childPid!==capture.child.pid||String(capture.nativeStatus.state.ownerBirth)!==capture.owner.birth||String(capture.nativeStatus.state.childBirth)!==capture.child.birth)fail('B6_STEADY_PREDECESSOR_REJECTED');
 if(entries.readOnly!==true||entries.executionAuthority!==false||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0||entries.ownerCaptureSha256!==STEADY_INPUTS['current-read2b-owner-capture.json']||!Array.isArray(entries.entries)||entries.entries.length!==6||!Array.isArray(entries.directEntries)||entries.postExitExclusiveEntryCount!==entries.entries.length+entries.directEntries.length||entries.runtimeValidationComplete!==false)fail('B6_STEADY_ENTRY_CAPTURE_REJECTED');
 const coreHash='d26648b28eef126e7c35473f66cf2338007280758727c8a7b8243a707572368e',routerHash='938c3b777c6ec140a7b7dad452ac1eb7fe1d15d76e183b29834fb9e00d73de79',entryHash='5bb24fc5034100eb3a8459c183297b1202837a4b61af5c793cabf9e3f6131b8e';
 const expectedArgv='"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.join(WEBONLY_ROUTER,'start-business-5244-readpair-router.ps1')+' -ManifestSha256 '+routerHash.toUpperCase()+' -ScopeName '+WRITER_SCOPE+' ';
 if(capture.schema!=='melisa-b6-writer-current-owner-capture.v1'||capture.predecessorEntryKind!=='ReadPairRouter'||capture.owner.birth!=='134377779664390871'||capture.child.birth!=='134377781387027619'||capture.owner.argv!==expectedArgv||capture.owner.exe!==String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`||capture.child.exe!==String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`||capture.core?.root!==WEBONLY_CORE||capture.core.manifestSha256!==coreHash||capture.core.sourceCommit!=='db2be8d3d474d54f0e6bcdfa125333de0c85f99c'||capture.router?.root!==WEBONLY_ROUTER||capture.router.manifestSha256!==routerHash||capture.entry?.root!==WEBONLY_ROUTER||capture.entry.leaf!=='start-business-5244-readpair-router.ps1'||capture.entry.sha256!==entryHash||capture.entry.manifestSha256!==routerHash||capture.entry.runtimeEntryBytesVerified!==false||capture.entry.postExitExclusiveBytesRequired!==true||entries.entries.length!==6||entries.directEntries.length!==22||entries.postExitExclusiveEntryCount!==28)fail('B6_STEADY_SOURCE_CAPTURE_REJECTED');
 const cm=json(pinned(path.join(WEBONLY_CORE,'owner-manifest.json'),coreHash)),rm=json(pinned(path.join(WEBONLY_ROUTER,'owner-manifest.json'),routerHash));
 if(cm.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||cm.maintenancePurpose!==WEBONLY_PURPOSE||cm.sourceCommit!==capture.core.sourceCommit||cm.finiteScope!==WRITER_SCOPE||!Array.isArray(cm.files)||cm.files.map(v=>v.path).sort().join('|')!==[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort().join('|')||JSON.stringify(cm.files)!==JSON.stringify(capture.core.files)||rm.coreRoot!==WEBONLY_CORE||rm.coreManifestSha256!==coreHash||rm.entrySha256!==entryHash)fail('B6_STEADY_SOURCE_MANIFEST_REJECTED');
 for(const row of cm.files)if(row.path!=='run-current-owner.ps1')pinned(path.join(WEBONLY_CORE,row.path),row.sha256);
 pinned(path.join(WEBONLY_ROUTER,'readpair-router-library.ps1'),rm.routerLibrarySha256);
 const prior=json(pinned(path.join(WEBONLY_CAPTURE,'current-entry-hold-capture.json'),WEBONLY_INPUTS['current-entry-hold-capture.json'])),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sameEntry=(r,p,h)=>r&&Object.keys(r).sort().join('|')==='path|sha256'&&r.path===p&&r.sha256===h;
 if(!same(entries.entries,prior.entries)||!same(entries.directEntries.slice(0,20),prior.directEntries)||!same(entries.gate,prior.gate)||!sameEntry(entries.directEntries[20],path.join(WEBONLY_CORE,'run-current-owner.ps1'),cm.files.find(v=>v.path==='run-current-owner.ps1').sha256)||!sameEntry(entries.directEntries[21],path.join(WEBONLY_ROUTER,'start-business-5244-readpair-router.ps1'),entryHash))fail('B6_STEADY_ENTRY_CHAIN_REJECTED');
 const rows=json(inputs.get('current-erp-processes.before.json')),list=Array.isArray(rows)?rows:[rows];const web=list.filter(r=>r.port===5244);if(web.length!==1||web[0].pid!==capture.child.pid||web[0].root!==path.join(RELEASES,'ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029')||web[0].sourceCommit!==WEBONLY_APP_SOURCE||web[0].backendPort!==4144)fail('B6_STEADY_RECORD_REJECTED');
 return {inputs,capture,entryCount:entries.postExitExclusiveEntryCount};
}
function renderSteadyCurrent(head){
 if(!commit(head))fail('B6_OWNER_RENDER_PIN_REJECTED');
 const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 return Buffer.from("param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256)\nSet-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$core="+ps(STEADY_CORE)+"\nif($PSScriptRoot-cne$core){throw 'B6_STEADY_ROOT_CHANGED'}\n"+holdHelpers()+"try{\nHold-B6 (Join-Path $core 'owner-manifest.json') $ManifestSha256\n$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json\nif($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne"+ps(WRITER_SCOPE)+"-or$m.maintenancePurpose-cne'WebOnlySteadyStartup'-or$m.sourceCommit-cne"+ps(head)+"-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.apiTransitionEnabled-ne$false-or$m.readPairMaintenanceEnabled-ne$false-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.recordingEnabled-ne$false){throw 'B6_STEADY_MANIFEST_CHANGED'}\n$names=@("+names.map(ps).join(',')+")\nif(@($m.files).Count-ne13-or(@($m.files.path|Sort-Object)-join'|')-cne($names-join'|')){throw 'B6_STEADY_CLOSURE_CHANGED'}\nforeach($file in $m.files){if($file.path-match'[\\\\/]'-or$file.sha256-cnotmatch'\\A[a-f0-9]{64}\\z'){throw 'B6_STEADY_LEAF_CHANGED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}\n. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName "+ps(WRITER_SCOPE)+"\nStart-Business5244OwnedSupervisor -InitialSlot Current -ScopeName "+ps(WRITER_SCOPE)+"|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}\n}"+initializationFailureTail(true));
}
function steadyPayload(source,ci,before){
 const pair=webOnlyPair(),coreFiles=new Map([...BUSINESS_SALE_OWNER_SOURCE_FILES.map(n=>[n,source.files.get(n)]),['run-current-owner.ps1',renderSteadyCurrent(source.head)]]);
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:WRITER_SCOPE,sourceCommit:source.head,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',maintenancePurpose:'WebOnlySteadyStartup',rehearsalOnly:false,apiTransitionEnabled:false,readPairMaintenanceEnabled:false,actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:before.entryCount,apiPackageId:pair.pair.candidate.api.packageId,appPackageId:pair.pair.candidate.web.packageId,apiManifestSha256:WEBONLY_BACKEND_HASH,webManifestSha256:WEBONLY_CANDIDATE_HASH,predecessor:{...writerPredecessorIdentity(before.capture),captureSha256:STEADY_INPUTS['current-read2b-owner-capture.json']},beforeImages:Object.entries(STEADY_INPUTS).map(([n,h])=>({path:n,sha256:h,bytes:before.inputs.get(n).length})),hostedCi:ci,files:[...coreFiles].map(([n,b])=>({path:n,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 return {coreFiles,coreBytes:bytes(manifest)};
}
function steadyVerification(source,payload,before){return {schema:'melisa-b6-steady-owner-verification.v1',ownerSourceCommit:source.head,coreRoot:STEADY_CORE,coreManifestSha256:hash(payload.coreBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),maintenancePurpose:'WebOnlySteadyStartup',scope:WRITER_SCOPE,coreFiles:13,beforeImages:6,apiTransitionEnabled:false,readPairMaintenanceEnabled:false,runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:before.entryCount,installed:false,recordingEnabled:false,executable:false,executionAuthority:false,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};}
export function prepareBusinessSaleSteadyBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,false,false,false,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=steadyBefore(),payload=steadyPayload(source,ci,before);
 for(const root of [STEADY_CORE,STEADY_PROOF]){if(fs.existsSync(root))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [n,h]of Object.entries(STEADY_INPUTS))pinned(path.join(STEADY_PRIVATE,n),h);
 for(const root of [STEADY_CORE,STEADY_PROOF])fs.mkdirSync(root);
 for(const [n,b]of payload.coreFiles)writeLeaf(STEADY_CORE,n,b);for(const [n,b]of before.inputs)writeLeaf(STEADY_CORE,n,b);writeLeaf(STEADY_CORE,'owner-manifest.json',payload.coreBytes);
 const result={...steadyVerification(source,payload,before),schema:'melisa-b6-steady-owner-preparation.v1',producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),hostedCi:ci};
 writeLeaf(STEADY_PROOF,'preparation-receipt.json',bytes(result));writeLeaf(STEADY_PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(STEADY_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleSteadyBundle(){
 const receipt=json(read(path.join(STEADY_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,false,false,false,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=steadyBefore(),payload=steadyPayload(source,ci,before),expected=steadyVerification(source,payload,before),prior={...expected,schema:'melisa-b6-steady-owner-preparation.v1',producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),hostedCi:receipt.hostedCi};
 if(JSON.stringify(receipt)!==JSON.stringify(prior)||receipt.hostedCi?.length!==2||receipt.hostedCi.some((r,n)=>r.event!==ci[n].event||r.head!==source.head||r.conclusion!=='success'||!Number.isSafeInteger(r.runId)||r.runId<1||JSON.stringify(r.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_STEADY_PREPARED_METADATA_CHANGED');
 const all=new Map([[path.join(STEADY_CORE,'owner-manifest.json'),payload.coreBytes],[path.join(STEADY_PROOF,'verified-owner-producer.mjs'),source.files.get('prepare-business-sale-owner-bundle.mjs')],[path.join(STEADY_PROOF,'reviewed-installer-source.ps1'),source.files.get('install-business-5244-readpair.ps1')]]);for(const [n,b]of payload.coreFiles)all.set(path.join(STEADY_CORE,n),b);for(const [n,b]of before.inputs)all.set(path.join(STEADY_CORE,n),b);for(const [p,b]of all)if(!read(p).equals(b))fail('B6_STEADY_PREPARED_SOURCE_CHANGED');return {...expected,currentRepoHead:source.repoHead};
}

function webOnlyPair(){
 const b=pinned(path.join(WEBONLY_PRIVATE,'writer-webonly-package-pair.json'),WEBONLY_PAIR_HASH),pair=json(b),exact=(v,keys)=>v&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
 if(!exact(pair,['schema','scope','purpose','current','candidate'])||pair.schema!=='melisa-b6-writer-webonly-pair.v1'||pair.scope!==WRITER_SCOPE||pair.purpose!==WEBONLY_PURPOSE)fail('B6_WEBONLY_PAIR_REJECTED');
 const backend='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';
 for(const mode of ['current','candidate']){
  const v=pair[mode],web=mode==='current'?'ERP-BUSINESS-WEB-5244-B6-WRITER-20261029':'ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029';
  if(!exact(v,['api','web'])||!exact(v.api,['root','packageId','manifestSha256','sourceCommit','configPath'])||!exact(v.web,['root','packageId','manifestSha256','frontendSourceCommit','backendPackageId','backendManifestSha256'])||v.api.root!==path.join(RELEASES,backend)||v.api.packageId!==backend||v.api.manifestSha256!==WEBONLY_BACKEND_HASH||v.api.sourceCommit!=='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'||v.api.configPath!==String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`||v.web.root!==path.join(RELEASES,web)||v.web.packageId!==web||v.web.manifestSha256!==(mode==='current'?WEBONLY_CURRENT_HASH:WEBONLY_CANDIDATE_HASH)||v.web.frontendSourceCommit!==(mode==='current'?WRITER_APP_SOURCE:WEBONLY_APP_SOURCE)||v.web.backendPackageId!==backend||v.web.backendManifestSha256!==WEBONLY_BACKEND_HASH)fail('B6_WEBONLY_PAIR_REJECTED');
  const a=json(pinned(path.join(v.api.root,'release-manifest.json'),v.api.manifestSha256)),w=json(pinned(path.join(v.web.root,'release-manifest.json'),v.web.manifestSha256));
  if(a.packageId!==backend||a.sourceCommit!==v.api.sourceCommit||a.actualT1!==false||a.externalOperations!==false||a.businessSaleCandidate?.kind!=='ADMITTED_B6_WRITER'||a.businessSaleCandidate.recordingEnabled!==true||w.packageId!==web||w.sourceCommit!==v.web.frontendSourceCommit||w.backendPackageId!==backend||w.backendManifestSha256!==WEBONLY_BACKEND_HASH||w.actualT1!==false||w.externalOperations!==false)fail('B6_WEBONLY_MANIFEST_REJECTED');
 }
 if(JSON.stringify(pair.current.api)!==JSON.stringify(pair.candidate.api))fail('B6_WEBONLY_BACKEND_DELTA_REJECTED');
 return {bytes:b,pair};
}
function webOnlyPredecessor(){
 const inputs=new Map(Object.entries(WEBONLY_INPUTS).map(([name,h])=>[name,pinned(path.join(WEBONLY_CAPTURE,name),h)])),capture=json(inputs.get('current-read2b-owner-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json')),task=json(inputs.get('current-task-capture.json'));
 const coreRoot=WRITER_RECOVERY_BASE_CORE,routerRoot=WRITER_RECOVERY_BASE_ROUTER,coreHash=WRITER_RECOVERY_BASE_CORE_HASH,routerHash=WRITER_RECOVERY_BASE_ROUTER_HASH,entryHash='2b0c4e83bb8c7f9a3c5f00d1ef90aa66a34a7e2a4eaf207832e9705913c03ecb';
 const expectedArgv='"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.join(routerRoot,'start-business-5244-readpair-router.ps1')+' -ManifestSha256 '+routerHash.toUpperCase()+' -ScopeName '+WRITER_SCOPE+' ';
 if(capture.schema!=='melisa-b6-writer-current-owner-capture.v1'||capture.predecessorEntryKind!=='ReadPairRouter'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.recordPath!==String.raw`C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json`||capture.recordBeforeFile!=='current-erp-processes.before.json'||capture.recordBeforeSha256!==WEBONLY_INPUTS['current-erp-processes.before.json']||capture.owner?.pid!==45612||capture.owner.birth!=='134377648982508423'||capture.owner.exe!==String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`||capture.owner.argv!==expectedArgv||capture.child?.pid!==52420||capture.child.birth!=='134377689444377841'||capture.child.parent!==45612||capture.child.exe!==String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0||capture.installedApiManifest!==WEBONLY_BACKEND_HASH||capture.installedWebManifest!==WEBONLY_CURRENT_HASH)fail('B6_WEBONLY_PREDECESSOR_REJECTED');
 if(capture.core?.root!==coreRoot||capture.core.manifestSha256!==coreHash||capture.router?.root!==routerRoot||capture.router.manifestSha256!==routerHash||capture.router.coreRoot!==coreRoot||capture.router.coreManifestSha256!==coreHash||capture.router.entrySha256!==entryHash||capture.entry?.root!==routerRoot||capture.entry.leaf!=='start-business-5244-readpair-router.ps1'||capture.entry.sha256!==entryHash||capture.entry.manifestSha256!==routerHash||capture.entry.runtimeEntryBytesVerified!==false||capture.entry.postExitExclusiveBytesRequired!==true||Object.keys(capture.entry).length!==6)fail('B6_WEBONLY_PREDECESSOR_SOURCE_REJECTED');
 const native=capture.nativeStatus;
 if(native?.reply!=='Status'||native.nativePeerVerified!==true||native.stopAuthorized!==false||native.childObservationOnly!==true||native.state?.phase!=='Running'||native.state.ownerPid!==capture.owner.pid||String(native.state.ownerBirth)!==capture.owner.birth||native.state.childPid!==capture.child.pid||String(native.state.childBirth)!==capture.child.birth)fail('B6_WEBONLY_NATIVE_OBSERVATION_REJECTED');
 const core=json(pinned(path.join(coreRoot,'owner-manifest.json'),coreHash)),router=json(pinned(path.join(routerRoot,'owner-manifest.json'),routerHash)),names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||core.finiteScope!==WRITER_SCOPE||core.sourceCommit!=='d0b457f2ee9911dc2bf0b453723a91264ff551b6'||capture.core.sourceCommit!==core.sourceCommit||core.maintenancePurpose!==WRITER_PURPOSE||core.rehearsalOnly!==false||core.actualT1!==false||core.externalOperations!==false||core.recordingEnabled!==false||!Array.isArray(core.files)||core.files.map(v=>v.path).sort().join('|')!==names.join('|')||router.kind!=='BUSINESS5244_READ_PAIR_ROUTER'||router.finiteScope!==WRITER_SCOPE||router.entrySourceCommit!==core.sourceCommit||router.coreRoot!==coreRoot||router.coreManifestSha256!==coreHash||router.entrySha256!==entryHash||router.rehearsalOnly!==false||router.maintenancePurpose!==WRITER_PURPOSE||router.actualT1!==false||router.externalOperations!==false)fail('B6_WEBONLY_BASE_SOURCE_REJECTED');
 for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.path!=='run-current-owner.ps1'&&pinned(path.join(coreRoot,f.path),f.sha256).length!==f.bytes)fail('B6_WEBONLY_BASE_SOURCE_REJECTED');}
 if(JSON.stringify(capture.core.files)!==JSON.stringify(core.files)||!hex(router.routerLibrarySha256))fail('B6_WEBONLY_BASE_SOURCE_REJECTED');
 pinned(path.join(routerRoot,'readpair-router-library.ps1'),router.routerLibrarySha256);
 const rows=json(inputs.get('current-erp-processes.before.json')),web=Array.isArray(rows)?rows.filter(r=>r.port===5244):[];
 if(web.length!==1||web[0].pid!==52420||web[0].root!==path.join(RELEASES,'ERP-BUSINESS-WEB-5244-B6-WRITER-20261029')||web[0].sourceCommit!==WRITER_APP_SOURCE||Object.entries(capture.webRecord??{}).some(([k,v])=>web[0][k]!==v))fail('B6_WEBONLY_RECORD_REJECTED');
 if(task.schema!=='melisa-b6-task-capture.v1'||task.readOnly!==true||task.taskPath!=='\\Melisa-ERP-TEST-Canonical'||task.instanceCount!==1||task.enginePid!==13532||task.instanceGuid!=='{2C892DEB-0A10-48D5-9931-A415B5154CAB}'||task.xmlSha256!==WEBONLY_INPUTS['current-task.before.xml']||task.sddlSha256!==WEBONLY_INPUTS['current-task.before.sddl']||task.writes!==0)fail('B6_WEBONLY_TASK_CAPTURE_REJECTED');
 const prior=json(pinned(path.join(WRITER_PRIVATE,'current-entry-hold-capture.json'),WRITER_INPUTS['current-entry-hold-capture.json'])),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sameEntry=(v,p,h)=>v&&Object.keys(v).sort().join('|')==='path|sha256'&&v.path===p&&v.sha256===h;
 const fields=['schema','observedAt','readOnly','executionAuthority','ownerCaptureSha256','gate','entries','directEntries','entryWrites','serviceCalls','sqlCalls','postExitExclusiveEntryCount','runtimeValidationComplete'];
 if(Object.keys(entries).sort().join('|')!==fields.sort().join('|')||entries.schema!=='melisa-b6-writer-current-entry-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==WEBONLY_INPUTS['current-read2b-owner-capture.json']||entries.postExitExclusiveEntryCount!==26||entries.runtimeValidationComplete!==false||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0||entries.entries?.length!==6||entries.directEntries?.length!==20||!same(entries.entries,prior.entries)||!same(entries.directEntries.slice(0,18),prior.directEntries)||!same(entries.gate,prior.gate)||!sameEntry(entries.directEntries[18],path.join(coreRoot,'run-current-owner.ps1'),core.files.find(v=>v.path==='run-current-owner.ps1').sha256)||!sameEntry(entries.directEntries[19],path.join(routerRoot,'start-business-5244-readpair-router.ps1'),entryHash))fail('B6_WEBONLY_ENTRY_CAPTURE_REJECTED');
 const boundaryBytes=pinned(path.join(WEBONLY_PRIVATE,'webonly-api-before.json'),WEBONLY_BOUNDARY_HASH),boundary=json(boundaryBytes),h=boundary.health;
 const protectedPaths=[String.raw`C:\Sirket\ERP\runtime\canonical-test\startup-config.json`,String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`,String.raw`C:\Sirket\ERP\config\TEST-20260929-01\runtime-private.json`,String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\api-b6-0824647186794a8d9d6e873ce127802b\native-b6-journal.jsonl`];
 if(boundary.schema!=='melisa-b6-webonly-api-before.v1'||boundary.readOnly!==true||boundary.executionAuthority!==false||boundary.apiPid!==41436||boundary.apiBirth!=='134377688108359820'||boundary.apiParent!==13532||boundary.apiManifestSha256!==WEBONLY_BACKEND_HASH||boundary.taskCaptureSha256!==WEBONLY_INPUTS['current-task-capture.json']||boundary.taskWrites!==0||boundary.apiRestarts!==0||boundary.sqlWrites!==0||!h||h.ok!==true||h.environment!=='CANONICAL_TEST'||h.mode!=='erp'||h.port!==4144||h.actualT1!==false||h.sysadmin!==0||h.databaseControl!==0||h.liveDatabaseAccess!==0||h.externalOperations!==false||h.automaticJobs!==false||h.packageId!=='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'||h.normalSessionUserId!==17||h.persistentNormalSession!==true||!Array.isArray(boundary.files)||boundary.files.length!==4||boundary.files.some((f,n)=>f.path!==protectedPaths[n]||!hex(f.sha256)||Object.keys(f).sort().join('|')!=='path|sha256'))fail('B6_WEBONLY_API_BOUNDARY_REJECTED');
 return {inputs,capture,boundaryBytes};
}
function webOnlyCoreVerification(){
 const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();
 return `$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json\nif($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne${ps(WRITER_SCOPE)}-or$m.maintenancePurpose-cne${ps(WEBONLY_PURPOSE)}-or$m.sourceCommit-cne$sourceCommit-or$m.rehearsalOnly-isnot[bool]-or$m.rehearsalOnly-or$m.recordingEnabled-isnot[bool]-or$m.recordingEnabled-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.apiTransitionEnabled-ne$false-or$m.postExitExclusiveEntryCount-ne26-or$m.runtimeValidationComplete-ne$false-or$m.postExitExclusiveBytesRequired-ne$true){throw 'B6_WEBONLY_OWNER_IDENTITY_CHANGED'}\n$names=@(${names.map(ps).join(',')})\nif(@($m.files).Count-ne13-or(@($m.files.path|Sort-Object)-join'|')-cne($names-join'|')){throw 'B6_WEBONLY_OWNER_CLOSURE_CHANGED'}\nforeach($file in $m.files){if($file.path-match'[\\\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_WEBONLY_OWNER_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}\nif($m.packagePair.path-cne'writer-webonly-package-pair.json'-or$m.packagePair.sha256-cne${ps(WEBONLY_PAIR_HASH)}-or$m.apiBoundary.path-cne'webonly-api-before.json'-or$m.apiBoundary.sha256-cne${ps(WEBONLY_BOUNDARY_HASH)}){throw 'B6_WEBONLY_PAIR_BOUNDARY_CHANGED'}\nHold-B6 (Join-Path $core 'writer-webonly-package-pair.json') ${ps(WEBONLY_PAIR_HASH)}\nHold-B6 (Join-Path $core 'webonly-api-before.json') ${ps(WEBONLY_BOUNDARY_HASH)}\n${Object.entries(WEBONLY_INPUTS).map(([n,h])=>'Hold-B6 (Join-Path $core '+ps(n)+') '+ps(h)).join('\n')}\n`;
}
function renderWebOnlyRouter(head,coreHash,libraryHash){
 if(!commit(head)||!hex(coreHash)||!hex(libraryHash))fail('B6_OWNER_RENDER_PIN_REJECTED');
 return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,[ValidateSet(${ps(WRITER_SCOPE)})][string]$ScopeName=${ps(WRITER_SCOPE)})\nSet-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$core=${ps(WEBONLY_CORE)};$root=${ps(WEBONLY_ROUTER)};$sourceCommit=${ps(head)}\nif($PSScriptRoot-cne$root-or$ScopeName-cne${ps(WRITER_SCOPE)}){throw 'B6_WEBONLY_ROUTER_ROOT_CHANGED'}\n${holdHelpers()}try{\nHold-B6 (Join-Path $root 'owner-manifest.json') $ManifestSha256\n$r=Get-Content -LiteralPath (Join-Path $root 'owner-manifest.json') -Raw|ConvertFrom-Json\nif($r.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$r.finiteScope-cne${ps(WRITER_SCOPE)}-or$r.entrySourceCommit-cne$sourceCommit-or$r.coreRoot-cne$core-or$r.coreManifestSha256-cne${ps(coreHash)}-or$r.routerLibrarySha256-cne${ps(libraryHash)}-or$r.maintenancePurpose-cne${ps(WEBONLY_PURPOSE)}-or$r.apiTransitionEnabled-ne$false-or$r.readPairMaintenanceEnabled-ne$false-or$r.actualT1-ne$false-or$r.externalOperations-ne$false){throw 'B6_WEBONLY_ROUTER_IDENTITY_CHANGED'}\nHold-B6 (Join-Path $root 'start-business-5244-readpair-router.ps1') $r.entrySha256\nHold-B6 (Join-Path $root 'readpair-router-library.ps1') ${ps(libraryHash)}\nHold-B6 (Join-Path $core 'owner-manifest.json') ${ps(coreHash)}\n${webOnlyCoreVerification()}. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName ${ps(WRITER_SCOPE)}\nStart-Business5244OwnedSupervisor -InitialSlot Current -ScopeName ${ps(WRITER_SCOPE)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}\n}${initializationFailureTail(true)}`);
}
function webOnlyPayload(source,ci,before){
 const pair=webOnlyPair(),coreFiles=new Map([...BUSINESS_SALE_OWNER_SOURCE_FILES.map(n=>[n,source.files.get(n)]),['run-current-owner.ps1',renderCurrent(source.head,'WebOnly')]]);
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:WRITER_SCOPE,sourceCommit:source.head,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',rehearsalOnly:false,maintenancePurpose:WEBONLY_PURPOSE,apiTransitionEnabled:false,runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:26,apiPackageId:pair.pair.current.api.packageId,appPackageId:pair.pair.current.web.packageId,apiPort:4144,nativePort:4146,webPort:5244,actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,predecessor:{...writerPredecessorIdentity(before.capture),captureSha256:WEBONLY_INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:WEBONLY_INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'ReadPairRouter'},packagePair:{path:'writer-webonly-package-pair.json',sha256:WEBONLY_PAIR_HASH,bytes:pair.bytes.length},apiBoundary:{path:'webonly-api-before.json',sha256:WEBONLY_BOUNDARY_HASH,bytes:before.boundaryBytes.length},beforeImages:Object.entries(WEBONLY_INPUTS).map(([n,h])=>({path:n,sha256:h,bytes:before.inputs.get(n).length})),hostedCi:ci,files:[...coreFiles].map(([n,b])=>({path:n,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 const coreBytes=bytes(manifest),library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,hash(coreBytes),hash(library),'WebOnly');
 const router={kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:WRITER_SCOPE,entrySourceCommit:source.head,coreRoot:WEBONLY_CORE,coreManifestSha256:hash(coreBytes),routerLibrarySha256:hash(library),readPairMaintenanceEnabled:false,apiTransitionEnabled:false,rehearsalOnly:false,recordingEnabled:false,maintenancePurpose:WEBONLY_PURPOSE,runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:26,actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:hash(entry),captureSha256:WEBONLY_INPUTS['current-read2b-owner-capture.json']};
 return {coreFiles,coreBytes,routerBytes:bytes(router),library,entry,pairBytes:pair.bytes};
}
function webOnlyVerification(source,payload){return {schema:'melisa-b6-webonly-owner-verification.v1',rehearsalOnly:false,ownerSourceCommit:source.head,maintenancePurpose:WEBONLY_PURPOSE,scope:WRITER_SCOPE,coreRoot:WEBONLY_CORE,coreManifestSha256:hash(payload.coreBytes),routerRoot:WEBONLY_ROUTER,routerManifestSha256:hash(payload.routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),coreFiles:13,beforeImages:6,packagePairSha256:WEBONLY_PAIR_HASH,apiBoundarySha256:WEBONLY_BOUNDARY_HASH,apiTransitionEnabled:false,runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:26,installed:false,recordingEnabled:false,executable:false,executionAuthority:false,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};}
export function prepareBusinessSaleWebOnlyBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,false,false,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=webOnlyPredecessor(),payload=webOnlyPayload(source,ci,before);
 for(const root of [WEBONLY_CORE,WEBONLY_ROUTER,WEBONLY_PROOF]){if(fs.existsSync(root))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [n,h]of Object.entries(WEBONLY_INPUTS))pinned(path.join(WEBONLY_CAPTURE,n),h);pinned(path.join(WEBONLY_PRIVATE,'writer-webonly-package-pair.json'),WEBONLY_PAIR_HASH);pinned(path.join(WEBONLY_PRIVATE,'webonly-api-before.json'),WEBONLY_BOUNDARY_HASH);
 for(const root of [WEBONLY_CORE,WEBONLY_ROUTER,WEBONLY_PROOF])fs.mkdirSync(root);
 for(const [n,b]of payload.coreFiles)writeLeaf(WEBONLY_CORE,n,b);for(const [n,b]of before.inputs)writeLeaf(WEBONLY_CORE,n,b);writeLeaf(WEBONLY_CORE,'owner-manifest.json',payload.coreBytes);writeLeaf(WEBONLY_CORE,'writer-webonly-package-pair.json',payload.pairBytes);writeLeaf(WEBONLY_CORE,'webonly-api-before.json',before.boundaryBytes);
 writeLeaf(WEBONLY_ROUTER,'readpair-router-library.ps1',payload.library);writeLeaf(WEBONLY_ROUTER,'start-business-5244-readpair-router.ps1',payload.entry);writeLeaf(WEBONLY_ROUTER,'owner-manifest.json',payload.routerBytes);
 const result={...webOnlyVerification(source,payload),schema:'melisa-b6-webonly-owner-preparation.v1',producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),hostedCi:ci};
 writeLeaf(WEBONLY_PROOF,'preparation-receipt.json',bytes(result));writeLeaf(WEBONLY_PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(WEBONLY_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleWebOnlyBundle(){
 const receipt=json(read(path.join(WEBONLY_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,false,false,false,false,false,false,true),ci=hostedSourceChecks(source.head),before=webOnlyPredecessor(),payload=webOnlyPayload(source,ci,before),expected=webOnlyVerification(source,payload);
 const prior={...expected,schema:'melisa-b6-webonly-owner-preparation.v1',producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),hostedCi:receipt.hostedCi};
 if(JSON.stringify(receipt)!==JSON.stringify(prior)||receipt.hostedCi?.length!==2||receipt.hostedCi.some((r,n)=>r.event!==ci[n].event||r.head!==source.head||r.conclusion!=='success'||!Number.isSafeInteger(r.runId)||r.runId<1||JSON.stringify(r.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_WEBONLY_PREPARED_METADATA_CHANGED');
 const all=new Map([[path.join(WEBONLY_CORE,'owner-manifest.json'),payload.coreBytes],[path.join(WEBONLY_ROUTER,'owner-manifest.json'),payload.routerBytes],[path.join(WEBONLY_CORE,'writer-webonly-package-pair.json'),payload.pairBytes],[path.join(WEBONLY_CORE,'webonly-api-before.json'),before.boundaryBytes],[path.join(WEBONLY_ROUTER,'readpair-router-library.ps1'),payload.library],[path.join(WEBONLY_ROUTER,'start-business-5244-readpair-router.ps1'),payload.entry],[path.join(WEBONLY_PROOF,'verified-owner-producer.mjs'),source.files.get('prepare-business-sale-owner-bundle.mjs')],[path.join(WEBONLY_PROOF,'reviewed-installer-source.ps1'),source.files.get('install-business-5244-readpair.ps1')]]);
 for(const [n,b]of payload.coreFiles)all.set(path.join(WEBONLY_CORE,n),b);for(const [n,b]of before.inputs)all.set(path.join(WEBONLY_CORE,n),b);for(const [p,b]of all)if(!read(p).equals(b))fail('B6_WEBONLY_PREPARED_SOURCE_CHANGED');
 return {...expected,currentRepoHead:source.repoHead};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const action=process.argv.slice(2).join('|'),actions={'--prepare-steady':prepareBusinessSaleSteadyBundle,'--verify-steady':verifyBusinessSaleSteadyBundle,'--prepare-webonly':prepareBusinessSaleWebOnlyBundle,'--verify-webonly':verifyBusinessSaleWebOnlyBundle,'--prepare':prepareBusinessSaleOwnerBundle,'--verify':verifyBusinessSaleOwnerBundle,'--prepare-current-supersession':prepareBusinessSaleCurrentSupersessionBundle,'--verify-current-supersession':verifyBusinessSaleCurrentSupersessionBundle,'--prepare-initializer-clean-recovery':prepareBusinessSaleInitializerCleanRecoveryBundle,'--verify-initializer-clean-recovery':verifyBusinessSaleInitializerCleanRecoveryBundle,'--prepare-rehearsal':prepareBusinessSaleRehearsalBundle,'--verify-rehearsal':verifyBusinessSaleRehearsalBundle,'--prepare-candidate':prepareBusinessSaleCandidateBundle,'--verify-candidate':verifyBusinessSaleCandidateBundle,'--prepare-writer-recovery':prepareBusinessSaleWriterRecoveryBundle,'--verify-writer-recovery':verifyBusinessSaleWriterRecoveryBundle,'--prepare-writer':prepareBusinessSaleWriterBundle,'--verify-writer':verifyBusinessSaleWriterBundle};if(!Object.hasOwn(actions,action))fail('B6_OWNER_FIXED_ACTION_REQUIRED');try{const r=actions[action]();process.stdout.write(JSON.stringify(r)+'\n');}catch(e){process.stderr.write((/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'B6_OWNER_PREPARATION_FAILED')+'\n');process.exitCode=1;}}
