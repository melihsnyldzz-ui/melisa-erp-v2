import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const CLEANUP_CONFIRMATION = 'DEMO_TEST_TEMIZLE';
const TEST_TREE_CONFIRMATION = 'TEST_ISLEM_AGACI_ARSIVLE';
const TEST_RESTORE_CONFIRMATION = 'TEST_ARSIV_GERI_AL';
const ARCHIVED_TEST_STATUS = 'archived_test';
const ARCHIVED_TEST_MARKER = '[TEST_ARCHIVED]';

const CUSTOMER_TEST_PARTY_PATTERN = `(
  c.customer_code LIKE N'QA-%'
  OR c.customer_code LIKE N'AKIS-%'
  OR c.customer_code LIKE N'TEST%'
  OR c.customer_code LIKE N'IMP-%'
  OR c.name LIKE N'QA %'
  OR c.name LIKE N'AKIS %'
  OR c.name LIKE N'TEST %'
  OR c.name LIKE N'Import Test%'
)`;

const SUPPLIER_TEST_PARTY_PATTERN = `(
  s.supplier_code LIKE N'QA-%'
  OR s.supplier_code LIKE N'AKIS-%'
  OR s.supplier_code LIKE N'TEST%'
  OR s.supplier_code LIKE N'DRAFT-%'
  OR s.supplier_code LIKE N'IMP-%'
  OR s.name LIKE N'QA %'
  OR s.name LIKE N'AKIS %'
  OR s.name LIKE N'TEST %'
  OR s.name LIKE N'%Draft Supplier%'
)`;

const SALES_TEST_DOCUMENT_PATTERN = `(
  si.document_no LIKE N'QA-%'
  OR si.document_no LIKE N'S-QA-%'
  OR si.document_no LIKE N'QAS-%'
  OR si.document_no LIKE N'AKIS-%'
  OR si.document_no LIKE N'TEST%'
  OR si.document_no LIKE N'DBG%'
  OR si.document_no LIKE N'ERP_%'
  OR si.document_no LIKE N'S-TST-%'
  OR si.document_no LIKE N'SDR-%'
  OR si.document_no LIKE N'SF-FIN-TEST-%'
  OR si.document_no LIKE N'SAVG-%'
  OR si.document_no LIKE N'SNEG-%'
  OR si.document_no LIKE N'TERM-TEST%'
  OR COALESCE(si.description, N'') LIKE N'%QA E2E%'
  OR COALESCE(si.description, N'') LIKE N'%ERP_TEST%'
  OR COALESCE(si.description, N'') LIKE N'%mock%'
  OR EXISTS (
    SELECT 1
    FROM dbo.sales_invoice_items sii_pattern
    INNER JOIN dbo.products p_pattern ON p_pattern.id = sii_pattern.product_id
    WHERE sii_pattern.sales_invoice_id = si.id
      AND (
        p_pattern.stock_code LIKE N'QA-%'
        OR p_pattern.stock_code LIKE N'TEST%'
        OR p_pattern.stock_code LIKE N'DBG%'
        OR p_pattern.stock_code LIKE N'DRAFT-%'
        OR p_pattern.stock_code LIKE N'IMP-%'
      )
  )
)`;

const PURCHASE_TEST_DOCUMENT_PATTERN = `(
  pi.document_no LIKE N'QA-%'
  OR pi.document_no LIKE N'P-QA-%'
  OR pi.document_no LIKE N'QAP-%'
  OR pi.document_no LIKE N'AKIS-%'
  OR pi.document_no LIKE N'TEST%'
  OR pi.document_no LIKE N'DBG%'
  OR pi.document_no LIKE N'ERP_%'
  OR pi.document_no LIKE N'P-TST-%'
  OR pi.document_no LIKE N'PAVG-%'
  OR pi.document_no LIKE N'PDR-%'
  OR pi.document_no LIKE N'AF-FIN-TEST-%'
  OR COALESCE(pi.description, N'') LIKE N'%QA E2E%'
  OR COALESCE(pi.description, N'') LIKE N'%ERP_TEST%'
  OR COALESCE(pi.description, N'') LIKE N'%mock%'
  OR EXISTS (
    SELECT 1
    FROM dbo.suppliers s_pattern
    WHERE s_pattern.id = pi.supplier_id
      AND (
        s_pattern.supplier_code LIKE N'QA-%'
        OR s_pattern.supplier_code LIKE N'TEST%'
        OR s_pattern.supplier_code LIKE N'DRAFT-%'
        OR s_pattern.supplier_code LIKE N'IMP-%'
        OR s_pattern.name LIKE N'%Draft Supplier%'
      )
  )
)`;

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function toCandidateDto(row) {
  return {
    id: Number(row.id),
    code: row.code || '-',
    name: row.name || '-',
    reason: row.reason || 'test-pattern',
    linkCount: Number(row.link_count || 0),
    canClean: Number(row.link_count || 0) === 0,
  };
}

