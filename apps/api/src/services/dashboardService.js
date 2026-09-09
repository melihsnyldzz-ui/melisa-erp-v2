import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { reportBalanceCtes, nullableReportAmount, sumReportAmounts, reportBalanceFields, reportConversion, historicalFinanceSummary } from './reportMoney.js';

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
  const balanceTry = nullableReportAmount(row.balance_try);
  return {
    customerId: row.id,
    customerName: row.name,
    ...reportBalanceFields(row),
    lastMove: row.last_move,
    risk: balanceTry === null ? 'Kur eksik' : balanceTry >= 100000 ? 'Yuksek' : 'Orta',
  };
}

function toSupplierPerformance(row) {
  return {
    supplierId: row.id,
    supplierName: row.name,
    openPurchases: numberValue(row.open_purchases),
    finalizedPurchases: numberValue(row.finalized_purchases),
    ...reportBalanceFields(row),
    debtTry: nullableReportAmount(row.balance_try),
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
    ...reportBalanceFields(row),
    lastSaleDate: row.last_sale_date,
  };
}

function toSupplierAnalysis(row) {
  return {
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    totalPurchasesTry: numberValue(row.total_purchases_try),
    ...reportBalanceFields(row),
    lastPurchaseDate: row.last_purchase_date,
  };
}

