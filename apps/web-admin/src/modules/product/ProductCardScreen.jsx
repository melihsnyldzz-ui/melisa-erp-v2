import React, { useEffect, useMemo, useState } from 'react';
import { ProductBarcodePanel } from './ProductBarcodePanel.jsx';
import { ProductCardForm } from './ProductCardForm.jsx';
import { ProductCardHeader } from './ProductCardHeader.jsx';
import { ProductImagePanel } from './ProductImagePanel.jsx';
import { ProductStockSummary } from './ProductStockSummary.jsx';
import {
  changeProductPassive,
  createProduct,
  fetchProductDetail,
  updateProduct,
} from '../../services/productDetailApi.js';

const emptyProductForm = {
  stockCode: '',
  barcode: '',
  existingBarcodeMasked: '',
  productName: '',
  brand: '',
  category: '',
  currency: 'TRY',
  salePrice: '',
  purchasePrice: '',
  supplierName: '',
  isPassive: false,
  hasMovements: false,
  stockQuantity: 0,
  averageCostTry: 0,
  lastPurchaseDate: '',
  lastSaleDate: '',
};

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function mapDetailToForm(detail) {
  return {
    stockCode: detail.stockCode || '',
    barcode: '',
    existingBarcodeMasked: detail.barcodeMasked || '',
    productName: detail.productName || '',
    brand: detail.brand || '',
    category: detail.category || '',
    currency: detail.currency || 'TRY',
    salePrice: String(detail.salePrice ?? ''),
    purchasePrice: String(detail.purchasePrice ?? ''),
    supplierName: detail.supplierName || '',
    isPassive: Boolean(detail.isPassive),
    hasMovements: Boolean(detail.lastPurchaseDate || detail.lastSaleDate),
    stockQuantity: detail.stockQuantity || 0,
    averageCostTry: detail.averageCostTry || 0,
    lastPurchaseDate: detail.lastPurchaseDate || '',
    lastSaleDate: detail.lastSaleDate || '',
  };
}

function buildProductView(form, detailId = null) {
  return {
    id: detailId,
    stockCode: form.stockCode || 'YENI-URUN',
    primaryBarcode: form.barcode || form.existingBarcodeMasked || '-',
    name: form.productName || 'Yeni urun',
    brand: form.brand || '-',
    category: form.category || '-',
    currency: form.currency || 'TRY',
    salesPrice: formatMoney(form.salePrice, form.currency || 'TRY'),
    purchasePrice: formatMoney(form.purchasePrice, form.currency || 'TRY'),
    supplier: form.supplierName || '-',
    status: form.isPassive ? 'Pasif' : 'Aktif',
    hasMovements: Boolean(form.hasMovements),
    currencyRule: form.hasMovements
      ? 'Hareket gormus urun: para birimi kilitli. Admin ozel islem ve audit gerekir.'
      : 'Hareket gormemis urun: para birimi degistirilebilir.',
    imageNote: 'Toplu gorsel eslesme sonraki fazda stok kodu/barkod adina gore yapilacak.',
  };
}

function mapStockSummary(form) {
  return {
    currentStock: Number(form.stockQuantity || 0),
    averageCostTry: formatMoney(form.averageCostTry || form.purchasePrice || 0, 'TRY'),
    lastPurchaseDate: form.lastPurchaseDate || '-',
    lastSaleDate: form.lastSaleDate || '-',
    negativeStockWarning: Number(form.stockQuantity || 0) < 0 ? 'Eksi stok uyarisi: satis/sync kontrol edilmeli.' : '',
  };
}

function mapBarcodes(form, detailId) {
  const barcode = form.barcode || form.existingBarcodeMasked;

  return barcode
    ? [{
      id: `${detailId || 'new'}-primary`,
      barcode,
      type: 'Ana barkod',
      isPrimary: true,
      status: form.isPassive ? 'Pasif' : 'Aktif',
    }]
    : [];
}

function validateProductForm(form, mode) {
  const missing = [];

  if (!form.stockCode.trim()) missing.push('stok kodu');
  if (!form.productName.trim()) missing.push('urun adi');
  if (mode === 'create' && !form.barcode.trim()) missing.push('barkod');
  if (!form.currency.trim()) missing.push('para birimi');
  if (form.salePrice === '' || Number.isNaN(Number(form.salePrice))) missing.push('satis fiyati');
  if (form.purchasePrice === '' || Number.isNaN(Number(form.purchasePrice))) missing.push('alis fiyati');

  return missing;
}

