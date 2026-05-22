import React from 'react';
import { UnauthorizedScreen } from '../auth/UnauthorizedScreen.jsx';
import { MockScreen } from './MockScreen.jsx';
import { CustomerCardScreen } from '../../modules/customer/CustomerCardScreen.jsx';
import { CustomerListScreen } from '../../modules/customer/CustomerListScreen.jsx';
import { DashboardScreen } from '../../modules/dashboard/DashboardScreen.jsx';
import { ImportScreen } from '../../modules/import/ImportScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
import { PurchaseInvoiceListScreen } from '../../modules/purchase/PurchaseInvoiceListScreen.jsx';
import { PurchaseInvoiceScreen } from '../../modules/purchase/PurchaseInvoiceScreen.jsx';
import { SalesInvoiceListScreen } from '../../modules/sales/SalesInvoiceListScreen.jsx';
import { SalesInvoiceScreen } from '../../modules/sales/SalesInvoiceScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';

export function Workspace({ activeTab, onOpenScreen, permissions = [] }) {
  const screenId = activeTab.screenId ?? activeTab.id;

  if (screenId === 'dashboard') {
    if (!permissions.includes('dashboard.view')) {
      return <UnauthorizedScreen message="Dashboard goruntuleme yetkiniz yok." />;
    }

    return <DashboardScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-list') {
    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'product-card') {
    return <ProductCardScreen productId={activeTab.payload?.productId} permissions={permissions} />;
  }

  if (screenId === 'customer-list') {
    return <CustomerListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-card') {
    return <CustomerCardScreen customerId={activeTab.payload?.customerId} permissions={permissions} />;
  }

  if (screenId === 'sales-invoice') {
    return <SalesInvoiceScreen salesDraftId={activeTab.payload?.salesDraftId} permissions={permissions} />;
  }

  if (screenId === 'sales-invoice-list') {
    return <SalesInvoiceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'purchase-invoice') {
    return <PurchaseInvoiceScreen purchaseDraftId={activeTab.payload?.purchaseDraftId} permissions={permissions} />;
  }

  if (screenId === 'purchase-invoice-list') {
    return <PurchaseInvoiceListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'import-foundation') {
    if (!permissions.includes('import.run')) {
      return <UnauthorizedScreen message="Import calistirma yetkiniz yok." />;
    }

    return <ImportScreen />;
  }

  return <MockScreen screen={activeTab} />;
}
