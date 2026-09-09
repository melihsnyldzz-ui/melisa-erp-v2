import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/tables.css';
import './styles/erp-skin.css';
import './styles/erp-modern.css';
import './styles/sales-invoice-ux.css';
import './styles/vega-sales-list.css';
import './styles/fedex-micro-export-demo.css';
import './styles/proforma-invoice.css';
import './styles/purchase-invoice-ux.css';
import './styles/invoice-visual-hierarchy.css';
import './styles/finance-entry-ux.css';
import './styles/entity-list-card-ux.css';
import './styles/stock-product-ux.css';
import './styles/bulk-product-update.css';
import './styles/bulk-product-create.css';
import './styles/report-definition-ux.css';
import './styles/supplier-movements-ux.css';
import './styles/responsive-layout-hardening.css';
import './styles/workspace-visual-hierarchy.css';
import './styles/cash-register.css';
import './styles/personnel-definitions.css';
import './styles/visual-refresh-phase1.css';
import './styles/product-profitability.css';
import './styles/system-settings-ux.css';
import './styles/management-reports-ux.css';
import './styles/stock-count.css';
import './styles/sales-pipeline-list.css';
import './styles/commerce-navigation.css';
import './styles/commerce-invoice-layout.css';
import { App } from './App.jsx';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="login-shell">
          <section className="login-panel">
            <h1>ERP ekranı yüklenemedi</h1>
            <p>{this.state.error.message}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);
