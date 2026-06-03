import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toCatalogDto(row) {
  return {
    id: Number(row.id),
    catalogNo: row.catalog_no,
    name: row.name,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customerName: row.customer_name || null,
    status: row.status,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    itemCount: Number(row.item_count || 0),
    imageReadyCount: Number(row.image_ready_count || 0),
    stockReadyCount: Number(row.stock_ready_count || 0),
    totalSaleValue: Number(row.total_sale_value || 0),
    currency: row.currency_code || 'TRY',
    createdAt: row.created_at,
  };
}

function toCatalogItemDto(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    stockCode: row.stock_code,
    barcode: row.barcode || '',
    productName: row.product_name,
    brand: row.brand || '',
    category: row.category || '',
    stockQuantity: Number(row.stock_quantity || 0),
    price: Number(row.price_snapshot || 0),
    currency: row.currency_code || 'TRY',
    hasImage: Boolean(row.has_image),
    imagePath: row.image_path || '',
    displayOrder: Number(row.display_order || 0),
    note: row.note || '',
  };
}

function toCandidateDto(row) {
  return {
    productId: Number(row.product_id),
    stockCode: row.stock_code,
    barcode: row.barcode || '',
    productName: row.product_name,
    brand: row.brand || '',
    category: row.category || '',
    stockQuantity: Number(row.stock_quantity || 0),
    salePrice: Number(row.sale_price || 0),
    currency: row.currency_code || 'TRY',
    hasImage: Boolean(row.has_image),
    readiness: row.has_image && Number(row.stock_quantity || 0) > 0 ? 'ready' : 'needs_attention',
  };
}

async function getSummary(pool) {
  const result = await pool.request().query(`
    SELECT
      COUNT_BIG(DISTINCT c.id) AS catalog_count,
      COUNT_BIG(ci.id) AS catalog_item_count,
      SUM(CASE WHEN pi.id IS NOT NULL THEN 1 ELSE 0 END) AS image_ready_count,
      SUM(CASE WHEN p.current_stock_qty > 0 THEN 1 ELSE 0 END) AS stock_ready_count,
      COUNT_BIG(DISTINCT CASE WHEN c.status = N'published' THEN c.id END) AS published_count
    FROM dbo.catalogs c
    LEFT JOIN dbo.catalog_items ci ON ci.catalog_id = c.id
    LEFT JOIN dbo.products p ON p.id = ci.product_id
    LEFT JOIN dbo.product_images pi ON pi.id = ci.product_image_id AND pi.is_active = 1;
  `);

  const row = result.recordset?.[0] || {};
  return {
    catalogCount: Number(row.catalog_count || 0),
    catalogItemCount: Number(row.catalog_item_count || 0),
    imageReadyCount: Number(row.image_ready_count || 0),
    stockReadyCount: Number(row.stock_ready_count || 0),
    publishedCount: Number(row.published_count || 0),
  };
}

async function getCatalogItems(pool, catalogId) {
  const result = await pool.request()
    .input('catalogId', sql.BigInt, catalogId)
    .query(`
      SELECT
        ci.id,
        ci.product_id,
        p.stock_code,
        pb.barcode,
        p.name AS product_name,
        p.brand,
        p.category,
        p.current_stock_qty AS stock_quantity,
        ci.price_snapshot,
        ci.currency_code,
        CASE WHEN pi.id IS NULL THEN 0 ELSE 1 END AS has_image,
        COALESCE(pi.file_path, pi.storage_key, N'') AS image_path,
        ci.display_order,
        ci.note
      FROM dbo.catalog_items ci
      INNER JOIN dbo.products p ON p.id = ci.product_id
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      LEFT JOIN dbo.product_images pi ON pi.id = ci.product_image_id AND pi.is_active = 1
      WHERE ci.catalog_id = @catalogId
      ORDER BY ci.display_order ASC, ci.id ASC;
    `);

  return (result.recordset || []).map(toCatalogItemDto);
}