function toCriticalWarning(row) {
  return {
    type: row.warning_type,
    subject: row.subject,
    value: nullableReportAmount(row.warning_value),
    currency: row.currency_code || null,
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
    amountTry: nullableReportAmount(row.amount_try),
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

async function fetchSummaryRows(pool, asOfDate) {
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      SELECT
        COALESCE((
          SELECT SUM(amount_try)
          FROM dbo.sales_invoices
          WHERE status = N'finalized'
            AND document_date = @reportAsOf
        ), 0) AS today_sales_try,
        COALESCE((
          SELECT SUM(sii.gross_profit_try)
          FROM dbo.sales_invoice_items sii
          INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
          WHERE si.status = N'finalized'
            AND si.document_date = @reportAsOf
        ), 0) AS today_gross_profit_try,
        COALESCE((
          SELECT COUNT_BIG(1)
          FROM dbo.sales_invoices
          WHERE status = N'finalized'
            AND document_date = @reportAsOf
        ), 0) AS finalized_sales_today;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      SELECT
        COUNT_BIG(1) AS finalized_purchases_today,
        COALESCE(SUM(amount_try), 0) AS today_purchases_try
      FROM dbo.purchase_invoices
      WHERE status = N'finalized'
        AND document_date = @reportAsOf;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      SELECT
        COALESCE(SUM(current_stock_qty * average_cost_try), 0) AS total_stock_value_try,
        COALESCE(SUM(CASE WHEN current_stock_qty < 0 THEN 1 ELSE 0 END), 0) AS negative_stock_count
      FROM dbo.products
      WHERE is_deleted = 0;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT
        (SELECT CASE WHEN COUNT_BIG(*)=COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try),0) END FROM report_customers WHERE balance>0) AS customer_receivables_try,
        (SELECT COUNT_BIG(*) FROM report_customers WHERE balance>0) AS customer_balance_count,
        (SELECT CASE WHEN COUNT_BIG(*)=COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try),0) END FROM report_suppliers WHERE balance>0) AS supplier_payables_try,
        (SELECT COUNT_BIG(*) FROM report_suppliers WHERE balance>0) AS supplier_balance_count,
        CASE WHEN EXISTS (SELECT 1 FROM report_customers WHERE balance>0 AND balance_try IS NULL) THEN NULL
          ELSE (SELECT COALESCE(SUM(balance_try),0) FROM (SELECT TOP (20) balance_try FROM report_customers WHERE balance>0 ORDER BY balance_try DESC,id DESC) top_twenty) END AS top_twenty_receivables_try;
      ${reportBalanceCtes}
      SELECT N'customer' AS party,currency_code,SUM(balance) AS balance,
        CASE WHEN COUNT_BIG(*)=COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try),0) END AS balance_try,
        SUM(CASE WHEN balance_try IS NULL THEN 1 ELSE 0 END) AS missing_count,
        MAX(rate_to_try) AS rate_to_try,MAX(rate_date) AS rate_date
      FROM report_customers WHERE balance>0 GROUP BY currency_code
      UNION ALL
      SELECT N'supplier',currency_code,SUM(balance),
        CASE WHEN COUNT_BIG(*)=COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try),0) END,
        SUM(CASE WHEN balance_try IS NULL THEN 1 ELSE 0 END),MAX(rate_to_try),MAX(rate_date)
      FROM report_suppliers WHERE balance>0 GROUP BY currency_code;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      SELECT
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.sales_invoices WHERE status = N'draft'), 0) AS sales_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.purchase_invoices WHERE status = N'draft'), 0) AS purchase_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.terminal_sync_queue WHERE status IN (N'pending', N'failed')), 0) AS sync_warning_count;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      WITH daily_finance AS (
        SELECT currency_code,amount,N'collection' AS movement_type FROM dbo.customer_movements WHERE movement_type=N'collection' AND document_date=@reportAsOf
        UNION ALL
        SELECT currency_code,amount,N'payment' FROM dbo.supplier_movements WHERE movement_type=N'payment' AND document_date=@reportAsOf
      )
      SELECT currency_code,
        SUM(CASE WHEN movement_type=N'collection' THEN amount ELSE 0 END) AS collections,
        SUM(CASE WHEN movement_type=N'payment' THEN amount ELSE 0 END) AS payments,
        SUM(CASE WHEN movement_type=N'collection' THEN ABS(amount) ELSE 0 END) AS collection_activity,
        SUM(CASE WHEN movement_type=N'payment' THEN ABS(amount) ELSE 0 END) AS payment_activity
      FROM daily_finance GROUP BY currency_code;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (10)
        c.id,
        c.name,
        c.balance,
        c.balance_try, c.currency_code, c.rate_to_try, c.rate_date,
        last_move.last_move
      FROM report_customers c
      OUTER APPLY (
        SELECT MAX(cm.document_date) AS last_move
        FROM dbo.customer_movements cm
        WHERE cm.customer_id = c.id
      ) last_move
      WHERE c.is_deleted = 0
        AND c.balance > 0
      ORDER BY CASE WHEN c.balance_try IS NULL THEN 0 ELSE 1 END, c.balance_try DESC, c.id DESC;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (10)
        s.id,
        s.name,
        s.balance,
        s.balance_try, s.currency_code, s.rate_to_try, s.rate_date,
        COALESCE(open_counts.open_purchases, 0) AS open_purchases,
        COALESCE(final_counts.finalized_purchases, 0) AS finalized_purchases,
        last_purchase.last_purchase_at
      FROM report_suppliers s
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
      ORDER BY CASE WHEN s.balance_try IS NULL THEN 0 ELSE 1 END, s.balance_try DESC, s.id DESC;
    `),
  ]);

  return {
    salesToday: salesToday.recordset[0] || {},
    purchaseToday: purchaseToday.recordset[0] || {},
    stockValue: stockValue.recordset[0] || {},
    balances: balances.recordset[0] || {},
    dailyFinance: historicalFinanceSummary(dailyFinance.recordset || []),
    conversion: reportConversion(balances.recordsets[1] || [], asOfDate),
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
  const asOfDate = todayDate();
  const rows = await fetchSummaryRows(pool, asOfDate);
  const top20 = nullableReportAmount(rows.balances.top_twenty_receivables_try);
  const receivablesTry = nullableReportAmount(rows.balances.customer_receivables_try);

  return {
    generatedAt: new Date().toISOString(),
    period: 'today',
    conversion: rows.conversion,
    financeConversion: { ratePolicy: 'TRANSACTION_SNAPSHOT_ONLY', missingSnapshotCurrencies: rows.dailyFinance.missingSnapshotCurrencies },
    financeCurrencySummary: rows.dailyFinance.currencySummary,
    melisa: {
      top20ReceivablesTry: top20,
      top20ReceivableShare: top20 === null || receivablesTry === null ? null : receivablesTry > 0 ? (top20 / receivablesTry) * 100 : 0,
      top20ReceivableCount: Math.min(20, numberValue(rows.balances.customer_balance_count)),
    },
    patron: {
      todaySalesTry: numberValue(rows.salesToday.today_sales_try),
      todayGrossProfitTry: numberValue(rows.salesToday.today_gross_profit_try),
      totalStockValueTry: numberValue(rows.stockValue.total_stock_value_try),
      customerReceivablesTry: receivablesTry,
      supplierPayablesTry: nullableReportAmount(rows.balances.supplier_payables_try),
      negativeStockCount: numberValue(rows.stockValue.negative_stock_count),
      finalizedSalesToday: numberValue(rows.salesToday.finalized_sales_today),
      finalizedPurchasesToday: numberValue(rows.purchaseToday.finalized_purchases_today),
    },
    accounting: {
      todayCollectionsTry: rows.dailyFinance.collections,
      todayPaymentsTry: rows.dailyFinance.payments,
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
  const asOfDate = todayDate();
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (10)
        customer_code,
        name,
        balance, balance_try, currency_code
      FROM report_customers
      WHERE is_deleted = 0
        AND (balance_try >= 100000 OR (balance > 0 AND balance_try IS NULL))
      ORDER BY CASE WHEN balance_try IS NULL THEN 0 ELSE 1 END, balance_try DESC, id DESC;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (10)
        supplier_code,
        name,
        balance, balance_try, currency_code
      FROM report_suppliers
      WHERE is_deleted = 0
        AND (balance_try >= 100000 OR (balance > 0 AND balance_try IS NULL))
      ORDER BY CASE WHEN balance_try IS NULL THEN 0 ELSE 1 END, balance_try DESC, id DESC;
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
      type: row.balance_try === null ? 'Müşteri kuru eksik' : 'Bakiye yuksek musteri',
      subject: `${row.name} / ${row.customer_code}`,
      value: row.balance_try === null ? numberValue(row.balance) : numberValue(row.balance_try),
      currency: row.balance_try === null ? row.currency_code : 'TRY',
      owner: 'Cari',
      severity: 'warn',
    });
  }

  for (const row of highPayables.recordset || []) {
    alerts.push({
      type: row.balance_try === null ? 'Tedarikçi kuru eksik' : 'Tedarikci borcu',
      subject: `${row.name} / ${row.supplier_code}`,
      value: row.balance_try === null ? numberValue(row.balance) : numberValue(row.balance_try),
      currency: row.balance_try === null ? row.currency_code : 'TRY',
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
  const asOfDate = todayDate();
  const [
    dailySales,
    dailyPurchases,
    topProducts,
    customerAnalysis,
    supplierAnalysis,
    widgets,
    criticalWarnings,
    balanceCurrencies,
  ] = await Promise.all([
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN 1 ELSE 0 END), 0) AS sales_count,
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN amount_try ELSE 0 END), 0) AS sales_amount_try,
        COALESCE((
          SELECT SUM(sii.gross_profit_try)
          FROM dbo.sales_invoice_items sii
          INNER JOIN dbo.sales_invoices si2 ON si2.id = sii.sales_invoice_id
          WHERE si2.status = N'finalized'
            AND si2.document_date = @reportAsOf
        ), 0) AS gross_profit_try,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_sales_count,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN amount_try ELSE 0 END), 0) AS cancelled_sales_amount_try
      FROM dbo.sales_invoices
      WHERE document_date = @reportAsOf;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN 1 ELSE 0 END), 0) AS purchase_count,
        COALESCE(SUM(CASE WHEN status = N'finalized' THEN amount_try ELSE 0 END), 0) AS purchase_amount_try,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_purchase_count,
        COALESCE(SUM(CASE WHEN status = N'cancelled' THEN amount_try ELSE 0 END), 0) AS cancelled_purchase_amount_try
      FROM dbo.purchase_invoices
      WHERE document_date = @reportAsOf;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (10)
        c.id AS customer_id,
        c.customer_code,
        c.name AS customer_name,
        COALESCE(sales_totals.total_sales_try, 0) AS total_sales_try,
        c.balance, c.currency_code, c.balance_try, c.rate_to_try, c.rate_date,
        sales_totals.last_sale_date
      FROM report_customers c
      OUTER APPLY (
        SELECT
          SUM(si.amount_try) AS total_sales_try,
          MAX(si.document_date) AS last_sale_date
        FROM dbo.sales_invoices si
        WHERE si.customer_id = c.id
          AND si.status = N'finalized'
      ) sales_totals
      WHERE c.is_deleted = 0
      ORDER BY COALESCE(sales_totals.total_sales_try, 0) DESC, ABS(c.balance_try) DESC, c.id DESC;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (10)
        s.id AS supplier_id,
        s.supplier_code,
        s.name AS supplier_name,
        COALESCE(purchase_totals.total_purchases_try, 0) AS total_purchases_try,
        s.balance, s.currency_code, s.balance_try, s.rate_to_try, s.rate_date,
        purchase_totals.last_purchase_date
      FROM report_suppliers s
      OUTER APPLY (
        SELECT
          SUM(pi.amount_try) AS total_purchases_try,
          MAX(pi.document_date) AS last_purchase_date
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = s.id
          AND pi.status = N'finalized'
      ) purchase_totals
      WHERE s.is_deleted = 0
      ORDER BY COALESCE(purchase_totals.total_purchases_try, 0) DESC, ABS(s.balance_try) DESC, s.id DESC;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT
        COALESCE((SELECT SUM(amount_try) FROM dbo.sales_invoices WHERE status = N'finalized' AND document_date = @reportAsOf), 0) AS today_sales_try,
        COALESCE((SELECT SUM(amount_try) FROM dbo.purchase_invoices WHERE status = N'finalized' AND document_date = @reportAsOf), 0) AS today_purchases_try,
        COALESCE((SELECT SUM(current_stock_qty * average_cost_try) FROM dbo.products WHERE is_deleted = 0), 0) AS total_stock_value_try,
        (SELECT CASE WHEN COUNT_BIG(*) = COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try), 0) END FROM report_customers) AS customer_balance_try,
        (SELECT CASE WHEN COUNT_BIG(*) = COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try), 0) END FROM report_suppliers) AS supplier_balance_try,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.products WHERE is_deleted = 0 AND current_stock_qty < 0), 0) AS negative_stock_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.sales_invoices WHERE status = N'draft'), 0) AS sales_draft_count,
        COALESCE((SELECT COUNT_BIG(1) FROM dbo.purchase_invoices WHERE status = N'draft'), 0) AS purchase_draft_count;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT TOP (20)
        warning_type,
        subject,
        warning_value,
        currency_code,
        severity
      FROM (
        SELECT
          N'negative_stock' AS warning_type,
          CONCAT(p.stock_code, N' / ', p.name) AS subject,
          CAST(p.current_stock_qty AS DECIMAL(18, 4)) AS warning_value,
          CAST(NULL AS NVARCHAR(3)) AS currency_code,
          N'danger' AS severity
        FROM dbo.products p
        WHERE p.is_deleted = 0
          AND p.current_stock_qty < 0

        UNION ALL

        SELECT
          N'customer_balance' AS warning_type,
          CONCAT(c.customer_code, N' / ', c.name) AS subject,
          CAST(c.balance_try AS DECIMAL(18, 4)) AS warning_value,
          N'TRY' AS currency_code,
          N'warn' AS severity
        FROM report_customers c
        WHERE c.is_deleted = 0
          AND c.balance_try >= 100000

        UNION ALL

        SELECT
          N'supplier_balance' AS warning_type,
          CONCAT(s.supplier_code, N' / ', s.name) AS subject,
          CAST(s.balance_try AS DECIMAL(18, 4)) AS warning_value,
          N'TRY' AS currency_code,
          N'warn' AS severity
        FROM report_suppliers s
        WHERE s.is_deleted = 0
          AND s.balance_try >= 100000
      ) warnings
      ORDER BY
        CASE severity WHEN N'danger' THEN 1 WHEN N'warn' THEN 2 ELSE 3 END,
        ABS(warning_value) DESC;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT N'customer' AS party, currency_code, SUM(balance) AS balance,
        CASE WHEN COUNT_BIG(*) = COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try), 0) END AS balance_try,
        SUM(CASE WHEN balance_try IS NULL THEN 1 ELSE 0 END) AS missing_count,
        MAX(rate_to_try) AS rate_to_try, MAX(rate_date) AS rate_date
      FROM report_customers GROUP BY currency_code
      UNION ALL
      SELECT N'supplier', currency_code, SUM(balance),
        CASE WHEN COUNT_BIG(*) = COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try), 0) END,
        SUM(CASE WHEN balance_try IS NULL THEN 1 ELSE 0 END), MAX(rate_to_try), MAX(rate_date)
      FROM report_suppliers GROUP BY currency_code;
    `),
  ]);

  const widgetRow = widgets.recordset?.[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    conversion: reportConversion(balanceCurrencies.recordset || [], asOfDate),
    assumptions: [
      'Yönetim raporları operasyonel ERP karar desteğidir; resmî muhasebe çıktısı değildir.',
      'Satış ve alış toplamları yalnız kesinleşmiş belgeleri içerir; iptal ve taslak belgeler ilgili yerlerde ayrı gösterilir.',
      'Müşteri ve tedarikçi bakiyeleri ERP kartları ile hareket etkilerinden gelir; içe aktarılan açılış bakiyeleri ayrıca ticari mutabakat gerektirir.',
      'Güncel kart bakiyeleri rapor gününe kadar kaydedilmiş son kurla TRY değerlenir; eksik/geçersiz kurda toplam hesaplanamaz. Fişlerin tarihsel TRY tutarları değişmez.',
      'Raporun hızlı ve denetlenebilir kalması için ürün, müşteri, tedarikçi ve uyarı listeleri belirli sayıda kayıtla sınırlandırılır.',
    ],
    dataQuality: {
      source: 'SQL Server salt okunur SELECT özetleri',
      reviewRequired: [
        'Tahsilat, ödeme veya satın alma kararından önce yüksek müşteri ve tedarikçi bakiyeleri ekstrelerle karşılaştırılmalıdır.',
        'Satın alma kararında kullanmadan önce eksi stoklar ve ortalama maliyete dayalı stok değeri işletme tarafından kontrol edilmelidir.',
        'Tedarikçi performansı; ürün eşlemesi, alış geçmişi ve satış kârlılığı birlikte incelenene kadar yön gösteren bir veridir.',
      ],
      rowLimits: {
        topProducts: 10,
        customerAnalysis: 10,
        supplierAnalysis: 10,
        criticalWarnings: 20,
      },
      approvalBoundaries: [
        'Bu raporun API uçları veritabanına yazma, şema güncelleme, temizlik, sıfırlama, yedekleme, geri yükleme, yayınlama veya dış mesaj gönderme işlemi çalıştırmaz.',
        'Resmî muhasebe, vergi ve ödeme kararları bu operasyonel rapor dışında insan kontrolü gerektirir.',
      ],
    },
    dailySales: toDailySalesSummary(dailySales.recordset?.[0] || {}),
    dailyPurchases: toDailyPurchaseSummary(dailyPurchases.recordset?.[0] || {}),
    topProducts: (topProducts.recordset || []).map(toManagementTopProduct),
    customerAnalysis: (customerAnalysis.recordset || []).map(toCustomerAnalysis),
    supplierAnalysis: (supplierAnalysis.recordset || []).map(toSupplierAnalysis),
    widgets: {
      todaySalesTry: numberValue(widgetRow.today_sales_try),
      todayPurchasesTry: numberValue(widgetRow.today_purchases_try),
      totalStockValueTry: numberValue(widgetRow.total_stock_value_try),
      customerBalanceTry: nullableReportAmount(widgetRow.customer_balance_try),
      supplierBalanceTry: nullableReportAmount(widgetRow.supplier_balance_try),
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
  const asOfDate = todayDate();

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
          CASE WHEN currency_code = N'TRY' OR SUM(ABS(amount)) = 0 THEN COALESCE(SUM(CASE WHEN movement_type = N'collection' THEN amount ELSE -amount END), 0) END AS amount_try,
          COALESCE(SUM(CASE WHEN movement_type = N'collection' THEN amount ELSE 0 END), 0) AS collections,
          COALESCE(SUM(CASE WHEN movement_type = N'payment' THEN amount ELSE 0 END), 0) AS payments,
          COALESCE(SUM(CASE WHEN movement_type = N'collection' THEN ABS(amount) ELSE 0 END), 0) AS collection_activity,
          COALESCE(SUM(CASE WHEN movement_type = N'payment' THEN ABS(amount) ELSE 0 END), 0) AS payment_activity
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
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT
        currency_code,
        COUNT_BIG(1) AS party_count,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS credit,
        COALESCE(SUM(balance), 0) AS balance,
        CASE WHEN COUNT_BIG(*) = COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try), 0) END AS balance_try
      FROM report_customers
      WHERE is_deleted = 0
      GROUP BY currency_code
      ORDER BY currency_code;
    `),
    pool.request().input('reportAsOf', sql.Date, asOfDate).query(`
      ${reportBalanceCtes}
      SELECT
        currency_code,
        COUNT_BIG(1) AS party_count,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS credit,
        COALESCE(SUM(balance), 0) AS balance,
        CASE WHEN COUNT_BIG(*) = COUNT_BIG(balance_try) THEN COALESCE(SUM(balance_try), 0) END AS balance_try
      FROM report_suppliers
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
          COALESCE((SELECT SUM(current_balance) FROM dbo.finance_accounts WHERE is_active = 1 AND currency_code = N'TRY'), 0) AS cash_bank_try;
      `),
  ]);

  const widgetRow = widgets.recordset?.[0] || {};
  const finance = historicalFinanceSummary(financeByCurrency.recordset || []);

  return {
    generatedAt: new Date().toISOString(),
    financeConversion: { ratePolicy: 'TRANSACTION_SNAPSHOT_ONLY', missingSnapshotCurrencies: finance.missingSnapshotCurrencies },
    financeCurrencySummary: finance.currencySummary,
    balanceAsOfDate: asOfDate,
    dateFrom,
    dateTo,
    assumptions: [
      'Dönemsel muhasebe görünümü ERP kontrolü için operasyonel bir özettir; resmî muhasebe defteri değildir.',
      'Dönem filtreleri, seçilen tarih aralığındaki kesinleşmiş faturalar ile kaydedilmiş tahsilat ve ödeme hareketlerine uygulanır.',
      'Dövizli tahsilat/ödemelerin işlem anı kur kaydı yoktur; tarihsel TRY karşılığı hesaplanamaz. Orijinal döviz tutarları ayrı tutulur.',
      'Müşteri ve tedarikçi bakiye bölümleri dönem sonu tarihsel görüntüyü değil, para birimi bazında güncel kart bakiyelerini gösterir.',
    ],
    dataQuality: {
      source: 'SQL Server salt okunur SELECT özetleri',
      reviewRequired: [
        'Karar vermeden önce bakiye özetleri müşteri ve tedarikçi ekstreleriyle karşılaştırılmalıdır.',
        'Kontrolde görünür tarih filtreleri kullanılmalıdır; filtresiz rapor tam denetim olarak kabul edilmemelidir.',
      ],
      rowLimits: {
        dailyCash: 40,
        customerBalances: 'grouped by currency',
        supplierBalances: 'grouped by currency',
      },
    },
    widgets: {
      salesTry: numberValue(widgetRow.sales_try),
      purchasesTry: numberValue(widgetRow.purchases_try),
      collections: finance.collections,
      payments: finance.payments,
      netCash: finance.netCash,
      cashBankTry: numberValue(widgetRow.cash_bank_try),
      customerBalance: sumReportAmounts((customerBalances.recordset || []).map(row => row.balance_try)),
      supplierBalance: sumReportAmounts((supplierBalances.recordset || []).map(row => row.balance_try)),
    },
    salesByCurrency: (salesByCurrency.recordset || []).map(toCurrencyTotal),
    purchasesByCurrency: (purchasesByCurrency.recordset || []).map(toCurrencyTotal),
    financeByCurrency: (financeByCurrency.recordset || []).map(toCurrencyTotal),
    dailyCash: (dailyCash.recordset || []).map(toDailyCashRow),
    customerBalances: (customerBalances.recordset || []).map(toBalanceTotal),
    supplierBalances: (supplierBalances.recordset || []).map(toBalanceTotal),
  };
}
