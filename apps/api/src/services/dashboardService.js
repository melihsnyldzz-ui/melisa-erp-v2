import sql from 'mssql';
import { getSqlPool } from '../config/database.js';

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toRecentSalesInvoice(row) {
  return {
    id: row.id,
    invoiceNo: row.document_no,
    customerName: row.customer_name || '-',
    currency: row.document_currency,
    totalAmountTry: numberValue(row.amount_try),
    totalAmount: numberValue(row.grand_total),
    status: String(row.status || '').toUpperCase(),
    itemCount: numberValue(row.item_count),
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
  };
}

function toRecentPurchaseInvoice(row) {
  return {
    id: row.id,
    invoiceNo: row.document_no,
    supplierName: row.supplier_name || '-',
    currency: row.document_currency,
    totalAmountTry: numberValue(row.amount_try),
    totalAmount: numberValue(row.grand_total),
    status: String(row.status || '').toUpperCase(),
    itemCount: numberValue(row.item_count),
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
  };
}

function toTopProduct(row) {
  return {
    productId: row.product_id,
    stockCode: row.stock_code,
    productName: row.product_name,
    quantity: numberValue(row.quantity),
    salesTry: numberValue(row.sales_try),
    stockQuantity: numberValue(row.stock_quantity),
  };
}

function toReceivable(row) {
  return {
    customerId: row.id,
    customerName: row.name,
    balanceTry: numberValue(row.balance),
    lastMove: row.last_move,
    risk: numberValue(row.balance) >= 100000 ? 'Yuksek' : 'Orta',
  };
}

function toSupplierPerformance(row) {
  return {
    supplierId: row.id,
    supplierName: row.name,
    openPurchases: numberValue(row.open_purchases),
    finalizedPurchases: numberValue(row.finalized_purchases),
    debtTry: numberValue(row.balance),
    lastPurchaseAt: row.last_purchase_at,
  };
}

