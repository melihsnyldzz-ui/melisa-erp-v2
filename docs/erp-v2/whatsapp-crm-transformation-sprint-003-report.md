# WhatsApp CRM Transformation Sprint 003 - Customer 360

## Outcome

The selected WhatsApp contact is matched against ERP customers using a normalized phone number. Matching is read-only and fails closed when the phone is missing or duplicated.

## Delivered

- Added a read-only ERP customer lookup adapter.
- Added explicit loading, matched, not-found, ambiguous, unverified and error states.
- Added ERP customer code, name, balance, currency, location, status and last movement date.
- Reused real customer movements in the recent orders area.
- Removed in-memory fake product and order creation from the CRM panel.

## Safety

- No customer, invoice or CRM database record is written by the Customer 360 lookup.
- Duplicate phone matches are never selected automatically.
- Unverified WhatsApp identities are not treated as ERP customers.

## Verification

- `node scripts/web-admin-crm-customer-360-smoke.mjs`
- `npm.cmd --prefix apps/web-admin run build`
- Browser verification on the real empty inbox state.