function summarizeCandidates(rows) {
  const safeRows = rows.filter((row) => row.canClean);
  const blockedRows = rows.filter((row) => !row.canClean);
  return {
    total: rows.length,
    safe: safeRows.length,
    blocked: blockedRows.length,
    sample: rows.slice(0, 25),
  };
}

function toInvoiceCandidateDto(row, kind) {
  return {
    id: Number(row.id),
    kind,
    documentNo: row.document_no || '-',
    status: row.status || '-',
    partyName: row.party_name || '-',
    documentDate: row.document_date,
    amountTry: Number(row.amount_try || 0),
    itemCount: Number(row.item_count || 0),
    ledgerCount: Number(row.ledger_count || 0),
    stockMovementCount: Number(row.stock_movement_count || 0),
    reason: row.reason || 'test-document-pattern',
    restoreStatus: row.restore_status || null,
  };
}

function summarizeInvoiceCandidates(rows) {
  return {
    total: rows.length,
    itemCount: rows.reduce((sum, row) => sum + row.itemCount, 0),
    ledgerCount: rows.reduce((sum, row) => sum + row.ledgerCount, 0),
    stockMovementCount: rows.reduce((sum, row) => sum + row.stockMovementCount, 0),
    sample: rows.slice(0, 50),
  };
}

function toFinanceMovementCandidateDto(row) {
  return {
    id: Number(row.id),
    partyType: row.party_type,
    partyId: Number(row.party_id),
    partyCode: row.party_code || '-',
    partyName: row.party_name || '-',
    movementType: row.movement_type || '-',
    documentNo: row.document_no || '-',
    documentDate: row.document_date,
    amount: Number(row.amount || 0),
    currency: row.currency_code || 'TRY',
    balanceEffect: Number(row.balance_effect || 0),
    reason: row.reason || 'test-finance-party',
  };
}

function summarizeFinanceMovementCandidates(rows) {
  return {
    total: rows.length,
    collectionCount: rows.filter((row) => row.movementType === 'collection').length,
    paymentCount: rows.filter((row) => row.movementType === 'payment').length,
    amountTry: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    sample: rows.slice(0, 50),
  };
}

async function readProductCandidates(request) {
  const result = await request.query(`
    WITH candidates AS (
      SELECT
        p.id,
        p.stock_code AS code,
        p.name,
        CASE
          WHEN p.stock_code LIKE N'QA-%' THEN N'QA stok kodu'
          WHEN p.stock_code LIKE N'TEST%' THEN N'TEST stok kodu'
          WHEN p.stock_code LIKE N'DBG%' THEN N'DBG stok kodu'
          WHEN p.stock_code LIKE N'DRAFT-%' THEN N'DRAFT stok kodu'
          WHEN p.stock_code LIKE N'IMP-%' THEN N'IMP stok kodu'
          WHEN p.name LIKE N'QA %' THEN N'QA urun adi'
          WHEN p.name LIKE N'TEST %' THEN N'TEST urun adi'
          WHEN p.name LIKE N'Import Test%' THEN N'import test urun'
          ELSE N'test deseni'
        END AS reason
      FROM dbo.products p
      WHERE p.is_deleted = 0
        AND (
          p.stock_code LIKE N'QA-%'
          OR p.stock_code LIKE N'TEST%'
          OR p.stock_code LIKE N'DBG%'
          OR p.stock_code LIKE N'DRAFT-%'
          OR p.stock_code LIKE N'IMP-%'
          OR p.name LIKE N'QA %'
          OR p.name LIKE N'TEST %'
          OR p.name LIKE N'Import Test%'
        )
    )
    SELECT
      c.id,
      c.code,
      c.name,
      c.reason,
      (
        SELECT COUNT_BIG(1)
        FROM dbo.stock_movements sm
        LEFT JOIN dbo.sales_invoices si ON si.id = sm.source_id AND sm.source_type = N'sales_invoice'
        LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.source_id AND sm.source_type = N'purchase_invoice'
        WHERE sm.product_id = c.id
          AND COALESCE(si.description, pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) + (
        SELECT COUNT_BIG(1)
        FROM dbo.sales_invoice_items sii
        INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
        WHERE sii.product_id = c.id
          AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) + (
        SELECT COUNT_BIG(1)
        FROM dbo.purchase_invoice_items pii
        INNER JOIN dbo.purchase_invoices pi ON pi.id = pii.purchase_invoice_id
        WHERE pii.product_id = c.id
          AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) AS link_count
    FROM candidates c
    ORDER BY c.code ASC;
  `);
  return result.recordset.map(toCandidateDto);
}

