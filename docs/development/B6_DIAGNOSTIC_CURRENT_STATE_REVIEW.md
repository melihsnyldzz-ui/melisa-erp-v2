# B6 diagnostic — source/offline review, 30 October 2026

This continues PR54's existing B6 delivery. It is **not an installer or admission**.
Application diagnostic source remains `7c6fa85447d52c9566870495e4d8ffe197940a65`.
The new helper changes no application payload, SQL, profiles, roles or services.

`scripts/canonical/business-sale-diagnostic-review.mjs` is a pure derivation helper.
The caller must pin the original artifact, descriptor, repair packet and dated
post-install receipt bytes. Three exact module identities/options and two approved
descriptor deltas are checked. Exactly one occurrence of each old definition hash
is replaced in the existing full After CAS text. Reverse replacement recovers the
original text exactly; every other predicate remains. No SQL executes or admission
is issued. Inputs are not mutated.

The existing private evidence case contains `diagnostic-current-state-review`:
review JSON, expected CAS text and expected descriptor. These stay outside Git and
are review files, not runtime manifests. The caller verified API before manifest,
WEB backend linkage, exact committed errorHandler blob, six unchanged dependencies
and six successful application CI jobs (push41089528798 / PR41089539093). No rerun.

The dated 10:05 UTC readback proves semantic equality of other profile fields.
It does **not** prove current raw profile byte equality or current process ownership.
Outputs retain `installed:false`, `executionAuthority:false`, `installable:false`,
`admissionIssued:false`, `DATED_RECEIPTS_ONLY`.

## Remaining installation inputs

1. Fresh raw private-profile capture and byte equality across PackageRefresh.
2. Fresh exclusive owner/API/task/running-versus-future launcher capture and old
   entry locks under the supported maintenance chain.
3. Independently reviewed fixed PackageRefresh generation binding the current
   three-module After state and descriptor. Old admission still expects the old
   snapshot; it must not be bypassed, normalized or replayed.

The next runtime action, once separately admitted, would replace only API
errorHandler, refresh its manifest and unchanged WEB backend linkage, and perform
the supported owner transition. SQL/profile/roles/trade effects must stay zero.
This review does not authorize it. Failed draft UUID and recovery404 are preserved;
no POST/finalize/cancel/replay or human acceptance occurred. 744 matching table
counts and metadata are not an all-row-value comparison.

Five offline tests cover derivation, input immutability, authority separation,
wrong/reordered/missing tuples, options, failed receipts, profile claims, corrupted
CAS, duplicate/missing literals and descriptor widening: PASS, zero skips.
Independent source review: GO, no open P1/P2. Pinned private artifacts passed the
same helper. New helper CI is separate from application CI and installation.

## Diagnostic API/WEB producer — 30 October source implementation

The existing fixed producer now has `--prepare-diagnostic`: exact7c6fa854
errorHandler blob, AFDB/8530 base manifests and six fixed dependency hashes. It
uses the existing committed-source, exact application CI, frozen parser, full
payload hashing, CreateNew copying and readback mechanisms. Only one API payload
file changes; all previous provenance/profile markers and WEB payload remain.
The WEB backend manifest link follows the new API manifest. No profile is read.
The passive receipt has installed/executionAuthority/admissionIssued and
ownerGenerationPrepared=false. This is actual package-producer support, not a
runtime installer or a complete diagnostic owner generation.

**Single remaining generation blocker:** the six typed current before-images
required by `nativeContextBefore` in prepare-business-sale-owner-bundle.mjs and
`Read-ErpBusinessSalePackageRefreshTaskSource` in canonical-business-sale-maintenance.ps1
are not available for the current repaired owner/API. The current four-process
boolean observation is valid passive metadata, but has no complete owner/native
peer/record/task/entry chain. Historical ARRAY-REPAIR before-images refer to the
previous owner/API. Replaying or reconstructing them as a current capture would
violate the fixed contract. This task forbids a fresh runtime capture. Therefore
no owner/core/router/steady manifests or executable generation are emitted;
PackageRefresh admission and old After/descriptor pins remain unchanged.

Independent review confirmed this boundary. The source tests also cover the new
exact blob, extra/missing overlay, stale provenance/backend identities, dependency
drift, unsafe/duplicate paths and repeated derivative rejection.

## Approved scanner exception

The user approved exactly rule+path+manifest-value conjunction in .gitleaks.toml.
Default rules are extended, not replaced; .gitleaksignore and workflow are unchanged.
Eight real Gitleaks8.30.1 disposable Git fixtures passed, including other values,
other paths, path prefix/suffix, longer value, a second secret on the same line
and an unrelated default provider rule. These offline canaries are unusable and
contact no provider. An initial directory-mode fixture returned absolute paths
and therefore correctly did not match; tests now use the actual Git scan mode.
The exception was not widened. No runtime or installation authority was added.

## Integrated Diagnostic owner generation

The current source adds a fourth closed Diagnostic case to the existing owner
producer, installer and startup libraries. Six fresh typed before-images now exist
in the approved private diagnostic-generation-20261030 case. Ordinary SID/argv
and Task XML/SDDL stay local; free-form task content was scanned before writing.
Protected profiles remain hash-only inputs, never copied into these snapshots.
The retired partial two-file capture is historical and is not replayed.

Diagnostic core/router/steady roots are fixed ERP-BUSINESS-5244-B6-DIAGNOSTIC-
OWNER/ROUTER/STEADY-OWNER-20261030 under releases. The existing passive API/WEB
pair is reused. The immutable owner data binds all six captures, current repaired
core/router/steady, actual native owner/web birth identities, separate running API
launcher and future task launcher, and all47 old-entry pins. Native/exclusive/CAS
checks remain deferred to the existing genuine runtime maintenance chain.

The profile parser checks only the small pinned descriptor/two deltas and exact
raw profile hash. The full original snapshot is preserved with exactly three
approved hash substitutions to B1C; fresh module/options and full state checks
remain at factory, paused boundary and final observation. PackageRefresh still
cannot execute native DDL or modify profile bytes/roles/trade data.

Relevant tests cover full passive construction/verification, wrong owner/native
birth, API/backend/manifest/closure drift, entry ordering, task hashes, changed
payload/history, unsuccessful CI and JSON-without-genuine-authority rejection.
The final source SHA, exact CI and actual emitted manifest hashes are recorded in
the existing PR54 report. Source support is not installation or human acceptance.

A future real TEST maintenance package must separately authorize temporary
maintenance marker/entry locks, controlled old owner/API-WEB stop/start, startup
component reference, scheduled-task future launcher and operation-record
publication. It installs only the diagnostic errorHandler derivative and manifest
links; WEB payload remains unchanged. Rollback selects the existing AFDB/8530
Current pair with byte-identical profile; uncertain results remain Unknown/no-retry.
Expected interruption is the controlled ERP API/WEB transition, not SQL/Vega/CRM.
No real maintenance or sale retry is performed by the passive generation task.