async function fetchSummaryRows(pool) {
  const [
    salesToday,
    purchaseToday,
    stockValue,
    balances,
    draftCounts,
    recentSales,
    recentPurchases,
    topProducts,
    receivables,
    suppliers,
  ] = await Promise.all([
    pool.request().query(`
      SELECT
        COALESCE((
          SELECT SUM(amount_try)
          FROM dbo.sales_invoices
          WHERE status = N'finalized'
            AND document_date = CONVERT(date, SYSUTCDATETIME())
        ), 0) AS today_sales_try,
        COALESCE((
          SELECT SUM(sii.gross_profit_try)
          FROM dbo.sales_invoice_items sii
          INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
          WHERE si.status = N'finalized'
            AND si.document_date = CONVERT(date, SYSUTCDATETIME())
        ), 0) AS today_gross_profit_try,
        COALESCE((
          SELECT COUNT_BIG(1)
          FROM dbo.sales_invoices
          WHERE status = N'finalized'
            AND document_date = CONVERT(date, SYSUTCDATETIME())
        ), 0) AS finalized_sales_today;
    `),
    pool.request().query(`
      SELECT
        COUNT_BIG(1) AS finalized_purchases_today,
        COALESCE(SUM(amount_try), 0) AS today_purchases_try
      FROM dbo.purchase_invoices
      WHERE status = N'finalized'
        AND document_date = CONVERT(date, SYSUTCDATETIME());
    `),
    pool.request().query(`
      SELECT
        COALESCE(SUM(current_stock_qty * average_cost_try), 0) AS total_stock_value_try,
        COALESCE(SUM(CASE WHEN current_stock_qty < 0 THEN 1 ELSE 0 END), 0) AS negative_stock_count
      FROM dbo.products
      WHERE is_deleted = 0;
    `),
    pool.request().query(`
      SELECT
        COALESCE((SELECT SUM(balance) FROM dbo.customers WHERE is_deleted = 0 AND balance > 0), 0) AS customer_receivables_try,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.customers WHERE is_deleted = 0 AND balance > 0), 0) AS customer_balance_count,
        COALESCE((SELECT SUM(balance) FROM dbo.suppliers WHERE is_deleted = 0 AND balance > 0), 0) AS supplier_payables_try,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.suppliers WHERE is_deleted = 0 AND balance > 0), 0) AS supplier_balance_count;
    `),
    pool.request().query(`
      SELECT
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.sales_invoices WHERE status = N'draft'), 0) AS sales_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.purchase_invoices WHERE status = N'draft'), 0) AS purchase_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.terminal_sync_queue WHERE status IN (N'pending', N'failed')), 0) AS sync_warning_count;
    `),
    pool.request().query(`
      SELECT TOP (10)
        si.id,
        si.document_no,
        si.document_currency,
        si.grand_total,
        si.amount_try,
        si.status,
        si.created_at,
        si.finalized_at,
        c.name AS customer_name,
        item_counts.item_count
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.sales_invoice_items sii
        WHERE sii.sales_invoice_id = si.id
      ) item_counts
      ORDER BY si.created_at DESC, si.id DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        pi.id,
        pi.document_no,
        pi.document_currency,
        pi.grand_total,
        pi.amount_try,
        pi.status,
        pi.created_at,
        pi.finalized_at,
        s.name AS supplier_name,
        item_counts.item_count
      FROM dbo.purchase_invoices pi
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = pi.id
      ) item_counts
      ORDER BY pi.created_at DESC, pi.id DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        sii.product_id,
        sii.stock_code_snapshot AS stock_code,
        sii.product_name_snapshot AS product_name,
        COALESCE(SUM(sii.quantity), 0) AS quantity,
        COALESCE(SUM(sii.line_total * si.exchange_rate_snapshot), 0) AS sales_try,
        MAX(p.current_stock_qty) AS stock_quantity
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
      INNER JOIN dbo.products p ON p.id = sii.product_id
      WHERE si.status = N'finalized'
      GROUP BY sii.product_id, sii.stock_code_snapshot, sii.product_name_snapshot
      ORDER BY quantity DESC, sales_try DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        c.id,
        c.name,
        c.balance,
        last_move.last_move
      FROM dbo.customers c
      OUTER APPLY (
        SELECT MAX(cm.document_date) AS last_move
        FROM dbo.customer_movements cm
        WHERE cm.customer_id = c.id
      ) last_move
      WHERE c.is_deleted = 0
        AND c.balance > 0
      ORDER BY c.balance DESC, c.id DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        s.id,
        s.name,
        s.balance,
        COALESCE(open_counts.open_purchases, 0) AS open_purchases,
        COALESCE(final_counts.finalized_purchases, 0) AS finalized_purchases,
        last_purchase.last_purchase_at
      FROM dbo.suppliers s
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS open_purchases
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = s.id
          AND pi.status = N'draft'
      ) open_counts
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS finalized_purchases
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = s.id
          AND pi.status = N'finalized'
      ) final_counts
      OUTER APPLY (
        SELECT MAX(pi.created_at) AS last_purchase_at
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = s.id
      ) last_purchase
      WHERE s.is_deleted = 0
      ORDER BY s.balance DESC, s.id DESC;
    `),
  ]);

  return {
    salesToday: salesToday.recordset[0] || {},
    purchaseToday: purchaseToday.recordset[0] || {},
    stockValue: stockValue.recordset[0] || {},
    balances: balances.recordset[0] || {},
    draftCounts: draftCounts.recordset[0] || {},
    recentSales: recentSales.recordset || [],
    recentPurchases: recentPurchases.recordset || [],
    topProducts: topProducts.recordset || [],
    receivables: receivables.recordset || [],
    suppliers: suppliers.recordset || [],
  };
}

export async function getDashboardSummaryData() {
  const pool = await getSqlPool();
  const rows = await fetchSummaryRows(pool);

  return {
    patron: {
      todaySalesTry: numberValue(rows.salesToday.today_sales_try),
      todayGrossProfitTry: numberValue(rows.salesToday.today_gross_profit_try),
      totalStockValueTry: numberValue(rows.stockValue.total_stock_value_try),
      customerReceivablesTry: numberValue(rows.balances.customer_receivables_try),
      supplierPayablesTry: numberValue(rows.balances.supplier_payables_try),
      negativeStockCount: numberValue(rows.stockValue.negative_stock_count),
      finalizedSalesToday: numberValue(rows.salesToday.finalized_sales_today),
      finalizedPurchasesToday: numberValue(rows.purchaseToday.finalized_purchases_today),
    },
    accounting: {
      todayCollectionsTry: 0,
      todayPaymentsTry: 0,
      customerBalanceCount: numberValue(rows.balances.customer_balance_count),
      supplierBalanceCount: numberValue(rows.balances.supplier_balance_count),
      recentSalesInvoices: rows.recentSales.map(toRecentSalesInvoice),
      recentPurchaseInvoices: rows.recentPurchases.map(toRecentPurchaseInvoice),
    },
    operations: {
      salesDraftCount: numberValue(rows.draftCounts.sales_draft_count),
      purchaseDraftCount: numberValue(rows.draftCounts.purchase_draft_count),
      syncWarningCount: numberValue(rows.draftCounts.sync_warning_count),
      todayPurchasesTry: numberValue(rows.purchaseToday.today_purchases_try),
    },
    topProducts: rows.topProducts.map(toTopProduct),
    receivables: rows.receivables.map(toReceivable),
    supplierPerformance: rows.suppliers.map(toSupplierPerformance),
  };
}

