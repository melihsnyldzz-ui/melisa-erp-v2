# P06.2 strict selected-source collection native adapter — 18 October 2026

Source preparation only; no SQL installation or native execution occurred.

## Supported scope

The existing selected-source preparation can now call a distinct native owner begin/intent/effects path. Creator15 and collector16 stay separate. The sale must be finalized TRY and match the current generic context customer, party account and its one sealed cash/bank account. Existing native guard limits, including **500 TRY maximum per collection**, remain in force. This is not general arbitrary-customer/currency collection completion and does not close P06.2/ERP09-C05 or change acceptance counts.

The addon preserves every prior native module and immutable registry. Its five owner modules bind copy, actor, invoice creation, customer/party/finance account, currency, request body and same serializable transaction. Partial/full amounts, cancellation of the original matching collection and exact UUID replay use existing collection arithmetic. Effects require one linked customer/finance movement and no stock or supplier movement. Effects/journal failure remains atomic through the factory transaction.

History has no finance accounts by design. The owner separately proves the generic context, compares current customer/account/source identity with history, and overlays its one finance account. History proof, selected revision and rate stay separate from generic context proof. A source regression checks this shape; an early impossible history-accounts assumption was corrected before delivery.

## Explicit source caller

Nothing is enabled by importing these modules. Existing default router still has no selected-source endpoints. A future isolated owner must first prepare/install the canonical additive bundle for the exact copy and prove existing V13 and collection-history predecessors. The supported bootstrap is `configureBusinessSelectedCollectionRevision(copy, candidateRevision, request)` under the existing native transaction/identity contract. Mere compiler output, cloned capabilities or metadata JSON cannot register it.

After earned registration, the server can explicitly construct `createWorkCollectionRoutes({selectedSourceNativeStore: store})`, where `store` is returned by `createIsolatedOperationCopyStore` / the existing trade-store factory. A module-private WeakSet rejects store lookalikes. This option is mutually exclusive with selectedSourceService. Native preparation obtains only scoped factory bridge callbacks; request/domain callbacks expire at transaction exit. Missing registry or authority fails closed. No environment flag, default fallback, new principal or automatic startup activation was added.

## Verification

39 targeted offline tests pass with zero skipped: compiler/bootstrap10, scope8, native adapter4, existing preparation11, actual Express routes6. Native adapter tests intentionally model the owner registry/SQL responses through a test-only import hook; they exercise real factory/journal/scope/service code, but are **not actual SQL execution or earned native registration evidence**. Bootstrap tests independently reject malformed native results and missing earned predecessors. Original route source fails the new explicit-native-selector regression (0 selected routes vs4); current source passes.

The native request fixture checks exact effects parameter names, including payload_hash. Partial5 + full19 TRY, cancellation after full payment, replay, conflicting UUID, revoked proof, effect and journal rollback, server marker spoofing and escaped bridge/domain callbacks are covered. Hosted CI runs compiler suites explicitly and discovers service/route tests normally.

Independent root source review found no remaining blocking source finding after the history/generic DTO fix; exact hosted CI still belongs to the PR head. Real owner SQL syntax/DDL/native before-after verification, controlled installation, normal GUI, physical devices and human acceptance remain open. No DB02/Vega/T1/LIVE, grants, service, customer message, main merge or data migration was performed. Migration remains last.


## Source preview/write amount coherence

The selected-source service rejects amounts above the existing 500.0000 TRY native per-collection ceiling during preview and before any mutation journal or financial effect. Fresh authority is checked first. Ordinary collection behavior and cancellation inverses remain unchanged. Each preview snapshots its primitive amount before awaiting authority, so a caller cannot change the original request body while the validated selection is waiting.

Thirteen targeted offline tests pass with zero skipped, independently repeated by root. They cover 499.9999 and 500.0000 preview/collection on a coherent 1000 TRY invoice, rejection of 500.0001 before source/journal/effects, revoked-authority precedence, and mutation of the original preview body during deferred authority. Both new regressions were reproduced as failing against the earlier implementation. Hosted CI belongs to the new PR head; no new native SQL, default-route activation, permissions or general-customer/currency completion is claimed.
