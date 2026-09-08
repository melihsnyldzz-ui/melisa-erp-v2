import React, { useState } from 'react';

export function CommercialSourceScreen({ label, children }) {
  const [source, setSource] = useState('vega');
  return (
    <section style={{ minHeight: 0, minWidth: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <div style={{ flex: '0 0 auto', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {label}
          <select aria-label={label} value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="vega">Vega — salt okunur</option>
            <option value="melisa">Melisa ERP</option>
          </select>
        </label>
      </div>
      <React.Fragment key={source}>{children(source)}</React.Fragment>
    </section>
  );
}
