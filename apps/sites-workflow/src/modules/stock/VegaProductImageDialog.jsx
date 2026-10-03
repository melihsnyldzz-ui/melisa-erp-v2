import React, { useState } from 'react';
import { ImagePlus, ShieldCheck, Trash2, X } from 'lucide-react';
import { ProductImagePanel } from '../product/ProductImagePanel.jsx';

export function VegaProductImageDialog({ product, isSaving = false, errorMessage = '', onSave, onRemove, onClose }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const images = product?.imageUrl ? [{ filePath: product.imageUrl, isPrimary: true, isActive: true }] : [];

  return (
    <div className="bulk-update-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section aria-labelledby="vega-image-dialog-title" aria-modal="true" className="bulk-update-dialog vega-image-dialog" role="dialog">
        <header className="bulk-update-header">
          <div>
            <h2 id="vega-image-dialog-title"><ImagePlus aria-hidden="true" size={19} /> Stok kartı görseli</h2>
            <p>{product.stockCode} · {product.name}</p>
          </div>
          <button aria-label="Pencereyi kapat" className="icon-button" disabled={isSaving} onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="bulk-update-protected vega-image-safety-note">
          <ShieldCheck aria-hidden="true" size={18} />
          <span>Görsel Melisa ERP'de saklanır. Vega stok kartı ve ticari veriler değiştirilmez.</span>
        </div>

        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

        <ProductImagePanel
          key={`${product.sourceId}:${product.imageUrl || 'empty'}`}
          product={{ productName: product.name, stockCode: product.stockCode }}
          images={images}
          canEdit
          disabled={isSaving}
          onSaveImage={onSave}
        />

        <footer className="vega-image-dialog-footer">
          {product.imageUrl && !confirmRemove && (
            <button className="danger-outline" disabled={isSaving} onClick={() => setConfirmRemove(true)} type="button">
              <Trash2 aria-hidden="true" size={16} /> Görseli Kaldır
            </button>
          )}
          {product.imageUrl && confirmRemove && (
            <div className="vega-image-remove-confirmation">
              <span>Görsel bağlantısı kaldırılsın mı?</span>
              <button disabled={isSaving} onClick={() => setConfirmRemove(false)} type="button">Vazgeç</button>
              <button className="danger-action" disabled={isSaving} onClick={onRemove} type="button">Evet, kaldır</button>
            </div>
          )}
          <button disabled={isSaving} onClick={onClose} type="button">Kapat</button>
        </footer>
      </section>
    </div>
  );
}
