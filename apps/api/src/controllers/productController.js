import {
  addProductBarcode,
  changeProductPassive,
  changeProductBarcodePassive,
  createProduct,
  getProductDetail,
  getProductsList,
  saveProductImage,
  updateProduct,
} from '../services/productService.js';
import { created, fail, ok } from '../utils/response.js';

function writeError(res, error) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || 'PRODUCT_WRITE_FAILED',
    error.statusCode ? error.message : 'Product write operation failed',
    error.meta || {},
  );
}

export async function getProducts(req, res) {
  try {
    const { data, meta } = await getProductsList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, 'SQL_SELECT_FAILED', 'Products query failed');
  }
}

export async function getProduct(req, res) {
  try {
    const data = await getProductDetail(req.params.id);
    return ok(res, data, {
      source: 'sql-select-only',
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'SQL_SELECT_FAILED', 'Product detail query failed');
  }
}

export async function postProduct(req, res) {
  try {
    const data = await createProduct(req.body, req.user);
    return created(res, data, {
      source: 'sql-write',
      audit: 'product_created',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function putProduct(req, res) {
  try {
    const data = await updateProduct(req.params.id, req.body, req.user);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'product_updated',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function patchProductPassive(req, res) {
  try {
    const result = await changeProductPassive(req.params.id, req.body, req.user);
    return ok(res, result.data, {
      source: 'sql-write',
      audit: result.auditWritten ? 'product_passive_changed' : 'skipped_no_state_change',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function postProductBarcode(req, res) {
  try {
    const data = await addProductBarcode(req.params.id, req.body, req.user);
    return created(res, data, {
      source: 'sql-write',
      audit: 'product_barcode_added',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function patchProductBarcodePassive(req, res) {
  try {
    const data = await changeProductBarcodePassive(req.params.id, req.params.barcodeId, req.body, req.user);
    return ok(res, data, {
      source: 'sql-write',
      audit: req.body?.isPassive ? 'product_barcode_passivated' : 'product_barcode_activated',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function postProductImage(req, res) {
  try {
    const data = await saveProductImage(req.params.id, req.body, req.user);
    return created(res, data, {
      source: 'sql-write',
      audit: 'product_image_saved',
    });
  } catch (error) {
    return writeError(res, error);
  }
}