export async function getCatalogOverview(query = {}) {
  const pool = await getSqlPool();
  const search = trimText(query.search);
  const status = trimText(query.status);
  const catalogId = Number(query.catalogId || 0) || null;
  const productSearch = trimText(query.productSearch);
  const brand = trimText(query.brand);
  const category = trimText(query.category);
  const currency = trimText(query.currency).toUpperCase();
  const stockMode = trimText(query.stockMode);
  const imageMode = trimText(query.imageMode);
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);

  const catalogResult = await pool.request()
    .input('search', sql.NVarChar(120), search ? `%${search}%` : null)
    .input('status', sql.NVarChar(20), status || null)
    .query(`
      SELECT TOP (80)
        c.id,
        c.catalog_no,
        c.name,
        c.customer_id,
        cu.name AS customer_name,
        c.status,
        c.valid_from,
        c.valid_to,
        c.created_at,
        COUNT_BIG(ci.id) AS item_count,
        SUM(CASE WHEN pi.id IS NOT NULL THEN 1 ELSE 0 END) AS image_ready_count,
        SUM(CASE WHEN p.current_stock_qty > 0 THEN 1 ELSE 0 END) AS stock_ready_count,
        SUM(COALESCE(ci.price_snapshot, 0)) AS total_sale_value,
        MAX(COALESCE(ci.currency_code, N'TRY')) AS currency_code
      FROM dbo.catalogs c
      LEFT JOIN dbo.customers cu ON cu.id = c.customer_id
      LEFT JOIN dbo.catalog_items ci ON ci.catalog_id = c.id
      LEFT JOIN dbo.products p ON p.id = ci.product_id
      LEFT JOIN dbo.product_images pi ON pi.id = ci.product_image_id AND pi.is_active = 1
      WHERE
        (@status IS NULL OR c.status = @status)
        AND (
          @search IS NULL
          OR c.catalog_no COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR cu.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
      GROUP BY c.id, c.catalog_no, c.name, c.customer_id, cu.name, c.status, c.valid_from, c.valid_to, c.created_at
      ORDER BY c.id DESC;
    `);

  const candidateRequest = pool.request()
    .input('productSearch', sql.NVarChar(160), productSearch ? `%${productSearch}%` : null)
    .input('brand', sql.NVarChar(120), brand || null)
    .input('category', sql.NVarChar(120), category || null)
    .input('currency', sql.NVarChar(3), currency || null)
    .input('stockMode', sql.NVarChar(20), stockMode || null)
    .input('imageMode', sql.NVarChar(20), imageMode || null)
    .input('minPrice', sql.Decimal(18, 4), Number.isFinite(minPrice) ? minPrice : null)
    .input('maxPrice', sql.Decimal(18, 4), Number.isFinite(maxPrice) ? maxPrice : null);

  const candidateResult = await candidateRequest.query(`
    SELECT TOP (80)
      p.id AS product_id,
      p.stock_code,
      pb.barcode,
      p.name AS product_name,
      p.brand,
      p.category,
      p.current_stock_qty AS stock_quantity,
      p.sales_price AS sale_price,
      p.currency_code,
      CASE WHEN pi.id IS NULL THEN 0 ELSE 1 END AS has_image
    FROM dbo.products p
    OUTER APPLY (
      SELECT TOP (1) b.barcode
      FROM dbo.product_barcodes b
      WHERE b.product_id = p.id AND b.is_active = 1
      ORDER BY b.is_primary DESC, b.id ASC
    ) pb
    OUTER APPLY (
      SELECT TOP (1) i.id
      FROM dbo.product_images i
      WHERE i.product_id = p.id AND i.is_active = 1
      ORDER BY i.is_primary DESC, i.sort_order ASC, i.id ASC
    ) pi
    WHERE p.is_deleted = 0
      AND p.is_active = 1
      AND (
        @productSearch IS NULL
        OR p.stock_code COLLATE Latin1_General_CI_AI LIKE @productSearch COLLATE Latin1_General_CI_AI
        OR p.name COLLATE Latin1_General_CI_AI LIKE @productSearch COLLATE Latin1_General_CI_AI
        OR p.brand COLLATE Latin1_General_CI_AI LIKE @productSearch COLLATE Latin1_General_CI_AI
        OR p.category COLLATE Latin1_General_CI_AI LIKE @productSearch COLLATE Latin1_General_CI_AI
        OR EXISTS (
          SELECT 1
          FROM dbo.product_barcodes bx
          WHERE bx.product_id = p.id
            AND bx.is_active = 1
            AND bx.barcode COLLATE Latin1_General_CI_AI LIKE @productSearch COLLATE Latin1_General_CI_AI
        )
      )
      AND (@brand IS NULL OR p.brand = @brand)
      AND (@category IS NULL OR p.category = @category)
      AND (@currency IS NULL OR p.currency_code = @currency)
      AND (
        @stockMode IS NULL
        OR (@stockMode = N'inStock' AND p.current_stock_qty > 0)
        OR (@stockMode = N'zero' AND p.current_stock_qty = 0)
        OR (@stockMode = N'negative' AND p.current_stock_qty < 0)
      )
      AND (
        @imageMode IS NULL
        OR (@imageMode = N'withImage' AND pi.id IS NOT NULL)
        OR (@imageMode = N'withoutImage' AND pi.id IS NULL)
      )
      AND (@minPrice IS NULL OR p.sales_price >= @minPrice)
      AND (@maxPrice IS NULL OR p.sales_price <= @maxPrice)
    ORDER BY
      CASE WHEN p.current_stock_qty > 0 THEN 0 ELSE 1 END ASC,
      CASE WHEN pi.id IS NULL THEN 1 ELSE 0 END ASC,
      p.current_stock_qty DESC,
      p.id DESC;
  `);

  const filterOptionsResult = await pool.request().query(`
    SELECT TOP (80) brand AS value
    FROM dbo.products
    WHERE is_deleted = 0 AND is_active = 1 AND ISNULL(brand, N'') <> N''
    GROUP BY brand
    ORDER BY brand;

    SELECT TOP (80) category AS value
    FROM dbo.products
    WHERE is_deleted = 0 AND is_active = 1 AND ISNULL(category, N'') <> N''
    GROUP BY category
    ORDER BY category;
  `);

  const catalogs = (catalogResult.recordset || []).map(toCatalogDto);
  const selectedCatalogId = catalogId || catalogs[0]?.id || null;
  const items = selectedCatalogId ? await getCatalogItems(pool, selectedCatalogId) : [];

  return {
    summary: await getSummary(pool),
    catalogs,
    selectedCatalogId: selectedCatalogId ? Number(selectedCatalogId) : null,
    items,
    productCandidates: (candidateResult.recordset || []).map(toCandidateDto),
    filterOptions: {
      brands: (filterOptionsResult.recordsets?.[0] || []).map((row) => row.value),
      categories: (filterOptionsResult.recordsets?.[1] || []).map((row) => row.value),
      currencies: ['TRY', 'USD', 'EUR'],
    },
    filters: {
      search,
      status,
      catalogId: selectedCatalogId ? Number(selectedCatalogId) : null,
      productSearch,
      brand,
      category,
      currency,
      stockMode,
      imageMode,
      minPrice: Number.isFinite(minPrice) ? minPrice : null,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    },
  };
}

