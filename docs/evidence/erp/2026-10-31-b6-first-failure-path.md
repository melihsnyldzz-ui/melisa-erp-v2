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

## Subsequent authorized isolated execution and confirmed defect

The coordinator subsequently relayed the user's explicit technical delegation
to perform the synthetic experiment. The earlier preparation-only boundary is
historical; no new-environment-only approval gate was retained. The existing
owned `melisa-b6-8711-20261029` container was matched to its original saved full
ID, `network=none`, zero published ports and the official existing SQL image.
The TCP runner target15439 was not opened. Existing credentials stayed inside
the container; no password/login/role was created or changed. Container-local
TLS was configured with certificate verification and encryption; client trust
was limited to that process's own certificate file. No `-C` bypass, Windows
trust-store change or real SQL service restart occurred.

The actual transport was Microsoft's installed SQLCMD/ODBC18 inside that
network-isolated container, not the application's Node mssql driver. This
distinction matters for full-flow claims. A uniquely named empty disposable DB
was created there; only synthetic fixtures were used. The reviewed SQL adapter
held manifest/input read handles, checked the copied SQL hash, pinned the full
container identity and failed closed on nonzero exit. Source review also closed
the multi-batch error-handling dependency with `:ON ERROR EXIT` and exact second
batch DB/server checks. No shared ERP/CRM SQL write or sale POST occurred.

Real SQL results:

| Probe | Observed result | Cleanup |
|---|---|---|
| Two valid selected items | Two inserted fixture rows | Outer transaction rolled back; schema/table count0 |
| Invalid decimal quantity | 8114, state5, class16, selected-items stage | Same verified rollback |
| Unknown synthetic product | FK547, state0, class16, selected-items stage | Same verified rollback |
| Original competing ISSUED header conditions | Draft and draft-cancel both raise51917/B6_EVENT_TRANSFORM | No durable rows |
| Fixed full generated header rules: valid draft/cancel | DRAFT_OPEN / DRAFT_CANCELLED | Verified rollback |
| Fixed full rules: wrong draft kind, wrong cancel kind, finalize in ISSUED | Each still rejects51917 | Verified rollback |

**Confirmed defect:** captured guard lines34 and44 independently enter the same
`sales_invoices/ISSUED` condition. The insert block requires deleted-count0 and
sets only `@next`; phase staysISSUED. The cancel block then enters and requires
deleted-count1. Conversely a legitimate cancel fails the insert block first.
This is a concrete blocking SQL logic defect; the old HTTP error lacked numeric
metadata, so it is not claimed as the uniquely correlated historical error.

The source compiler now adds `@operation=sale_draft` and `@operation=sale_cancel`
to those two outer selectors. All inner predicates, counts, freshness, identity,
permission, transaction and registry checks stay unchanged. After removing just
these two selectors, the complete generated definition equals the captured
installed definition byte-for-byte. CREATE-form corrected guard hash:
`313C6549B137E242D471E3511F5E07E1105061F83F5E645AE75CE059B64B13E5`.
The five-case real SQL regression used both complete generated rule bodies,
including their original row predicates; it was not merely a string test.
Sixteen targeted compiler tests passed under the unchanged offline guard and
independent source review found no remaining P1/P2.

**Transaction-count candidate was not proved.** An initial observation INSERT
itself perturbed the measured count; that fixture was rejected. SQLCMD's default
256-character truncation and a fixture-quoting error were also corrected without
touching shared TEST. Measurements taken before observation DML, followed by
the literal original guard/ready IF context predicates, saw count1 inside the
called procedure at trigger depth1 and nested depth2, with the same transaction
ID and no original context rejection. The documented general trigger increment
does not justify changing this unproved caller-specific predicate; `@@TRANCOUNT`
remains unchanged. See [Microsoft's transaction interoperability description](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/rollback-transaction-transact-sql#interoperability).

## Exact remaining activation boundary

The installed shared TEST was only read: current guard and scope hash are both
`9E8BC946A0FF0E90F22FD248927B7855679E7E196131D7D30247E2B674AC2DBE`;
the scope immutable trigger remains enabled. API admission pins do not contain
the guard hash; their existing four procedure pins are unchanged. A new API/web
package or restart is not currently part of the planned correction.

Private apply/inverse plans cover exactly one guard ALTER and one scope-row
guard-hash update. They require verified fresh backup, exact DB18/server,
existing exclusive transaction application lock, current definition/options/
object/owner pins, scope CAS, preservation of five other procedures, and a
temporary immutable-trigger state change restored inside the same transaction.
ANSI_NULLS/QUOTED_IDENTIFIER/execute-as/object ID are preserved. Error means full
rollback; the inverse is separately pinned. These plans were **not applied**.

Current instructions explicitly preserve installed5244/shared SQL. Applying this
specific guarded shared-TEST maintenance, including its temporary protection
state change, requires a separate explicit activation decision. The old approval
for one narrowly scoped sale is retained and not enlarged. Full normal sale,
receipt, stock/customer effects, replay/cancellation and human acceptance remain
open until the installed result is actually tested.

## Directly approved native activation — verified

The user subsequently explicitly approved exactly the guard procedure, its
single bound hash row, and the temporary transactional immutable-trigger
maintenance. The prepared apply/inverse received independent source review.
The actual module options were read and pinned: object624825388,
ANSI_NULLS/QUOTED_IDENTIFIER1, EXECUTE AS OWNER. Those values are checked both
before and after; no role/permission change is part of the plan.

Fresh native TEST COPY_ONLY/CHECKSUM backup and RESTORE VERIFYONLY passed. This
is not a performed restore rehearsal. The backup receipt and held backup stream
were SHA-verified. Before-images were flushed to durable storage before the
single-attempt marker. A PS5 UTC/local DateTime subtraction problem stopped the
initial invocation before before-image/marker/SQL; DateTimeOffset arithmetic
fixed the calculation while preserving both freshness limits. No new backup
or SQL write was repeated because of that precheck failure.

At `2026-10-31T14:00:04Z`, one native maintenance SQL call completed. Independent
SQL readback verified corrected guard hash313C..., matching single scope hash,
original immutable definition and enabled state, original guard object/options/
owner, and the other six captured module records. Eight protected stock/balance/
role hashes and ten history table counts are identical. Runtime/config/manifest
files, API/native/WEB PIDs and health identity also remain identical. No API/web
package installation, restart, password/role, stock/customer/cash movement,
invoice, sale POST, LIVE/Vega/CRM/T1 change occurred.

Normal5244 was read again through the preserved Semih session. Catalogue refresh
returned16992 products/50 rows; empty sales reload returned402 customers. The
existing two-line cart was preserved, its product/account reading revalidated,
and native sale preview succeeded with the save-draft control enabled. **No
save-draft click was made.** The previous failed request's normal receipt read
still reports unconfirmed; it is not treated as a new sale or an authorization
to retry blindly. Receipt/stock/customer-effect/replay/cancel and human acceptance
therefore remain open.

Only the owned network-none SQL test container was gracefully returned to its
previous stopped state. Its evidence, volume and empty disposable DB were not
deleted. The standalone TCP subpath runner's count alias was quoted as
`[rowCount]` after SQL Server's reserved-word behavior was observed in the
readback query. Its eight offline target-refusal/rollback tests passed again;
its alternate TCP SQL branch was not claimed as executed.

The guard's applied source is15062d66. Its first push CI41207364873 passed all
three jobs; PR41207369007 was still running its unrelated Windows job at this
recording. The earlier af5029d0 PR Windows cancellation was never called PASS
and was not rerun. Final source/report delivery and CI are recorded separately
in the same PR comment; no further install loop is started.
