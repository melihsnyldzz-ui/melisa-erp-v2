import React, { useEffect, useState } from 'react';
import { get } from '../../services/apiClient.js';
import { ProductVisualInfoView } from './ProductVisualInfoView.jsx';

export function ProductVisualInfoPanel({ sourceId, imageUrl }) {
  const [result, setResult] = useState({ sourceId: null, state: 'LOADING' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setResult({ sourceId: String(sourceId), state: 'LOADING' });
    if (!sourceId) return () => { current = false; };
    get(`/api/vega/products/${sourceId}/visual-profile`)
      .then((response) => { if (current) setResult(response.data); })
      .catch(() => { if (current) setResult({ sourceId: String(sourceId), state: 'UNAVAILABLE' }); });
    return () => { current = false; };
  }, [sourceId, imageUrl, refresh]);
  if (!sourceId) return null;
  const profile = String(result.sourceId) === String(sourceId) ? result : { state: 'LOADING' };
  return <ProductVisualInfoView profile={profile} onRefresh={() => setRefresh((value) => value + 1)} />;
}
