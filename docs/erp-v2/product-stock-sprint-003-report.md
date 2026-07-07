# Sprint 003 Report - Product And Stock Data Reliability

Date: 2026-07-07
Branch: `codex/erp-ui-modernization`
Owner: Codex
Reviewer: ChatGPT
Approver: Melih

## Status

Completed within the approved safe scope.

No live database writes, migrations, destructive cleanup, large UI redesign, or `.claude/` changes were performed.

## Business Goal

Make product cards and the stock list reliable enough for daily ERP Core operations.

Sales, purchases, terminal scanning, catalog usage and reporting all depend on product/stock data being searchable and trustworthy.

## Completed Work

- Increased the product list API cap from 100 to 500 for `/api/products` only, matching the stock-list screen expectation.
- Added supplier code and supplier name to backend product search so product searches can find rows by supplier as well as stock code, barcode, name, brand and category.
- Removed mock brand/category/supplier suggestions from the stock-list filter path.
- Connected stock-list suggestions to real `/api/products/options` data, with visible rows added as a local supplement.
- Kept suggestion de-duplication Turkish-search aware through the existing `normalizeSearchText` helper.
- Adjusted stock image hover preview positioning so previews are clamped inside the viewport instead of opening too low or off-screen.
- Verified Turkish search normalization for `i`, dotless-i, uppercase dotted-I and uppercase-I cases.

## Product And Stock Behavior Summary

| Area | Result |
|---|---|
| Product list limit | `/api/products` can now return up to 500 rows per page |
| Product search | Supplier code/name is included in product search |
| Stock filter suggestions | Uses real ERP product options instead of mock stock categories |
| Turkish search | ILKER/Ilker, dotless-i variants, Dis and Ic style searches normalize consistently |
| Image preview | Preview opens within viewport bounds and avoids dropping below the visible table area |
| Live writes | Not performed |

## Tests Run

- `node --check apps/api/src/services/productService.js`
- `node --check apps/api/src/controllers/productController.js`
- `node --check apps/api/src/routes/productRoutes.js`
- `npm.cmd --prefix apps/web-admin run build`
- Unicode search-normalization smoke using `normalizeSearchText` and `searchTextIncludes`
- `git diff --check`

## Test Notes

The web-admin build passed. Vite still reports existing non-blocking warnings about `lucide-react` module directives and large chunk size.

The first manual normalization check failed because PowerShell converted literal Turkish characters in the inline command to `?`. The same test passed with Unicode escape sequences, confirming the application helper behavior.

## Tests Not Run

Live product create/update/image-save smoke was not run because those operations write to SQL Server and require explicit approval.

## Documentation Updated

- `docs/erp-v2/current-status.md`
- `docs/erp-v2/product-stock-sprint-003-report.md`

## Risks

- Existing product data may still contain dirty categories, duplicate brands or supplier naming inconsistencies.
- Product image files are local/runtime assets and are not fully represented in Git.
- Full product-card save validation still needs an approved test database or explicit live-write approval.

## Next Sprint Recommendation

Complete Sprint 004: Customer And Supplier Ledger Reliability.
