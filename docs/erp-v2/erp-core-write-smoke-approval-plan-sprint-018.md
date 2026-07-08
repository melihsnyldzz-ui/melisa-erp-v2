# ERP Core Write Smoke Approval Plan - Sprint 018

Date: 2026-07-08
Status: Completed
Owner: Codex
Approver: Melih

## Purpose

Sprint 018 prepares the approval plan for controlled ERP Core write smokes:

```text
purchase -> sales -> finance
```

This sprint does not execute the write smokes. It defines the exact approval
gate, target-environment requirements, QA record strategy, before/after evidence
requirements, and rollback or reversal expectations that must be accepted before
any commercial write is run.

## Safety Boundary

This sprint is planning-only and static.

Allowed:

- Read documentation and source files.
- Define the controlled write-smoke checklist.
- Define approval language and evidence requirements.
- Run static smoke checks that only read source and documentation.

Not allowed without separate explicit Melih approval:

- Create, update, finalize, cancel, collect, pay, import, cleanup, reset,
  restore, migrate, deploy, publish, or send external messages.
- Run purchase, sales, finance, import, terminal, backup, restore, reset, or
  migration write checks.
- Read or print `.env.local`, credentials, tokens, SQL passwords, private
  customer records, or private business data.

## Required Approval Before Execution

Controlled write smoke execution can start only after Melih explicitly approves
all of the following in one run-specific approval:

| Approval item | Required detail |
|---|---|
| Target environment | Exact database/environment name and whether it is local, lab, staging, or production |
| Run window | Date/time window and who is watching the run |
| QA records | Approved product, customer, supplier, finance account, and document prefixes |
| Allowed actions | Which purchase, sales, and finance write actions may run |
| Evidence scope | Which before/after screenshots, IDs, counts, and summaries may be recorded |
| Reversal strategy | Whether each test record is cancelled, reversed, left as QA evidence, or cleaned by an approved operator |
| Stop conditions | Any mismatch, unexpected private data exposure, permission issue, or non-QA record touch stops the run |

Approval must name the environment and allowed write actions. A generic
"continue" or "test it" is not enough for DB write execution.

## Target Environment Strategy

Preferred order:

1. Lab/test SQL database with representative QA records.
2. Local development database with explicitly approved QA records.
3. Production database only if Melih explicitly names production and approves
   the exact run window and records.

Before execution, the operator must confirm:

- The target database is not ambiguous.
- The app is connected to the approved target.
- The QA product, customer, supplier, and finance account are identifiable
  without exposing private data.
- No migration, reset, restore, cleanup, import apply, or external message send
  is bundled into the smoke.

## QA Record Strategy

All controlled write-smoke records should be visibly marked with a QA prefix,
for example:

```text
QA-S018-
```

Required QA record types:

| Record type | Requirement |
|---|---|
| Product | Existing or newly approved QA product with known stock and movement expectations |
| Supplier | Existing or newly approved QA supplier used only for the purchase smoke |
| Customer | Existing or newly approved QA customer used only for the sales smoke |
| Finance account | Existing or newly approved QA-safe cash/bank account for collection/payment checks |
| Document notes | Include the Sprint 018 QA prefix when the UI/API supports notes or descriptions |

If a QA record cannot be safely identified, execution must stop before any
write action.

## Controlled Write-Smoke Checklist

### 1. Purchase Smoke

Goal: verify finalized purchase commercial impact and cancellation reversal.

Planned steps:

1. Record before evidence for QA product stock, supplier balance/movements, and
   recent audit entries.
2. Create a purchase draft using only QA product and QA supplier.
3. Verify the draft has no stock or supplier ledger impact.
4. Finalize the purchase.
5. Verify stock increased, supplier movement exists, cost/average-cost behavior
   is visible where applicable, and audit trace exists.
6. Cancel the purchase if cancellation is the approved reversal method.
7. Verify stock and supplier ledger reversal behavior.

Stop conditions:

- Draft creates commercial impact.
- Finalize touches a non-QA record.
- Duplicate finalize/cancel is accepted unexpectedly.
- Expected audit trace is missing.

### 2. Sales Smoke

Goal: verify finalized sales commercial impact and cancellation reversal.

Planned steps:

1. Record before evidence for QA product stock, customer balance/movements, and
   recent audit entries.
2. Create a sales draft using only QA product and QA customer.
3. Verify the draft has no stock, customer ledger, profit, or cost impact.
4. Finalize the sale.
5. Verify stock decreased, customer movement exists, cost/profit behavior is
   visible where applicable, and audit trace exists.
6. Cancel the sale if cancellation is the approved reversal method.
7. Verify stock and customer ledger reversal behavior.

Stop conditions:

- Draft creates commercial impact.
- Finalize touches a non-QA record.
- Negative stock appears unexpectedly outside the approved QA item.
- Expected audit trace is missing.

### 3. Finance Smoke

Goal: verify operational collection/payment impact and traceability.

Planned steps:

1. Record before evidence for the approved QA customer or supplier balance,
   finance account balance, finance movements, and recent audit entries.
2. Create one approved collection or payment transaction.
3. Verify cari movement impact and finance account movement impact.
4. Verify audit or finance journal trace where supported.
5. Reverse the transaction only through an approved reversal path if one exists;
   otherwise record the QA transaction as retained test evidence.

Stop conditions:

- Transaction is applied to a non-QA cari or finance account.
- Official accounting behavior is implied or generated.
- Before/after balance movement is not traceable.
- Expected audit or journal trace is missing.

## Evidence Requirements

Evidence must prove behavior without exposing private business data.

Allowed evidence:

- Endpoint names or screen names.
- QA prefixes.
- Document IDs or record IDs only when they do not expose private customer or
  supplier information.
- Before/after numeric deltas for the QA records.
- PASS/FAIL summary per smoke step.
- Redacted screenshots if needed.

Forbidden evidence:

- `.env.local` content.
- SQL credentials, tokens, passwords, API keys, WhatsApp keys, or connection
  strings.
- Private customer/supplier names, phone numbers, addresses, balances, or notes
  outside approved QA records.
- Full database rows or unrestricted exports.

## Reversal And Rollback Expectations

Preferred reversal method is normal ERP cancellation or reversing entry, not
direct SQL cleanup.

| Flow | Preferred reversal | Not allowed without separate approval |
|---|---|---|
| Purchase | Cancel finalized purchase through ERP flow | Direct SQL delete/update, reset, restore |
| Sales | Cancel finalized sale through ERP flow | Direct SQL delete/update, reset, restore |
| Finance | Approved reversal flow or retain QA transaction as test evidence | Direct SQL delete/update, cleanup script |

If reversal fails or behaves unexpectedly:

1. Stop the smoke.
2. Record only non-sensitive evidence.
3. Do not attempt direct SQL repair.
4. Ask Melih for the exact remediation approval.

## Acceptance Criteria

- [x] Controlled purchase, sales, and finance write-smoke plan exists.
- [x] Exact target environment requirements are defined.
- [x] QA record and QA prefix strategy is defined.
- [x] Before/after evidence rules avoid secrets and private business data.
- [x] Reversal expectations are documented for each controlled write check.
- [x] Stop gate before any DB write execution is explicit.
- [x] Static smoke verifies the Sprint 018 documentation and package script.

## Execution Gate

Sprint 018 is complete when this approval plan and static smoke pass.

Actual controlled write execution remains blocked until Melih gives exact
run-specific approval that names the target environment, allowed QA records,
allowed write actions, evidence scope, and reversal strategy.

