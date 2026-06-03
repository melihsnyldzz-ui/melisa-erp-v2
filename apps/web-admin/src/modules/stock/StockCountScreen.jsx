import React, { useMemo, useState } from 'react';
import { fetchProducts } from '../../services/productApi.js';
import { applyStockCountAdjustment } from '../../services/movementApi.js';

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function differenceTone(value) {
  if (Number(value || 0) > 0) return 'ledger-debit';
  if (Number(value || 0) < 0) return 'ledger-credit';
  return '';
}

export function StockCountScreen({ onOpenScreen }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [countedQuantity, setCountedQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const difference = useMemo(() => {
    if (!selectedProduct || countedQuantity === '') return 0;
    return Number(countedQuantity || 0) - Number(selectedProduct.stockQuantity || 0);
  }, [countedQuantity, selectedProduct]);

  async function searchProducts(event) {
    event?.preventDefault();
    setIsSearching(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetchProducts({ search, limit: 25, activeOnly: true });
      setProducts(response.data || []);
      if ((response.data || []).length === 1) {
        selectProduct(response.data[0]);
      }
    } catch (error) {
      setProducts([]);
      setErrorMessage(error.message || 'Urun arama yapilamadi.');
    } finally {
      setIsSearching(false);
    }
  }

  function selectProduct(product) {
    setSelectedProduct(product);
    setCountedQuantity(String(Number(product.stockQuantity || 0)));
    setMessage('');
    setErrorMessage('');
    setLastResult(null);
  }

  async function applyCount(event) {
    event.preventDefault();
    if (!selectedProduct) {
      setErrorMessage('Once stok karti secin.');
      return;
    }

    setIsApplying(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await applyStockCountAdjustment({
        productId: selectedProduct.id,
        countedQuantity,
        note,
      });
      const result = response.data;
      setLastResult(result);
      setMessage(result.message || 'Stok sayimi uygulandi.');
      setSelectedProduct((current) => current ? { ...current, stockQuantity: result.countedQuantity } : current);
      setCountedQuantity(String(Number(result.countedQuantity || 0)));
    } catch (error) {
      setErrorMessage(`${error.message || 'Stok sayimi uygulanamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <main className="work-area stock-count-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Stok Sayim / Envanter Kontrol</strong>
          <span>Sayilan stok ile sistem stok farkini hareket defterine isler</span>
        </div>
        <form className="filter-grid" onSubmit={searchProducts}>
          <label>
            Urun ara
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Stok kodu, barkod, urun adi veya marka"
            />
          </label>
          <button type="submit" className="primary" disabled={isSearching}>
            {isSearching ? 'Araniyor...' : 'Ara'}
          </button>
          <button type="button" className="ghost-button" onClick={() => { setSearch(''); setProducts([]); }}>
            Temizle
          </button>
        </form>
      </section>

      <section className="dashboard-main-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Arama Sonuclari</strong>
            <span>Stok kartina tiklayarak sayima al</span>
          </div>
          {products.length === 0 ? (
            <div className="list-state">Arama sonucu bekleniyor.</div>
          ) : (
            <div className="table-shell compact-table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Stok Kodu</th>
                    <th>Barkod</th>
                    <th>Urun</th>
                    <th>Marka</th>
                    <th>Stok</th>
                    <th>Sec</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr className="clickable-row" key={product.id} onClick={() => selectProduct(product)}>
                      <td className="code-cell">{product.stockCode}</td>
                      <td>{product.matchedBarcode || product.barcodeMasked || '-'}</td>
                      <td>{product.productName}</td>
                      <td>{product.brand || '-'}</td>
                      <td className={Number(product.stockQuantity || 0) < 0 ? 'ledger-credit' : ''}>{formatNumber(product.stockQuantity)}</td>
                      <td>
                        <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); selectProduct(product); }}>
                          Say
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="erp-panel">
          <div className="panel-title">
            <strong>Sayim Girisi</strong>
            <span>Fazla stok yesil giris, eksik stok kirmizi cikis olarak islenir</span>
          </div>
          {!selectedProduct ? (
            <div className="list-state">Sayim icin urun secin.</div>
          ) : (
            <form className="stock-count-form" onSubmit={applyCount}>
              <div className="summary-strip">
                <article className="summary-card">
                  <span>Stok Kodu</span>
                  <strong>{selectedProduct.stockCode}</strong>
                  <small>{selectedProduct.productName}</small>
                </article>
                <article className="summary-card">
                  <span>Sistem Stok</span>
                  <strong>{formatNumber(selectedProduct.stockQuantity)}</strong>
                  <small>Mevcut kayit</small>
                </article>
                <article className="summary-card">
                  <span>Fark</span>
                  <strong className={differenceTone(difference)}>{difference > 0 ? '+' : ''}{formatNumber(difference)}</strong>
                  <small>{difference > 0 ? 'Giris' : difference < 0 ? 'Cikis' : 'Hareket yok'}</small>
                </article>
                <article className="summary-card">
                  <span>Tahmini Etki</span>
                  <strong>{formatMoney(Math.abs(difference) * Number(selectedProduct.averageCostTry || 0))}</strong>
                  <small>Ortalama maliyet TRY</small>
                </article>
              </div>
              <div className="form-grid two-columns">
                <label>
                  Sayilan stok
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={countedQuantity}
                    onChange={(event) => setCountedQuantity(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Not
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Raf sayimi, depo farki, sayim tutanagi..."
                  />
                </label>
              </div>
              <div className="button-row">
                <button type="submit" className="primary" disabled={isApplying}>
                  {isApplying ? 'Uygulaniyor...' : 'Sayimi Uygula'}
                </button>
                <button type="button" onClick={() => onOpenScreen?.('product-card', { productId: selectedProduct.id })}>
                  Stok Kartina Git
                </button>
              </div>
            </form>
          )}
          {message && <div className="list-state list-state-success">{message}</div>}
          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {lastResult && (
            <div className="screen-summary dashboard-summary inline-summary">
              <span>Hareket: {lastResult.movementCreated ? `#${lastResult.movementId}` : 'olusturulmadi'}</span>
              <span>Onceki: {formatNumber(lastResult.currentQuantity)}</span>
              <span>Yeni: {formatNumber(lastResult.countedQuantity)}</span>
              <span>Fark: {lastResult.difference > 0 ? '+' : ''}{formatNumber(lastResult.difference)}</span>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
