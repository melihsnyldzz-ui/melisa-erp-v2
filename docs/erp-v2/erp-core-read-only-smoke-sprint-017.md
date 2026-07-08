# ERP Core Read-Only Smoke Execution - Sprint 017

Date: 2026-07-08
Status: Completed
Owner: Codex
Approver: Melih

## Purpose

Sprint 017 executes the safe read-only validation layer for the connected ERP
Core path defined in Sprint 016:

```text
login -> stock -> purchase -> sales -> finance -> reports
```

The goal is to collect source-level and static execution evidence without
running commercial write checks, SQL migrations, cleanup, backup/restore/reset,
deployment, public publishing, or external messaging.

## Safety Boundary

This sprint is read-only and static by default.

Allowed:

- Read local source and documentation files.
- Verify route-level auth and permission guards.
- Verify read-only report assumptions and data-quality boundaries.
- Verify package script registration.
- Run syntax/static smoke checks.

Not allowed without separate explicit Melih approval:

- Create, update, finalize, cancel, import, cleanup, reset, restore, migrate, or
  deploy.
- Run controlled purchase, sales, finance, import, or terminal write smokes.
- Send WhatsApp, SMS, email, catalog messages, or any external communication.
- Read or print `.env.local` contents, secrets, tokens, SQL credentials, or
  private business data.

## Executed Read-Only Evidence

| Step | Evidence collected | Write risk |
|---|---|---|
| Login | Auth middleware rejects missing bearer tokens and `/auth/me` requires `requireAuth` | None; source/static check |
| Stock | Product list and options routes require auth plus `product.view`; product write routes require edit/passive permissions | None; source/static check |
| Purchase | Purchase list/detail routes are read-only `GET` routes behind `purchase.view`; draft/finalize/cancel routes are protected write routes | None; source/static check |
| Sales | Sales list/detail routes are read-only `GET` routes behind `sales.view`; draft/finalize/cancel routes are protected write routes | None; source/static check |
| Finance | Finance summary, accounting-control, account list, movement, and journal reads are guarded; collection/payment/account writes remain permission-gated | None; source/static check |
| Reports | Management and periodic report endpoints require auth, expose assumptions/data-quality/row-limit metadata, and remain SELECT-only | None; source/static check |

## Protected Write Gate Confirmation

The Sprint 017 smoke confirms that the following protected operations remain
outside read-only execution:

- Product create/update/passive and image/barcode writes.
- Sales and purchase draft, finalize, cancel, and draft update routes.
- Finance account writes, cleanup/apply, standardization, collections, and
  payments.
- Import apply/commit routes remain outside this sprint.
- Backup/restore/reset scripts remain outside this sprint.

## Acceptance Criteria

- [x] Read-only evidence exists for login, stock, purchase, sales, finance, and reports.
- [x] Protected write endpoints are confirmed as auth/permission-gated.
- [x] The smoke script does not call API write endpoints.
- [x] No SQL migrations, DB writes, cleanup, backup/restore/reset, deploys, or external messages were executed.
- [x] Documentation records the evidence and remaining approval gate.

## Remaining Gap

Sprint 017 does not prove controlled commercial write behavior on live/local SQL
data. Purchase, sales, finance, import, backup/restore/reset, migration, and
production checks still require a separate approval that names the target
environment, allowed records, rollback/reversal expectations, and evidence to
collect.