export async function getDashboardAlertsData() {
  const pool = await getSqlPool();
  const [negativeStock, highReceivables, highPayables, draftCounts, syncWarnings] = await Promise.all([
    pool.request().query(`
      SELECT TOP (10)
        stock_code,
        name,
        current_stock_qty
      FROM dbo.products
      WHERE is_deleted = 0
        AND current_stock_qty < 0
      ORDER BY current_stock_qty ASC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        customer_code,
        name,
        balance
      FROM dbo.customers
      WHERE is_deleted = 0
        AND balance >= 100000
      ORDER BY balance DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        supplier_code,
        name,
        balance
      FROM dbo.suppliers
      WHERE is_deleted = 0
        AND balance >= 100000
      ORDER BY balance DESC;
    `),
    pool.request().query(`
      SELECT
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.sales_invoices WHERE status = N'draft'), 0) AS sales_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.purchase_invoices WHERE status = N'draft'), 0) AS purchase_draft_count;
    `),
    pool.request().query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = N'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
        COALESCE(SUM(CASE WHEN status = N'pending' THEN 1 ELSE 0 END), 0) AS pending_count
      FROM dbo.terminal_sync_queue;
    `),
  ]);

  const alerts = [];

  for (const row of negativeStock.recordset || []) {
    alerts.push({
      type: 'Eksi stok',
      subject: `${row.name} / ${row.stock_code}`,
      value: numberValue(row.current_stock_qty),
      owner: 'Stok',
      severity: 'danger',
    });
  }

  for (const row of highReceivables.recordset || []) {
    alerts.push({
      type: 'Bakiye yuksek musteri',
      subject: `${row.name} / ${row.customer_code}`,
      value: numberValue(row.balance),
      owner: 'Cari',
      severity: 'warn',
    });
  }

  for (const row of highPayables.recordset || []) {
    alerts.push({
      type: 'Tedarikci borcu',
      subject: `${row.name} / ${row.supplier_code}`,
      value: numberValue(row.balance),
      owner: 'Alis',
      severity: 'warn',
    });
  }

  const draftRow = draftCounts.recordset[0] || {};
  const salesDraftCount = numberValue(draftRow.sales_draft_count);
  const purchaseDraftCount = numberValue(draftRow.purchase_draft_count);

  if (salesDraftCount > 0) {
    alerts.push({
      type: 'Draft fis',
      subject: 'Satis taslaklari',
      value: salesDraftCount,
      owner: 'Satis',
      severity: 'info',
    });
  }

  if (purchaseDraftCount > 0) {
    alerts.push({
      type: 'Draft fis',
      subject: 'Alis taslaklari',
      value: purchaseDraftCount,
      owner: 'Alis',
      severity: 'info',
    });
  }

  const syncRow = syncWarnings.recordset[0] || {};
  const failedCount = numberValue(syncRow.failed_count);
  const pendingCount = numberValue(syncRow.pending_count);

  if (failedCount > 0) {
    alerts.push({
      type: 'Hatali terminal sync',
      subject: 'Terminal sync failed queue',
      value: failedCount,
      owner: 'Terminal',
      severity: 'danger',
    });
  }

  if (pendingCount > 0) {
    alerts.push({
      type: 'Sync bekleyen terminal kaydi',
      subject: 'Terminal sync pending queue',
      value: pendingCount,
      owner: 'Terminal',
      severity: 'warn',
    });
  }

  return alerts.slice(0, 30);
}
