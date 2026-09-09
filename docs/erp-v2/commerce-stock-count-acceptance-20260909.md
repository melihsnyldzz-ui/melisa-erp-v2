# Stock count permission and SQL acceptance

Bounded acceptance in the isolated commerce candidate, 2026-09-09. Production accounts, permissions, schema and stock were not changed.

Stock counts require both `product.view` and the existing critical `stock.adjust` permission at the route and service boundary. `stock.adjust` requires update or approve on its own permission row; product editing and full-access role defaults do not grant it. The permission overview reports this explicit grant separately. Before rollout, existing users must have their intended explicit grant reviewed; no automatic grant or production migration is included.

Real test SQL exposed a stock movement source rejected by the schema. Counts now use the existing `stock_count` source. The rejected attempt rolled back fully. Successful count results also update the search row immediately, normalizing string/numeric product identities.

## Evidence

- Dedicated synthetic product TEST-SC-20260909, initial quantity 5; browser counts 5 -> 7 -> 6 -> 8. SQL has exactly three corresponding movements (+2, -1, +2) and three audit records with actor 20002, before/after quantities and reasons.
- Final browser search row and summary both show 8 without another search. Earlier stale-row failures are retained in the Development OS evidence trail.
- Actual HTTP: unauthenticated 401, product editor without stock grant 403, stale snapshot 409, missing reason 400. Unchanged count returns no movement; final movement/audit counts remain three.
- The editor account sees an access-denied screen. Explicit stock counter has no product.edit yet performs authorized counts.
- Previous test product stock 8, customer 40 TRY, supplier 110 TRY and cash 10 TRY remain unchanged.
- 111 API tests, 231 web checks (218 static/contract plus 13 behavioral), API 149 roots and web 184 roots with zero type diagnostics, lint and web build pass. Build retains the existing large-chunk advisory.

Test SQL is restricted to named localhost lab port 51433; API 54100 and web 54173. Services stopped and SQL volume retained. No production business writes or messaging actions. This is not full ERP acceptance, a branch merge or deployment.

Source index refreshed: 8451 nodes, 26294 edges, 28 partial files, zero skipped, 89 intentionally excluded. Operated files were directly reviewed; coverage still reports metadata_changed after refresh and is not proof of completeness. Cross-project matching reports three HTTP edges, not live integration proof. Stock-count request/response shape stays the same; permission requirements become stricter.

Reproducible lab helpers: `prepare-stock-count.mjs --verify` only reads existing fixture; preparation is one-shot and refuses reuse. `accept-stock-count-permission.mjs after 8` checks final no-op/stale/reason behavior. Do not reset the preserved fixture or replay preparations.

Detailed public evidence is in Development OS `audit/commerce-no-messaging-20260908/stock-count/acceptance.json`; credentials remain in the private backup directory.
