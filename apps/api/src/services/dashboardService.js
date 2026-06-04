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
  const balanceTry = numberValue(row.balance_try ?? row.balance);
  return {
    customerId: row.id,
    customerName: row.name,
    balanceTry,
    lastMove: row.last_move,
    risk: balanceTry >= 100000 ? 'Yuksek' : 'Orta',
  };
}

function toSupplierPerformance(row) {
  return {
    supplierId: row.id,
    supplierName: row.name,
    openPurchases: numberValue(row.open_purchases),
    finalizedPurchases: numberValue(row.finalized_purchases),
    debtTry: numberValue(row.balance_try ?? row.balance),
    lastPurchaseAt: row.last_purchase_at,
  };
}

function toDailySalesSummary(row) {
  return {
    salesCount: numberValue(row.sales_count),
    salesAmountTry: numberValue(row.sales_amount_try),
    grossProfitTry: numberValue(row.gross_profit_try),
    cancelledSalesCount: numberValue(row.cancelled_sales_count),
    cancelledSalesAmountTry: numberValue(row.cancelled_sales_amount_try),
  };
}

function toDailyPurchaseSummary(row) {
  return {
    purchaseCount: numberValue(row.purchase_count),
    purchaseAmountTry: numberValue(row.purchase_amount_try),
    cancelledPurchaseCount: numberValue(row.cancelled_purchase_count),
    cancelledPurchaseAmountTry: numberValue(row.cancelled_purchase_amount_try),
  };
}

function toManagementTopProduct(row) {
  return {
    productId: row.product_id,
    stockCode: row.stock_code,
    productName: row.product_name,
    quantity: numberValue(row.quantity),
    revenueTry: numberValue(row.revenue_try),
    grossProfitTry: numberValue(row.gross_profit_try),
  };
}

function toCustomerAnalysis(row) {
  return {
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    totalSalesTry: numberValue(row.total_sales_try),
    balanceTry: numberValue(row.balance_try),
    lastSaleDate: row.last_sale_date,
  };
}

function toSupplierAnalysis(row) {
  return {
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    totalPurchasesTry: numberValue(row.total_purchases_try),
    balanceTry: numberValue(row.balance_try),
    lastPurchaseDate: row.last_purchase_date,
  };
}

function toCriticalWarning(row) {
  return {
    type: row.warning_type,
    subject: row.subject,
    value: numberValue(row.warning_value),
    severity: row.severity,
  };
}

function normalizeReportDate(value, fallback) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  return fallback;
}

function monthStartDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toCurrencyTotal(row) {
  return {
    currency: row.currency_code || row.document_currency || 'TRY',
    count: numberValue(row.row_count),
    amount: numberValue(row.amount),
    amountTry: numberValue(row.amount_try),
  };
}

function toBalanceTotal(row) {
  return {
    currency: row.currency_code || 'TRY',
    partyCount: numberValue(row.party_count),
    debit: numberValue(row.debit),
    credit: numberValue(row.credit),
    balance: numberValue(row.balance),
  };
}

function toDailyCashRow(row) {
  return {
    date: row.document_date,
    currency: row.currency_code || 'TRY',
    collections: numberValue(row.collections),
    payments: numberValue(row.payments),
    net: numberValue(row.net_amount),
  };
}

