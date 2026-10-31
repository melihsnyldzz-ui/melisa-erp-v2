# B6 first failure path — source and SELECT evidence only

This delivery does not install a package or execute a sale. The installed Current
pair, roles, existing evidence and pending human acceptance are preserved.

## Actual call order

1. `workSalesRoutes.mjs:14` authenticates/authorizes the draft request.
   `workSalesService.mjs:60` validates it and enters the selected mutation store.
2. `workTradeStore.mjs:122–127` builds the canonical body and calls the admitted
   runtime. `canonicalBusinessSaleRuntime.mjs:45–55` starts SERIALIZABLE,
   obtains the existing transaction application lock, checks identity/module
   metadata, then calls `usp_canonical_business_sale_begin_v1`.
3. Captured `begin_v1:1` calls `ready_v1` and checks the same application lock.
   Body, provenance, role permission and replay checks precede resolution.
   `begin_v1:22` invokes `resolve_v1`, whose first line calls `ready_v1` again.
   Resolve uses a local table variable, dated rate, account/product witnesses,
   unit, stock, cost, quote, hold, total/revision/preview predicates.
4. The first persistent draft-path write is captured `begin_v1:47`: an
   **intent**, not an invoice. Factory `:64` enters the transaction binding;
   the intermediate `assert_v1` call at `:87` validates the issued proof.
5. The callback in `workSalesService.mjs:61–65` uses the already bound context.
   `workTradeStore.mjs:65–66` does not execute `context_v1` again for this draft.
   `context_v1 → ready_v1 → resolve_v1 → ready_v1` is the separate preview/read
   path; it is not a necessary extra call before begin inside every draft POST.
6. `workTradeStore.mjs:104–108` calls `invoiceDraftService.js:1877` onward.
   Quarantine, personnel schema, accounting period, selected invocation,
   account/currency and product checks precede the header INSERT at `:1924`.
   Header/currency updates encounter existing triggers; selected multi-item
   INSERT at `:125–130` is reached through `:1972`. Snapshot/audit, link creation,
   effects, journal (`canonicalBusinessSaleRuntime.mjs:67`), completed assertion
   and final metadata comparison precede commit.

`WORK_REQUEST_NOT_FOUND` (`workTradeStore.mjs:101`) means the request read found
no eligible committed journal row. It does **not** establish that begin, intent,
header, or SQL execution was never reached: the outer catch rolls the whole
transaction back. Existing zero committed effects are consistent with several
failure locations in this sequence.

## Read-only predicate result

The existing protected TEST connection first verified server/database/DB18 and
zero transaction count. Three relevant procedure hashes were freshly compared
with the prior metadata capture. Only SELECT statements evaluated data predicates;
no procedure/application lock/write transaction was run. Original approved IDs
and values remain private.

- Account source witness and unique customer/currency account: valid now.
- Customer/account linkage, active state and hold: valid now.
- Both products: active, ADET, sufficient known stock, known nonnegative cost,
  no hold; their current USD quote source/unit/stock/price/cost witnesses: valid.
- Exact existing actor/role/permission predicate and dated rate witness: valid.

These are current observations, not a historical reconstruction of the failed
POST. The original quote IDs were not preserved in the inspected request receipt;
current valid quote candidates do not prove the original selection. Session
`ORIGINAL_LOGIN`, transaction/admission and native guard execution were not
emulated through the metadata connection. No failing predicate is proved.

## Runnable preparation, not SQL execution

`scripts/canonical/b6-selected-items-subpath.mjs` extracts the exact pinned
`insertSelectedSourceSalesItems` SQL, changing only its target table to the
disposable fixture schema. It independently tests **only** OPENJSON conversion,
selected-item column types and product/header FK behavior. It does not copy,
relax or claim to satisfy production `ready_v1`, server/login guards, native
admission, canonical intent/phase triggers, accounting, stock or finance.

Offline plan (no connection, credentials or SQL required):

```powershell
node scripts/canonical/b6-selected-items-subpath.mjs
node --require ./scripts/ci/offline-guard.cjs --test apps/api/src/services/b6SelectedItemsSubpathPreparation.test.mjs
```

The SQL branch is **not authorized or executed by this delivery**. It requires
all of these exact independently prepared conditions:

- Host/port `127.0.0.1:15439`; database `MELISA_B6_SUBPATH_20261031_1234`.
- Server identity `MELISA-B6-DISPOSABLE`; database extended property
  `MELISA_DISPOSABLE_SCOPE=B6-SELECTED-ITEMS-1234`.
- No user tables and no existing fixture schema. This is not a claim that every
  possible database object has been enumerated or the whole database is empty.
- Existing specifically authorized credentials supplied through the protected
  execution environment; no credential creation or default production config.
  TLS remains required with certificate verification enabled.

After separate approval and target provisioning, the guarded command is:

```powershell
node scripts/canonical/b6-selected-items-subpath.mjs --execute --approved-execution --scenario valid
```

Alternative single scenarios `bad-quantity` and `unknown-product` isolate typed
JSON conversion (expected8114) and FK rejection (expected547). Each execution
uses two synthetic products, one synthetic header and one outer transaction.
DDL/seed/item rows are rolled back; no commit path exists. A fresh read must
confirm zero user tables, no fixture schema and zero transaction count. Expected
errors count only at the selected-items stage, never at schema/seed/readback.
Only bounded numeric provider fields are emitted; raw SQL error messages and
credentials are not logged. CLI flags do not themselves grant user authority.

## Verification and remaining unknown

Eight targeted offline tests passed under the unchanged CI offline guard. An
independent reviewer found a wrong-stage false-PASS risk; the outcome validator
and explicit negative stage/rollback tests close it. An unnecessary CLI-child
test was denied by the offline guard; the final test calls the pure argument
entry directly and creates no child. No guard/workflow exception was added.
The existing API test discovery includes the new test file automatically.

The one unresolved runtime fact remains the first failing SQL statement/guard
and provider number/state/class/line from the original draft. The subpath runner
is a bounded discriminator, not a demonstrated root cause or full-sale PASS.
Actual SQL execution and a newly provisioned disposable environment require
separate explicit approval; neither happened here.
