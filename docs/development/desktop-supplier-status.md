# K04-09: reversible local supplier status

The normal supplier card can deactivate or reactivate a local supplier with a
3–250 character reason. Both `supplier.view` and `supplier.edit` are required at
the HTTP boundary and again in the leased SQL transaction. Deleted suppliers
cannot be recovered through this operation. No delete or merge operation exists.

`GET /api/desktop-suppliers/:id/status-context` returns the supplier ID, current
status and revision. `POST /api/desktop-suppliers/:id/status` accepts only
`requestId`, `expectedRevision`, `isActive`, and `reason`. The matching `/resolve`
endpoint resolves the original command without creating a replacement update.
`GET /api/desktop-suppliers/inactive?page=1` provides the bounded inactive list,
so a deactivated card remains reachable and its existing accounts/history can
still be read. Default active lists and the TRY purchase currency boundary stay
in place. Purchase selection rechecks active status inside its transaction.

The revision binds the native supplier timestamp, entity and account identity.
The producer explicitly converts timestamp through `binary(8)` before hex.
Every status read/write/resolution verifies the existing local create journal,
audit and complete linked-account provenance. Contradictory, foreign or shared
identity stops before any status UPDATE or even audit-only fencing. It never
chooses a candidate identity or combines cards. Synthetic transactional tests
cover these contradictory identities; real normal-screen acceptance is separate.

The SERIALIZABLE transaction owns the current session lease and a UUID lock.
Its immutable audit receipt binds actor, supplier, UUID and exact command.
Replay returns the original result; a stale revision records a durable no-commit
result. Only status, passive timestamp/reason, updated timestamp/actor change.
Supplier/entity/account identity, money, balances and all business history remain
unchanged. Reactivation clears the current passive timestamp/reason; audits retain
the operation and its reason. It is logical reversal, not a timestamp rollback.

The client persists the command before sending it. UNKNOWN freezes the same
UUID/body and exposes result resolution. Unsaved reasons and pending operations
guard navigation. A confirmed commit refreshes active/inactive lists and the card;
a failed or unknown result does not announce success or discard the command.

## Installation boundary

V7 adds exactly four column UPDATE rights on `dbo.suppliers`: `is_active`,
`passive_at`, `passive_reason`, `updated_by`. `updated_at` was already allowed.
There is no DDL, new ERP role/user, broad UPDATE or DELETE grant. The previous
customer-edit eight-column authorization is not authorization for these four.
The reviewed TEST plan must bind the actual source/package/DB and separately
authorize its rollback trial, conditional application and exact restoration.

Source tests/build are not installation. Final acceptance requires normal TEST
deactivation/reactivation, history preservation, same-currency inactive purchase
exclusion and a reversible synthetic ambiguous-identity case with no status write.
It must not delete records, merge cards, repeat accepted purchase transactions,
create the special sales approver, or turn historical request 209 into a retry.
