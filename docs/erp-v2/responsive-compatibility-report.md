# ERP Responsive Compatibility Report

## Supported Desktop Profile

- Primary resolution: `1920x1080` at 100% browser zoom.
- Safe scaled profile: `1920x1080` with Windows 125% scaling, approximated by a `1536px` CSS viewport.
- Compact fallback profiles: `1366x768` and `1280x720`.
- Dense tables keep their column widths and scroll inside the table wrapper. The document and workspace must not scroll horizontally.

## Verified Main Modules

The following module entry screens were measured at `1920x1080`:

- Operations Desk
- Stock
- Customer accounts
- Sales
- Purchases
- Finance
- Reports
- WhatsApp CRM
- Definitions
- Settings

All ten screens completed without document overflow, workspace overflow, or controls outside the viewport.

## Compact Desktop Findings

Testing also covered `1280x720` and a `1093x614` viewport that approximates a 1366-wide screen at 125% scaling.

Resolved findings:

- The top-right Exit action was outside the viewport at 1280px.
- Module labels forced the last modules behind horizontal scrolling on scaled laptops.
- Bulk Purchase Entry allowed discount and Add Row controls to leave the panel.

Compact behavior:

- Duplicate Simple/Detailed buttons move to the View menu.
- Module navigation switches to icon buttons with accessible names and hover tooltips.
- The secondary New Invoice action is hidden below 1100px; the main Sales workflow remains available.
- Bulk Purchase Entry collapses to three columns at 1280px and two columns below 1100px.

## Regression Gate

Run:

```powershell
cd apps/web-admin
npm.cmd run smoke:responsive-layout
npm.cmd run smoke:ux-regression
npm.cmd run build
```

Expected horizontal scrolling is limited to dense table wrappers and the open-tab strip.
