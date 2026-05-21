import React from 'react';

export function SalesInvoiceRulesPanel({ rules, statusMessage }) {
  return (
    <section className="erp-panel sales-rules-panel">
      <div className="panel-title">
        <strong>Is Kurallari</strong>
        <span>{statusMessage}</span>
      </div>
      <div className="sales-rule-list">
        {rules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
    </section>
  );
}
