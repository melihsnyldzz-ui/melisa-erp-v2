# Melisa ERP v2 Production Acceptance Session

Date: 2026-07-09

Purpose: record the practical go/no-go decision after ERP Core closure without starting another open-ended sprint chain.

This session does not execute production deploys, SQL writes, migrations, backup/restore, reset, cleanup, import apply, WhatsApp sending, permission changes, or secret changes.

## Session Decision

Decision: `READY_FOR_INTERNAL_USE_ONLY`

Melisa ERP v2 is ready for controlled internal/operator use and final operator walkthrough.

Melisa ERP v2 is not yet approved for full production go-live because the production acceptance gates below still need human confirmation and, for some items, exact action approval.

## What Is Accepted

| Area | Decision |
|---|---|
| ERP Core business screens | Accepted for internal use |
| Product/stock flow | Accepted for internal use |
| Customer/supplier ledger flow | Accepted for internal use |
| Sales/purchase flow | Accepted for internal use |
| Finance collection/payment flow | Accepted for internal use |
| Import preview/apply safety model | Accepted with operator caution |
| Reporting and decision support | Accepted as operational reporting, not official accounting |
| Terminal visibility and sync review | Accepted as controlled/readiness flow |
| CRM, AI, WhatsApp automation | Not part of ERP Core go-live |

## Production Go-Live Gates

These items must be confirmed before declaring `READY_FOR_PRODUCTION_USE`:

1. Production host and access method are confirmed.
2. Production environment variable names, owners and storage location are confirmed without exposing values.
3. Backup/restore verification is executed only after exact approval.
4. Migration rehearsal is completed on staging or restore-test target only.
5. SQL least privilege and certificate/trust policy are signed off.
6. Production users and permissions are signed off.
7. Final ERP smoke pack is run in the target production-like environment.
8. Human operator walkthrough is completed and recorded.

## Deferred Non-Blocking Work

These do not block internal use:

- Monitoring and log-retention refinement.
- Terminal physical-device acceptance details.
- Import operator training notes.
- Short user guide updates.
- Visual polish based on real operator findings.
- CRM implementation.
- AI automation.
- Mission Control integration.
- Media library automation.

## Exact Approval Still Required

Generic approval is not enough for:

- Production deploy.
- SQL backup, restore, reset, cleanup or migration.
- Import apply against live data.
- WhatsApp or external message sending.
- Permission changes in production.
- Secret value changes or secret rotation.
- Business rule changes.
- Destructive scripts.

## Evidence

- Final closure decision: `docs/erp-v2/final-closure-decision.md`
- Final testing runbook: `docs/erp-v2/final-testing-runbook.md`
- Production deployment runbook: `docs/erp-v2/production-deployment-runbook.md`
- Final ERP smoke command: `npm.cmd --prefix apps\web-admin run smoke:final-erp`

## Verification Result

Executed on 2026-07-09:

- `npm.cmd --prefix apps\web-admin run smoke:final-closure`: passed, 8/8 checks.
- `npm.cmd --prefix apps\web-admin run build`: passed with existing Vite/lucide/chunk-size warnings.
- `npm.cmd --prefix apps\web-admin run smoke:final-erp`: passed with 30 passed, 0 failed, 1 warning and 1 skipped check.

The warning is the existing local live API read-only smoke warning for `http://127.0.0.1:4100` when the expected local API route is not available. The skipped check is the controlled write smoke because `FINAL_ERP_WRITE_SMOKE_APPROVED` is not true.

## Current Next Step

Use the ERP internally with controlled operators, and record real findings only when they appear.

If Melih wants full production go-live, the next action is not a new development sprint. It is:

```text
Approve exact production go-live gate action.
```

The exact action must name the target and allowed operation.