async function fetchSummaryRows(pool) {
  const [
    salesToday,
    purchaseToday,
    stockValue,
    balances,
    draftCounts,
    dailyFinance,
    masterCounts,
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
        COALESCE((
          SELECT SUM(c.balance * CASE WHEN c.currency_code = N'TRY' THEN 1 ELSE COALESCE(r.rate_to_try, 1) END)
          FROM dbo.customers c
          OUTER APPLY (
            SELECT TOP (1) rate_to_try
            FROM dbo.currency_rates cr
            WHERE cr.currency_code = c.currency_code
            ORDER BY cr.rate_date DESC, cr.id DESC
          ) r
          WHERE c.is_deleted = 0 AND c.balance > 0
        ), 0) AS customer_receivables_try,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.customers WHERE is_deleted = 0 AND balance > 0), 0) AS customer_balance_count,
        COALESCE((
          SELECT SUM(s.balance * CASE WHEN s.currency_code = N'TRY' THEN 1 ELSE COALESCE(r.rate_to_try, 1) END)
          FROM dbo.suppliers s
          OUTER APPLY (
            SELECT TOP (1) rate_to_try
            FROM dbo.currency_rates cr
            WHERE cr.currency_code = s.currency_code
            ORDER BY cr.rate_date DESC, cr.id DESC
          ) r
          WHERE s.is_deleted = 0 AND s.balance > 0
        ), 0) AS supplier_payables_try,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.suppliers WHERE is_deleted = 0 AND balance > 0), 0) AS supplier_balance_count;
    `),
    pool.request().query(`
      SELECT
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.sales_invoices WHERE status = N'draft'), 0) AS sales_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.purchase_invoices WHERE status = N'draft'), 0) AS purchase_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.terminal_sync_queue WHERE status IN (N'pending', N'failed')), 0) AS sync_warning_count;
    `),
    pool.request().query(`
      SELECT
        COALESCE((
          SELECT SUM(cm.amount * CASE WHEN cm.currency_code = N'TRY' THEN 1 ELSE COALESCE(r.rate_to_try, 1) END)
          FROM dbo.customer_movements cm
          OUTER APPLY (
            SELECT TOP (1) rate_to_try
            FROM dbo.currency_rates cr
            WHERE cr.currency_code = cm.currency_code
            ORDER BY cr.rate_date DESC, cr.id DESC
          ) r
          WHERE cm.movement_type = N'collection'
            AND cm.document_date = CONVERT(date, SYSUTCDATETIME())
        ), 0) AS today_collections_try,
        COALESCE((
          SELECT SUM(sm.amount * CASE WHEN sm.currency_code = N'TRY' THEN 1 ELSE COALESCE(r.rate_to_try, 1) END)
          FROM dbo.supplier_movements sm
          OUTER APPLY (
            SELECT TOP (1) rate_to_try
            FROM dbo.currency_rates cr
            WHERE cr.currency_code = sm.currency_code
            ORDER BY cr.rate_date DESC, cr.id DESC
          ) r
          WHERE sm.movement_type = N'payment'
            AND sm.document_date = CONVERT(date, SYSUTCDATETIME())
        ), 0) AS today_payments_try;
    `),
    pool.request().query(`
      SELECT
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.customers WHERE is_deleted = 0), 0) AS total_customers,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.products WHERE is_deleted = 0), 0) AS total_products,
        COALESCE((
          SELECT COUNT_BIG(1)
          FROM dbo.product_barcodes pb
          INNER JOIN dbo.products p ON p.id = pb.product_id
          WHERE p.is_deleted = 0
            AND p.is_active = 1
            AND pb.is_active = 1
        ), 0) AS active_barcoded_products;
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
        c.balance * CASE WHEN c.currency_code = N'TRY' THEN 1 ELSE COALESCE(rate.rate_to_try, 1) END AS balance_try,
        last_move.last_move
      FROM dbo.customers c
      OUTER APPLY (
        SELECT TOP (1) rate_to_try
        FROM dbo.currency_rates cr
        WHERE cr.currency_code = c.currency_code
        ORDER BY cr.rate_date DESC, cr.id DESC
      ) rate
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
        s.balance * CASE WHEN s.currency_code = N'TRY' THEN 1 ELSE COALESCE(rate.rate_to_try, 1) END AS balance_try,
        COALESCE(open_counts.open_purchases, 0) AS open_purchases,
        COALESCE(final_counts.finalized_purchases, 0) AS finalized_purchases,
        last_purchase.last_purchase_at
      FROM dbo.suppliers s
      OUTER APPLY (
        SELECT TOP (1) rate_to_try
        FROM dbo.currency_rates cr
        WHERE cr.currency_code = s.currency_code
        ORDER BY cr.rate_date DESC, cr.id DESC
      ) rate
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
    dailyFinance: dailyFinance.recordset[0] || {},
    masterCounts: masterCounts.recordset[0] || {},
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
      todayCollectionsTry: numberValue(rows.dailyFinance.today_collections_try),
      todayPaymentsTry: numberValue(rows.dailyFinance.today_payments_try),
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
    masterCounts: {
      totalCustomers: numberValue(rows.masterCounts.total_customers),
      totalProducts: numberValue(rows.masterCounts.total_products),
      activeBarcodedProducts: numberValue(rows.masterCounts.active_barcoded_products),
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

export async function getManagementReportingData() {
  const pool = await getSqlPool();
  const [
    dailySales,
    dailyPurchases,
    topProducts,
    customerAnalysis,
    supplierAnalysis,
    widgets,
    criticalWarnings,
  ] = await Promise.all([
    pool.request().query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN 1 ELSE 0 END), 0) AS sales_count,
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN amount_try ELSE 0 END), 0) AS sales_amount_try,
        COALESCE((
          SELECT SUM(sii.gross_profit_try)
          FROM dbo.sales_invoice_items sii
          INNER JOIN dbo.sales_invoices si2 ON si2.id = sii.sales_invoice_id
          WHERE si2.status = N'finalized'
            AND si2.document_date = CONVERT(date, SYSUTCDATETIME())
        ), 0) AS gross_profit_try,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_sales_count,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN amount_try ELSE 0 END), 0) AS cancelled_sales_amount_try
      FROM dbo.sales_invoices
      WHERE document_date = CONVERT(date, SYSUTCDATETIME());
    `),
    pool.request().query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN 1 ELSE 0 END), 0) AS purchase_count,
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN amount_try ELSE 0 END), 0) AS purchase_amount_try,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_purchase_count,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN amount_try ELSE 0 END), 0) AS cancelled_purchase_amount_try
      FROM dbo.purchase_invoices
      WHERE document_date = CONVERT(date, SYSUTCDATETIME());
    `),
    pool.request().query(`
      SELECT TOP (10)
        sii.product_id,
        sii.stock_code_snapshot AS stock_code,
        sii.product_name_snapshot AS product_name,
        COALESCE(SUM(sii.quantity), 0) AS quantity,
        COALESCE(SUM(sii.line_total * si.exchange_rate_snapshot), 0) AS revenue_try,
        COALESCE(SUM(sii.gross_profit_try), 0) AS gross_profit_try
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
      WHERE si.status = N'finalized'
      GROUP BY sii.product_id, sii.stock_code_snapshot, sii.product_name_snapshot
      ORDER BY quantity DESC, revenue_try DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        c.id AS customer_id,
        c.customer_code,
        c.name AS customer_name,
        COALESCE(sales_totals.total_sales_try, 0) AS total_sales_try,
        c.balance AS balance_try,
        sales_totals.last_sale_date
      FROM dbo.customers c
      OUTER APPLY (
        SELECT
          SUM(si.amount_try) AS total_sales_try,
          MAX(si.document_date) AS last_sale_date
        FROM dbo.sales_invoices si
        WHERE si.customer_id = c.id
          AND si.status = N'finalized'
      ) sales_totals
      WHERE c.is_deleted = 0
      ORDER BY COALESCE(sales_totals.total_sales_try, 0) DESC, ABS(c.balance) DESC, c.id DESC;
    `),
    pool.request().query(`
      SELECT TOP (10)
        s.id AS supplier_id,
        s.supplier_code,
        s.name AS supplier_name,
        COALESCE(purchase_totals.total_purchases_try, 0) AS total_purchases_try,
        s.balance * CASE WHEN s.currency_code = N'TRY' THEN 1 ELSE COALESCE(rate.rate_to_try, 1) END AS balance_try,
        purchase_totals.last_purchase_date
      FROM dbo.suppliers s
      OUTER APPLY (
        SELECT TOP (1) rate_to_try
        FROM dbo.currency_rates cr
        WHERE cr.currency_code = s.currency_code
        ORDER BY cr.rate_date DESC, cr.id DESC
      ) rate
      OUTER APPLY (
        SELECT
          SUM(pi.amount_try) AS total_purchases_try,
          MAX(pi.document_date) AS last_purchase_date
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = s.id
          AND pi.status = N'finalized'
      ) purchase_totals
      WHERE s.is_deleted = 0
      ORDER BY COALESCE(purchase_totals.total_purchases_try, 0) DESC, ABS(s.balance) DESC, s.id DESC;
    `),
    pool.request().query(`
      SELECT
        COALESCE((SELECT SUM(amount_try) FROM dbo.sales_invoices WHERE status = N'finalized' AND document_date = CONVERT(date, SYSUTCDATETIME())), 0) AS today_sales_try,
        COALESCE((SELECT SUM(amount_try) FROM dbo.purchase_invoices WHERE status = N'finalized' AND document_date = CONVERT(date, SYSUTCDATETIME())), 0) AS today_purchases_try,
        COALESCE((SELECT SUM(current_stock_qty * average_cost_try) FROM dbo.products WHERE is_deleted = 0), 0) AS total_stock_value_try,
        COALESCE((
          SELECT SUM(c.balance * CASE WHEN c.currency_code = N'TRY' THEN 1 ELSE COALESCE(r.rate_to_try, 1) END)
          FROM dbo.customers c
          OUTER APPLY (
            SELECT TOP (1) rate_to_try
            FROM dbo.currency_rates cr
            WHERE cr.currency_code = c.currency_code
            ORDER BY cr.rate_date DESC, cr.id DESC
          ) r
          WHERE c.is_deleted = 0
        ), 0) AS customer_balance_try,
        COALESCE((
          SELECT SUM(s.balance * CASE WHEN s.currency_code = N'TRY' THEN 1 ELSE COALESCE(r.rate_to_try, 1) END)
          FROM dbo.suppliers s
          OUTER APPLY (
            SELECT TOP (1) rate_to_try
            FROM dbo.currency_rates cr
            WHERE cr.currency_code = s.currency_code
            ORDER BY cr.rate_date DESC, cr.id DESC
          ) r
          WHERE s.is_deleted = 0
        ), 0) AS supplier_balance_try,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.products WHERE is_deleted = 0 AND current_stock_qty < 0), 0) AS negative_stock_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.sales_invoices WHERE status = N'draft'), 0) AS sales_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.purchase_invoices WHERE status = N'draft'), 0) AS purchase_draft_count;
    `),
    pool.request().query(`
      SELECT TOP (20)
        warning_type,
        subject,
        warning_value,
        severity
      FROM (
        SELECT
          N'negative_stock' AS warning_type,
          CONCAT(p.stock_code, N' / ', p.name) AS subject,
          CAST(p.current_stock_qty AS DECIMAL(18, 4)) AS warning_value,
          N'danger' AS severity
        FROM dbo.products p
        WHERE p.is_deleted = 0
          AND p.current_stock_qty < 0

        UNION ALL

        SELECT
          N'customer_balance' AS warning_type,
          CONCAT(c.customer_code, N' / ', c.name) AS subject,
          CAST(c.balance AS DECIMAL(18, 4)) AS warning_value,
          N'warn' AS severity
        FROM dbo.customers c
        WHERE c.is_deleted = 0
          AND c.balance >= 100000

        UNION ALL

        SELECT
          N'supplier_balance' AS warning_type,
          CONCAT(s.supplier_code, N' / ', s.name) AS subject,
          CAST(s.balance AS DECIMAL(18, 4)) AS warning_value,
          N'warn' AS severity
        FROM dbo.suppliers s
        WHERE s.is_deleted = 0
          AND s.balance >= 100000
      ) warnings
      ORDER BY
        CASE severity WHEN N'danger' THEN 1 WHEN N'warn' THEN 2 ELSE 3 END,
        ABS(warning_value) DESC;
    `),
  ]);

  const widgetRow = widgets.recordset?.[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    dailySales: toDailySalesSummary(dailySales.recordset?.[0] || {}),
    dailyPurchases: toDailyPurchaseSummary(dailyPurchases.recordset?.[0] || {}),
    topProducts: (topProducts.recordset || []).map(toManagementTopProduct),
    customerAnalysis: (customerAnalysis.recordset || []).map(toCustomerAnalysis),
    supplierAnalysis: (supplierAnalysis.recordset || []).map(toSupplierAnalysis),
    widgets: {
      todaySalesTry: numberValue(widgetRow.today_sales_try),
      todayPurchasesTry: numberValue(widgetRow.today_purchases_try),
      totalStockValueTry: numberValue(widgetRow.total_stock_value_try),
      customerBalanceTry: numberValue(widgetRow.customer_balance_try),
      supplierBalanceTry: numberValue(widgetRow.supplier_balance_try),
      negativeStockCount: numberValue(widgetRow.negative_stock_count),
      salesDraftCount: numberValue(widgetRow.sales_draft_count),
      purchaseDraftCount: numberValue(widgetRow.purchase_draft_count),
    },
    criticalWarnings: (criticalWarnings.recordset || []).map(toCriticalWarning),
  };
}

