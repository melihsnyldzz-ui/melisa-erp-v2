# ERP2254 — normal metadata route and parallel ERP fixes

Task: `ERP-C06-METADATA-ROUTE-RUNTIME-20261102-2254`. Existing ERP49 scope and PR54; no new project, goal or acceptance counter. The user prioritised finishing ERP before terminal/CRM and requested parallel independent work.

## C06: concrete source integration

The canonical entry now retains the existing `configureCanonicalTest(...)` result. After the existing catalog/current-finance setup, ERP mode with its existing protected business session prepares `prepareCanonicalCustomerMasterMetadata(...)` using **that exact connected pool**. The wrapper supplies it to the existing prepared binding without invoking the database's pool acquisition function. Only `binding.metadata` is returned; service/store/cards are not registered and the default real master writer remains unavailable (503).

The fixed `GET /api/customers/master-metadata` route is mounted before the generic customer-ID routes. It uses the normal authentication middleware plus existing `customer.view` and `customer.edit` checks. Query/body parameters are rejected; other methods including HEAD return 405. Cache storage is disabled and a second concurrent observation is rejected. The existing fixed bounded SELECT reader returns OBSERVED/UNAVAILABLE/REJECTED/FAILED explicitly; a failed observation is HTTP503, never a successful metadata result. There is no generic SQL, database, object, credential or connection parameter and no new login/role/permission.

The unchanged canonical startup also performs its existing catalog classification/warmup work. That reader uses existing stored-procedure execution and SERIALIZABLE read transactions. These startup operations are **not** the new three-request SELECT metadata observation. No real startup, warmup or metadata query was executed in this task.

Seven new route/bootstrap tests cover 401/403 before query, both existing permissions, fixed route isolation, no-store, query and GET-body rejection, method rejection, wrong actual target, denied metadata, missing reader, single in-flight observation, exact pool reuse, wrong startup identity/transport/copy and unchanged global 503. The first bootstrap test attempt failed because its synthetic fixture did not pass the already-existing current-finance proof provider; the test setup was corrected without weakening the runtime admission.

## Actual runtime: not installed, exact blocker

