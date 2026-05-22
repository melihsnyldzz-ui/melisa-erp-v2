import React from 'react';
import { MockScreen } from './MockScreen.jsx';
import { CustomerCardScreen } from '../../modules/customer/CustomerCardScreen.jsx';
import { CustomerListScreen } from '../../modules/customer/CustomerListScreen.jsx';
import { DashboardScreen } from '../../modules/dashboard/DashboardScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
import { PurchaseInvoiceScreen } from '../../modules/purchase/PurchaseInvoiceScreen.jsx';
import { SalesInvoiceScreen } from '../../modules/sales/SalesInvoiceScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';

export function Workspace({ activeTab, onOpenScreen }) {
  const screenId = activeTab.screenId ?? activeTab.id;

  if (screenId === 'dashboard') {
    return <DashboardScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'stock-list') {
    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'product-card') {
    return <ProductCardScreen productId={activeTab.payload?.productId} />;
  }

  if (screenId === 'customer-list') {
    return <CustomerListScreen onOpenScreen={onOpenScreen} />;
  }

  if (screenId === 'customer-card') {
    return <CustomerCardScreen customerId={activeTab.payload?.customerId} />;
  }

  if (screenId === 'sales-invoice') {
    return <SalesInvoiceScreen />;
  }

  if (screenId === 'purchase-invoice') {
    return <PurchaseInvoiceScreen />;
  }

  return <MockScreen screen={activeTab} />;
}
