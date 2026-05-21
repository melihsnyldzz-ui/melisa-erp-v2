import React from 'react';
import { Dashboard } from '../dashboard/Dashboard.jsx';
import { MockScreen } from './MockScreen.jsx';

export function Workspace({ activeTab, onOpenScreen }) {
  if (activeTab.id === 'dashboard') {
    return <Dashboard onOpenScreen={onOpenScreen} />;
  }

  return <MockScreen screen={activeTab} />;
}
