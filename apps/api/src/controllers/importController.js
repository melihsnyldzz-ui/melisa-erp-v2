import {
  commitCustomerImport,
  commitProductImport,
  commitSupplierImport,
  previewCustomerImport,
  previewProductImport,
  previewSupplierImport,
} from '../services/importService.js';
import { created, fail, ok } from '../utils/response.js';

function importError(res, error) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || 'IMPORT_FAILED',
    error.statusCode ? error.message : 'Import operation failed',
  );
}

export async function postProductsPreview(req, res) {
  try {
    const preview = await previewProductImport(req.body);
    return ok(res, preview, {
      source: 'import-preview',
      writes: false,
    });
  } catch (error) {
    return importError(res, error);
  }
}

export async function postProductsCommit(req, res) {
  try {
    const result = await commitProductImport(req.body, req.user);
    return created(res, result, {
      source: 'import-commit',
      audit: 'import_products',
    });
  } catch (error) {
    return importError(res, error);
  }
}

export async function postCustomersPreview(req, res) {
  try {
    const preview = await previewCustomerImport(req.body);
    return ok(res, preview, {
      source: 'import-preview',
      writes: false,
    });
  } catch (error) {
    return importError(res, error);
  }
}

export async function postCustomersCommit(req, res) {
  try {
    const result = await commitCustomerImport(req.body, req.user);
    return created(res, result, {
      source: 'import-commit',
      audit: 'import_customers',
    });
  } catch (error) {
    return importError(res, error);
  }
}

export async function postSuppliersPreview(req, res) {
  try {
    const preview = await previewSupplierImport(req.body);
    return ok(res, preview, {
      source: 'import-preview',
      writes: false,
    });
  } catch (error) {
    return importError(res, error);
  }
}

export async function postSuppliersCommit(req, res) {
  try {
    const result = await commitSupplierImport(req.body, req.user);
    return created(res, result, {
      source: 'import-commit',
      audit: 'import_suppliers',
    });
  } catch (error) {
    return importError(res, error);
  }
}
