import { OperationsWorkspace, operationScreens } from '../../modules/demo/OperationsWorkspace.jsx';
import { TerminalWorkspace } from '../../modules/demo/TerminalWorkspace.jsx';
import { ReportsWorkspace } from '../../modules/demo/ReportsWorkspace.jsx';
import { demoRoleCanOpen, demoRolePermissions } from '../../config/demoRolePolicy.js';
import { ConnectedReadWorkspace, connectedReadScreens } from '../../modules/demo/ConnectedReadWorkspace.jsx';
import { DemoStoreGate } from '../../modules/demo/DemoStoreGate.jsx';
import { apiConfig } from '../../config/apiConfig.js';
import { VegaReadWorkspace } from '../../modules/vega/VegaReadWorkspace.jsx';
import {SupplierReturnReadScreen} from '../../modules/purchase/SupplierReturnReadScreen.jsx';
import React from 'react';
import { UnauthorizedScreen } from '../auth/UnauthorizedScreen.jsx';
import { CatalogListScreen } from '../../modules/catalog/CatalogListScreen.jsx';
import { CustomerCardScreen } from '../../modules/customer/CustomerCardScreen.jsx';
import { CustomerListScreen } from '../../modules/customer/CustomerListScreen.jsx';
import { CustomerMovementsScreen } from '../../modules/customer/CustomerMovementsScreen.jsx';
import { VegaCustomerMovementsScreen } from '../../modules/customer/VegaKoliMovementsScreen.jsx';
import { CustomerStatementScreen } from '../../modules/customer/CustomerStatementScreen.jsx';
import { DashboardScreen } from '../../modules/dashboard/DashboardScreen.jsx';
import { OperationalHealthScreen } from '../../modules/operations/OperationalHealthScreen.jsx';
import { AccountingJournalScreen } from '../../modules/finance/AccountingJournalScreen.jsx';
import { AccountingControlScreen } from '../../modules/finance/AccountingControlScreen.jsx';
import { CashBankLedgerScreen } from '../../modules/finance/CashBankLedgerScreen.jsx';
import { CashRegisterScreen } from '../../modules/finance/CashRegisterScreen.jsx';
import { CashCustomerTrackingScreen } from '../../modules/finance/CashCustomerTrackingScreen.jsx';
import { CollectionsOverviewScreen } from '../../modules/finance/CollectionsOverviewScreen.jsx';
import { CollectionNoticeScreen } from '../../modules/finance/CollectionNoticeScreen.jsx';
import { ChequeCreateScreen } from '../../modules/finance/ChequeCreateScreen.jsx';
import { SupplierPaymentScreen } from '../../modules/finance/SupplierPaymentScreen.jsx';
import { FinanceTransferForm } from '../../modules/finance/FinanceTransferForm.jsx';
import { FinanceOverviewScreen } from '../../modules/finance/FinanceOverviewScreen.jsx';
import { ImportScreen } from '../../modules/import/ImportScreen.jsx';
import { ExportCenterScreen } from '../../modules/reports/ExportCenterScreen.jsx';
import { ManagementReportsScreen } from '../../modules/reports/ManagementReportsScreen.jsx';
import { VegaSalesComparisonScreen } from '../../modules/reports/VegaSalesComparisonScreen.jsx';
import { VegaSalesPerformanceScreen } from '../../modules/reports/VegaSalesPerformanceScreen.jsx';
import { VegaProductProfitabilityScreen } from '../../modules/reports/VegaProductProfitabilityScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
import { BulkPurchaseEntryScreen } from '../../modules/purchase/BulkPurchaseEntryScreen.jsx';
import { VegaPurchaseInvoiceListScreen } from '../../modules/purchase/VegaPurchaseInvoiceListScreen.jsx';
import { PurchaseInvoiceScreen } from '../../modules/purchase/PurchaseInvoiceScreen.jsx';
import { VegaSalesInvoiceListScreen } from '../../modules/sales/VegaSalesInvoiceListScreen.jsx';
import { FedexMicroExportDemoScreen } from '../../modules/sales/FedexMicroExportDemoScreen.jsx';
import { ProformaInvoiceScreen } from '../../modules/sales/ProformaInvoiceScreen.jsx';
import { SalesInvoiceScreen } from '../../modules/sales/SalesInvoiceScreen.jsx';
import { SalesPipelineListScreen } from '../../modules/sales/SalesPipelineListScreen.jsx';
import { SalesPipelineScreen } from '../../modules/sales/SalesPipelineScreen.jsx';
import { AuthAdminScreen } from '../../modules/settings/AuthAdminScreen.jsx';
import { AuditLogScreen } from '../../modules/settings/AuditLogScreen.jsx';
import { CurrencyRatesScreen } from '../../modules/settings/CurrencyRatesScreen.jsx';
import { DefinitionsScreen } from '../../modules/settings/DefinitionsScreen.jsx';
import { PersonnelDefinitionsScreen } from '../../modules/settings/PersonnelDefinitionsScreen.jsx';
import { SystemSettingsScreen } from '../../modules/settings/SystemSettingsScreen.jsx';
import { PriceListScreen } from '../../modules/stock/PriceListScreen.jsx';
import { BulkProductCreateScreen } from '../../modules/stock/BulkProductCreateScreen.jsx';
import { StockCountScreen } from '../../modules/stock/StockCountScreen.jsx';
import { NativeStockCountScreen } from '../../modules/stock/NativeStockCountScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';
import { StockMovementsScreen } from '../../modules/stock/StockMovementsScreen.jsx';
import { StockValuationScreen } from '../../modules/stock/StockValuationScreen.jsx';
import { SupplierCardScreen } from '../../modules/supplier/SupplierCardScreen.jsx';
import { SupplierListScreen } from '../../modules/supplier/SupplierListScreen.jsx';
import { SupplierMovementsScreen } from '../../modules/supplier/SupplierMovementsScreen.jsx';
import { VegaSupplierMovementsScreen } from '../../modules/supplier/VegaSupplierMovementsScreen.jsx';
import { SupplierStatementScreen } from '../../modules/supplier/SupplierStatementScreen.jsx';
import { TerminalAdminScreen } from '../../modules/terminal/TerminalAdminScreen.jsx';
import { WhatsappCrmWorkspace } from '../../modules/whatsapp-crm/WhatsappCrmWorkspace.jsx';
import { WhatsappPlannerScreen } from '../../modules/catalog/WhatsappPlannerScreen.jsx';
import { WhatsappWebQueueScreen } from '../../modules/catalog/WhatsappWebQueueScreen.jsx';
import { ReadOnlyInvoiceListScreen } from '../../modules/shared/ReadOnlyInvoiceListScreen.jsx';
import { ReadOnlyPartyListScreen } from '../../modules/shared/ReadOnlyPartyListScreen.jsx';
import { ReceiptReadScreen } from '../../modules/purchase/ReceiptReadScreen.jsx';

