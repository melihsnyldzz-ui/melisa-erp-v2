# Melisa ERP v2 Codebase Analysis

Generated on: 2026-06-29

## 1. Repository Structure

Melisa ERP v2 is organized as a local-first multi-app ERP repository:

```text
melisa-erp-v2/
  apps/
    api/            Node.js + Express API, SQL Server access, business services
    web-admin/      React + Vite desktop-first ERP admin UI
    terminal-app/   Expo / React Native Android terminal application
    desktop/        Electron shell for desktop packaging
  docs/
    erp-v2/         Architecture, roadmap, schema, QA and user training docs
  infra/
    sql/
      migrations/   SQL Server schema migrations
      seeds/        Reference roles, permissions and test seed data
  scripts/          Local startup, smoke test and document generation scripts
  uploads/          Runtime-uploaded local media, not application source
```

Important root files:

- `README.md`: high-level project purpose and startup notes.
- `vercel.json`: deployment rewrite configuration.
- `.gitignore`: excludes generated/local artifacts.

## 2. Existing Modules

### Backend API Modules

The API is under `apps/api`. It uses Express routes, controllers and service modules.

Main backend module groups:

- Authentication and session: `authRoutes`, `authController`, `authService`.
- Auth/admin overview: `authAdminRoutes`, `authAdminController`, `authAdminService`.
- Dashboard and monitoring: `dashboardRoutes`, `dashboardService`, `monitoringService`.
- Product and stock: `productRoutes`, `productService`, `movementRoutes`, `movementService`.
- Customer/cari: `customerRoutes`, `customerService`, customer movement and statement APIs.
- Supplier/cari: `supplierRoutes`, `supplierService`, supplier movement and statement APIs.
- Sales invoices: `invoiceRoutes`, `invoiceDraftService`.
- Purchase invoices: `invoiceRoutes`, `invoiceDraftService`.
- Sales offers/orders: `salesPipelineRoutes`, `salesPipelineService`.
- Finance: `financeRoutes`, `financeService`.
- Catalog and WhatsApp sharing: `catalogRoutes`, `catalogService`.
- Currency rates: `currencyRateRoutes`, `currencyRateService`.
- Import: `importRoutes`, `importService`.
- Settings and cleanup: `settingsRoutes`, `settingsService`, `cleanupService`.
- Terminal API: `terminalRoutes`, `terminalService`.
- Terminal admin: `terminalAdminRoutes`, `terminalAdminService`.
- SQL health: `sqlHealthRoutes`, `sqlHealthService`.
- Cross-cutting services: `auditService`, `permissionCatalog`, `periodLockService`, `queryHelpers`, `writeGuardService`.

### Web Admin Modules

The web admin app is under `apps/web-admin`. It is a React/Vite desktop ERP UI with a tabbed workspace.

Main frontend module groups:

- Layout/workspace: `AppShell`, `Sidebar`, `TopMenu`, `Workspace`, `TabBar`, `CommandPalette`, `StatusBar`.
- Dashboard: KPI grid, alerts, recent transactions, operations panel, receivables, top products, quick actions.
- Stock: stock list, stock card/product card, price list, stock movements, stock valuation, stock count, product 360 panel.
- Customers: customer list, card, movements, statement, product trace, transactions.
- Suppliers: supplier list, card, movements, statement, product trace.
- Sales: sales invoice entry, sales invoice list, sales offers, sales orders.
- Purchase: purchase invoice entry/list and bulk purchase entry.
- Finance: finance overview, collections/payment entry, cash customer tracking, cash/bank ledger, accounting journal, accounting control.
- Catalog/WhatsApp: catalog list, WhatsApp planner, WhatsApp Web queue.
- Import: Excel/CSV import foundation.
- Reports: management reports and export center.
- Settings: system settings, definitions, currency rates, auth/admin.
- Terminal: terminal admin overview.

### Terminal App Modules

The terminal app is under `apps/terminal-app` and is built with Expo / React Native.

Existing terminal screens:

