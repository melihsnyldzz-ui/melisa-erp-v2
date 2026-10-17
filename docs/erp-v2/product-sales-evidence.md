# Read-only product sales evidence

`GET /api/vega/ai/product-sales-evidence` requires authentication and `sales.view`.
Required query parameters: one positive SQL-int `sourceId`, `dateFrom`, `dateTo`
(real ISO dates within 2026, inclusive, ordered). Extra/duplicate parameters fail
with 400. The maximum window is the fixed 2026 calendar year.

The service uses the existing Vega read-only pool pinned to `VEGA2026`, company
`F0102`, period `D0007`. It selects one stock from `F0102TBLSTOKLAR`, aggregates
all matching rows of `F0102D0007TBLSTOKHAREKETLERI`, and examines undated rows
for that same stock. Sales mean trimmed `IZAHAT=33` and positive `CIKAN` within
the window. `salesCount` counts positive sale movements, not distinct invoices.
`firstSoldAt`/`lastSoldAt` are dates, not document or customer identifiers.
There are no writes, customer joins, price fields, pagination or row truncation.

- 200 `SALES_FOUND`: positive sale movements, `noSalesInWindow=false`.
- 200 `NO_SALES_IN_WINDOW`: completed query with no sale-code, positive-sale,
  undated or unclassified outbound evidence; `salesCount=0`,
  `noSalesInWindow=true`. Non-sale inbound rows may still be present.
- 200 `INDETERMINATE`: no confirmed dated positive sale, but sale-code, undated
  or unclassified outbound rows prevent a trustworthy no-sales conclusion.
  Consumers must leave discovery blocked.
- 404 `UNAVAILABLE`: missing stock, disabled/mismatched source or failed SQL
  query. Never represents an empty successful movement aggregate.
- 502: malformed or contradictory source evidence. Never substitutes zero.

`data` exposes the six movement metrics directly for the existing Melisa AI
adapter/acceptance contract. `meta.scope` carries exact stock/date bounds, source table, movement definition,
full aggregation coverage, no pagination/limit and undated-row coverage.
`meta` carries contract `vega-product-sales-evidence/v1`, retrieval timestamp,
database/company/period/year, `source=vega-live-read-only` and
`writePerformed=false`. The response deliberately allowlists fields.

Unit/controller/auth regression suite (no live SQL):
`node --test src/services/vegaProductSalesEvidenceService.test.js`
from `apps/api`. This does not establish live SQL execution or deployment;
the existing 4100 runtime must be updated separately with owner authorization.
