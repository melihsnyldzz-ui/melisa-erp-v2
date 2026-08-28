import {
  addProductBarcode,
  changeProductPassive,
  changeProductBarcodePassive,
  createProduct,
  applyProductBulkCreate,
  getProductDetail,
  getProductIdentityAvailability,
  previewProductBulkCreate,
  previewProductBulkUpdate,
  getProductFilterOptions,
  getProductsList,
  saveProductImage,
  updateProduct,
  applyProductBulkUpdate,
} from '../services/productService.js';
import { getVegaProductsListFromWorker } from '../services/vegaProductClientService.js';
import {
  getActiveVegaProductImageSourceIds,
  getVegaProductImageMap,
  removeVegaProductImage,
  saveVegaProductImage,
} from '../services/vegaProductImageService.js';
import { getVegaProductCustomsMap } from '../services/vegaProductCustomsService.js';
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

export async function getVegaProducts(req, res) {
  try {
    const imageStatus = ['with-image', 'without-image'].includes(req.query?.imageStatus)
      ? req.query.imageStatus
      : 'all';
    const imageSourceIds = imageStatus === 'all'
      ? []
      : await getActiveVegaProductImageSourceIds();
    const workerQuery = {
      ...req.query,
      imageStatus,
      includeSourceIds: imageStatus === 'with-image' ? imageSourceIds : undefined,
      excludeSourceIds: imageStatus === 'without-image' ? imageSourceIds : undefined,
    };
    const { data, meta } = await getVegaProductsListFromWorker(workerQuery);
    const sourceIds = data.map((product) => product.sourceId);
    const [imageMap, customsMap] = await Promise.all([
      getVegaProductImageMap(sourceIds),
      getVegaProductCustomsMap(sourceIds),
    ]);
    const products = data.map((product) => ({
      ...product,
      imageUrl: imageMap.get(Number(product.sourceId)) || null,
      customs: customsMap.get(Number(product.sourceId)) || null,
    }));
    return ok(res, products, {
      ...meta,
      filters: {
        ...(meta?.filters || {}),
        imageStatus,
      },
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_PRODUCT_LIST_FAILED', 'Vega stock list could not be read');
  }
}

export async function getProductOptions(req, res) {
  try {
    const data = await getProductFilterOptions();
    return ok(res, data, {
      source: 'sql-select-only',
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'SQL_SELECT_FAILED', 'Product options query failed');
  }
}

export async function getProductIdentityCheck(req, res) {
  try {
    const data = await getProductIdentityAvailability(req.query);
    return ok(res, data, {
      source: 'sql-select-only',
      writePerformed: false,
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function getProductBulkUpdatePreview(req, res) {
  try {
    const data = await previewProductBulkUpdate(req.body);
    return ok(res, data, {
      source: 'sql-select-only',
      writePerformed: false,
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function getProductBulkCreatePreview(req, res) {
  try {
    const data = await previewProductBulkCreate(req.body);
    return ok(res, data, {
      source: 'sql-select-only',
      writePerformed: false,
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function postProductBulkCreateApply(req, res) {
  try {
    const data = await applyProductBulkCreate(req.body, req.user);
    return created(res, data, {
      source: 'sql-write',
      audit: 'products_bulk_created',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function postProductBulkUpdateApply(req, res) {
  try {
    const data = await applyProductBulkUpdate(req.body, req.user);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'products_bulk_updated',
    });
  } catch (error) {
    return writeError(res, error);
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

export async function postVegaProductImage(req, res) {
  try {
    const sourceId = Number(req.params.sourceId);
    const vegaResult = await getVegaProductsListFromWorker({ sourceId, page: 1, limit: 1, activeOnly: true });
    const verifiedProduct = vegaResult.data.find((product) => Number(product.sourceId) === sourceId);
    if (!verifiedProduct) {
      return fail(res, 404, 'VEGA_PRODUCT_NOT_FOUND', 'Vega stok kartı bulunamadı');
    }
    const data = await saveVegaProductImage(sourceId, req.body, req.user, verifiedProduct);
    return created(res, data, {
      source: 'melisa-sql-write-vega-link',
      vegaReadOnly: true,
      audit: 'vega_product_image_saved',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function deleteVegaProductImage(req, res) {
  try {
    const data = await removeVegaProductImage(req.params.sourceId, req.user);
    return ok(res, data, {
      source: 'melisa-sql-write-vega-link',
      vegaReadOnly: true,
      audit: 'vega_product_image_removed',
    });
  } catch (error) {
    return writeError(res, error);
  }
}
