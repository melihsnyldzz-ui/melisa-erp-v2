# Sprint 008 - Import And Cleanup Control

Date: 2026-07-08
Branch: `supervisor-live-smoke-001`

## Status

Completed for code and documentation guardrails.

No SQL write, migration, backup, restore, reset, cleanup apply, WhatsApp sending, production deploy, or destructive script was run.

## Scope

Sprint 008 focused on making import and cleanup operations safer before wider business use:

- Product, customer and supplier import preview/apply behavior.
- Duplicate and suspicious row reporting.
- Apply result reporting.
- Cleanup endpoint safety review.
- Operator documentation for approval points and rollback expectations.

## Import Behavior

Import apply is now preview-gated.

The required flow is:

1. Operator selects a CSV/XLS/XLSX file.
2. Operator runs preview.
3. API parses rows, validates required columns, checks file duplicates and DB duplicates, and returns a `previewToken`.
4. Web-admin stores that token for the current file/entity preview.
5. Apply sends the same file plus `previewToken`.
6. API re-runs preview and rejects apply if the token is missing or stale.
7. Apply runs in one SQL transaction and writes audit after successful insert.

Preview remains read-only. Apply still requires:

- authenticated user
- `import.run`
- write guard enabled
- matching preview token
- valid rows according to the selected apply mode

## Validation And Reporting

Existing duplicate handling remains:

- Product import checks `stockCode` and `barcode` duplicates in the file and database.
- Customer import checks `customerCode` duplicates in the file and database.
- Supplier import checks `supplierCode` duplicates in the file and database.
- Duplicate rows are not silently applied.

Suspicious-but-valid rows now create warnings instead of hard failures:

- product zero sale price
- product zero purchase price
- product zero stock quantity
- missing product brand/category
- temporary-looking customer phone
- missing city/country
- non-zero opening customer/supplier balance
- missing supplier phone

Apply result and audit snapshot now include:

- inserted count
- inserted ids
- skipped invalid count when valid-only apply is used
- skipped duplicate count when valid-only apply is used
- warning count
- before count
- after count

## Cleanup Safety Review

Cleanup endpoints were reviewed but not executed.

Current cleanup controls:

- Preview and apply are separate endpoints.
- Apply requires `settings.manage`.
- Apply requires explicit confirmation text.
- Apply calls `assertMelisaWriteEnabled()`.
- Demo cleanup uses soft-delete for safe candidates instead of physical delete.
- Test transaction tree cleanup archives with `TEST_ARCHIVED` marker.
- Test archive restore has its own preview/apply and confirmation.
- Apply writes audit actions:
  - `demo_test_cleanup_applied`
  - `test_transaction_tree_archived`
  - `test_transaction_tree_restored`

Cleanup apply remains high risk. It must not be run against live/business data without explicit Melih approval, a known target database, and a current backup/rollback plan.

## Approval Points

Human approval is required before:

- any import apply against live/business data
- any cleanup apply
- any reset/restore/backup execution
- any SQL migration
- any destructive file or database action
- any production deploy

Preview-only import and cleanup review can be used for low-risk inspection, but preview output may still reveal business data and must not be pasted into public channels.

## Files Changed

- `apps/api/src/services/importService.js`
- `apps/web-admin/src/modules/import/ImportScreen.jsx`
- `docs/erp-v2/import-cleanup-sprint-008-report.md`
- `docs/erp-v2/current-status.md`
- `docs/erp-v2/production-readiness-checklist.md`

## Verification

Required checks for this sprint:

- API syntax check for import service.
- Web-admin build.
- Static source review for preview-token apply guard.

No live import apply or cleanup apply was run because those are write operations and require explicit Melih approval.

## Remaining Risks

| Risk | Status | Next action |
|---|---|---|
| Real business import can still insert incorrect but syntactically valid rows | Reduced, not eliminated | Use small approved batches and review warnings before apply |
| Cleanup apply can affect balances and test-pattern records | High | Keep approval, confirmation, write guard and backup requirement |
| Imported opening balances need business reconciliation | Open | Handle in finance/accounting reconciliation sprint |
| UI does not yet show a dedicated persisted import history browser | Open | Consider under operational health/audit browser work |

## Next Sprint Recommendation

Recommended sprint: Sprint 009 - Operational Health And Monitoring

Reason: Import and cleanup writes now have stronger guardrails; operators next need one place to see health, failed sync, recent critical failures, and import/finalize failure visibility.