- Login
- Home
- Barcode lookup
- Product lookup
- New sale
- Receipt collection
- Customer accounts
- Catalog send
- Data update
- Sync status
- Reports
- Field test
- Settings

Terminal services include API client, auth, product lookup, product image upload, currency rates, catalog sharing, queue/cache, session storage and terminal sales submission.

### Desktop App Module

The desktop shell is under `apps/desktop` and uses Electron.

It currently acts as a wrapper/runtime shell around the web/admin experience rather than a separate ERP implementation. The desktop app has:

- `src/main.mjs`
- `src/preload.cjs`
- local runtime logs
- npm scripts for `start`, `dev`, and syntax check

## 3. Existing Database Models

SQL Server schema migrations live in `infra/sql/migrations`.

Core tables from the initial schema:

- `roles`
- `permissions`
- `users`
- `products`
- `product_barcodes`
- `product_images`
- `customers`
- `suppliers`
- `terminal_devices`
- `currency_rates`
- `sales_invoices`
- `sales_invoice_items`
- `purchase_invoices`
- `purchase_invoice_items`
- `stock_movements`
- `catalogs`
- `catalog_items`
- `terminal_sync_queue`
- `audit_logs`

Later migrations add or extend:

- `customer_movements`
- `supplier_movements`
- `auth_refresh_tokens`
- `sales_offers`
- `sales_offer_items`
- `sales_orders`
- `sales_order_items`
- `system_settings`
- average cost and gross profit fields
- stock movement sales snapshot fields
- finance collection/payment movement support
- purchase discount defaults on products/suppliers

Important database design characteristics:

- SQL Server-first schema.
- Soft delete / passive record approach through `is_active`, `is_deleted`, passive metadata and status fields.
- Snapshot fields on invoice items and sales/purchase documents to preserve history.
- `product_barcodes` has an active barcode uniqueness constraint.
- `product_images` separates media references from product master data.
- `stock_movements` centralizes inventory movement provenance.
- `customer_movements` and `supplier_movements` are separate ledger-style movement tables.
- `audit_logs` is intended to capture critical user and system actions.
- Terminal sync uses queue/idempotency-oriented storage.

## 4. Existing API Endpoints

All API routes are mounted under `/api` by `apps/api/src/app.js`.

### System and Health

- `GET /api/health`
- `GET /api/version`
- `GET /api/monitoring/summary`
- `GET /api/sql/health`
- `GET /api/sql/tables-preview`

### Auth and Authorization

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/auth-admin/overview`
- `PATCH /api/auth-admin/users/:id`

### Dashboard

- `GET /api/dashboard/summary`
- `GET /api/dashboard/alerts`
- `GET /api/dashboard/management-reporting`
- `GET /api/dashboard/periodic-accounting`

### Products and Stock

- `GET /api/products`
- `GET /api/products/options`
- `POST /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `PATCH /api/products/:id/passive`
- `POST /api/products/:id/barcodes`
- `PATCH /api/products/:id/barcodes/:barcodeId/passive`
- `POST /api/products/:id/images`
- `GET /api/stock-movements`
- `GET /api/stock-valuation`
- `POST /api/stock-count/adjust`

### Customers

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `PATCH /api/customers/:id/passive`
- `GET /api/customer-movements`
- `GET /api/customer-statement`

### Suppliers

- `GET /api/suppliers`
- `POST /api/suppliers`
- `GET /api/suppliers/:id`
- `PUT /api/suppliers/:id`
- `GET /api/supplier-movements`
- `GET /api/supplier-statement`

### Sales and Purchase Invoices

- `GET /api/sales-invoices`
- `POST /api/sales-invoices/draft`
- `GET /api/sales-invoices/:id`
- `PUT /api/sales-invoices/:id/draft`
- `POST /api/sales-invoices/:id/finalize`
- `POST /api/sales-invoices/:id/cancel`
- `GET /api/purchase-invoices`
- `POST /api/purchase-invoices/draft`
- `GET /api/purchase-invoices/:id`
- `PUT /api/purchase-invoices/:id/draft`
- `POST /api/purchase-invoices/:id/finalize`
- `POST /api/purchase-invoices/:id/cancel`

