import React from 'react';
import { Dashboard } from '../dashboard/Dashboard.jsx';
import { MockScreen } from './MockScreen.jsx';
import { ProductCardScreen } from '../../modules/product/ProductCardScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';

export function Workspace({ activeTab, onOpenScreen }) {
  if (activeTab.id === 'dashboard') {
    return <Dashboard onOpenScreen={onOpenScreen} />;
  }

  if (activeTab.id === 'stock-list') {
    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  if (activeTab.id === 'product-card') {
    return <ProductCardScreen />;
  }

  return <MockScreen screen={activeTab} />;
}
