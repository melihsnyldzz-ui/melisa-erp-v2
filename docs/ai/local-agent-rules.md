# ERP Local Agent Rules

These rules are specific to Melisa ERP v2. They extend the central Melisa OS rules.

## SQL Server

- The ERP uses SQL Server as the source of business truth.
- Never run SQL migrations, destructive SQL, backup/reset, restore, cleanup, or write tests without explicit human approval.
- Never expose SQL credentials or `.env.local` values.
- Prefer read-only health checks when possible.
- Treat `DELETE`, `DROP`, `TRUNCATE`, and bulk update operations as high risk.
- Respect migration guards and database target checks.

## Inventory

- Stock cards are ERP core.
- Product stock, barcode, price, currency, supplier, and image references must remain consistent.
- Do not introduce multi-warehouse, shelf, floor, or location tracking unless explicitly approved. The documented ERP assumption is single-center stock.
- Draft sales or purchase invoices must not affect stock.
- Only finalized commercial documents may create stock movement.
- Products with movement history should not be hard-deleted.

## Finance

- ERP finance is operational finance, not official accounting.
- Customer and supplier balances must remain traceable to movements.
- Collections and payments must update the correct ledger and audit trail.
- Multi-currency behavior must preserve transaction-time snapshots where applicable.
- Do not silently change balance or currency calculation rules.

## Permissions

- Protected API routes must require authentication.
- Critical writes must require explicit permissions.
- Do not add bypass tokens, fake admin users, silent auth fallbacks, or hardcoded credentials.
- Permission changes must be documented and tested.

## Audit

- Critical operations must be auditable:
  - invoice creation, finalize, cancel
  - price changes
  - stock adjustments
  - import operations
  - user and permission changes
  - currency-sensitive changes
- Audit actor should come from the authenticated user whenever possible.

## AI And Automation

- AI-assisted ERP work is read-only by default.
- AI may analyze, summarize, explain, draft, review, and prepare checklists from safe ERP data.
- AI must not create, update, delete, import, cleanup, reset, restore, migrate, publish, deploy, or send messages without explicit Melih approval for the exact run.
- AI must not change price, stock, finance, customer, supplier, invoice, permission, audit, catalog, terminal sync, or public data truth without explicit approval, audit, and rollback/reversal planning.
- AI analysis must separate known ERP data, inference, missing data, and human verification.
- AI-generated recommendations are review inputs only; humans remain responsible for business decisions.
- See `docs/erp-v2/ai-automation-readiness.md` before implementing any AI or automation feature.

## Uploads And Media

- `uploads/` and `apps/api/uploads/` are runtime media areas, not normal source code.
- Do not commit uploaded product images unless explicitly requested.
- Product image matching, watermarking, and bulk media actions require dry-run/report/apply discipline.
- Low-confidence image matches must be reviewed before applying.

## Terminal

- The terminal app must stay simple and field-focused.
- Terminal must not become a full ERP admin panel.
- Offline terminal sales may be accepted and synced later according to documented ERP rules.
- Idempotency is required for terminal sales submission.
- Failed sync visibility belongs to operations and must not be hidden.

## Electron

- Electron is a desktop shell around the ERP web/admin experience.
- Do not put ERP business logic in Electron.
- API URL, ports, and local runtime assumptions must be explicit.
- Electron changes should not break the web-admin build.

## Build Policy

- Run the smallest relevant checks before committing.
- For API JavaScript syntax changes, use `node --check` when useful.
- For web-admin changes, run `npm.cmd --prefix apps/web-admin run build` unless the change is documentation-only.
- For desktop changes, run the desktop check script when relevant.
- For terminal changes, run available terminal checks when relevant.
- If a test cannot be run, explain why in the final report.

## Commit Policy

- Keep commits small and focused.
- Do not mix code changes with unrelated documentation changes.
- Do not include `.env.local`, secrets, logs, build output, uploads, backups, or tool-specific local folders unless explicitly requested.
- Before committing, inspect `git status --short`.
- After committing, report commit hash and remaining dirty files.