### Sales Pipeline

- `GET /api/sales-offers`
- `POST /api/sales-offers`
- `GET /api/sales-offers/:id`
- `PUT /api/sales-offers/:id`
- `PATCH /api/sales-offers/:id/status`
- `POST /api/sales-offers/:id/convert-to-order`
- `GET /api/sales-orders`
- `POST /api/sales-orders`
- `GET /api/sales-orders/:id`
- `PUT /api/sales-orders/:id`
- `PATCH /api/sales-orders/:id/status`
- `POST /api/sales-orders/:id/convert-to-sales-draft`

### Finance

- `GET /api/finance/summary`
- `GET /api/finance/accounting-control`
- `GET /api/finance/document-number-fix-preview`
- `POST /api/finance/document-number-fix`
- `GET /api/finance/accounts`
- `POST /api/finance/accounts`
- `PATCH /api/finance/accounts/:id`
- `GET /api/finance/accounts/cleanup-preview`
- `POST /api/finance/accounts/cleanup`
- `POST /api/finance/accounts/standardize`
- `GET /api/finance/movements`
- `GET /api/finance/journal`
- `POST /api/finance/collections`
- `POST /api/finance/payments`

### Catalog and WhatsApp

- `GET /api/public/catalog-products`
- `GET /api/catalogs`
- `POST /api/catalogs/draft`
- `GET /api/catalogs/whatsapp-plan`
- `GET /api/catalogs/whatsapp-status`
- `POST /api/catalogs/whatsapp-send`

### Currency Rates

- `GET /api/currency-rates`
- `PUT /api/currency-rates`

### Import

- `POST /api/import/products/preview`
- `POST /api/import/products/commit`
- `POST /api/import/products/apply`
- `POST /api/import/customers/preview`
- `POST /api/import/customers/commit`
- `POST /api/import/customers/apply`
- `POST /api/import/suppliers/preview`
- `POST /api/import/suppliers/commit`
- `POST /api/import/suppliers/apply`

### Settings and Cleanup

- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/demo-cleanup/preview`
- `POST /api/settings/demo-cleanup/apply`
- `GET /api/settings/test-tree-cleanup/preview`
- `POST /api/settings/test-tree-cleanup/apply`
- `GET /api/settings/test-archive-restore/preview`
- `POST /api/settings/test-archive-restore/apply`

### Terminal

- `GET /api/terminal/products/search`
- `GET /api/terminal/products/barcode/:barcode`
- `GET /api/terminal/customers/search`
- `POST /api/terminal/sales/submit`
- `POST /api/terminal/whatsapp-share`
- `GET /api/terminal-admin/overview`

## 5. Existing UI Screens

The web admin workspace maps screens in `apps/web-admin/src/components/workspace/Workspace.jsx` and the menu registry in `apps/web-admin/src/data/mockNavigationData.js`.

Current routed web admin screens:

- Dashboard / Operation Desk
- Stock List
- Product Card
- Stock Movements
- Stock Valuation
- Stock Count
- Price List
- Customer List
- Customer Card
- Customer Movements
- Customer Statement
- Supplier List
- Supplier Card
- Supplier Movements
- Supplier Statement
- Sales Invoice
- Sales Invoice List
- Sales Offers List
- Sales Offer Card
- Sales Orders List
- Sales Order Card
- Purchase Invoice
- Bulk Purchase Entry
- Purchase Invoice List
- Finance Overview
- Collections / Payments Overview
- Cash Customer Tracking
- Cash / Bank Ledger
- Accounting Journal
- Accounting Control
- Catalog List
- WhatsApp Planner
- WhatsApp Web Queue
- Import Foundation
- Reports Overview / Management Reports
- Export Center
- Currency Rates
- System Settings
- Definitions
- Terminal Overview
- Auth and Audit Overview

The UI uses:

- tabbed workspace
- permission-gated route rendering
- desktop-first dense ERP layouts
- command/search style navigation
- reusable data tables and form suggestion inputs
- module-specific API service wrappers
- mock/demo fallback data in several places

## 6. Existing Services

### API Services

Backend service files:

- `auditService`
- `authAdminService`
- `authService`
- `catalogService`
- `cleanupService`
- `currencyRateService`
- `customerService`
- `dashboardService`
- `financeService`
- `importService`
- `invoiceDraftService`
- `mockDataService`
- `monitoringService`
- `movementService`
- `periodLockService`
- `permissionCatalog`
- `productService`
- `queryHelpers`
- `salesPipelineService`
- `settingsService`
- `sqlHealthService`
- `supplierService`
- `terminalAdminService`
- `terminalService`
- `writeGuardService`

### Web Admin Services

Frontend API wrapper files:

- `apiClient`
- `authApi`
- `authAdminApi`
- `catalogApi`
- `currencyRateApi`
- `customerApi`
- `customerDetailApi`
- `dashboardApi`
- `financeApi`
- `importApi`
- `invoiceDraftApi`
- `movementApi`
- `productApi`
- `productDetailApi`
- `salesPipelineApi`
- `settingsApi`
- `supplierApi`
- `terminalAdminApi`

### Terminal App Services

Terminal service files:

- `apiClient`
- `authService`
- `cacheService`
- `catalogService`
- `currencyRateService`
- `productImageService`
- `productService`
- `queueService`
- `sessionStorage`
- `shareService`
- `terminalSalesService`

## 7. Existing Architecture

### High-Level Architecture

The repository follows an API-first architecture:

```text
React Web Admin
       |
       | HTTP / JSON
       v
