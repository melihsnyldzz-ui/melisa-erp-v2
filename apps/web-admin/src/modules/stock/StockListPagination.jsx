import React, { useEffect, useState } from 'react';

export function StockListPagination({ page, totalPages, isLoading, onPageChange }) {
  const [target, setTarget] = useState(String(page));
  useEffect(() => { setTarget(String(page)); }, [page]);
  const targetPage = Number(target);
  const validTarget = Number.isInteger(targetPage) && targetPage >= 1 && targetPage <= totalPages;
  return (
    <nav className="stock-pagination" aria-label="Stok sayfaları">
      <button type="button" disabled={isLoading || page <= 1} onClick={() => onPageChange(1)}>İlk</button>
      <button type="button" disabled={isLoading || page <= 1} onClick={() => onPageChange(page - 1)}>Önceki</button>
      <form onSubmit={event => { event.preventDefault(); if (!isLoading && validTarget) onPageChange(targetPage); }}>
        <label>Sayfa <input aria-label="Gidilecek stok sayfası" type="number" min="1" max={totalPages} value={target} onChange={event => setTarget(event.target.value)} disabled={isLoading} /></label>
        <span>/ {totalPages}</span>
        <button type="submit" disabled={isLoading || !validTarget || targetPage === page}>Git</button>
      </form>
      <button type="button" disabled={isLoading || page >= totalPages} onClick={() => onPageChange(page + 1)}>Sonraki</button>
      <button type="button" disabled={isLoading || page >= totalPages} onClick={() => onPageChange(totalPages)}>Son</button>
    </nav>
  );
}
