# Melisa delivery checks — first usable scope (14 October 2026)

User authorization: “tamam bunları kuralım lütfen”, following the proposal to install
1 + 5 first: record consistency and a short changed/missing prerequisite check.
This is delivery tooling, not a new main delivery item. CRM06 → ERP09 and the
existing fixed55/common21 authority remain unchanged.

## What runs

`node scripts/delivery-checks/run.mjs --config <absolute-config-path>`

Node built-ins only; no package installation, API key, paid service, credentials,
network, browser action, service restart, Git mutation or database access. The
checker reads existing records and writes only a small deduplication cache outside
Git. It never rewrites the tracker, accepts a feature, or changes the work queue.

The coordinator runs `audit` mode against the existing two canonical JSON files.
Company owners run `projects` mode against the existing ERP STATUS.md and CRM
CRM_STATUS.md. The latter are views of the existing authority, not a second board.

- `RECORDS_CONSISTENT`: the inspected records do not contradict these checks.
  **Not application PASS, human acceptance, or LIVE readiness.** Exit 0.
- `INCONSISTENCY`: a fixed-ID/count/owner/focus/proof claim conflicts with a record.
  Correct only that claim using existing evidence. Exit 2.
- `CHECK_REQUIRED`: only the named step lacks a usable prerequisite record.
  Prepare it through the existing supported TEST path; never request a password
  or invent a new authorization. Independent authorized work remains possible.
  Exit 3.

`changed:false` suppresses repeat notification, not the finding itself. The cache
contains only a signature, fixed issue codes and timestamp. It is disposable and
does not contain delivery status, accepted proof, user data or secrets.
The cache cannot alias a configured source or config file. An existing file is
replaced only when it already has the exact cache format; unknown or damaged
files are preserved and reported through `cacheSaved:false`.

## Install without interrupting the active CRM06 step

1. ERP owner brings only `scripts/delivery-checks/` and its README from the pinned
   reviewed feature commit into the current feature branch. Do not change branch,
   pull over dirty files, change running packages, or restart anything for this.
2. Create owner-local config outside Git, using `projects.example.json`; the ERP
   and CRM configs have different cache paths. Both may use the same ERP-owned
   script location. CRM does not edit shared script/runtime files.
3. Append the following short rule to each effective root AGENTS.md, preserving
   the current working agreement and every user authorization:

   > At the next safe work boundary, new/resumed turn or compaction, read the
   > existing Sıradaki iş and run the configured Melisa record check once. Run it
   > again when that step closes or its runtime/role/surface prerequisite changes.
   > Use existing accepted evidence; no repeat acceptance, broad test or restore.
   > A consistent result is not functional completion. A missing prerequisite
   > applies only to that step. Update this same status view, save the completed
   > feature work to GitHub, and continue the next authorized step without a new
   > user/monitor message. Current CRM06 must fully close before ERP09. The checker
   > neither authorizes nor performs LIVE/main/customer-message/paid-service work.

4. In the existing Sıradaki iş section, record a small `melisa-preflight` fenced
   JSON projection of the current prerequisite evidence. This is a machine-readable
   view of existing records, not new acceptance criteria. Use real, already-known
   revision/receipt references; never fill `verified` from a source-only claim.
5. Run once. Check unchanged verified proof is REUSE; changed/missing scope is
   CHECK_REQUIRED. Retain the sanitized result and exact source SHA in STATUS.
   Commit/push on each existing feature branch; verify the remote commit.

The coordinator's existing heartbeat invokes audit mode once per audit after
reading the canonical baseline, then uses changed owner snapshots. It stays quiet
for an unchanged result and does not redistribute correct active work.

## Prerequisite projection

Put one fenced `melisa-preflight` JSON object inside the current Sıradaki iş
section. Example values below are deliberately **unknown**, not runtime evidence:

```melisa-preflight
{
  "current": {
    "environment": "test-target-revision",
    "runtime": "current-runtime-generation",
    "identityRole": "normal-role-revision",
    "surface": "normal-ui-surface-revision"
  },
  "required": [
    {"id":"runtime-health","contextKeys":["environment","runtime"]},
    {"id":"normal-role","contextKeys":["environment","runtime","identityRole"]},
    {"id":"normal-ui","contextKeys":["environment","runtime","identityRole","surface"]}
  ],
  "proofs": []
}
```

A proof is `{requirementId,status:"verified",context:{...matching relevant keys},
evidenceRef:"evidence:opaque-reference"}`. Scope fingerprints are non-secret
revision IDs, not credentials, JWTs, customer information or raw URLs with query
parameters. The normal-role proof must come from normal identity/role evidence;
health or TEST ADMIN does not substitute. Browser capability must be checked in
the actual supported browser execution surface, not inferred from a shell test.
Changed runtime, role or surface invalidates only proofs depending on that key.
Time passing alone does not invalidate an accepted proof. The owner must update
the current context when the actual environment changes; matching stale inputs
cannot independently establish live health.

## Optional lifecycle hook adapter

The ready adapter accepts Codex `SessionStart` and `Stop` JSON on stdin with
`--hook`. It ignores transcript, prompt and tool arguments. New/changed hook
definitions require Codex's normal review/trust flow. No trust store editing,
managed-policy impersonation or trust-bypass flag is authorized. Installing the
files or successfully testing stdin is **not evidence a hook is active**.

`hooks.example.json` is an optional definition, not an installed/trusted hook.
The first usable integration is the existing heartbeat plus the owners' written
work-boundary rule. It does not wait for optional hook trust to deliver value.
If trusted hooks are later activated, use one definition per scope; do not run
duplicate global/project/plugin copies. Keep `allowStopContinuation:false` for
informational operation. If deliberately enabled, only a new record contradiction
can request one continuation; `stop_hook_active`, unchanged findings, failed cache
writes and missing prerequisites never trigger another continuation.

## Validation and limits

`node --test scripts/delivery-checks/*.test.mjs`

Tests use synthetic documents and temporary cache files. They do not replay prior
business acceptance. Receipt references are checked for presence/scope, not their
truth; independent evidence reading remains the owner's/monitor's responsibility.
Existing historical checkpoints remain historical. No code/data/elapsed-time/LIVE
percentage is inferred from the fixed closure count. Hook support and trust must
be observed on the actual company host before claiming lifecycle activation.