async function readCustomerCandidates(request) {
  const result = await request.query(`
    WITH candidates AS (
      SELECT
        c.id,
        c.customer_code AS code,
        c.name,
        CASE
          WHEN c.customer_code LIKE N'QA-%' THEN N'QA cari kodu'
          WHEN c.customer_code LIKE N'AKIS-%' THEN N'AKIS test cari kodu'
          WHEN c.customer_code LIKE N'TEST%' THEN N'TEST cari kodu'
          WHEN c.customer_code LIKE N'IMP-%' THEN N'IMP cari kodu'
          WHEN c.name LIKE N'QA %' THEN N'QA cari adi'
          WHEN c.name LIKE N'AKIS %' THEN N'AKIS test cari adi'
          WHEN c.name LIKE N'TEST %' THEN N'TEST cari adi'
          WHEN c.name LIKE N'Import Test%' THEN N'import test cari'
          ELSE N'test deseni'
        END AS reason
      FROM dbo.customers c
      WHERE c.is_deleted = 0
        AND (
          c.customer_code LIKE N'QA-%'
          OR c.customer_code LIKE N'AKIS-%'
          OR c.customer_code LIKE N'TEST%'
          OR c.customer_code LIKE N'IMP-%'
          OR c.name LIKE N'QA %'
          OR c.name LIKE N'AKIS %'
          OR c.name LIKE N'TEST %'
          OR c.name LIKE N'Import Test%'
        )
    )
    SELECT
      c.id,
      c.code,
      c.name,
      c.reason,
      (
        SELECT COUNT_BIG(1)
        FROM dbo.customer_movements cm
        LEFT JOIN dbo.sales_invoices si ON si.id = cm.sales_invoice_id
        WHERE cm.customer_id = c.id
          AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) + (
        SELECT COUNT_BIG(1)
        FROM dbo.sales_invoices si
        WHERE si.customer_id = c.id
          AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) AS link_count
    FROM candidates c
    ORDER BY c.code ASC;
  `);
  return result.recordset.map(toCandidateDto);
}

async function readSupplierCandidates(request) {
  const result = await request.query(`
    WITH candidates AS (
      SELECT
        s.id,
        s.supplier_code AS code,
        s.name,
        CASE
          WHEN s.supplier_code LIKE N'QA-%' THEN N'QA tedarikci kodu'
          WHEN s.supplier_code LIKE N'AKIS-%' THEN N'AKIS test tedarikci kodu'
          WHEN s.supplier_code LIKE N'TEST%' THEN N'TEST tedarikci kodu'
          WHEN s.supplier_code LIKE N'DRAFT-%' THEN N'DRAFT tedarikci kodu'
          WHEN s.supplier_code LIKE N'IMP-%' THEN N'IMP tedarikci kodu'
          WHEN s.name LIKE N'QA %' THEN N'QA tedarikci adi'
          WHEN s.name LIKE N'AKIS %' THEN N'AKIS test tedarikci adi'
          WHEN s.name LIKE N'TEST %' THEN N'TEST tedarikci adi'
          WHEN s.name LIKE N'%Draft Supplier%' THEN N'draft supplier test'
          ELSE N'test deseni'
        END AS reason
      FROM dbo.suppliers s
      WHERE s.is_deleted = 0
        AND (
          s.supplier_code LIKE N'QA-%'
          OR s.supplier_code LIKE N'AKIS-%'
          OR s.supplier_code LIKE N'TEST%'
          OR s.supplier_code LIKE N'DRAFT-%'
          OR s.supplier_code LIKE N'IMP-%'
          OR s.name LIKE N'QA %'
          OR s.name LIKE N'AKIS %'
          OR s.name LIKE N'TEST %'
          OR s.name LIKE N'%Draft Supplier%'
        )
    )
    SELECT
      c.id,
      c.code,
      c.name,
      c.reason,
      (
        SELECT COUNT_BIG(1)
        FROM dbo.supplier_movements sm
        LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.purchase_invoice_id
        WHERE sm.supplier_id = c.id
          AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) + (
        SELECT COUNT_BIG(1)
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = c.id
          AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      ) + (
        SELECT COUNT_BIG(1)
        FROM dbo.products p
        WHERE p.supplier_id = c.id AND p.is_deleted = 0
      ) AS link_count
    FROM candidates c
    ORDER BY c.code ASC;
  `);
  return result.recordset.map(toCandidateDto);
}

