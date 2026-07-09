# Melisa ERP v2 Final Testing Findings Log

Date: 2026-07-09

Purpose: record concrete findings from guided final testing and convert them into small, evidence-based fixes.

This file is not a general wishlist. Only issues observed during final testing or confirmed by smoke/build checks should be listed here.

## Current Finding Status

No human final-testing findings have been recorded yet.

The next step is to run the guided final-testing flow in `docs/erp-v2/final-testing-runbook.md` and add findings here before starting a fix pass.

## Finding Priority Rules

Use these priority levels:

- P0: blocks final testing or can corrupt stock, cari, finance, auth, permissions, import, terminal sync, or settings.
- P1: should be fixed before final acceptance because it confuses operators or weakens a core ERP flow.
- P2: can wait until after final acceptance if the workaround is clear.
- P3: future improvement, redesign, automation, CRM, AI, Mission Control, or non-core enhancement.

## Required Finding Format

Every finding must include:

- ID: `FT-YYYYMMDD-###`
- Priority: P0, P1, P2, or P3
- Module:
- Screen/API:
- Tester:
- Evidence:
- Steps to reproduce:
- Expected result:
- Actual result:
- Business impact:
- Suggested fix:
- Requires DB write or migration: Yes/No
- Requires external message/deploy/backup/reset approval: Yes/No
- Status: Open, In Progress, Fixed, Deferred, Accepted Risk
- Fix commit:
- Retest result:

## Open Findings

No open findings recorded.

## Fixed Findings

No fixed findings recorded.

## Deferred Or Accepted Findings

No deferred or accepted findings recorded.

## Fix Pass Rules

- Fix P0 before P1.
- Do not mix unrelated modules in one fix commit unless the same root cause affects them.
- Do not turn P2/P3 items into redesign work during ERP Core final testing.
- Do not execute DB writes, migrations, backup/restore/reset, WhatsApp sending, production deploys, or destructive scripts without explicit approval.
- Every fix must include a retest note or a smoke/build check.
- Update `docs/erp-v2/final-testing-runbook.md` if the operator flow changes.

## Sprint Conversion

When findings exist:

1. Group by priority and business impact.
2. Create one small sprint for related P0/P1 findings.
3. Define scope and out of scope before coding.
4. Run focused smoke/build checks.
5. Record fix commit and retest result in this file.
