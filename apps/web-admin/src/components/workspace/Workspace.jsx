import React from 'react';
import { UnauthorizedScreen } from '../auth/UnauthorizedScreen.jsx';
import { CatalogListScreen } from '../../modules/catalog/CatalogListScreen.jsx';
import { CustomerCardScreen } from '../../modules/customer/CustomerCardScreen.jsx';
import { CustomerListScreen } from '../../modules/customer/CustomerListScreen.jsx';
import { CustomerMovementsScreen } from '../../modules/customer/CustomerMovementsScreen.jsx';
import { CustomerStatementScreen } from '../../modules/customer/CustomerStatementScreen.jsx';
import { DashboardScreen } from '../../modules/dashboard/DashboardScreen.jsx';
import { AccountingJournalScreen } from '../../modules/finance/AccountingJournalScreen.jsx';
import { AccountingControlScreen } from '../../modules/finance/AccountingControlScreen.jsx';
import { CashBankLedgerScreen } from '../../modules/finance/CashBankLedgerScreen.jsx';
import { CashCustomerTrackingScreen } from '../../modules/finance/CashCustomerTrackingScreen.jsx';
import { CollectionsOverviewScreen } from '../../modules/finance/CollectionsOverviewScreen.jsx';
import { FinanceOverviewScreen } from '../../modules/finance/FinanceOverviewScreen.jsx';
import { ImportScreen } from '../../modules/import/ImportScreen.jsx';
import { ExportCenterScreen } from '../../modules/reports/ExportCenterScreen.jsx';
import { ManagementReportsScreen } from '../../modules/reports/ManagementReportsScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
import { BulkPurchaseEntryScreen } from '../../modules/purchase/BulkPurchaseEntryScreen.jsx';
import { PurchaseInvoiceListScreen } from '../../modules/purchase/PurchaseInvoiceListScreen.jsx';
import { PurchaseInvoiceScreen } from '../../modules/purchase/PurchaseInvoiceScreen.jsx';
import { SalesInvoiceListScreen } from '../../modules/sales/SalesInvoiceListScreen.jsx';
import { SalesInvoiceScreen } from '../../modules/sales/SalesInvoiceScreen.jsx';
import { SalesPipelineListScreen } from '../../modules/sales/SalesPipelineListScreen.jsx';
import { SalesPipelineScreen } from '../../modules/sales/SalesPipelineScreen.jsx';
import { AuthAdminScreen } from '../../modules/settings/AuthAdminScreen.jsx';
import { CurrencyRatesScreen } from '../../modules/settings/CurrencyRatesScreen.jsx';
import { DefinitionsScreen } from '../../modules/settings/DefinitionsScreen.jsx';
import { SystemSettingsScreen } from '../../modules/settings/SystemSettingsScreen.jsx';
import { PriceListScreen } from '../../modules/stock/PriceListScreen.jsx';
import { StockCountScreen } from '../../modules/stock/StockCountScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';
import { StockMovementsScreen } from '../../modules/stock/StockMovementsScreen.jsx';
import { StockValuationScreen } from '../../modules/stock/StockValuationScreen.jsx';
import { SupplierCardScreen } from '../../modules/supplier/SupplierCardScreen.jsx';
import { SupplierListScreen } from '../../modules/supplier/SupplierListScreen.jsx';
import { SupplierMovementsScreen } from '../../modules/supplier/SupplierMovementsScreen.jsx';
import { SupplierStatementScreen } from '../../modules/supplier/SupplierStatementScreen.jsx';
import { TerminalAdminScreen } from '../../modules/terminal/TerminalAdminScreen.jsx';
import { WhatsappPlannerScreen } from '../../modules/catalog/WhatsappPlannerScreen.jsx';
import { WhatsappWebQueueScreen } from '../../modules/catalog/WhatsappWebQueueScreen.jsx';

function UnmappedScreen({ screen }) {
  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Ekran bağlı değil</strong>
          <span>{screen?.label || screen?.screenId || screen?.id || 'Bilinmeyen ekran'}</span>
        </div>
        <div className="list-state list-state-error">
          Bu ekran gerçek API ekranına bağlanmamış. Menüye eklenmeden önce Workspace route kontrolü yapılmalı.
        </div>
      </section>
    </main>
  );
}

