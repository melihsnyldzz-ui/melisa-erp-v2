# Sprint 011 - Product Media Workflow

Branch: `supervisor-live-smoke-001`

## Status

Completed as a safe dry-run and reporting sprint.

## Business Goal

Make product media matching, watermarking, and coverage controlled and reportable without committing uploads or running unreviewed bulk apply.

## Scope Completed

- Added a dry-run product media workflow script:
  - scans an optional source image folder,
  - reads product/image state from SQL with SELECT-only queries in normal mode,
  - supports fixture products for DB-free smoke testing,
  - reports product image coverage by brand and supplier,
  - separates high-confidence, low-confidence, ambiguous, and unmatched images,
  - can write a review-only manifest for human review.
- Added an API package script:
  - `npm.cmd --prefix apps/api run media:product-workflow -- --source-dir=<image-folder>`
- Documented the apply boundary:
  - the Sprint 011 script does not implement `--apply`,
  - no `product_images` rows are written,
  - no upload files are copied,
  - low-confidence and ambiguous matches require manual review,
  - any DB write/apply batch requires explicit Melih approval.

## Commands

Coverage-only dry run against configured SQL:

```powershell
npm.cmd --prefix apps/api run media:product-workflow
```

Dry run with source images and JSON output:

```powershell
npm.cmd --prefix apps/api run media:product-workflow -- --source-dir="C:\path\to\product-images" --write-report=outputs/product-media-dry-run.json
```

Dry run with Markdown output and review manifest:

```powershell
npm.cmd --prefix apps/api run media:product-workflow -- --source-dir="C:\path\to\product-images" --markdown --write-report=outputs/product-media-dry-run.md --write-review-manifest=outputs/product-media-review-manifest.json
```

DB-free fixture smoke:

```powershell
node apps/api/scripts/product-media-workflow.mjs --fixture-products=<fixture-products.json> --source-dir=<fixture-image-folder>
```

## Confidence Rules

| Confidence | Rule | Apply Policy |
|---|---|---|
| High | Filename exactly matches or contains stock code/barcode | May be proposed for a small approved apply batch after review |
| Low | Filename partially matches product name | Manual review required; never bulk apply |
| Ambiguous | One image matches multiple products | Manual review required |
| Unmatched | No product candidate found | Keep for manual sorting |

## Watermark Boundary

The existing `watermark:product-images` script remains separate. It already has dry-run/apply behavior for existing local upload files. Sprint 011 does not change watermark image processing and does not run watermark apply.

Recommended order:

1. Run product media dry-run and review coverage.
2. Review high-confidence matches.
3. Ask Melih for explicit approval before any write/apply step.
4. Apply only a small reviewed batch.
5. Run a fresh coverage report.
6. Run watermark dry-run before any watermark apply.

## Tests And Checks

- `node --check apps/api/scripts/product-media-workflow.mjs`
- Fixture dry-run smoke with sample products and images.
- `npm.cmd --prefix apps/web-admin run build`

## Human Approval

No approval was used because no risky operation was performed.

Approval is still required for:

- DB writes to `product_images`,
- upload copy/move/delete,
- watermark apply,
- backup/reset/restore,
- production deploy,
- WhatsApp/external sending.

## Known Limits

- The script uses filename-based matching only.
- It does not inspect image contents.
- It does not verify whether the source image visually represents the product.
- Coverage depends on current SQL product/image rows and local runtime upload paths.
- Review manifest is not an apply command.

## Definition Of Done Result

- Image operations are reportable: yes.
- Risky matches require review: yes.
- Rollback/undo strategy is documented: yes, apply is gated and must use reviewed batches plus fresh reports.
- Uploads committed to Git: no.
- Unreviewed bulk apply: no.

## Next Sprint Recommendation

Sprint 012: Catalog And WhatsApp Sales Preparation.

Reason: Product media workflow now has a dry-run/report boundary. Catalog and WhatsApp preparation can proceed only after reviewed product media coverage and without enabling external sending by default.