async function readTestFinanceMovementCandidates(request) {
  const result = await request.query(`
    SELECT
      cm.id,
      N'customer' AS party_type,
      cm.customer_id AS party_id,
      c.customer_code AS party_code,
      c.name AS party_name,
      cm.movement_type,
      COALESCE(CONCAT(N'TH-', cm.id), N'-') AS document_no,
      cm.document_date,
      cm.amount,
      cm.currency_code,
      cm.balance_effect,
      CASE
        WHEN c.customer_code LIKE N'QA-%' THEN N'QA müşteri tahsilatı'
        WHEN c.customer_code LIKE N'TEST%' THEN N'TEST müşteri tahsilatı'
        WHEN c.customer_code LIKE N'IMP-%' THEN N'import test müşteri tahsilatı'
        ELSE N'test müşteri hareketi'
      END AS reason
    FROM dbo.customer_movements cm
    INNER JOIN dbo.customers c ON c.id = cm.customer_id
    WHERE cm.movement_type = N'collection'
      AND cm.sales_invoice_id IS NULL
      AND ${CUSTOMER_TEST_PARTY_PATTERN}

    UNION ALL

    SELECT
      sm.id,
      N'supplier' AS party_type,
      sm.supplier_id AS party_id,
      s.supplier_code AS party_code,
      s.name AS party_name,
      sm.movement_type,
      COALESCE(CONCAT(N'OD-', sm.id), N'-') AS document_no,
      sm.document_date,
      sm.amount,
      sm.currency_code,
      sm.balance_effect,
      CASE
        WHEN s.supplier_code LIKE N'QA-%' THEN N'QA tedarikçi ödemesi'
        WHEN s.supplier_code LIKE N'TEST%' THEN N'TEST tedarikçi ödemesi'
        WHEN s.supplier_code LIKE N'IMP-%' THEN N'import test tedarikçi ödemesi'
        ELSE N'test tedarikçi hareketi'
      END AS reason
    FROM dbo.supplier_movements sm
    INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
    WHERE sm.movement_type = N'payment'
      AND sm.purchase_invoice_id IS NULL
      AND ${SUPPLIER_TEST_PARTY_PATTERN}
    ORDER BY document_date DESC, id DESC;
  `);
  return result.recordset.map(toFinanceMovementCandidateDto);
}

async function readSalesTestInvoiceCandidates(request) {
  const result = await request.query(`
    SELECT
      si.id,
      si.document_no,
      si.status,
      si.document_date,
      si.amount_try,
      c.name AS party_name,
      CASE
        WHEN si.document_no LIKE N'ERP_%' THEN N'ERP otomasyon test fisi'
        WHEN si.document_no LIKE N'QA-%' OR si.document_no LIKE N'S-QA-%' OR si.document_no LIKE N'QAS-%' THEN N'QA satis testi'
        WHEN si.document_no LIKE N'TEST%' THEN N'TEST satis fisi'
        WHEN si.document_no LIKE N'SAVG-%' OR si.document_no LIKE N'SNEG-%' THEN N'maliyet/satis test fisi'
        WHEN COALESCE(si.description, N'') LIKE N'%ERP_TEST%' OR COALESCE(si.description, N'') LIKE N'%mock%' THEN N'test aciklamasi'
        WHEN EXISTS (
          SELECT 1
          FROM dbo.sales_invoice_items sii_reason
          INNER JOIN dbo.products p_reason ON p_reason.id = sii_reason.product_id
          WHERE sii_reason.sales_invoice_id = si.id
            AND (
              p_reason.stock_code LIKE N'QA-%'
              OR p_reason.stock_code LIKE N'TEST%'
              OR p_reason.stock_code LIKE N'DBG%'
              OR p_reason.stock_code LIKE N'DRAFT-%'
              OR p_reason.stock_code LIKE N'IMP-%'
            )
        ) THEN N'test stok karti kullanimi'
        ELSE N'test belge deseni'
      END AS reason,
      (SELECT COUNT_BIG(1) FROM dbo.sales_invoice_items sii WHERE sii.sales_invoice_id = si.id) AS item_count,
      (SELECT COUNT_BIG(1) FROM dbo.customer_movements cm WHERE cm.sales_invoice_id = si.id) AS ledger_count,
      (SELECT COUNT_BIG(1) FROM dbo.stock_movements sm WHERE sm.source_type = N'sales_invoice' AND sm.source_id = si.id) AS stock_movement_count
    FROM dbo.sales_invoices si
    LEFT JOIN dbo.customers c ON c.id = si.customer_id
    WHERE COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      AND ${SALES_TEST_DOCUMENT_PATTERN}
    ORDER BY si.document_date DESC, si.id DESC;
  `);
  return result.recordset.map((row) => toInvoiceCandidateDto(row, 'sales'));
}

