import React from 'react';
import { mockScreenContent } from '../../data/mockScreenData.js';
import { DataTable } from '../dashboard/DataTable.jsx';

export function MockScreen({ screen }) {
  const content = mockScreenContent[screen.id];
  const actions = content?.actions || ['Yenile', 'Kolonlar', 'Dışa aktar'];

  if (!content) {
    return (
      <main className="work-area">
        <article className="erp-panel">
          <div className="panel-title">
            <strong>{screen.label}</strong>
            <span>Mock ekran hazırlanmadı</span>
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="work-area">
      <section className="screen-header">
        <div>
          <strong>{content.title}</strong>
          <span>{content.subtitle}</span>
        </div>
        <div className="screen-actions">
          {actions.map((action) => (
            <button key={action} type="button">{action}</button>
          ))}
        </div>
      </section>

      {content.filters ? (
        <section className="filter-row screen-filter">
          {content.filters.map((filter) => (
            <span key={filter}>{filter}</span>
          ))}
        </section>
      ) : null}

      {content.insights ? (
        <section className="screen-summary screen-insights">
          {content.insights.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </section>
      ) : null}

      {content.fields ? (
        <section className="screen-form-grid">
          {content.fields.map(([label, value]) => (
            <label key={label}>
              <span>{label}</span>
              <input readOnly value={value} />
            </label>
          ))}
        </section>
      ) : null}

      <section className="erp-panel screen-table-panel">
        <div className="panel-title">
          <strong>{content.title} Detay</strong>
          <span>{screen.module} / {screen.type}</span>
        </div>
        <DataTable columns={content.columns} rows={content.rows} />
      </section>

      <section className="screen-summary">
        {content.summary.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>
    </main>
  );
}