const testReadOnly = import.meta.env.VITE_TEST_READ_ONLY === 'true';

function UnmappedScreen({ screen }) {
  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Ekran bağlı değil</strong>
          <span>{screen?.label || 'Bilinmeyen ekran'}</span>
        </div>
        <div className="list-state list-state-error">
          Bu ekran henüz gerçek veri kaynağına bağlanmamış. Kullanıma açılmadan önce çalışma alanı bağlantısı tamamlanmalıdır.
        </div>
      </section>
    </main>
  );
}

function DemoPendingScreen({ screen }) {
  return <main className="work-area"><section className="erp-panel">
    <h1>{screen?.label || 'Bu ekran'}</h1>
    <p>Bu işlevin bağlı demo veri kaynağı henüz tamamlanmadı. Eski örnek kayıtlar gerçek işlem sonucu gibi gösterilmiyor.</p>
    <p>İlgili iş akışı sonraki çalışma paketinde bağlanacak.</p>
  </section></main>;
}

function hasAnyPermission(permissions, permissionKeys) {
  return permissionKeys.some((permissionKey) => permissions.includes(permissionKey));
}

function hasRoutePermission(permissions, route) {
  if (!route.permissionKeys?.length) {
    return true;
  }

  return route.permissionMode === 'all'
    ? route.permissionKeys.every((permissionKey) => permissions.includes(permissionKey))
    : hasAnyPermission(permissions, route.permissionKeys);
}