export async function getPeriodicAccountingData(query = {}) {
  const dateFrom = normalizeReportDate(query.dateFrom, monthStartDate());
  const dateTo = normalizeReportDate(query.dateTo, todayDate());
  const pool = await getSqlPool();

  const [
    salesByCurrency,
    purchasesByCurrency,
    financeByCurrency,
    dailyCash,
    customerBalances,
    supplierBalances,
    widgets,
  ] = await Promise.all([
    pool.request()
      .input('periodSalesFrom', sql.Date, dateFrom)
      .input('periodSalesTo', sql.Date, dateTo)
      .query(`
        SELECT
          document_currency AS currency_code,
          COUNT_BIG(1) AS row_count,
          COALESCE(SUM(grand_total), 0) AS amount,
          COALESCE(SUM(amount_try), 0) AS amount_try
        FROM dbo.sales_invoices
        WHERE status = N'finalized'
          AND document_date >= @periodSalesFrom
          AND document_date <= @periodSalesTo
        GROUP BY document_currency
        ORDER BY document_currency;
      `),
    pool.request()
      .input('periodPurchaseFrom', sql.Date, dateFrom)
      .input('periodPurchaseTo', sql.Date, dateTo)
      .query(`
        SELECT
          document_currency AS currency_code,
          COUNT_BIG(1) AS row_count,
          COALESCE(SUM(grand_total), 0) AS amount,
          COALESCE(SUM(amount_try), 0) AS amount_try
        FROM dbo.purchase_invoices
        WHERE status = N'finalized'
          AND document_date >= @periodPurchaseFrom
          AND document_date <= @periodPurchaseTo
        GROUP BY document_currency
        ORDER BY document_currency;
      `),
    pool.request()
      .input('periodFinanceFrom', sql.Date, dateFrom)
      .input('periodFinanceTo', sql.Date, dateTo)
      .query(`
        WITH finance_rows AS (
          SELECT currency_code, amount, N'collection' AS movement_type
          FROM dbo.customer_movements
          WHERE movement_type = N'collection'
            AND document_date >= @periodFinanceFrom
            AND document_date <= @periodFinanceTo
          UNION ALL
          SELECT currency_code, amount, N'payment' AS movement_type
          FROM dbo.supplier_movements
          WHERE movement_type = N'payment'
            AND document_date >= @periodFinanceFrom
            AND document_date <= @periodFinanceTo
        )
        SELECT
          currency_code,
          COUNT_BIG(1) AS row_count,
          COALESCE(SUM(CASE WHEN movement_type = N'collection' THEN amount ELSE -amount END), 0) AS amount,
          COALESCE(SUM(CASE WHEN movement_type = N'collection' THEN amount ELSE -amount END), 0) AS amount_try
        FROM finance_rows
        GROUP BY currency_code
        ORDER BY currency_code;
      `),
    pool.request()
      .input('periodCashFrom', sql.Date, dateFrom)
      .input('periodCashTo', sql.Date, dateTo)
      .query(`
        WITH cash_rows AS (
          SELECT document_date, currency_code, amount AS collection_amount, CAST(0 AS DECIMAL(18,4)) AS payment_amount
          FROM dbo.customer_movements
          WHERE movement_type = N'collection'
            AND document_date >= @periodCashFrom
            AND document_date <= @periodCashTo
          UNION ALL
          SELECT document_date, currency_code, CAST(0 AS DECIMAL(18,4)), amount
          FROM dbo.supplier_movements
          WHERE movement_type = N'payment'
            AND document_date >= @periodCashFrom
            AND document_date <= @periodCashTo
        )
        SELECT TOP (40)
          document_date,
          currency_code,
          COALESCE(SUM(collection_amount), 0) AS collections,
          COALESCE(SUM(payment_amount), 0) AS payments,
          COALESCE(SUM(collection_amount - payment_amount), 0) AS net_amount
        FROM cash_rows
        GROUP BY document_date, currency_code
        ORDER BY document_date DESC, currency_code ASC;
      `),
    pool.request().query(`
      SELECT
        currency_code,
        COUNT_BIG(1) AS party_count,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS credit,
        COALESCE(SUM(balance), 0) AS balance
      FROM dbo.customers
      WHERE is_deleted = 0
      GROUP BY currency_code
      ORDER BY currency_code;
    `),
    pool.request().query(`
      SELECT
        currency_code,
        COUNT_BIG(1) AS party_count,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS credit,
        COALESCE(SUM(balance), 0) AS balance
      FROM dbo.suppliers
      WHERE is_deleted = 0
      GROUP BY currency_code
      ORDER BY currency_code;
    `),
    pool.request()
      .input('periodWidgetFrom', sql.Date, dateFrom)
      .input('periodWidgetTo', sql.Date, dateTo)
      .query(`
        SELECT
          COALESCE((SELECT SUM(amount_try) FROM dbo.sales_invoices WHERE status = N'finalized' AND document_date >= @periodWidgetFrom AND document_date <= @periodWidgetTo), 0) AS sales_try,
          COALESCE((SELECT SUM(amount_try) FROM dbo.purchase_invoices WHERE status = N'finalized' AND document_date >= @periodWidgetFrom AND document_date <= @periodWidgetTo), 0) AS purchases_try,
          COALESCE((SELECT SUM(amount) FROM dbo.customer_movements WHERE movement_type = N'collection' AND document_date >= @periodWidgetFrom AND document_date <= @periodWidgetTo), 0) AS collections,
          COALESCE((SELECT SUM(amount) FROM dbo.supplier_movements WHERE movement_type = N'payment' AND document_date >= @periodWidgetFrom AND document_date <= @periodWidgetTo), 0) AS payments,
          COALESCE((SELECT SUM(current_balance) FROM dbo.finance_accounts WHERE is_active = 1 AND currency_code = N'TRY'), 0) AS cash_bank_try,
          COALESCE((SELECT SUM(balance) FROM dbo.customers WHERE is_deleted = 0), 0) AS customer_balance,
          COALESCE((SELECT SUM(balance) FROM dbo.suppliers WHERE is_deleted = 0), 0) AS supplier_balance;
      `),
  ]);

  const widgetRow = widgets.recordset?.[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    dateFrom,
    dateTo,
    widgets: {
      salesTry: numberValue(widgetRow.sales_try),
      purchasesTry: numberValue(widgetRow.purchases_try),
      collections: numberValue(widgetRow.collections),
      payments: numberValue(widgetRow.payments),
      netCash: numberValue(widgetRow.collections) - numberValue(widgetRow.payments),
      cashBankTry: numberValue(widgetRow.cash_bank_try),
      customerBalance: numberValue(widgetRow.customer_balance),
      supplierBalance: numberValue(widgetRow.supplier_balance),
    },
    salesByCurrency: (salesByCurrency.recordset || []).map(toCurrencyTotal),
    purchasesByCurrency: (purchasesByCurrency.recordset || []).map(toCurrencyTotal),
    financeByCurrency: (financeByCurrency.recordset || []).map(toCurrencyTotal),
    dailyCash: (dailyCash.recordset || []).map(toDailyCashRow),
    customerBalances: (customerBalances.recordset || []).map(toBalanceTotal),
    supplierBalances: (supplierBalances.recordset || []).map(toBalanceTotal),
  };
}
