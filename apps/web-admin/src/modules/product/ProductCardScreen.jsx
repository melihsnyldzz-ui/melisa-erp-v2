import React, { useEffect, useState } from 'react';
import { ProductBarcodePanel } from './ProductBarcodePanel.jsx';
import { ProductCardForm } from './ProductCardForm.jsx';
import { ProductCardHeader } from './ProductCardHeader.jsx';
import { ProductImagePanel } from './ProductImagePanel.jsx';
import { ProductStockSummary } from './ProductStockSummary.jsx';
import { fetchProductDetail } from '../../services/productDetailApi.js';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function mapProduct(detail) {
  return {
    id: detail.id,
    stockCode: detail.stockCode,
    primaryBarcode: detail.barcodeMasked || '-',
    name: detail.productName,
    brand: detail.brand || '-',
    category: detail.category || '-',
    currency: detail.currency,
    salesPrice: formatMoney(detail.salePrice, detail.currency),
    purchasePrice: formatMoney(detail.purchasePrice, detail.currency),
    supplier: detail.supplierName || '-',
    status: detail.isPassive ? 'Pasif' : 'Aktif',
    hasMovements: Boolean(detail.lastPurchaseDate || detail.lastSaleDate),
    currencyRule: detail.lastPurchaseDate || detail.lastSaleDate
      ? 'Hareket gormus urun: para birimi kilitli. Admin ozel islem ve audit gerekir.'
      : 'Hareket gormemis urun: para birimi degistirilebilir.',
    imageNote: 'Toplu gorsel eslesme sonraki fazda stok kodu/barkod adina gore yapilacak.',
  };
}

function mapStockSummary(detail) {
  return {
    currentStock: detail.stockQuantity,
    averageCostTry: formatMoney(detail.averageCostTry, 'TRY'),
    lastPurchaseDate: detail.lastPurchaseDate || '-',
    lastSaleDate: detail.lastSaleDate || '-',
    negativeStockWarning: detail.stockQuantity < 0 ? 'Eksi stok uyarisi: satis/sync kontrol edilmeli.' : '',
  };
}

function mapBarcodes(detail) {
  return [
    {
      id: `${detail.id}-primary`,
      barcode: detail.barcodeMasked || '-',
      type: 'Ana barkod',
      isPrimary: true,
      status: detail.isPassive ? 'Pasif' : 'Aktif',
    },
  ];
}

export function ProductCardScreen({ productId }) {
  const [product, setProduct] = useState(null);
  const [stockSummary, setStockSummary] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!productId) {
        setProduct(null);
        setStockSummary(null);
        setBarcodes([]);
        setErrorMessage('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchProductDetail(productId);
        const detail = response.data;

        if (isMounted) {
          setProduct(mapProduct(detail));
          setStockSummary(mapStockSummary(detail));
          setBarcodes(mapBarcodes(detail));
        }
      } catch (error) {
        if (isMounted) {
          setProduct(null);
          setStockSummary(null);
          setBarcodes([]);
          setErrorMessage(error.message || 'Urun karti API baglantisi basarisiz.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  return (
    <main className="work-area product-card-screen">
      {isLoading && <div className="list-state">API'den urun karti yukleniyor...</div>}
      {!isLoading && errorMessage && (
        <div className="list-state list-state-error">
          {errorMessage} API baglantisi kontrol edilmeli; mock veriye gecilmedi.
        </div>
      )}
      {!isLoading && !errorMessage && !product && (
        <div className="list-state">Urun karti acmak icin stok listesinden bir urun secin.</div>
      )}
      {!isLoading && !errorMessage && product && (
        <>
          <ProductCardHeader product={product} />
          <section className="product-card-layout">
            <ProductCardForm product={product} />
            <aside className="product-side-panels">
              <ProductImagePanel product={product} />
              <ProductStockSummary summary={stockSummary} />
            </aside>
            <ProductBarcodePanel barcodes={barcodes} />
          </section>
          <section className="screen-summary product-card-summary">
            <span>Urun: {product.stockCode}</span>
            <span>Durum: {product.status}</span>
            <span>Hareket: {product.hasMovements ? 'var' : 'yok'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