async function readPurchaseTestInvoiceCandidates(request) {
  const result = await request.query(`
    SELECT
      pi.id,
      pi.document_no,
      pi.status,
      pi.document_date,
      pi.amount_try,
      s.name AS party_name,
      CASE
        WHEN pi.document_no LIKE N'ERP_%' THEN N'ERP otomasyon test fisi'
        WHEN pi.document_no LIKE N'QA-%' OR pi.document_no LIKE N'P-QA-%' OR pi.document_no LIKE N'QAP-%' THEN N'QA alis testi'
        WHEN pi.document_no LIKE N'TEST%' THEN N'TEST alis fisi'
        WHEN pi.document_no LIKE N'PAVG-%' OR pi.document_no LIKE N'PDR-%' THEN N'maliyet/alis test fisi'
        WHEN pi.document_no LIKE N'P-TST-%' THEN N'test alis belge no'
        WHEN COALESCE(pi.description, N'') LIKE N'%ERP_TEST%' OR COALESCE(pi.description, N'') LIKE N'%mock%' THEN N'test/mock aciklamasi'
        WHEN EXISTS (
          SELECT 1
          FROM dbo.suppliers s_reason
          WHERE s_reason.id = pi.supplier_id
            AND (
              s_reason.supplier_code LIKE N'QA-%'
              OR s_reason.supplier_code LIKE N'TEST%'
              OR s_reason.supplier_code LIKE N'DRAFT-%'
              OR s_reason.supplier_code LIKE N'IMP-%'
              OR s_reason.name LIKE N'%Draft Supplier%'
            )
        ) THEN N'test tedarikci karti'
        ELSE N'test belge deseni'
      END AS reason,
      (SELECT COUNT_BIG(1) FROM dbo.purchase_invoice_items pii WHERE pii.purchase_invoice_id = pi.id) AS item_count,
      (SELECT COUNT_BIG(1) FROM dbo.supplier_movements sm WHERE sm.purchase_invoice_id = pi.id) AS ledger_count,
      (SELECT COUNT_BIG(1) FROM dbo.stock_movements sm WHERE sm.source_type = N'purchase_invoice' AND sm.source_id = pi.id) AS stock_movement_count
    FROM dbo.purchase_invoices pi
    LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
    WHERE COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
      AND ${PURCHASE_TEST_DOCUMENT_PATTERN}
    ORDER BY pi.document_date DESC, pi.id DESC;
  `);
  return result.recordset.map((row) => toInvoiceCandidateDto(row, 'purchase'));
}

async function readSalesArchivedTestInvoices(request) {
  const result = await request.query(`
    SELECT
      si.id,
      si.document_no,
      N'${ARCHIVED_TEST_STATUS}' AS status,
      si.document_date,
      si.amount_try,
      c.name AS party_name,
      CASE
        WHEN si.cancelled_at IS NOT NULL THEN N'cancelled'
        WHEN si.finalized_at IS NOT NULL THEN N'finalized'
        ELSE si.status
      END AS restore_status,
      N'arsivden geri alma adayi' AS reason,
      (SELECT COUNT_BIG(1) FROM dbo.sales_invoice_items sii WHERE sii.sales_invoice_id = si.id) AS item_count,
      (SELECT COUNT_BIG(1) FROM dbo.customer_movements cm WHERE cm.sales_invoice_id = si.id) AS ledger_count,
      (SELECT COUNT_BIG(1) FROM dbo.stock_movements sm WHERE sm.source_type = N'sales_invoice' AND sm.source_id = si.id) AS stock_movement_count
    FROM dbo.sales_invoices si
    LEFT JOIN dbo.customers c ON c.id = si.customer_id
    WHERE si.description LIKE N'%TEST_ARCHIVED%'
    ORDER BY si.document_date DESC, si.id DESC;
  `);
  return result.recordset.map((row) => toInvoiceCandidateDto(row, 'sales'));
}