function hasAnyPermission(permissions, permissionKeys) {
  return permissionKeys.some((permissionKey) => permissions.includes(permissionKey));
}

export function Workspace({ activeTab, onDirtyChange, onOpenScreen, permissions = [] }) {
  const screenId = activeTab.screenId ?? activeTab.id;

  if (screenId === 'dashboard') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Dashboard görüntüleme yetkiniz yok." />;
    }

    return <DashboardScreen onOpenScreen={onOpenScreen} permissions={permissions} />;
  }

  if (screenId === 'stock-list') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Stok görüntüleme yetkiniz yok." />;
    }

    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'product-card') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Ürün görüntüleme yetkiniz yok." />;
    }

    return <ProductCardScreen productId={activeTab.payload?.productId} permissions={permissions} onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-movements') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Stok hareketleri görüntüleme yetkiniz yok." />;
    }

    return <StockMovementsScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-valuation') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Stok değerleme görüntüleme yetkiniz yok." />;
    }

    return <StockValuationScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-count') {
    if (!permissions.includes('product.edit')) {
      return <UnauthorizedScreen message="Stok sayımı uygulama yetkiniz yok." />;
    }

    return <StockCountScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'price-list') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Fiyat listesi görüntüleme yetkiniz yok." />;
    }

    return <PriceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-list') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari görüntüleme yetkiniz yok." />;
    }

    return <CustomerListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-card') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari görüntüleme yetkiniz yok." />;
    }

    return <CustomerCardScreen customerId={activeTab.payload?.customerId} permissions={permissions} onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-movements') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari hareketleri görüntüleme yetkiniz yok." />;
    }

    return <CustomerMovementsScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-statement') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari ekstre görüntüleme yetkiniz yok." />;
    }

    return <CustomerStatementScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'supplier-list') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikçi görüntüleme yetkiniz yok." />;
    }

    return <SupplierListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'supplier-card') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikçi kartı görüntüleme yetkiniz yok." />;
    }

    return (
      <SupplierCardScreen
        supplierId={activeTab.payload?.supplierId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    );
  }

  if (screenId === 'supplier-movements') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikçi cari hareketleri görüntüleme yetkiniz yok." />;
    }

    return <SupplierMovementsScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'supplier-statement') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikçi ekstresi görüntüleme yetkiniz yok." />;
    }

    return <SupplierStatementScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-invoice') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Satış fişi görüntüleme yetkiniz yok." />;
    }

    return (
      <SalesInvoiceScreen
        salesDraftId={activeTab.payload?.salesDraftId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    );
  }

  if (screenId === 'sales-invoice-list') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Satış listesi görüntüleme yetkiniz yok." />;
    }

    return <SalesInvoiceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-offers') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Teklif görüntüleme yetkiniz yok." />;
    }

    return <SalesPipelineListScreen type="offer" onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-offer') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Teklif görüntüleme yetkiniz yok." />;
    }

    return (
      <SalesPipelineScreen
        type="offer"
        documentId={activeTab.payload?.offerId}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    );
  }

  if (screenId === 'sales-orders') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Sipariş görüntüleme yetkiniz yok." />;
    }

    return <SalesPipelineListScreen type="order" onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-order') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Sipariş görüntüleme yetkiniz yok." />;
    }

    return (
      <SalesPipelineScreen
        type="order"
        documentId={activeTab.payload?.orderId}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    );
  }

  if (screenId === 'purchase-invoice') {
    if (!permissions.includes('purchase.view')) {
      return <UnauthorizedScreen message="Alış fişi görüntüleme yetkiniz yok." />;
    }

    return (
      <PurchaseInvoiceScreen
        purchaseDraftId={activeTab.payload?.purchaseDraftId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
      />
    );
  }

  if (screenId === 'bulk-purchase-entry') {
    if (!permissions.includes('purchase.view')) {
      return <UnauthorizedScreen message="Toplu alis girisi goruntuleme yetkiniz yok." />;
    }

    return (
      <BulkPurchaseEntryScreen
        permissions={permissions}
        onDirtyChange={onDirtyChange}
        onOpenScreen={onOpenScreen}
      />
    );
  }

  if (screenId === 'purchase-invoice-list') {
    if (!permissions.includes('purchase.view')) {
      return <UnauthorizedScreen message="Alış listesi görüntüleme yetkiniz yok." />;
    }

    return <PurchaseInvoiceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'finance-overview') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view'])) {
      return <UnauthorizedScreen message="Finans özeti görüntüleme yetkiniz yok." />;
    }

    return <FinanceOverviewScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'collections-overview') {
    if (!hasAnyPermission(permissions, ['finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'])) {
      return <UnauthorizedScreen message="Tahsilat/ödeme kaydı için finans yetkiniz yok." />;
    }

    return <CollectionsOverviewScreen initialPayload={activeTab.payload} onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'cash-customers') {
    if (!hasAnyPermission(permissions, ['finance.view', 'customer.view', 'sales.view'])) {
      return <UnauthorizedScreen message="Pesin cari takibi goruntuleme yetkiniz yok." />;
    }

    return <CashCustomerTrackingScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'cash-bank-ledger') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view', 'customer.view'])) {
      return <UnauthorizedScreen message="Kasa/banka defteri görüntüleme yetkiniz yok." />;
    }

    return <CashBankLedgerScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'accounting-journal') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view'])) {
      return <UnauthorizedScreen message="Muhasebe defteri görüntüleme yetkiniz yok." />;
    }

    return <AccountingJournalScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'accounting-control') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view'])) {
      return <UnauthorizedScreen message="Muhasebe kontrol paneli görüntüleme yetkiniz yok." />;
    }

    return <AccountingControlScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'catalog-list') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Katalog görüntüleme yetkiniz yok." />;
    }

    return <CatalogListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'whatsapp-planner') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="WhatsApp paylaşım listesi görüntüleme yetkiniz yok." />;
    }

    return <WhatsappPlannerScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'whatsapp-web-queue') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="WhatsApp gönderim kuyruğu görüntüleme yetkiniz yok." />;
    }

    return (
      <WhatsappWebQueueScreen
        catalogId={activeTab.payload?.catalogId}
        customerName={activeTab.payload?.customerName}
        customerPhone={activeTab.payload?.customerPhone}
        onOpenScreen={onOpenScreen}
      />
    );
  }

  if (screenId === 'import-foundation') {
    if (!permissions.includes('import.run')) {
      return <UnauthorizedScreen message="Import calıştirma yetkiniz yok." />;
    }

    return <ImportScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'reports-overview') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Rapor görüntüleme yetkiniz yok." />;
    }

    return <ManagementReportsScreen />;
  }

  if (screenId === 'export-center') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Çıktı merkezi görüntüleme yetkiniz yok." />;
    }

    return <ExportCenterScreen />;
  }

  if (screenId === 'currency-rates') {
    if (!permissions.includes('settings.manage')) {
      return <UnauthorizedScreen message="Döviz kuru ynetimi yetkiniz yok." />;
    }

    return <CurrencyRatesScreen />;
  }

  if (screenId === 'settings-overview') {
    if (!permissions.includes('settings.manage')) {
      return <UnauthorizedScreen message="Sistem ayarları yönetimi yetkiniz yok." />;
    }

    return <SystemSettingsScreen />;
  }

  if (screenId === 'definitions-overview') {
    if (!permissions.includes('settings.manage')) {
      return <UnauthorizedScreen message="Tanım listeleri yönetimi yetkiniz yok." />;
    }

    return <DefinitionsScreen />;
  }

  if (screenId === 'terminal-overview') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Terminal yönetimi görüntüleme yetkiniz yok." />;
    }

    return <TerminalAdminScreen />;
  }

  if (screenId === 'auth-overview') {
    if (!permissions.includes('audit.view')) {
      return <UnauthorizedScreen message="Audit görüntüleme yetkiniz yok." />;
    }

    return <AuthAdminScreen permissions={permissions} />;
  }

  return <UnmappedScreen screen={activeTab} />;
}
