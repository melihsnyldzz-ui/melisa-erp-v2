import React from 'react';
import { UnauthorizedScreen } from '../auth/UnauthorizedScreen.jsx';
import { MockScreen } from './MockScreen.jsx';
import { CustomerCardScreen } from '../../modules/customer/CustomerCardScreen.jsx';
import { CustomerListScreen } from '../../modules/customer/CustomerListScreen.jsx';
import { DashboardScreen } from '../../modules/dashboard/DashboardScreen.jsx';
import { ImportScreen } from '../../modules/import/ImportScreen.jsx';
import { ManagementReportsScreen } from '../../modules/reports/ManagementReportsScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
import { PurchaseInvoiceListScreen } from '../../modules/purchase/PurchaseInvoiceListScreen.jsx';
import { PurchaseInvoiceScreen } from '../../modules/purchase/PurchaseInvoiceScreen.jsx';
import { SalesInvoiceListScreen } from '../../modules/sales/SalesInvoiceListScreen.jsx';
import { SalesInvoiceScreen } from '../../modules/sales/SalesInvoiceScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';

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

    return <ProductCardScreen productId={activeTab.payload?.productId} permissions={permissions} />;
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

    return <CustomerCardScreen customerId={activeTab.payload?.customerId} permissions={permissions} />;
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
      />
    );
  }

  if (screenId === 'sales-invoice-list') {
    if (!permissions.includes('sales.view')) {
      return <UnauthorizedScreen message="Satis listesi goruntuleme yetkiniz yok." />;
    }

    return <SalesInvoiceListScreen onOpenScreen={onOpenScreen} />;
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

  if (screenId === 'import-foundation') {
    if (!permissions.includes('import.run')) {
      return <UnauthorizedScreen message="Import calistirma yetkiniz yok." />;
    }

    return <ImportScreen />;
  }

  if (screenId === 'reports-overview') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Rapor goruntuleme yetkiniz yok." />;
    }

    return <ManagementReportsScreen />;
  }

  if (screenId === 'auth-overview') {
    if (!permissions.includes('audit.view')) {
      return <UnauthorizedScreen message="Audit goruntuleme yetkiniz yok." />;
    }
  }

  return <MockScreen screen={activeTab} />;
}
