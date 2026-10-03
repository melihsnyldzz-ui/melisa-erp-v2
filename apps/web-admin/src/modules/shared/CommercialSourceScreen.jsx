import React, { useState } from 'react';

export function CommercialSourceScreen({ label, children, scope = null, onOpenGeneral = null }) {
  const [source, setSource] = useState(scope ? 'melisa' : 'vega');
  return (
    <section style={{ minHeight: 0, minWidth: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <div style={{ flex: '0 0 auto', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {label}
          <select aria-label={label} value={source} disabled={Boolean(scope)} onChange={(event) => setSource(event.target.value)}>
            <option value="vega">Vega — salt okunur</option>
            <option value="melisa">Melisa ERP</option>
          </select>
        </label>
        {scope && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{scope.label} · Yalnız bu kaydın fişleri</span>
          <button type="button" onClick={onOpenGeneral}>Genel fiş listesine git</button>
        </div>}
      </div>
      <React.Fragment key={source}>{children(source)}</React.Fragment>
    </section>
  );
}
