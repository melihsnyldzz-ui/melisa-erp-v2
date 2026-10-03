import {
  createFinanceAccount,
  createCustomerCollection,
  createSupplierPayment,
  applyFinanceAccountCleanup,
  applyFinanceAccountStandardization,
  applyDocumentNumberFix,
  getDocumentNumberFixPreview,
  getAccountingControlDashboard,
  getFinanceAccounts,
  getFinanceAccountCleanupPreview,
  getFinanceJournal,
  getFinanceMovements,
  getFinanceSummary,
  updateFinanceAccount,
} from '../services/financeService.js';
import { created, fail, ok } from '../utils/response.js';

function financeFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Finance operation failed',
  );
}

export async function getFinanceSummaryReport(req, res) {
  try {
    const data = await getFinanceSummary();
    return ok(res, data, { source: 'sql-finance-summary' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_SUMMARY_FAILED');
  }
}

export async function getFinanceMovementList(req, res) {
  try {
    const data = await getFinanceMovements(req.query);
    return ok(res, data, { source: 'sql-finance-movements' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_MOVEMENTS_FAILED');
  }
}

export async function getFinanceJournalReport(req, res) {
  try {
    const data = await getFinanceJournal(req.query);
    return ok(res, data, { source: 'sql-finance-journal' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_JOURNAL_FAILED');
  }
}

export async function getAccountingControlReport(req, res) {
  try {
    const data = await getAccountingControlDashboard();
    return ok(res, data, { source: 'sql-accounting-control' });
  } catch (error) {
    return financeFail(res, error, 'ACCOUNTING_CONTROL_FAILED');
  }
}

export async function getDocumentNumberFixPreviewReport(req, res) {
  try {
    const data = await getDocumentNumberFixPreview();
    return ok(res, data, { source: 'sql-document-number-fix-preview' });
  } catch (error) {
    return financeFail(res, error, 'DOCUMENT_NUMBER_FIX_PREVIEW_FAILED');
  }
}

export async function getFinanceAccountList(req, res) {
  try {
    const data = await getFinanceAccounts(req.query);
    return ok(res, data, { source: 'sql-finance-accounts' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_ACCOUNTS_FAILED');
  }
}

export async function postFinanceAccount(req, res) {
  try {
    const data = await createFinanceAccount(req.body, req.user);
    return created(res, data, {
      audit: 'finance_account_created',
      source: 'sql-finance-accounts',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_ACCOUNT_CREATE_FAILED');
  }
}

export async function patchFinanceAccount(req, res) {
  try {
    const data = await updateFinanceAccount(req.params.id, req.body, req.user);
    return ok(res, data, {
      audit: 'finance_account_updated',
      source: 'sql-finance-accounts',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_ACCOUNT_UPDATE_FAILED');
  }
}

export async function getFinanceAccountCleanupPreviewReport(req, res) {
  try {
    const data = await getFinanceAccountCleanupPreview();
    return ok(res, data, { source: 'sql-finance-account-cleanup-preview' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_ACCOUNT_CLEANUP_PREVIEW_FAILED');
  }
}

export async function postFinanceAccountCleanup(req, res) {
  try {
    const data = await applyFinanceAccountCleanup(req.user);
    return ok(res, data, {
      audit: 'finance_accounts_cleanup_applied',
      source: 'sql-finance-account-cleanup',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_ACCOUNT_CLEANUP_FAILED');
  }
}

export async function postFinanceAccountStandardization(req, res) {
  try {
    const data = await applyFinanceAccountStandardization(req.user);
    return ok(res, data, {
      audit: 'finance_accounts_standardized',
      source: 'sql-finance-account-standardization',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_ACCOUNT_STANDARDIZATION_FAILED');
  }
}

export async function postDocumentNumberFix(req, res) {
  try {
    const data = await applyDocumentNumberFix(req.user);
    return ok(res, data, {
      audit: 'invoice_document_numbers_fixed',
      source: 'sql-document-number-fix',
    });
  } catch (error) {
    return financeFail(res, error, 'DOCUMENT_NUMBER_FIX_FAILED');
  }
}

export async function postCustomerCollection(req, res) {
  try {
    const data = await createCustomerCollection(req.body, req.user);
    return created(res, data, {
      audit: 'customer_collection_created',
      source: 'sql-finance',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_COLLECTION_FAILED');
  }
}

export async function postSupplierPayment(req, res) {
  try {
    const data = await createSupplierPayment(req.body, req.user);
    return created(res, data, {
      audit: 'supplier_payment_created',
      source: 'sql-finance',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_PAYMENT_FAILED');
  }
}