Express API
       |
       | mssql / msnodesqlv8
       v
SQL Server

Expo Terminal App ---- HTTP / JSON ----^
Electron Desktop Shell wraps/launches the web-admin experience
```

### Backend Architecture

- Express app is created in `apps/api/src/app.js`.
- Security middleware includes helmet, CORS, rate limiting and request context.
- `/uploads` is served as static local media.
- `/api` routes are composed in `routes/index.js`.
- Route files call controller functions.
- Controllers shape HTTP success/error responses.
- Services own business logic and SQL access.
- SQL access is centralized through `config/database.js`.
- Authentication uses JWT-style access/refresh flows with fallback open-admin behavior in frontend.
- Write protection is centralized through `writeGuardService`.
- Audit writing is centralized through `auditService`.

### Frontend Architecture

- React 19 + Vite.
- `App.jsx` handles session restore/login fallback.
- `AppShell` provides the ERP shell.
- `Workspace.jsx` maps screen IDs to real screen components and permission requirements.
- Each module has colocated screens/components.
- Each module talks to API through a small service wrapper under `src/services`.
- Search normalization exists in `utils/searchText.js`.
- UI styling is CSS-based with major styles in `erp-modern.css`, `layout.css`, `tables.css`, `dashboard.css`, and `base.css`.

### Terminal Architecture

- Expo app with screen-based navigation controlled in `App.js`.
- Services isolate API, cache, queue and session storage concerns.
- Terminal app is designed for barcode/product lookup, quick sale, collection and offline/sync workflows.

### Desktop Architecture

- Electron wrapper exists in `apps/desktop`.
- It is a shell, not a separate business logic layer.
- The API remains the authoritative business/data layer.

## 8. Missing Parts Compared to the Current Implementation

This section compares the implemented codebase against the documented ERP target and the current operational direction.

### Still Incomplete or Partially Implemented

- Full warehouse/depot-level inventory is not modeled; stock is effectively product-level.
- Terminal sync has sales submission and lookup endpoints, but a complete robust offline conflict dashboard, retry UI and sync queue administration flow are still limited.
- Audit exists, but not every important write path appears equally visible through a user-facing audit browser.
- Reporting is broad but still operational; deeper profitability, supplier performance, customer risk and period-close reports need consolidation.
- Catalog/WhatsApp workflows exist, but production WhatsApp sending depends on external service reliability and operational setup.
- Import flows exist for products/customers/suppliers, but rollback/preview UX and post-import reconciliation need stronger guided flows.
- Backup/reset tooling exists, but it should be exposed as a safer operator-facing workflow with clearer restore verification.
- Settings/definitions screens exist, but not all domain definitions are first-class editable reference tables.
- Electron shell exists, but full installer/update/shortcut lifecycle is not represented as source-controlled release automation.
- Some frontend text appears mojibake in source files, indicating encoding cleanup is still needed.
- `packages/` exists in the repo structure but appears underused relative to a shared UI/shared domain package plan.
- There are still mock/demo modules and mock screen data alongside live screens; the live/mock boundary should be made explicit.
- Product image upload and watermark tooling exists, but bulk image import/matching is currently script/manual workflow rather than a maintained product feature.

### Documentation vs Code Drift

- `README.md` still says the repo is a skeleton in parts, while the implementation is now much more advanced.
- Several architecture documents describe intended endpoints that are not exactly the same as implemented route names.
- Menu labels and registry names are older Turkish-encoded text in some source files.
- The stabilization roadmap and QA reports are useful, but the latest implemented changes should be reflected in a fresh release/status document.

### Operational Gaps

- No single documented "run everything locally" command that covers API, web-admin, Electron and terminal.
- No complete end-to-end automated smoke suite for the whole ERP path: login -> stock -> sales -> purchase -> finance -> reports.
- No source-controlled documentation for the recent local product image matching/import runs.
- Local database state contains important operational data that is not represented in GitHub by design; reviewers must understand that GitHub alone cannot show current DB media links.

## 9. Suggested Improvements

### Highest Priority

1. Update `README.md` to reflect the current implementation, not the old skeleton state.
2. Add a current `docs/erp-v2/current-status.md` that lists completed modules, partial modules, and known gaps.
3. Add a maintained "local runbook" covering API, web-admin, Electron, terminal app, DB backup and restore.
4. Formalize image matching/import as a documented script or admin workflow with dry-run, report and rollback support.
5. Add a whole-app smoke test checklist or automated script for the main ERP journey.

### Backend Improvements

- Add OpenAPI or endpoint reference generation from route files.
- Add service-level tests for invoice finalization, stock movement, average cost, finance collection/payment and supplier/customer statements.
- Add explicit audit coverage tests for critical write paths.
- Strengthen permission naming consistency: supplier routes currently reuse some customer permissions.
- Add clearer API error codes and validation response schemas for all write endpoints.
- Add a DB migration status table or documented migration application process.

### Frontend Improvements

- Remove or isolate demo/mock screens so operators do not confuse mock options with live ERP data.
- Continue responsive/density stabilization for different monitor sizes.
- Add route-level loading/error states consistently.
- Add safer empty states and "what to do next" actions for every list.
- Fix source text encoding/mojibake across UI files.
- Add a UI regression screenshot pass for key screens.

### Data and Reporting Improvements

- Add a product image coverage report by brand/category/supplier.
- Add reconciliation reports for stock cards without supplier, products without barcode, products without image and suspicious duplicate codes.
- Add import audit reports with before/after counts.
- Add period lock / month close operator screens if the business needs accounting discipline.

### Terminal and Desktop Improvements

- Expand terminal sync administration: failed queue items, retry, duplicate detection and device health.
- Add terminal field-test scripts into the central QA report.
- Create a repeatable Electron build/package process.
- Document LAN/IP setup and common startup failures for different computers.

### Documentation Improvements

- Keep architecture docs split, but add one "map" document linking:
  - route -> service -> table -> UI screen
  - screen -> permission -> endpoint
  - migration -> business feature
- Add ChatGPT/Codex review prompt including current branch link, module status and known DB-local limitations.
- Add a release checklist for "before push", "before operator test", and "before real business use".