export async function createCatalogDraft(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const name = trimText(payload.name) || `Katalog ${new Date().toISOString().slice(0, 10)}`;
  const customerId = Number(payload.customerId || 0) || null;
  const productIds = Array.isArray(payload.productIds)
    ? [...new Set(payload.productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (productIds.length < 1) {
    throw makeServiceError('CATALOG_PRODUCTS_REQUIRED', 'Katalog icin en az bir urun secilmeli');
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const catalogNo = `KAT-${Date.now()}`;
    const insertCatalog = await new sqlDriver.Request(transaction)
      .input('catalogNo', sql.NVarChar(50), catalogNo)
      .input('name', sql.NVarChar(200), name)
      .input('customerId', sql.BigInt, customerId)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.catalogs (catalog_no, name, customer_id, status, created_by)
        OUTPUT inserted.id
        VALUES (@catalogNo, @name, @customerId, N'draft', @actorId);
      `);

    const catalogId = Number(insertCatalog.recordset[0].id);

    for (let index = 0; index < productIds.length; index += 1) {
      await new sqlDriver.Request(transaction)
        .input('catalogId', sql.BigInt, catalogId)
        .input('productId', sql.BigInt, productIds[index])
        .input('displayOrder', sql.Int, index + 1)
        .query(`
          INSERT INTO dbo.catalog_items (
            catalog_id,
            product_id,
            product_image_id,
            display_order,
            price_snapshot,
            currency_code,
            note
          )
          SELECT
            @catalogId,
            p.id,
            pi.id,
            @displayOrder,
            p.sales_price,
            p.currency_code,
            CASE WHEN pi.id IS NULL THEN N'Gorsel eksik' ELSE NULL END
          FROM dbo.products p
          OUTER APPLY (
            SELECT TOP (1) i.id
            FROM dbo.product_images i
            WHERE i.product_id = p.id AND i.is_active = 1
            ORDER BY i.is_primary DESC, i.sort_order ASC, i.id ASC
          ) pi
          WHERE p.id = @productId
            AND p.is_deleted = 0
            AND p.is_active = 1;
        `);
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'catalog_draft_created',
      entityType: 'catalog',
      entityId: catalogId,
      beforeSnapshot: null,
      afterSnapshot: { catalogNo, name, customerId, productIds },
      actor,
    });

    await transaction.commit();
    return {
      catalogId,
      catalogNo,
      name,
      itemCount: productIds.length,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getWhatsappPlanner(query = {}) {
  const pool = await getSqlPool();
  const catalogId = Number(query.catalogId || 0) || null;

  const customerResult = await pool.request().query(`
    SELECT TOP (80)
      c.id,
      c.customer_code,
      c.name,
      c.city,
      c.country,
      c.currency_code,
      c.balance,
      MAX(si.document_date) AS last_sale_date,
      COUNT_BIG(si.id) AS receipt_count
    FROM dbo.customers c
    LEFT JOIN dbo.sales_invoices si ON si.customer_id = c.id AND si.status = N'finalized'
    WHERE c.is_active = 1 AND c.is_deleted = 0
    GROUP BY c.id, c.customer_code, c.name, c.city, c.country, c.currency_code, c.balance
    ORDER BY MAX(si.document_date) DESC, c.id DESC;
  `);

  const catalogResult = await pool.request().query(`
    SELECT TOP (20)
      c.id,
      c.catalog_no,
      c.name,
      c.status,
      COUNT_BIG(ci.id) AS item_count
    FROM dbo.catalogs c
    LEFT JOIN dbo.catalog_items ci ON ci.catalog_id = c.id
    GROUP BY c.id, c.catalog_no, c.name, c.status
    ORDER BY CASE WHEN c.status = N'published' THEN 0 ELSE 1 END, c.id DESC;
  `);

  const selectedCatalog = catalogId
    ? catalogResult.recordset.find((row) => Number(row.id) === catalogId)
    : catalogResult.recordset[0];

  const messageTemplate = selectedCatalog
    ? `Merhaba, ${selectedCatalog.name} katalogumuz hazir. Urun ve fiyat listesini inceleyebilirsiniz.`
    : 'Merhaba, Melisa Bebe urun katalogumuz hazir. Urun ve fiyat listesini inceleyebilirsiniz.';

  return {
    catalogs: (catalogResult.recordset || []).map((row) => ({
      id: Number(row.id),
      catalogNo: row.catalog_no,
      name: row.name,
      status: row.status,
      itemCount: Number(row.item_count || 0),
    })),
    selectedCatalogId: selectedCatalog ? Number(selectedCatalog.id) : null,
    messageTemplate,
    customers: (customerResult.recordset || []).map((row) => ({
      id: Number(row.id),
      customerCode: row.customer_code,
      customerName: row.name,
      city: row.city || '',
      country: row.country || '',
      currency: row.currency_code || 'TRY',
      balance: Number(row.balance || 0),
      lastSaleDate: row.last_sale_date,
      receiptCount: Number(row.receipt_count || 0),
      whatsappText: `${messageTemplate} Cari: ${row.name}`,
    })),
  };
}