async function readPurchaseArchivedTestInvoices(request) {
  const result = await request.query(`
    SELECT
      pi.id,
      pi.document_no,
      N'${ARCHIVED_TEST_STATUS}' AS status,
      pi.document_date,
      pi.amount_try,
      s.name AS party_name,
      CASE
        WHEN pi.cancelled_at IS NOT NULL THEN N'cancelled'
        WHEN pi.finalized_at IS NOT NULL THEN N'finalized'
        ELSE pi.status
      END AS restore_status,
      N'arsivden geri alma adayi' AS reason,
      (SELECT COUNT_BIG(1) FROM dbo.purchase_invoice_items pii WHERE pii.purchase_invoice_id = pi.id) AS item_count,
      (SELECT COUNT_BIG(1) FROM dbo.supplier_movements sm WHERE sm.purchase_invoice_id = pi.id) AS ledger_count,
      (SELECT COUNT_BIG(1) FROM dbo.stock_movements sm WHERE sm.source_type = N'purchase_invoice' AND sm.source_id = pi.id) AS stock_movement_count
    FROM dbo.purchase_invoices pi
    LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
    WHERE pi.description LIKE N'%TEST_ARCHIVED%'
    ORDER BY pi.document_date DESC, pi.id DESC;
  `);
  return result.recordset.map((row) => toInvoiceCandidateDto(row, 'purchase'));
}

async function buildTestTreePreview(request) {
  const sales = await readSalesTestInvoiceCandidates(request);
  const purchases = await readPurchaseTestInvoiceCandidates(request);
  const salesSummary = summarizeInvoiceCandidates(sales);
  const purchaseSummary = summarizeInvoiceCandidates(purchases);
  return {
    confirmationText: TEST_TREE_CONFIRMATION,
    archiveStatus: ARCHIVED_TEST_STATUS,
    rules: [
      'Fiziksel silme yok; test fişleri açıklama alanındaki TEST_ARCHIVED etiketiyle arşivlenir.',
      'Satır, stok hareketi ve cari hareket kayıtları korunur; normal rapor/ekstre akışından ayrılır.',
      'Belge no, açıklama veya bağlı test stok/tedarikçi kartı açıkça test ise aday yapılır.',
    ],
    summary: {
      sales: salesSummary,
      purchases: purchaseSummary,
    },
    totals: {
      totalInvoices: salesSummary.total + purchaseSummary.total,
      salesInvoices: salesSummary.total,
      purchaseInvoices: purchaseSummary.total,
      itemCount: salesSummary.itemCount + purchaseSummary.itemCount,
      ledgerCount: salesSummary.ledgerCount + purchaseSummary.ledgerCount,
      stockMovementCount: salesSummary.stockMovementCount + purchaseSummary.stockMovementCount,
    },
  };
}

async function buildTestArchiveRestorePreview(request) {
  const sales = await readSalesArchivedTestInvoices(request);
  const purchases = await readPurchaseArchivedTestInvoices(request);
  const salesSummary = summarizeInvoiceCandidates(sales);
  const purchaseSummary = summarizeInvoiceCandidates(purchases);
  return {
    confirmationText: TEST_RESTORE_CONFIRMATION,
    archiveStatus: ARCHIVED_TEST_STATUS,
    rules: [
      'Fiziksel silme yok; sadece TEST_ARCHIVED etiketi açıklama alanından kaldırılır.',
      'Fişin gerçek draft/finalized/cancelled statüsü korunur.',
      'Satır, stok hareketi ve cari hareket kayıtlarına dokunulmaz.',
    ],
    summary: {
      sales: salesSummary,
      purchases: purchaseSummary,
    },
    totals: {
      totalInvoices: salesSummary.total + purchaseSummary.total,
      salesInvoices: salesSummary.total,
      purchaseInvoices: purchaseSummary.total,
      itemCount: salesSummary.itemCount + purchaseSummary.itemCount,
      ledgerCount: salesSummary.ledgerCount + purchaseSummary.ledgerCount,
      stockMovementCount: salesSummary.stockMovementCount + purchaseSummary.stockMovementCount,
    },
  };
}

async function buildCleanupPreview(request) {
  const products = await readProductCandidates(request);
  const customers = await readCustomerCandidates(request);
  const suppliers = await readSupplierCandidates(request);
  const financeMovements = await readTestFinanceMovementCandidates(request);

  const summary = {
    products: summarizeCandidates(products),
    customers: summarizeCandidates(customers),
    suppliers: summarizeCandidates(suppliers),
  };

  return {
    confirmationText: CLEANUP_CONFIRMATION,
    rules: [
      'Fiziksel silme yok; sadece is_deleted=1 ve is_active=0 soft-delete uygulanir.',
      'Archived_test durumundaki test fişleri blok sayımına dahil edilmez.',
      'Fiş, hareket veya bağlı kaydı olan aktif adaylar temizlenmez; bloklu listede kalır.',
      'Adaylar sadece QA/TEST/DBG/DRAFT/IMP gibi acik test desenleriyle bulunur.',
    ],
    summary,
    financeMovements: summarizeFinanceMovementCandidates(financeMovements),
    totals: {
      total: summary.products.total + summary.customers.total + summary.suppliers.total,
      safe: summary.products.safe + summary.customers.safe + summary.suppliers.safe,
      blocked: summary.products.blocked + summary.customers.blocked + summary.suppliers.blocked,
      financeMovementCount: financeMovements.length,
    },
  };
}

