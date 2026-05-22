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
  if (activeTab.id === 'dashboard') {
    return <DashboardScreen onOpenScreen={onOpenScreen} />;
  }

  if (activeTab.id === 'stock-list') {
    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  if (activeTab.id === 'product-card') {
    return <ProductCardScreen />;
  }

  if (activeTab.id === 'customer-list') {
    return <CustomerListScreen onOpenScreen={onOpenScreen} />;
  }

  if (activeTab.id === 'customer-card') {
    return <CustomerCardScreen />;
  }

  if (activeTab.id === 'sales-invoice') {
    return <SalesInvoiceScreen />;
  }

  if (activeTab.id === 'purchase-invoice') {
    return <PurchaseInvoiceScreen />;
  }

  return <MockScreen screen={activeTab} />;
}
