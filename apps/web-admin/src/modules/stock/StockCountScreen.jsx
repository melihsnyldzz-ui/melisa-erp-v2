import React, { useEffect, useMemo, useState } from 'react';
import { fetchProducts } from '../../services/productApi.js';
import { applyStockCountAdjustment } from '../../services/movementApi.js';
import {
  canApplyStockCount,
  isValidCountedQuantity,
  isValidStockCountReason,
} from './stockCountSafety.js';

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

export function StockCountScreen({ onDirtyChange, onOpenScreen }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [countedQuantity, setCountedQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCountConfirmed, setIsCountConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const difference = useMemo(() => {
    if (!selectedProduct || countedQuantity === '') return 0;
    return Number(countedQuantity || 0) - Number(selectedProduct.stockQuantity || 0);
  }, [countedQuantity, selectedProduct]);
  const isDirty = Boolean(selectedProduct) && (
    countedQuantity !== String(Number(selectedProduct?.stockQuantity || 0))
    || note.trim() !== ''
  );
  const isApplyEnabled = canApplyStockCount({
    selectedProduct,
    countedQuantity,
    note,
    isCountConfirmed,
    isApplying,
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function searchProducts(event) {
    event.preventDefault();
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
      setErrorMessage(error.message || 'Ürün arama yapılamadı.');
    } finally {
      setIsSearching(false);
    }
  }

  function selectProduct(product) {
    setSelectedProduct(product);
    setCountedQuantity(String(Number(product.stockQuantity || 0)));
    setNote('');
    setIsCountConfirmed(false);
    setMessage('');
    setErrorMessage('');
    setLastResult(null);
  }

  async function applyCount(event) {
    event.preventDefault();
    if (!selectedProduct) {
      setErrorMessage('Önce stok kartı seçin.');
      return;
    }
    if (!isValidCountedQuantity(countedQuantity)) {
      setErrorMessage('Sayılan stok sıfır veya daha büyük geçerli bir sayı olmalıdır.');
      return;
    }
    if (!isValidStockCountReason(note)) {
      setErrorMessage('Stok düzeltme nedeni zorunludur.');
      return;
    }
    if (!isCountConfirmed) {
      setErrorMessage('Stok bakiyesi değişikliğini uygulamadan önce kontrol onayını işaretleyin.');
      return;
    }

    setIsApplying(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await applyStockCountAdjustment({
        productId: selectedProduct.id,
        expectedCurrentQuantity: selectedProduct.stockQuantity,
        countedQuantity,
        note,
      });
      const result = response.data;
      setLastResult(result);
      setMessage(result.message || 'Stok sayımı uygulandı.');
      setSelectedProduct((current) => current ? { ...current, stockQuantity: result.countedQuantity } : current);
      setProducts((current) => current.map((product) => (
        String(product.id) === String(result.productId) ? { ...product, stockQuantity: result.countedQuantity } : product
      )));
      setCountedQuantity(String(Number(result.countedQuantity || 0)));
      setNote('');
      setIsCountConfirmed(false);
    } catch (error) {
      setIsCountConfirmed(false);
      setErrorMessage(error.code === 'STOCK_COUNT_STALE'
        ? 'Stok siz sayım yaparken değişti. Ürünü yeniden arayıp güncel miktarı kontrol edin. (STOCK_COUNT_STALE)'
        : `${error.message || 'Stok sayımı uygulanamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <main className="work-area stock-count-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Stok Sayım / Envanter Kontrol</strong>
          <span>Sayılan stok ile sistem stok farkını hareket defterine işler</span>
        </div>
        <form className="filter-grid" onSubmit={searchProducts}>
          <label>
            Ürün ara
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Stok kodu, barkod, ürün adı veya marka"
            />
          </label>
          <button type="submit" className="primary" disabled={isSearching}>
            {isSearching ? 'Aranıyor...' : 'Ara'}
          </button>
          <button type="button" className="ghost-button" onClick={() => { setSearch(''); setProducts([]); }}>
            Temizle
          </button>
        </form>
      </section>

      <section className="dashboard-main-grid">
        <section className="erp-panel">
          <div className="panel-title">
            <strong>Arama Sonuçları</strong>
            <span>Stok kartına tıklayarak sayıma al</span>
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
                    <th>Ürün</th>
                    <th>Marka</th>
                    <th>Stok</th>
                    <th>Seç</th>
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
            <strong>Sayım Girişi</strong>
            <span>Fazla stok yeşil giriş, eksik stok kırmızı çıkış olarak işlenir</span>
          </div>
          {!selectedProduct ? (
            <div className="list-state">Sayım için ürün seçin.</div>
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
                  <small>Mevcut kayıt</small>
                </article>
                <article className="summary-card">
                  <span>Fark</span>
                  <strong className={differenceTone(difference)}>{difference > 0 ? '+' : ''}{formatNumber(difference)}</strong>
                  <small>{difference > 0 ? 'Giriş' : difference < 0 ? 'Çıkış' : 'Hareket yok'}</small>
                </article>
                <article className="summary-card">
                  <span>Tahmini Etki</span>
                  <strong>{formatMoney(Math.abs(difference) * Number(selectedProduct.averageCostTry || 0))}</strong>
                  <small>Ortalama maliyet TRY</small>
                </article>
              </div>
              <div className="form-grid two-columns">
                <label>
                  Sayılan stok
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={countedQuantity}
                    onChange={(event) => {
                      setCountedQuantity(event.target.value);
                      setIsCountConfirmed(false);
                    }}
                    required
                  />
                </label>
                <label>
                  Not
                  <input
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setIsCountConfirmed(false);
                    }}
                    placeholder="Raf sayımı, depo farkı, sayım tutanağı..."
                    required
                  />
                </label>
              </div>
              <div className="stock-count-commit-warning" role="note">
                <strong>Gerçek stok değişikliği</strong>
                <span>Bu işlem stok bakiyesini ve hareket defterini değiştirir. Sayım nedeni zorunludur; ürün ile sayılan miktarı son kez kontrol edin.</span>
              </div>
              <label className="stock-count-confirmation">
                <input
                  type="checkbox"
                  checked={isCountConfirmed}
                  disabled={!isValidCountedQuantity(countedQuantity) || !isValidStockCountReason(note) || isApplying}
                  onChange={(event) => setIsCountConfirmed(event.target.checked)}
                />
                <span>Sayılan miktarı, farkı, seçilen ürünü ve düzeltme nedenini kontrol ettim.</span>
              </label>
              <div className="button-row">
                <button type="submit" className="primary" disabled={!isApplyEnabled}>
                  {isApplying ? 'Uygulanıyor...' : 'Onayla ve Sayımı Uygula'}
                </button>
                <button type="button" onClick={() => onOpenScreen?.('product-card', { productId: selectedProduct.id })}>
                  Stok Kartına Git
                </button>
              </div>
            </form>
          )}
          {message && <div className="list-state list-state-success">{message}</div>}
          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {lastResult && (
            <div className="screen-summary dashboard-summary inline-summary">
              <span>Hareket: {lastResult.movementCreated ? `#${lastResult.movementId}` : 'oluşturulmadı'}</span>
              <span>Önceki: {formatNumber(lastResult.currentQuantity)}</span>
              <span>Yeni: {formatNumber(lastResult.countedQuantity)}</span>
              <span>Fark: {lastResult.difference > 0 ? '+' : ''}{formatNumber(lastResult.difference)}</span>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
