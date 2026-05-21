import React from 'react';

export function PurchaseInvoiceRulesPanel({ rules, statusMessage }) {
  return (
    <section className="erp-panel purchase-rules-panel">
      <div className="panel-title">
        <strong>Is Kurallari</strong>
        <span>{statusMessage}</span>
      </div>
      <div className="purchase-rule-list">
        {rules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </section>
  );
}
