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