const workspaceRouteRegistry = {
  dashboard: {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Ana sayfayı görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen, permissions, roleViewId }) => (
      <DashboardScreen onOpenScreen={onOpenScreen} permissions={permissions} roleViewId={roleViewId} />
    ),
  },
  'operational-health': {
    permissionKeys: ['audit.view'],
    unauthorizedMessage: 'Operasyon sağlığını görüntüleme yetkiniz yok.',
    render: () => <OperationalHealthScreen />,
  },
  'stock-list': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'Stok görüntüleme yetkiniz yok.',
    render: ({ activeTab, onOpenScreen, permissions }) => (
      <StockListScreen
        onOpenScreen={onOpenScreen}
        permissions={permissions}
        initialStockCode={activeTab.payload?.stockCode}
        initialSourceId={activeTab.payload?.sourceId}
      />
    ),
  },
  'product-card': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'Ürün görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen, permissions }) => (
      <ProductCardScreen
        productId={activeTab.payload?.productId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'stock-movements': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'Stok hareketleri görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <StockMovementsScreen onOpenScreen={onOpenScreen} />,
  },
  'stock-valuation': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'Stok değerleme görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <StockValuationScreen onOpenScreen={onOpenScreen} />,
  },
  'stock-count': {
    permissionKeys: testReadOnly ? ['stock.adjust', 'terminal.stock_count.create'] : ['product.view', 'product.edit'],
    permissionMode: testReadOnly ? 'any' : 'all',
    unauthorizedMessage: testReadOnly ? 'Sayım görüntüleme yetkisi doğrulanmadı.' : 'Stok sayımı için ürün görüntüleme ve stok düzenleme yetkileri birlikte gereklidir.',
    render: ({ activeTab, onDirtyChange, onOpenScreen }) => testReadOnly ? <NativeStockCountScreen initialCount={activeTab.payload?.count} /> : <StockCountScreen onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen} />,
  },
  'bulk-product-create': {
    permissionKeys: ['product.edit'],
    unauthorizedMessage: 'Toplu stok kartı hazırlama yetkiniz yok.',
    render: ({ onDirtyChange, onOpenScreen }) => (
      <BulkProductCreateScreen onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen} />
    ),
  },
  'price-list': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'Fiyat listesi görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <PriceListScreen onOpenScreen={onOpenScreen} />,
  },
  'customer-list': {
    permissionKeys: ['customer.view'],
    unauthorizedMessage: 'Cari görüntüleme yetkiniz yok.',
    render: ({ activeTab, onOpenScreen }) => testReadOnly
      ? <ReadOnlyPartyListScreen kind="customer" onOpenScreen={onOpenScreen} initialPartyId={activeTab.payload?.customerId} />
      : <CustomerListScreen onOpenScreen={onOpenScreen} />,
  },
  'customer-card': {
    permissionKeys: ['customer.view'],
    unauthorizedMessage: 'Cari görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen, permissions }) => (
      <CustomerCardScreen
        customerId={activeTab.payload?.customerId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'customer-movements': {
    permissionKeys: ['customer.view'],
    unauthorizedMessage: 'Cari hareketleri görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <CustomerMovementsScreen onOpenScreen={onOpenScreen} />,
  },
  'vega-koli-movements': {
    permissionKeys: ['customer.view'],
    unauthorizedMessage: 'Vega cari hareketlerini görüntüleme yetkiniz yok.',
    render: ({ activeTab }) => (
      <VegaCustomerMovementsScreen
        customerSourceId={activeTab.payload?.customerSourceId}
        customerCode={activeTab.payload?.customerCode}
        customerName={activeTab.payload?.customerName}
        customerCurrency={activeTab.payload?.customerCurrency}
        initialDateFrom={activeTab.payload?.initialDateFrom}
        initialDateTo={activeTab.payload?.initialDateTo}
        initialMovementType={activeTab.payload?.initialMovementType}
      />
    ),
  },
  'customer-statement': {
    permissionKeys: ['customer.view'],
    unauthorizedMessage: 'Cari ekstre görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <CustomerStatementScreen onOpenScreen={onOpenScreen} />,
  },
  'supplier-list': {
    permissionKeys: ['supplier.view'],
    unauthorizedMessage: 'Tedarikçi görüntüleme yetkiniz yok.',
    render: ({ activeTab, onOpenScreen, permissions }) => testReadOnly
      ? <ReadOnlyPartyListScreen kind="supplier" onOpenScreen={onOpenScreen} initialPartyId={activeTab.payload?.supplierId} permissions={permissions} />
      : <SupplierListScreen onOpenScreen={onOpenScreen} />,
  },
  'supplier-card': {
    permissionKeys: ['supplier.view'],
    unauthorizedMessage: 'Tedarikçi kartı görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen, permissions }) => (
      <SupplierCardScreen
        supplierId={activeTab.payload?.supplierId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'supplier-movements': {
    permissionKeys: ['supplier.view'],
    unauthorizedMessage: 'Tedarikçi cari hareketleri görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <SupplierMovementsScreen onOpenScreen={onOpenScreen} />,
  },
  'vega-supplier-movements': {
    permissionKeys: ['supplier.view'],
    unauthorizedMessage: 'Vega tedarikçi hareketlerini görüntüleme yetkiniz yok.',
    render: ({ activeTab }) => (
      <VegaSupplierMovementsScreen
        supplierSourceId={activeTab.payload?.supplierSourceId}
        supplierCode={activeTab.payload?.supplierCode}
        supplierName={activeTab.payload?.supplierName}
        supplierCurrency={activeTab.payload?.supplierCurrency}
      />
    ),
  },
  'supplier-statement': {
    permissionKeys: ['supplier.view'],
    unauthorizedMessage: 'Tedarikçi ekstresi görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <SupplierStatementScreen onOpenScreen={onOpenScreen} />,
  },
  'sales-invoice': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Satış fişi görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen, permissions }) => (
      <SalesInvoiceScreen
        salesDraftId={activeTab.payload?.salesDraftId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'sales-invoice-list': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Satış listesi görüntüleme yetkiniz yok.',
    render: ({ activeTab, onOpenScreen }) => testReadOnly
      ? <ReadOnlyInvoiceListScreen kind="sales" initialDocumentId={activeTab.payload?.salesDraftId} onOpenScreen={onOpenScreen} returnScreen={activeTab.payload?.returnScreen} returnPayload={activeTab.payload?.returnPayload} />
      : <VegaSalesInvoiceListScreen onOpenScreen={onOpenScreen} />,
  },
  'fedex-micro-export-demo': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Mikro ihracat demo ekranını görüntüleme yetkiniz yok.',
    render: () => <FedexMicroExportDemoScreen />,
  },
  'proforma-invoice': {
    permissionKeys: ['sales.view', 'customer.view'],
    permissionMode: 'all',
    unauthorizedMessage: 'Proforma hazırlamak için satış fişi ve müşteri bilgisi görüntüleme yetkileri birlikte gereklidir.',
    render: ({ activeTab, onDirtyChange, user }) => (
      <ProformaInvoiceScreen
        initialPayload={activeTab.payload}
        onDirtyChange={onDirtyChange}
        draftOwnerId={user?.id || user?.username || 'unassigned'}
      />
    ),
  },
  'sales-offers': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Teklif görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen, permissions }) => (
      <SalesPipelineListScreen type="offer" onOpenScreen={onOpenScreen} permissions={permissions} />
    ),
  },
  'sales-offer': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Teklif görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen }) => (
      <SalesPipelineScreen
        type="offer"
        documentId={activeTab.payload?.offerId}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'sales-orders': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Sipariş görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen, permissions }) => (
      <SalesPipelineListScreen type="order" onOpenScreen={onOpenScreen} permissions={permissions} />
    ),
  },
  'sales-order': {
    permissionKeys: ['sales.view'],
    unauthorizedMessage: 'Sipariş görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen }) => (
      <SalesPipelineScreen
        type="order"
        documentId={activeTab.payload?.orderId}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'purchase-invoice': {
    permissionKeys: ['purchase.view'],
    unauthorizedMessage: 'Alış fişi görüntüleme yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, permissions }) => (
      <PurchaseInvoiceScreen
        purchaseDraftId={activeTab.payload?.purchaseDraftId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
      />
    ),
  },
  'bulk-purchase-entry': {
    permissionKeys: ['purchase.view'],
    unauthorizedMessage: 'Toplu alış girişini görüntüleme yetkiniz yok.',
    render: ({ onDirtyChange, onOpenScreen, permissions }) => (
      <BulkPurchaseEntryScreen
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'inventory-receipt-list': {
    permissionKeys: ['purchase.view', 'purchase.create'],
    unauthorizedMessage: 'Mal kabul görüntüleme yetkiniz yok.',
    render: ({ activeTab }) => testReadOnly
      ? <ReceiptReadScreen initialReceiptId={activeTab.payload?.receiptId} />
      : <UnmappedScreen screen={{ label: 'Gelen mal' }} />,
  },
  'purchase-invoice-list': {
    permissionKeys: ['purchase.view'],
    unauthorizedMessage: 'Alış listesi görüntüleme yetkiniz yok.',
    render: ({ activeTab, onOpenScreen }) => testReadOnly
      ? activeTab.payload?.mode === 'supplier-return-read' ? <SupplierReturnReadScreen onOpenScreen={onOpenScreen} /> : <ReadOnlyInvoiceListScreen kind="purchase" initialDocumentId={activeTab.payload?.purchaseDraftId} onOpenScreen={onOpenScreen} returnScreen={activeTab.payload?.returnScreen} returnPayload={activeTab.payload?.returnPayload} />
      : <VegaPurchaseInvoiceListScreen onOpenScreen={onOpenScreen} />,
  },
  'finance-overview': {
    permissionKeys: ['dashboard.view', 'finance.view'],
    unauthorizedMessage: 'Finans özeti görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <FinanceOverviewScreen onOpenScreen={onOpenScreen} />,
  },
  'collections-overview': {
    permissionKeys: testReadOnly ? ['finance.view', 'finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'] : ['finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'],
    unauthorizedMessage: 'Tahsilat/ödeme kaydı için finans yetkiniz yok.',
    render: ({ activeTab, onDirtyChange, onOpenScreen }) => testReadOnly ? (activeTab.payload?.mode==='cheque'?<ChequeCreateScreen initialCheque={activeTab.payload?.cheque} />:activeTab.payload?.mode==='payment'?<SupplierPaymentScreen supplierId={activeTab.payload?.supplierId} source={activeTab.payload?.source} />:<CollectionNoticeScreen initialNotice={activeTab.payload?.notice} onOpenScreen={onOpenScreen} />) : (
      <CollectionsOverviewScreen
        initialPayload={activeTab.payload}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'cash-customers': {
    permissionKeys: ['finance.view', 'customer.view', 'sales.view'],
    unauthorizedMessage: 'Peşin cari takibini görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <CashCustomerTrackingScreen onOpenScreen={onOpenScreen} />,
  },
  'cash-bank-ledger': {
    permissionKeys: ['dashboard.view', 'finance.view', 'customer.view'],
    unauthorizedMessage: 'Kasa/banka defteri görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen, permissions }) => <CashBankLedgerScreen readOnly={testReadOnly || !hasAnyPermission(permissions, ['finance.payment', 'finance.collection', 'settings.manage'])} onOpenScreen={onOpenScreen} commandPanel={testReadOnly ? <FinanceTransferForm /> : null} />,
  },
  'cash-register': {
    permissionKeys: ['finance.view', 'finance.collection', 'finance.payment'],
    unauthorizedMessage: 'Günlük kasa oturumu için finans yetkiniz yok.',
    render: ({ onDirtyChange, permissions }) => (
      <CashRegisterScreen onDirtyChange={onDirtyChange} permissions={permissions} />
    ),
  },
  'accounting-journal': {
    permissionKeys: ['dashboard.view', 'finance.view'],
    unauthorizedMessage: 'Muhasebe defteri görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <AccountingJournalScreen onOpenScreen={onOpenScreen} />,
  },
  'accounting-control': {
    permissionKeys: ['dashboard.view', 'finance.view'],
    unauthorizedMessage: 'Muhasebe kontrol paneli görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <AccountingControlScreen onOpenScreen={onOpenScreen} />,
  },
  'catalog-list': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'Katalog görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <CatalogListScreen onOpenScreen={onOpenScreen} />,
  },
  'whatsapp-planner': {
    permissionKeys: ['customer.view'],
    unauthorizedMessage: 'WhatsApp paylaşım listesi görüntüleme yetkiniz yok.',
    render: ({ onOpenScreen }) => <WhatsappPlannerScreen onOpenScreen={onOpenScreen} />,
  },
  'whatsapp-web-queue': {
    permissionKeys: ['product.view'],
    unauthorizedMessage: 'WhatsApp gönderim kuyruğu görüntüleme yetkiniz yok.',
    render: ({ activeTab, onOpenScreen }) => (
      <WhatsappWebQueueScreen
        catalogId={activeTab.payload?.catalogId}
        customerName={activeTab.payload?.customerName}
        customerPhone={activeTab.payload?.customerPhone}
        onOpenScreen={onOpenScreen}
      />
    ),
  },
  'whatsapp-crm-inbox': {
    permissionKeys: ['crm.view'],
    unauthorizedMessage: 'WhatsApp CRM gelen kutusunu görüntüleme yetkiniz yok.',
    render: ({ user }) => <WhatsappCrmWorkspace user={user} />,
  },
  'import-foundation': {
    permissionKeys: ['import.run'],
    unauthorizedMessage: 'Veri aktarımını çalıştırma yetkiniz yok.',
    render: ({ onOpenScreen }) => <ImportScreen onOpenScreen={onOpenScreen} />,
  },
  'reports-overview': {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Rapor görüntüleme yetkiniz yok.',
    render: () => <ManagementReportsScreen />,
  },
  'vega-sales-comparison': {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Satış karşılaştırma raporunu görüntüleme yetkiniz yok.',
    render: () => <VegaSalesComparisonScreen />,
  },
  'vega-sales-performance': {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Satış performansı raporunu görüntüleme yetkiniz yok.',
    render: () => <VegaSalesPerformanceScreen />,
  },
  'vega-product-profitability': {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Ürün kârlılığı raporunu görüntüleme yetkiniz yok.',
    render: () => <VegaProductProfitabilityScreen />,
  },
  'export-center': {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Çıktı merkezi görüntüleme yetkiniz yok.',
    render: () => <ExportCenterScreen />,
  },
  'currency-rates': {
    permissionKeys: ['settings.manage'],
    unauthorizedMessage: 'Döviz kuru yönetimi yetkiniz yok.',
    render: () => <CurrencyRatesScreen />,
  },
  'settings-overview': {
    permissionKeys: ['settings.manage'],
    unauthorizedMessage: 'Sistem ayarları yönetimi yetkiniz yok.',
    render: () => <SystemSettingsScreen />,
  },
  'definitions-overview': {
    permissionKeys: ['settings.manage'],
    unauthorizedMessage: 'Tanım listeleri yönetimi yetkiniz yok.',
    render: () => <DefinitionsScreen />,
  },
  'personnel-definitions': {
    permissionKeys: ['settings.manage'],
    unauthorizedMessage: 'Personel tanımları yönetimi yetkiniz yok.',
    render: () => <PersonnelDefinitionsScreen />,
  },
  'terminal-overview': {
    permissionKeys: ['dashboard.view'],
    unauthorizedMessage: 'Terminal yönetimi görüntüleme yetkiniz yok.',
    render: () => <TerminalAdminScreen />,
  },
  'auth-overview': {
    permissionKeys: ['audit.view'],
    unauthorizedMessage: 'Yetki ve denetim ekranını görüntüleme yetkiniz yok.',
    render: ({ permissions }) => <AuthAdminScreen permissions={permissions} />,
  },
  'audit-log': {
    permissionKeys: ['audit.view'],
    unauthorizedMessage: 'Denetim günlüğünü görüntüleme yetkiniz yok.',
    render: () => <AuditLogScreen />,
  },
};

export function Workspace({ activeTab, onDirtyChange, onOpenScreen, permissions = [], roleViewId = 'yonetici', user = null }) {
  const screenId = activeTab.screenId ?? activeTab.id;
  if (apiConfig.vegaBridgeMode) return <VegaReadWorkspace screenId={screenId} payload={activeTab.payload} permissions={permissions} onOpenScreen={onOpenScreen} />;
  if (apiConfig.demoMode) {
    if (!demoRoleCanOpen(roleViewId, screenId)) return <UnauthorizedScreen message="Bu ekran seçili görev rolüne açık değil." />;
    permissions = demoRolePermissions(permissions, roleViewId);
  }
  const route = workspaceRouteRegistry[screenId];

  if (route) {
    if (!hasRoutePermission(permissions, route)) {
      return <UnauthorizedScreen message={route.unauthorizedMessage} />;
    }

    if (apiConfig.demoMode) return <DemoStoreGate>{screenId === 'reports-overview'
      ? <ReportsWorkspace onOpenScreen={onOpenScreen} />
      : screenId === 'terminal-overview'
      ? <TerminalWorkspace roleViewId={roleViewId} onOpenScreen={onOpenScreen} />
      : operationScreens.has(screenId)
      ? <OperationsWorkspace screenId={screenId} payload={activeTab.payload} permissions={permissions} roleViewId={roleViewId} onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen} />
      : connectedReadScreens.has(screenId)
        ? <ConnectedReadWorkspace screenId={screenId} payload={activeTab.payload} permissions={permissions} onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen} />
        : <DemoPendingScreen screen={activeTab} />}</DemoStoreGate>;
    return route.render({ activeTab, onDirtyChange, onOpenScreen, permissions, roleViewId, user });
  }

  return <UnmappedScreen screen={activeTab} />;
}
