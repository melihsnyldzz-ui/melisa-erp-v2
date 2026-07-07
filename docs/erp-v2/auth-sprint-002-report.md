# Sprint 002 Report - Authentication And User Access Stabilization

Date: 2026-07-07
Branch: `codex/erp-ui-modernization`
Owner: Codex
Reviewer: ChatGPT
Approver: Melih

## Status

Completed with one intentional limitation: live login/logout/refresh smoke was not executed because `/api/auth/login` can write refresh-token metadata and update `users.last_login_at` when the API is not running in read-only mode. This requires explicit human approval before touching live data.

## Business Goal

Make ERP access safer and clearer before deeper ERP Core validation continues.

The open-admin bypass was already removed in commit `6e15ba6`. Sprint 002 verifies the current auth shape, removes stale-browser-token behavior on unauthorized responses, and documents remaining permission risks.

## Completed Work

- Reviewed API auth middleware, auth routes and auth service.
- Reviewed web-admin login, logout, session restore and unauthorized response handling.
- Confirmed no active open-admin bypass or fake local admin token pattern was found in active API/web-admin source.
- Updated web-admin API client so a `401 Unauthorized` response clears stored auth tokens before raising the session-expired event.
- Cleaned broken login error fallback text.
- Updated current ERP status to move the next recommended sprint to Sprint 003.

## Auth Behavior Summary

| Area | Current behavior | Sprint 002 result |
|---|---|---|
| Login | `/api/auth/login` validates username/password through API auth service | Reviewed; live smoke not run because it can write DB metadata |
| Session restore | Web-admin calls `/api/auth/me` on boot | Reviewed |
| Protected API | Auth middleware verifies bearer access token and active user | Reviewed |
| Unauthorized response | Web-admin now clears stored access/refresh tokens on `401` | Improved |
| Logout | Web-admin calls logout then clears local tokens | Reviewed |
| Open-admin bypass | Removed before this sprint | Rechecked by static scan |

## Permission Review Notes

These are not changed in Sprint 002 because they can affect business rules and should be handled in a permission-cleanup sprint or after human approval:

- Supplier movement and statement routes currently reuse some `customer.view` style permissions.
- Supplier create/update routes currently reuse some `customer.edit` style permissions.
- Finance routes mix `finance.*`, `customer.*` and `settings.manage` permissions depending on the operation.
- Public catalog product endpoints appear intentionally unauthenticated and should stay explicitly documented as public if that remains the business rule.

## Required Tests

Sprint 002 required safe verification only:

- Static auth bypass scan.
- API auth file syntax checks.
- Web-admin production build.
- Git diff scope review.

## Tests Not Run

Live login/logout/refresh smoke was not run. Reason: login can insert refresh-token rows and update login metadata in SQL Server when not read-only.

## Documentation Updated

- `docs/erp-v2/current-status.md`
- `docs/erp-v2/auth-sprint-002-report.md`

## Risks

- Operator login still needs a controlled live smoke test with explicit approval.
- Permission naming and route boundaries still need a dedicated cleanup pass.
- If refresh-token tables or JWT secrets are missing in a local environment, login can fail even when credentials are correct.

## Next Sprint Recommendation

Complete Sprint 003: Product And Stock Data Reliability.
