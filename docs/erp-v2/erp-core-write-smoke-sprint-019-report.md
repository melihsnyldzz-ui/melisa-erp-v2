# Sprint 019 Report - Controlled ERP Core Write Smoke Execution

Date: 2026-07-09
Status: Completed
Phase: ERP Core Validation
Owner: Codex
Approver: Melih
Branch: `supervisor-live-smoke-001`

## Approval Used

Melih approved Sprint 019 controlled ERP Core write smoke execution for the local ERP environment.

Approved execution boundary:

- Target: local development API connected to `MELISA_ERP_V2`.
- Scope: controlled ERP Core write smoke using only `QA-S019-*` records.
- Allowed writes: QA customer, supplier, product, finance account, purchase draft/finalize, sales draft/finalize, collection, payment.
- Evidence: QA IDs, document IDs, movement IDs and before/after numeric effects.
- Not allowed: real customer/supplier records, secrets, `.env`, SQL credentials, direct SQL repair, migration, backup/restore/reset, cleanup, production deploy, public publishing, WhatsApp or other external sending.

## Goal

Prove the connected ERP Core commercial path with controlled QA data:

```text
purchase -> sales -> finance
```

## Successful Run

Command:

```powershell
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'
node scripts/sprint-019-erp-core-write-smoke.mjs
```

Successful stamp:

```text
QA-S019-1783581628463
```

Evidence IDs:

| Entity | ID / Code |
|---|---:|
| Customer | 145 |
| Supplier | 10311 |
| Product | 19483 |
| Finance account | 6 / `QA-S019-1783581628463-KASA` |
| Sales invoice | 10006 |
| Purchase invoice | 10006 |
| Collection movement | 10012 |
| Payment movement | 10013 |

## Validated Behavior

| Check | Expected | Result |
|---|---|---|
| Product baseline | stock `0`, average cost `10` | Pass |
| Customer baseline | balance `0` | Pass |
| Supplier baseline | balance `0` | Pass |
| QA finance account baseline | balance `0` | Pass |
| Purchase draft | no stock or supplier ledger effect | Pass |
| Purchase finalize | stock `2`, supplier balance `20` | Pass |
| Purchase supplier movement | `purchase_invoice` movement exists | Pass |
| Sales draft | no stock or customer ledger effect | Pass |
| Sales finalize | stock `0`, customer balance `20` | Pass |
| Sales customer movement | `sales_invoice` movement exists | Pass |
| Collection | customer balance returns to `0`, QA account becomes `20` | Pass |
| Collection movement | `collection` customer movement exists | Pass |
| Payment | supplier balance returns to `0`, QA account returns to `0` | Pass |
| Payment movement | `payment` supplier movement exists | Pass |

Final state for the successful run:

| Area | Final value |
|---|---:|
| QA product stock | 0 |
| QA customer balance | 0 |
| QA supplier balance | 0 |
| QA finance account balance | 0 |

## Safety Notes

- Direct SQL was not used.
- SQL migration was not run.
- Backup, restore, reset and cleanup were not run.
- WhatsApp, SMS, email, catalog publish or external sending was not run.
- Production deploy was not run.
- Secrets and `.env` values were not printed.
- The successful smoke used only newly created `QA-S019-*` records.

## First Attempt Stop And Recovery

First attempted stamp:

```text
QA-S019-1783581537295
```

The first attempt stopped after collection because the script looked for the QA collection in `/api/finance/movements`. That endpoint intentionally excludes QA/test-coded records from operational finance lists. This was a validation-script filter issue, not a commercial-write failure.

Recovery action:

- Created the matching QA supplier payment through the normal `/api/finance/payments` API.
- Verified the first attempt's QA supplier balance returned to `0`.
- Verified the first attempt's QA finance account balance returned to `0`.
- No direct SQL repair was used.

The script was then adjusted to verify finance impact through QA finance account balance and collection/payment responses instead of the operational finance movement list.

## Checks Run

```powershell
node --check scripts/sprint-019-erp-core-write-smoke.mjs
$env:MELISA_API_BASE_URL='http://127.0.0.1:4100'; node scripts/sprint-019-erp-core-write-smoke.mjs
```

Additional regression checks were run after documentation updates:

```powershell
npm.cmd --prefix apps/web-admin run build
npm.cmd --prefix apps/web-admin run smoke:erp-core-write-plan
npm.cmd --prefix apps/web-admin run smoke:erp-core-read-only
npm.cmd --prefix apps/web-admin run smoke:erp-core-path
```

## Result

Sprint 019 is completed for the approved local controlled QA write-smoke scope.

The ERP Core path now has controlled write evidence for:

- purchase commercial effect,
- sales commercial effect,
- customer collection effect,
- supplier payment effect,
- stock impact,
- customer balance impact,
- supplier balance impact,
- QA finance account impact.

## Remaining Work

This sprint does not prove production readiness.

Remaining P0/P1 items:

- Audit browser and audit coverage map.
- Import reconciliation after apply.
- Demo/mock isolation review.
- Backup/restore/reset verification with explicit approval.
- Terminal failed-sync administration.