The supported readonly runtime observation on 2 November at 22:57:21 UTC verified normal API4144/PID31124, native4146/PID2288, WEB5244/PID10104 and `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Installed API source is `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`; it does not contain the new route. This is a dated observation, not proof that this source is installed.

The deployment connector reports its legacy DB02 mapping as externally supervised/observe-only, host deployment disabled; its separate current-business observation is readonly. Its legacy deployment operation is not a normal-5244 installer. No deploy attempt was made against that wrong mapping.

Independent source inspection found the concrete application-transition boundary:

- `Get-ErpApiComponentConfig` requires the component source commit to match the base startup source. The manifest and every payload hash, plus runtime health source/package, are checked.
- `New-ErpReadPairPreparedReleaseProof` accepts only its existing finite scopes/current-package proof. A new C06 package is not automatically admitted.
- `New-Test125ReadPairTransition` requires the genuine admission and exact config/launcher/release chain. The supervisor holds its startup configuration in memory; changing a pointer would not update it safely.
- The existing native API stop uses `TerminateProcess`, not graceful shutdown. Stopping a shared task instance has not been proved to affect only the API.

Therefore **Stop/Config/Start and installation remain NO-GO**. The missing component is a supported finite transition binding the new immutable C06 API overlay to the actual normal application launcher while excluding competing owners and preserving companions. An overlay may truthfully retain its base identity with separately verified overlay source/file hashes, but that does not create admission. No old consumed installer/recovery proof, source-pin relaxation, in-place package change, second API/port, alternate credential/CLI, task/security change or Windows reboot was used.

**Actual new metadata queries: 0.** Object existence/compatibility/effective permissions remain UNKNOWN until that route is actually installed and called through the existing authorised session. This is an application-transition blocker, not a demonstrated SQL permission denial. Customer INSERT/UPDATE, DDL, global writer activation and human acceptance remain outside this delivery.

## Parallel work and real changes

All writers had isolated worktrees and explicit file ownership. The main agent alone owns C06/API/bootstrap and shared delivery. The existing readonly reviewer remained readonly; the tools did not expose separate agent thread/turn IDs, so none are invented here.

| Original finish item | Agent / isolated source | Result |
|---|---|---|
| C07 history | `b264_old_cut_adapter`, `erp-c07-read-20261102-2254` | Existing supplier history adapter already bound; 6 offline QA checks. No redundant production change. This does not close normal GUI/native/personnel acceptance. |
| C05 terms | `b264_recovery_adapter`, `erp-c05-read-20261102-2254` | 9 existing checks; unknown terms are not invented. General limit/risk DTO/display remains incomplete. |
| C08 cash recovery | Same first isolated writer after C07 completed | Pending cash command was automatically POSTed on reopening/refresh. It now preserves UUID/body/journal, reads overview with GET only, shows a visible alert and disables new cash commands. No status endpoint is invented; unresolved outcomes remain blocked. Fixed B4 date, six accounts, currencies, roles and target guards are unchanged. 8 targeted checks. |
| C03 purchase recovery | Same second isolated writer after C05 completed | A rejected explicit retry after lost ACK incorrectly closed the old pending request as rejected. Only a definite rejection of the first send can now do that. Restored/unknown requests retain their exact identity/body/history; confirmed explicit replay still closes correctly. 19 recovery plus 9 existing presentation checks. |
| C01 receiving recovery | First local writer, new `erp-c01-recovery-20261102-2254` | The same unknown-outcome rejection defect was reproduced with 10 failing tests. The narrow fresh-send distinction preserves original UUID/body and leaves existing readonly approval GET recovery and personnel handoff unchanged. 98 targeted/regression checks. |
| C03 FX receiving/purchase recovery | Second local writer, new `erp-c03-fx-recovery-20261102-2254` | 15 old-source failures demonstrated false closure of an unknown FX request. The fix preserves original command/recorded rate, currency, quantity and receipt; 29 checks. |
| B06 / C08 / C07 supplier payment | Visible native child `01a19e91-d8e7-72c1-bed9-a1d2857d426a`, first turn `01a19e91-dc2f-7c60-8cbe-7859baa0d3aa`, `erp-c09-payment-20261102-2254` | 22 old-source failures demonstrated unknown payment/cancellation closure and confirmed-refresh mistakes; child fix passed 61 checks. Main independent review found one additional P2 in restored GET confirmation followed by a failed context refresh. Four new regressions failed on the child source; the integrated fix preserves the confirmed receipt, clears stale context and retains a separate read-error message. Final payment suite: 65 checks. |
| C05 / B06 / C08 collection | Visible native child `01a19e91-de46-7ff1-8d38-e0d98f1e481d`, first turn `01a19e91-e183-7311-8be9-85e5d39b2283`, `erp-c09-collection-20261102-2254` | False closure after an unknown generic collection/cancellation retry was reproduced with 27 failing tests. Only fresh definitive rejections now close the request. Selected-source behavior remains unchanged; 96 checks. |
| C10 return amount | Same visible payment child, new turn `01a19ea1-708d-7340-94f8-937f147b6f49`, `erp-c10-return-amount-20261102-2254` | Null/empty values were rendered as a real zero. The display-only type/presence check now shows unknown separately from genuine zero; 36 old-source failures, 78 checks after the fix. No return calculation/journal/permission change. |
| C10 count close | Same visible collection child, new turn `01a19ea1-7240-7902-b5f1-570697121833`, `erp-c10-count-close-20261102-2254` | An arbitrary result object incorrectly released the close barrier. The existing journal/daily API fields now verify structural response identity without changing storage. Child baseline had 34 failures and 87 checks after its fix. Main review found explicit error/contradictory-state receipts with a valid ID still passed; 22 new failing regressions now pass, with 109 count regressions. Valid minimal legacy responses and genuine personnel nested `{}` are preserved. This is structural safety, not proof against forged browser storage or native write admission. |

C03 tests showed 7 pass/10 fail on the old source before the final expanded suite. These tests describe local source behavior, not an actual financial event. C08's independent worker commit was integrated without committing unrelated dirty files; the final PR source is recorded separately.

`technicalTaskId` values `ERP-C09-PAYMENT-RECOVERY-...` and `ERP-C09-COLLECTION-RECOVERY-...` are historical task labels, **not** the original C09 price-editing item. Payment's `originalFinishIds` are B06/C08/C07 (ERP-UA14); collection's are C05/B06/C08 (ERP-UA08/ERP-UA14). Those fixed 1–74 numeric IDs are not inferred. Receiving is original C01 (coordinator-confirmed fixed13), FX is original C03 (coordinator-confirmed fixed49). The original C09 price item is unchanged.

The user's later explicit permission for additional development chats was used after reusing the two idle existing agents. Two separate user-visible ERP child chats were then opened for distinct payment/collection files; these are distinct from the local `/root/b264_*` collaboration agents. The same main owner retains all integration and shared runtime control. No extra audit-only work was counted as a delivered feature.

The C08 GUI attempt used the required computer-use skill and stopped at the supported first entry: `Browser is not available: iab`. No other browser/OS method, server or tab was used to bypass that refusal. No screenshot, installed-screen or human PASS is claimed.

## Verification and remaining decisions

- Final main integrated offline suite: **716 passed, 0 skipped**, 2826 ms. It includes the changed C06/receiving/purchase/FX/cash/payment/collection/return/count tests and relevant existing regressions; worker totals are not added again.
- API/CI syntax quality passed in 59293 ms. Final guarded Sites build passed in 9.16 s (10409 ms wrapper); output is a private build artifact, not an installed TEST package.
- Independent source review: all nine source slices GO, including the closed payment restored-GET and count error-receipt P2 findings; actual runtime installation not GO. Exact final-source GitHub CI is recorded in STATUS and the shared PR54 report separately.
- Previous 2148 push41535841107 / PR41535851339 were independently read back as six successful jobs, attempt1. They do not substitute for this changed source's CI.
- The previous dirty STATUS tail and two unrelated PowerShell WIP files, original journals, packages, roles, balances and installed ERP/CRM are preserved. No new commercial/native transaction, migration, CRM/terminal change or human acceptance occurred.

One C05 business question remains: **for which customer/currency-account scope is the limit defined, and should exceeding it block a sale or only warn?** Raw `risk_limit` does not answer that contract. No default rule was introduced. Other authorised independent ERP source work was not held waiting for this question.

C06/item16 and original C03/C05/C07/C08 human acceptance remain partial/pending; ERP49/9 complete/39 partial/1 open and CRM25 counters are unchanged.
