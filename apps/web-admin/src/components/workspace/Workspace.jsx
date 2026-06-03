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
import { CollectionsOverviewScreen } from '../../modules/finance/CollectionsOverviewScreen.jsx';
import { FinanceOverviewScreen } from '../../modules/finance/FinanceOverviewScreen.jsx';
import { ImportScreen } from '../../modules/import/ImportScreen.jsx';
import { ExportCenterScreen } from '../../modules/reports/ExportCenterScreen.jsx';
import { ManagementReportsScreen } from '../../modules/reports/ManagementReportsScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
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
      return <UnauthorizedScreen message="Dashboard goruntuleme yetkiniz yok." />;
    }

    return <DashboardScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-list') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Stok goruntuleme yetkiniz yok." />;
    }

    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'product-card') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Urun goruntuleme yetkiniz yok." />;
    }

    return <ProductCardScreen productId={activeTab.payload?.productId} permissions={permissions} onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-movements') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Stok hareketleri goruntuleme yetkiniz yok." />;
    }

    return <StockMovementsScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-valuation') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Stok degerleme goruntuleme yetkiniz yok." />;
    }

    return <StockValuationScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-count') {
    if (!permissions.includes('product.edit')) {
      return <UnauthorizedScreen message="Stok sayimi uygulama yetkiniz yok." />;
    }

    return <StockCountScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'price-list') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Fiyat listesi goruntuleme yetkiniz yok." />;
    }

    return <PriceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-list') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari goruntuleme yetkiniz yok." />;
    }

    return <CustomerListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-card') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari goruntuleme yetkiniz yok." />;
    }

    return <CustomerCardScreen customerId={activeTab.payload?.customerId} permissions={permissions} onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-movements') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari hareketleri goruntuleme yetkiniz yok." />;
    }

    return <CustomerMovementsScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-statement') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Cari ekstre goruntuleme yetkiniz yok." />;
    }

    return <CustomerStatementScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'supplier-list') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikci goruntuleme yetkiniz yok." />;
    }

    return <SupplierListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'supplier-card') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikci karti goruntuleme yetkiniz yok." />;
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
      return <UnauthorizedScreen message="Tedarikci cari hareketleri goruntuleme yetkiniz yok." />;
    }

    return <SupplierMovementsScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'supplier-statement') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="Tedarikci ekstresi goruntuleme yetkiniz yok." />;
    }

    return <SupplierStatementScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-invoice') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Satis fisi goruntuleme yetkiniz yok." />;
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
      return <UnauthorizedScreen message="Satis listesi goruntuleme yetkiniz yok." />;
    }

    return <SalesInvoiceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-offers') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Teklif goruntuleme yetkiniz yok." />;
    }

    return <SalesPipelineListScreen type="offer" onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-offer') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Teklif goruntuleme yetkiniz yok." />;
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
      return <UnauthorizedScreen message="Siparis goruntuleme yetkiniz yok." />;
    }

    return <SalesPipelineListScreen type="order" onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'sales-order') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Siparis goruntuleme yetkiniz yok." />;
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
      return <UnauthorizedScreen message="Alis fisi goruntuleme yetkiniz yok." />;
    }

    return (
      <PurchaseInvoiceScreen
        purchaseDraftId={activeTab.payload?.purchaseDraftId}
        permissions={permissions}
        onDirtyChange={onDirtyChange}
      />
    );
  }

  if (screenId === 'purchase-invoice-list') {
    if (!permissions.includes('purchase.view')) {
      return <UnauthorizedScreen message="Alis listesi goruntuleme yetkiniz yok." />;
    }

    return <PurchaseInvoiceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'finance-overview') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view'])) {
      return <UnauthorizedScreen message="Finans ozeti goruntuleme yetkiniz yok." />;
    }

    return <FinanceOverviewScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'collections-overview') {
    if (!hasAnyPermission(permissions, ['finance.collection', 'finance.payment', 'customer.edit', 'purchase.edit'])) {
      return <UnauthorizedScreen message="Tahsilat/odeme kaydi icin finans yetkiniz yok." />;
    }

    return <CollectionsOverviewScreen initialPayload={activeTab.payload} onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'cash-bank-ledger') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view', 'customer.view'])) {
      return <UnauthorizedScreen message="Kasa/banka defteri goruntuleme yetkiniz yok." />;
    }

    return <CashBankLedgerScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'accounting-journal') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view'])) {
      return <UnauthorizedScreen message="Muhasebe defteri goruntuleme yetkiniz yok." />;
    }

    return <AccountingJournalScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'accounting-control') {
    if (!hasAnyPermission(permissions, ['dashboard.view', 'finance.view'])) {
      return <UnauthorizedScreen message="Muhasebe kontrol paneli goruntuleme yetkiniz yok." />;
    }

    return <AccountingControlScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'catalog-list') {
    if (!permissions.includes('product.view')) {
      return <UnauthorizedScreen message="Katalog goruntuleme yetkiniz yok." />;
    }

    return <CatalogListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'whatsapp-planner') {
    if (!permissions.includes('customer.view')) {
      return <UnauthorizedScreen message="WhatsApp paylasim listesi goruntuleme yetkiniz yok." />;
    }

    return <WhatsappPlannerScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'import-foundation') {
    if (!permissions.includes('import.run')) {
      return <UnauthorizedScreen message="Import calistirma yetkiniz yok." />;
    }

    return <ImportScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'reports-overview') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Rapor goruntuleme yetkiniz yok." />;
    }

    return <ManagementReportsScreen />;
  }

  if (screenId === 'export-center') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Cikti merkezi goruntuleme yetkiniz yok." />;
    }

    return <ExportCenterScreen />;
  }

  if (screenId === 'currency-rates') {
    if (!permissions.includes('settings.manage')) {
      return <UnauthorizedScreen message="Doviz kuru yonetimi yetkiniz yok." />;
    }

    return <CurrencyRatesScreen />;
  }

  if (screenId === 'settings-overview') {
    if (!permissions.includes('settings.manage')) {
      return <UnauthorizedScreen message="Sistem ayarlari yonetimi yetkiniz yok." />;
    }

    return <SystemSettingsScreen />;
  }

  if (screenId === 'definitions-overview') {
    if (!permissions.includes('settings.manage')) {
      return <UnauthorizedScreen message="Tanim listeleri yonetimi yetkiniz yok." />;
    }

    return <DefinitionsScreen />;
  }

  if (screenId === 'terminal-overview') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Terminal yonetimi goruntuleme yetkiniz yok." />;
    }

    return <TerminalAdminScreen />;
  }

  if (screenId === 'auth-overview') {
    if (!permissions.includes('audit.view')) {
      return <UnauthorizedScreen message="Audit goruntuleme yetkiniz yok." />;
    }

    return <AuthAdminScreen permissions={permissions} />;
  }

  return <UnmappedScreen screen={activeTab} />;
}
