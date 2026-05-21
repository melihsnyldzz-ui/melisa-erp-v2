import React from 'react';
import { Dashboard } from '../dashboard/Dashboard.jsx';
import { MockScreen } from './MockScreen.jsx';
import { StockListScreen } from '../../modules/stock/StockListScreen.jsx';

export function Workspace({ activeTab, onOpenScreen }) {
  if (activeTab.id === 'dashboard') {
    return <Dashboard onOpenScreen={onOpenScreen} />;
  }

  if (activeTab.id === 'stock-list') {
    return <StockListScreen onOpenScreen={onOpenScreen} />;
  }

  return <MockScreen screen={activeTab} />;
}