export function ProductCardScreen({ productId }) {
  const [activeProductId, setActiveProductId] = useState(productId || null);
  const [form, setForm] = useState(emptyProductForm);
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [isSaving, setIsSaving] = useState(false);
  const [isPassiveSaving, setIsPassiveSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setActiveProductId(productId || null);
  }, [productId]);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!activeProductId) {
        setForm(emptyProductForm);
        setErrorMessage('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchProductDetail(activeProductId);

        if (isMounted) {
          setForm(mapDetailToForm(response.data));
        }
      } catch (error) {
        if (isMounted) {
          setForm(emptyProductForm);
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
  }, [activeProductId]);

  const mode = activeProductId ? 'update' : 'create';
  const productView = useMemo(() => buildProductView(form, activeProductId), [form, activeProductId]);
  const stockSummary = useMemo(() => mapStockSummary(form), [form]);
  const barcodes = useMemo(() => mapBarcodes(form, activeProductId), [form, activeProductId]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSuccessMessage('');
  }

  function startNewProduct() {
    setActiveProductId(null);
    setForm(emptyProductForm);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveProduct() {
    const missing = validateProductForm(form, mode);

    if (missing.length > 0) {
      setErrorMessage(`Kaydetmeden once zorunlu alanlari tamamlayin: ${missing.join(', ')}.`);
      setSuccessMessage('');
      return;
    }

    const payload = {
      stockCode: form.stockCode,
      productName: form.productName,
      barcode: form.barcode,
      brand: form.brand,
      category: form.category,
      currency: form.currency,
      salePrice: Number(form.salePrice),
      purchasePrice: Number(form.purchasePrice),
    };

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = mode === 'create'
        ? await createProduct(payload)
        : await updateProduct(activeProductId, payload);

      setActiveProductId(response.data.id);
      setForm(mapDetailToForm(response.data));
      setSuccessMessage(mode === 'create' ? 'Urun olusturuldu ve audit kaydi yazildi.' : 'Urun guncellendi ve audit kaydi yazildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Urun kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePassiveProduct() {
    if (!activeProductId) {
      setErrorMessage('Pasif/Aktif islemi icin once kayitli urun acilmali.');
      setSuccessMessage('');
      return;
    }

    const nextIsPassive = !form.isPassive;

    setIsPassiveSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await changeProductPassive(activeProductId, nextIsPassive);
      setForm(mapDetailToForm(response.data));
      setSuccessMessage(nextIsPassive
        ? 'Urun pasif yapildi ve audit kaydi yazildi.'
        : 'Urun aktif yapildi ve audit kaydi yazildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Pasif/Aktif islemi basarisiz.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsPassiveSaving(false);
    }
  }

  return (
    <main className="work-area product-card-screen">
      {isLoading && <div className="list-state">API'den urun karti yukleniyor...</div>}
      {!isLoading && (
        <>
          <ProductCardHeader
            product={productView}
            mode={mode}
            isSaving={isSaving}
            isPassiveSaving={isPassiveSaving}
            onSave={saveProduct}
            onNew={startNewProduct}
            onTogglePassive={togglePassiveProduct}
          />
          {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
          {successMessage && <div className="list-state list-state-success">{successMessage}</div>}
          {form.isPassive && (
            <div className="list-state list-state-passive">
              PASIF kayit: yeni fislerde secilemez, gecmis rapor ve hareketlerde gorunmeye devam eder.
            </div>
          )}
          <section className="product-card-layout">
            <ProductCardForm
              product={productView}
              form={form}
              mode={mode}
              onChange={updateField}
            />
            <aside className="product-side-panels">
              <ProductImagePanel product={productView} />
              <ProductStockSummary summary={stockSummary} />
            </aside>
            <ProductBarcodePanel barcodes={barcodes} />
          </section>
          <section className="screen-summary product-card-summary">
            <span>Urun: {productView.stockCode}</span>
            <span>Durum: {productView.status}</span>
            <span>Mod: {mode === 'create' ? 'Yeni kayit' : 'Guncelleme'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