export async function previewDemoCleanup() {
  const pool = await getSqlPool();
  return buildCleanupPreview(pool.request());
}

export async function applyDemoCleanup(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  if (payload.confirmation !== CLEANUP_CONFIRMATION) {
    throw makeServiceError('CLEANUP_CONFIRMATION_REQUIRED', `confirmation must be ${CLEANUP_CONFIRMATION}`, 400);
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const before = await buildCleanupPreview(new sqlDriver.Request(transaction));

    const productUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        WITH safe_candidates AS (
          SELECT p.id
          FROM dbo.products p
          WHERE p.is_deleted = 0
            AND (
              p.stock_code LIKE N'QA-%'
              OR p.stock_code LIKE N'TEST%'
              OR p.stock_code LIKE N'DBG%'
              OR p.stock_code LIKE N'DRAFT-%'
              OR p.stock_code LIKE N'IMP-%'
              OR p.name LIKE N'QA %'
              OR p.name LIKE N'TEST %'
              OR p.name LIKE N'Import Test%'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.stock_movements sm
              LEFT JOIN dbo.sales_invoices si ON si.id = sm.source_id AND sm.source_type = N'sales_invoice'
              LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.source_id AND sm.source_type = N'purchase_invoice'
              WHERE sm.product_id = p.id
                AND COALESCE(si.description, pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.sales_invoice_items sii
              INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
              WHERE sii.product_id = p.id
                AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.purchase_invoice_items pii
              INNER JOIN dbo.purchase_invoices pi ON pi.id = pii.purchase_invoice_id
              WHERE pii.product_id = p.id
                AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
            )
        )
        UPDATE p
        SET is_deleted = 1,
            is_active = 0,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        FROM dbo.products p
        INNER JOIN safe_candidates c ON c.id = p.id;
      `);

    const customerUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        WITH safe_candidates AS (
          SELECT c.id
          FROM dbo.customers c
          WHERE c.is_deleted = 0
            AND (
              c.customer_code LIKE N'QA-%'
              OR c.customer_code LIKE N'TEST%'
              OR c.customer_code LIKE N'IMP-%'
              OR c.name LIKE N'QA %'
              OR c.name LIKE N'TEST %'
              OR c.name LIKE N'Import Test%'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.customer_movements cm
              LEFT JOIN dbo.sales_invoices si ON si.id = cm.sales_invoice_id
              WHERE cm.customer_id = c.id
                AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
            )
            AND NOT EXISTS (SELECT 1 FROM dbo.sales_invoices si WHERE si.customer_id = c.id AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
        )
        UPDATE c
        SET is_deleted = 1,
            is_active = 0,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        FROM dbo.customers c
        INNER JOIN safe_candidates sc ON sc.id = c.id;
      `);

    const supplierUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        WITH safe_candidates AS (
          SELECT s.id
          FROM dbo.suppliers s
          WHERE s.is_deleted = 0
            AND (
              s.supplier_code LIKE N'QA-%'
              OR s.supplier_code LIKE N'TEST%'
              OR s.supplier_code LIKE N'DRAFT-%'
              OR s.supplier_code LIKE N'IMP-%'
              OR s.name LIKE N'QA %'
              OR s.name LIKE N'TEST %'
              OR s.name LIKE N'%Draft Supplier%'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM dbo.supplier_movements sm
              LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.purchase_invoice_id
              WHERE sm.supplier_id = s.id
                AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
            )
            AND NOT EXISTS (SELECT 1 FROM dbo.purchase_invoices pi WHERE pi.supplier_id = s.id AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
            AND NOT EXISTS (SELECT 1 FROM dbo.products p WHERE p.supplier_id = s.id AND p.is_deleted = 0)
        )
        UPDATE s
        SET is_deleted = 1,
            is_active = 0,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        FROM dbo.suppliers s
        INNER JOIN safe_candidates c ON c.id = s.id;
      `);

    const result = {
      productsCleaned: productUpdate.rowsAffected?.[0] || 0,
      customersCleaned: customerUpdate.rowsAffected?.[0] || 0,
      suppliersCleaned: supplierUpdate.rowsAffected?.[0] || 0,
    };
    result.totalCleaned = result.productsCleaned + result.customersCleaned + result.suppliersCleaned;

    const after = await buildCleanupPreview(new sqlDriver.Request(transaction));
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'demo_test_cleanup_applied',
      entityType: 'maintenance_cleanup',
      entityId: null,
      beforeSnapshot: before.totals,
      afterSnapshot: { result, remaining: after.totals },
      actor,
    });

    await transaction.commit();
    return {
      result,
      preview: after,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function previewTestTreeCleanup() {
  const pool = await getSqlPool();
  return buildTestTreePreview(pool.request());
}

export async function applyTestTreeCleanup(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  if (payload.confirmation !== TEST_TREE_CONFIRMATION) {
    throw makeServiceError('TEST_TREE_CONFIRMATION_REQUIRED', `confirmation must be ${TEST_TREE_CONFIRMATION}`, 400);
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const before = await buildTestTreePreview(new sqlDriver.Request(transaction));
    const salesUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE si
        SET description = CASE
              WHEN si.description LIKE N'%TEST_ARCHIVED%' THEN si.description
              ELSE CONCAT(LEFT(COALESCE(si.description, N''), 480), N' ${ARCHIVED_TEST_MARKER}')
            END,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        FROM dbo.sales_invoices si
        WHERE COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
          AND ${SALES_TEST_DOCUMENT_PATTERN};
      `);

    const purchaseUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE pi
        SET description = CASE
              WHEN pi.description LIKE N'%TEST_ARCHIVED%' THEN pi.description
              ELSE CONCAT(LEFT(COALESCE(pi.description, N''), 480), N' ${ARCHIVED_TEST_MARKER}')
            END,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        FROM dbo.purchase_invoices pi
        WHERE COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%'
          AND ${PURCHASE_TEST_DOCUMENT_PATTERN};
      `);

    const result = {
      salesInvoicesArchived: salesUpdate.rowsAffected?.[0] || 0,
      purchaseInvoicesArchived: purchaseUpdate.rowsAffected?.[0] || 0,
    };
    result.totalArchived = result.salesInvoicesArchived + result.purchaseInvoicesArchived;

    const after = await buildTestTreePreview(new sqlDriver.Request(transaction));
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'test_transaction_tree_archived',
      entityType: 'maintenance_cleanup',
      entityId: null,
      beforeSnapshot: before.totals,
      afterSnapshot: { result, remaining: after.totals },
      actor,
    });

    await transaction.commit();
    return {
      result,
      preview: after,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function previewTestArchiveRestore() {
  const pool = await getSqlPool();
  return buildTestArchiveRestorePreview(pool.request());
}

export async function applyTestArchiveRestore(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  if (payload.confirmation !== TEST_RESTORE_CONFIRMATION) {
    throw makeServiceError('TEST_RESTORE_CONFIRMATION_REQUIRED', `confirmation must be ${TEST_RESTORE_CONFIRMATION}`, 400);
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const before = await buildTestArchiveRestorePreview(new sqlDriver.Request(transaction));
    const salesUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.sales_invoices
        SET description = NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(COALESCE(description, N''), N' ${ARCHIVED_TEST_MARKER}', N''), N'${ARCHIVED_TEST_MARKER}', N''))), N''),
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE description LIKE N'%TEST_ARCHIVED%';
      `);

    const purchaseUpdate = await new sqlDriver.Request(transaction)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.purchase_invoices
        SET description = NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(COALESCE(description, N''), N' ${ARCHIVED_TEST_MARKER}', N''), N'${ARCHIVED_TEST_MARKER}', N''))), N''),
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE description LIKE N'%TEST_ARCHIVED%';
      `);

    const result = {
      salesInvoicesRestored: salesUpdate.rowsAffected?.[0] || 0,
      purchaseInvoicesRestored: purchaseUpdate.rowsAffected?.[0] || 0,
    };
    result.totalRestored = result.salesInvoicesRestored + result.purchaseInvoicesRestored;

    const after = await buildTestArchiveRestorePreview(new sqlDriver.Request(transaction));
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'test_transaction_tree_restored',
      entityType: 'maintenance_cleanup',
      entityId: null,
      beforeSnapshot: before.totals,
      afterSnapshot: { result, remaining: after.totals },
      actor,
    });

    await transaction.commit();
    return {
      result,
      preview: after,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
