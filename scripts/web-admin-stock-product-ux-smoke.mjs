import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const filters = read('apps/web-admin/src/modules/stock/StockListFilters.jsx');
const toolbar = read('apps/web-admin/src/modules/stock/StockListToolbar.jsx');
const stockList = read('apps/web-admin/src/modules/stock/StockListScreen.jsx');
const stockTable = read('apps/web-admin/src/modules/stock/StockListTable.jsx');
const stock360 = read('apps/web-admin/src/modules/stock/StockProduct360Panel.jsx');
const productCard = read('apps/web-admin/src/modules/product/ProductCardScreen.jsx');
const product360 = read('apps/web-admin/src/modules/product/Product360Panel.jsx');
const productImage = read('apps/web-admin/src/modules/product/ProductImagePanel.jsx');
const productService = read('apps/api/src/services/productService.js');
const productForm = read('apps/web-admin/src/modules/product/ProductCardForm.jsx');
const productHeader = read('apps/web-admin/src/modules/product/ProductCardHeader.jsx');
const productApi = read('apps/web-admin/src/services/productDetailApi.js');
const productRoutes = read('apps/api/src/routes/productRoutes.js');
const productController = read('apps/api/src/controllers/productController.js');
const auditService = read('apps/api/src/services/auditService.js');
const productUsage = read('apps/web-admin/src/modules/product/ProductStockUsagePanel.jsx');
const bulkProductCreate = read('apps/web-admin/src/modules/stock/BulkProductCreateScreen.jsx');
const bulkProductCreateStyles = read('apps/web-admin/src/styles/bulk-product-create.css');
const suggestedTextInput = read('apps/web-admin/src/components/forms/SuggestedTextInput.jsx');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const navigation = read('apps/web-admin/src/data/mockNavigationData.js');
const styles = read('apps/web-admin/src/styles/stock-product-ux.css');
const modernStyles = read('apps/web-admin/src/styles/erp-modern.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['stock list keeps one primary quick search', filters.includes('stock-filter-primary-row') && filters.includes('stock-search-input-wrap')],
  ['primary stock state and status remain visible', filters.includes('Stok durumu') && filters.includes('filters.status')],
  ['secondary stock filters are collapsible', filters.includes('stock-filter-details') && filters.includes('Ayrıntılı filtreler')],
  ['brand category and supplier suggestions remain available', filters.includes('suggestions.brands') && filters.includes('suggestions.categories') && filters.includes('suggestions.suppliers')],
  ['stock toolbar keeps create open and refresh actions', toolbar.includes('Yeni Ürün') && toolbar.includes('Ürün Kartı') && toolbar.includes('Yenile')],
  ['live Vega stock opens a read-only card summary without replacing the table', toolbar.includes("isReadOnly ? 'Kart Özeti' : 'Ürün Kartı'") && stockList.includes('setIsProduct360Open(true)') && !stockList.includes('Vega canlı stok kartı ayrıntısı bir sonraki adımda açılacak') && stock360.includes('isReadOnly = false') && stock360.includes("Vega'dan canlı okunan kart özeti")],
  ['secondary stock commands use overflow menu', toolbar.includes('stock-list-tools-menu') && toolbar.includes('Yazdır/PDF') && toolbar.includes('Kolonlar')],
  ['stock default columns include immutable card opening date', stockList.includes("'cardOpenedDate', 'status'") && stockList.includes("label: 'Kart Açılış Tarihi'") && productService.includes('cardOpenedAt: row.created_at')],
  ['stock card opening date range reaches the database query', filters.includes('type="date"') && filters.includes('cardOpenedFrom') && filters.includes('cardOpenedTo') && stockList.includes('cardOpenedFrom: filters.cardOpenedFrom') && productService.includes('@cardOpenedFrom IS NULL OR p.created_at >= @cardOpenedFrom') && productService.includes('p.created_at < DATEADD(day, 1, @cardOpenedTo)')],
  ['new stock column preference key activates defaults', stockList.includes("melisa.stockList.visibleColumns.v2")],
  ['Vega KOD4 is explicit in stock list and Product 360', stockList.includes("label: '4-ÖK (KOD4)'") && stockList.includes('specialCode4: product.specialCode4') && stock360.includes('<dt>4-ÖK (KOD4)</dt>')],
  ['stock image preview uses viewport portal and larger stable dimensions', stockTable.includes('createPortal') && stockTable.includes('previewWidth = Math.min(480') && modernStyles.includes('width: min(480px')],
  ['stock 360 recent movements are collapsible', stock360.includes('stock-360-movement-details') && stock360.includes('Son fiş hareketleri')],
  ['product form starts open and remains user-collapsible', productForm.includes('product-form-details') && productForm.includes('const [isOpen, setIsOpen] = useState(true)') && productForm.includes('onToggle=')],
  ['product form omits the redundant currency rule notice', !productForm.includes('currency-rule') && !productForm.includes('product.currencyRule')],
  ['product card opening date comes from immutable database creation time', productService.includes('p.created_at AS card_opened_at') && productService.includes('cardOpenedAt: row.card_opened_at') && productForm.includes('Kart açılış tarihi') && productForm.includes('<time dateTime={form.cardOpenedAt || undefined}>') && productHeader.includes('Kart açılışı:') && productHeader.includes('formatCardOpenedAt(cardOpenedAt)') && styles.includes('.card-opened-at-field time') && styles.includes('.product-card-opened-at time')],
  ['product identity check uses a read-only exact-match endpoint', productRoutes.includes("get('/products/identity-check'") && productService.includes('getProductIdentityAvailability')],
  ['stock code and barcode warn before save after debounce', productCard.includes('checkProductIdentityAvailability') && productCard.includes('}, 350)') && productForm.includes('product-identity-feedback duplicate') && productApi.includes("get('/api/products/identity-check'")],
  ['editable product details appear before stock summary and movements', productCard.indexOf('<ProductCardForm') < productCard.indexOf('<Product360Panel') && productCard.indexOf('<Product360Panel') < productCard.indexOf('<ProductStockUsagePanel')],
  ['product movements start collapsed and remain user-expandable', productCard.includes('defaultOpen={false}') && productUsage.includes('open={isOpen}')],
  ['duplicate stock summary is removed from product details', !productCard.includes('ProductStockSummary')],
  ['average stock cost uses historical document currency as primary', productService.includes('average_cost_currency') && product360.includes('averageCostCurrency') && product360.includes('Fiş kurlarıyla hesaplandı')],
  ['sales price shows currency-aware unit profit and margin badge', product360.includes('product-profit-badge') && product360.includes('grossProfitRate') && product360.includes('birim kâr')],
  ['product image and stock 360 use compact responsive layouts', productImage.includes('product-image-compact-body') && styles.includes('grid-template-columns: 132px minmax(0, 1fr)') && styles.includes('.product-card-screen .product-360-panel .entity-360-grid') && styles.includes('min-height: 58px')],
  ['bulk product card is routed from stock navigation', workspace.includes('<BulkProductCreateScreen') && navigation.includes("screenId: 'bulk-product-create'") && navigation.includes("'bulk-product-create': {")],
  ['bulk product card uses server preview before enabling real save', bulkProductCreate.includes('previewProductBulkCreate') && bulkProductCreate.includes('applyProductBulkCreate') && bulkProductCreate.includes('preview?.canApply') && bulkProductCreate.includes('confirmationCode: preview.confirmationCode')],
  ['bulk product stock code and barcode warn immediately after debounce', bulkProductCreate.includes('checkProductIdentityAvailability') && bulkProductCreate.includes('}, 400)') && bulkProductCreate.includes('Bu stok kodu mevcut') && bulkProductCreate.includes('Bu barkod mevcut') && bulkProductCreateStyles.includes('.bulk-product-identity-field.is-duplicate input')],
  ['bulk product create API is permission protected and separates preview from apply', productRoutes.includes("post('/products/bulk-create/preview'") && productRoutes.includes("post('/products/bulk-create/apply'") && productController.includes('writePerformed: false') && productController.includes("audit: 'products_bulk_created'")],
  ['bulk product create applies all rows in one transaction with duplicate locking and audit', productService.includes('applyProductBulkCreate') && productService.includes('await transaction.begin()') && productService.includes('assertProductDuplicates') && productService.includes("action: 'products_bulk_created'") && auditService.includes("'products_bulk_created'")],
  ['bulk product opening stock creates an auditable adjustment movement', productService.includes("source_type, source_id, quantity_in") && productService.includes("N'stock_adjustment'") && productService.includes('openingMovementId')],
  ['bulk product brand category and supplier use searchable suggestion inputs', bulkProductCreate.includes('SuggestedTextInput') && bulkProductCreate.includes('fetchProductOptions') && bulkProductCreate.includes('options.brands') && bulkProductCreate.includes('options.categories') && bulkProductCreate.includes('options.suppliers') && bulkProductCreate.includes('Yazın ve marka seçin')],
  ['bulk product suggestion menus escape clipped table cells', suggestedTextInput.includes('createPortal') && suggestedTextInput.includes('suggested-options-portal') && bulkProductCreate.includes('placeholder="Marka yazın" portal') && bulkProductCreate.includes('placeholder="Kategori yazın" portal') && bulkProductCreate.includes('placeholder="Tedarikçi yazın" portal')],
  ['bulk product supplier accepts exact code and exposes row error detail', productService.includes("const supplierCode = parts.length > 1 ? parts[0] : product.supplierName") && bulkProductCreate.includes('bulk-product-status-message') && bulkProductCreateStyles.includes('.bulk-product-status-message')],
  ['bulk product brand selection recalls category supplier and currency defaults', productService.includes('preferred_category') && productService.includes('preferred_supplier') && productService.includes('brandDefaults: Object.fromEntries') && bulkProductCreate.includes('options.brandDefaults[canonicalBrand]') && bulkProductCreate.includes('updateRowBrand')],
  ['new product supplier selection applies supplier card currency', productService.includes('supplierCurrencies') && productService.includes('currency: String(row.currency_code') && productCard.includes("field === 'supplierName'") && productCard.includes('optionSuggestions.supplierCurrencies[value]') && bulkProductCreate.includes('updateRowSupplier') && bulkProductCreate.includes('updateDefaultSupplier')],
  ['bulk product definitions require a real list option in UI and API', productService.includes('assertBulkCreateDefinitions') && productService.includes('PRODUCT_BULK_CREATE_CATEGORY_NOT_FOUND') && bulkProductCreate.includes('getDefinitionIssue') && bulkProductCreate.includes('invalid={definitionIssue?.field') && bulkProductCreateStyles.includes('.suggested-input-wrap.is-invalid input')],
  ['bulk product card has compact responsive table styling', bulkProductCreateStyles.includes('.bulk-product-create-table') && bulkProductCreateStyles.includes('min-width: 1560px') && bulkProductCreateStyles.includes('@media (max-width: 680px)')],
  ['product card uses layered panels and semantic movement rows', styles.includes('--product-workspace') && styles.includes('.identity-section') && styles.includes('.usage-in-row td')],
  ['movement table keeps seven operational columns', ['Tarih', 'Tip', 'Fiş No', 'Müşteri / Tedarikçi', 'Adet', 'TRY Tutar', 'Git'].every((label) => productUsage.includes(`<th>${label}</th>`)) && !productUsage.includes('<th>Maliyet TRY</th>')],
  ['scoped responsive stylesheet is loaded', main.includes("import './styles/stock-product-ux.css';") && styles.includes('@media (max-width: 1450px)') && styles.includes('@media (max-width: 680px)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - Stock Product UX / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
