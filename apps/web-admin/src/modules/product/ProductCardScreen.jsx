import React, { useEffect, useMemo, useState } from 'react';
import { ProductBarcodePanel } from './ProductBarcodePanel.jsx';
import { ProductCardForm } from './ProductCardForm.jsx';
import { ProductCardHeader } from './ProductCardHeader.jsx';
import { ProductImagePanel } from './ProductImagePanel.jsx';
import { ProductStockUsagePanel } from './ProductStockUsagePanel.jsx';
import { ProductStockSummary } from './ProductStockSummary.jsx';
import { stockFilterOptions } from '../stock/stockMockData.js';
import {
  addProductBarcode,
  changeProductPassive,
  changeProductBarcodePassive,
  createProduct,
  fetchProductDetail,
  fetchProductStockMovements,
  saveProductImage,
  updateProduct,
} from '../../services/productDetailApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';

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
  purchaseDiscountRate: '',
  supplierName: '',
  isPassive: false,
  hasMovements: false,
  stockQuantity: 0,
  averageCostTry: 0,
  lastPurchaseDate: '',
  lastSaleDate: '',
  barcodes: [],
  images: [],
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
    purchaseDiscountRate: String(detail.purchaseDiscountRate ?? 0),
    supplierName: detail.supplierCode && detail.supplierName
      ? `${detail.supplierCode} / ${detail.supplierName}`
      : detail.supplierName || '',
    isPassive: Boolean(detail.isPassive),
    hasMovements: Boolean(detail.lastPurchaseDate || detail.lastSaleDate),
    stockQuantity: detail.stockQuantity || 0,
    averageCostTry: detail.averageCostTry || 0,
    lastPurchaseDate: detail.lastPurchaseDate || '',
    lastSaleDate: detail.lastSaleDate || '',
    barcodes: detail.barcodes || [],
    images: detail.images || [],
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
    purchaseDiscountRate: Number(form.purchaseDiscountRate || 0),
    supplier: form.supplierName || '-',
    status: form.isPassive ? 'Pasif' : 'Aktif',
    hasMovements: Boolean(form.hasMovements),
    currencyRule: form.hasMovements
      ? 'Hareket gormus urun: para birimi kilitli. Admin ozel islem ve audit gerekir.'
      : 'Hareket gormemis urun: para birimi degistirilebilir.',
    imageNote: 'Gorsel URL veya dosya yolu kaydedilebilir. Binary dosya yukleme sonraki faz.',
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

function mapBarcodes(form) {
  if (form.barcodes?.length > 0) {
    return form.barcodes.map((barcode) => ({
      ...barcode,
      status: barcode.isActive ? 'Aktif' : 'Pasif',
    }));
  }

  const barcode = form.barcode || form.existingBarcodeMasked;
  return barcode ? [{
    id: 'pending-primary',
    barcode,
    type: 'primary',
    isPrimary: true,
    isActive: !form.isPassive,
    status: form.isPassive ? 'Pasif' : 'Aktif',
  }] : [];
}

function validateProductForm(form, mode) {
  const missing = [];

  if (!form.stockCode.trim()) missing.push('stok kodu');
  if (!form.productName.trim()) missing.push('urun adi');
  if (mode === 'create' && !form.barcode.trim()) missing.push('barkod');
  if (!form.currency.trim()) missing.push('para birimi');
  if (form.salePrice === '' || Number.isNaN(Number(form.salePrice))) missing.push('satis fiyati');
  if (form.purchasePrice === '' || Number.isNaN(Number(form.purchasePrice))) missing.push('alis fiyati');
  if (form.purchaseDiscountRate !== '' && (Number.isNaN(Number(form.purchaseDiscountRate)) || Number(form.purchaseDiscountRate) < 0 || Number(form.purchaseDiscountRate) > 100)) {
    missing.push('alis iskontosu 0-100');
  }

  return missing;
}

export function ProductCardScreen({ productId, permissions = [], onOpenScreen }) {
  const [activeProductId, setActiveProductId] = useState(productId || null);
  const [form, setForm] = useState(emptyProductForm);
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [isSaving, setIsSaving] = useState(false);
  const [isPassiveSaving, setIsPassiveSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateProductSuggestion, setDuplicateProductSuggestion] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [stockMovements, setStockMovements] = useState([]);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);

  useEffect(() => {
    setActiveProductId(productId || null);
  }, [productId]);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!activeProductId) {
        setForm(emptyProductForm);
        setErrorMessage('');
        setDuplicateProductSuggestion(null);
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

  useEffect(() => {
    let isMounted = true;

    async function loadSuppliers() {
      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 100,
          activeOnly: true,
        });

        if (isMounted) {
          setSupplierSuggestions((response.data || []).map((supplier) => (
            `${supplier.supplierCode} / ${supplier.supplierName}`
          )));
        }
      } catch {
        if (isMounted) {
          setSupplierSuggestions([]);
        }
      }
    }

    loadSuppliers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMovements() {
      if (!activeProductId) {
        setStockMovements([]);
        setIsMovementsLoading(false);
        return;
      }

      setIsMovementsLoading(true);

      try {
        const response = await fetchProductStockMovements(activeProductId);
        if (isMounted) {
          setStockMovements(response.data || []);
        }
      } catch (error) {
        if (isMounted) {
          setStockMovements([]);
        }
      } finally {
        if (isMounted) {
          setIsMovementsLoading(false);
        }
      }
    }

    loadMovements();

    return () => {
      isMounted = false;
    };
  }, [activeProductId]);

  const mode = activeProductId ? 'update' : 'create';
  const canSave = permissions.includes('product.edit');
  const canTogglePassive = permissions.includes('product.passive');
  const productView = useMemo(() => buildProductView(form, activeProductId), [form, activeProductId]);
  const stockSummary = useMemo(() => mapStockSummary(form), [form]);
  const barcodes = useMemo(() => mapBarcodes(form), [form]);
  const images = useMemo(() => form.images || [], [form.images]);
  const productSuggestions = useMemo(() => ({
    ...stockFilterOptions,
    suppliers: supplierSuggestions.length > 0 ? supplierSuggestions : stockFilterOptions.suppliers,
  }), [supplierSuggestions]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSuccessMessage('');
    setDuplicateProductSuggestion(null);
  }

  function startNewProduct() {
    setActiveProductId(null);
    setForm(emptyProductForm);
    setErrorMessage('');
    setDuplicateProductSuggestion(null);
    setSuccessMessage('');
  }

  function setProductError(error, fallbackMessage) {
    const duplicateProduct = error.meta?.duplicateProduct || null;
    setDuplicateProductSuggestion(duplicateProduct);
    setErrorMessage(`${error.message || fallbackMessage} (${error.code || 'API_ERROR'})`);
  }

  function openDuplicateProduct() {
    const duplicateProductId = Number(duplicateProductSuggestion?.productId || duplicateProductSuggestion?.id || 0);

    if (!duplicateProductId) {
      return;
    }

    setActiveProductId(duplicateProductId);
    setErrorMessage('');
    setDuplicateProductSuggestion(null);
    setSuccessMessage(`Kullanilan stok karti aciliyor: ${duplicateProductSuggestion.stockCode || duplicateProductId}`);

    if (onOpenScreen) {
      onOpenScreen('product-card', {
        productId: duplicateProductId,
        stockCode: duplicateProductSuggestion.stockCode,
      });
    }
  }

  function openStockMovement(row) {
    if (!onOpenScreen) {
      return;
    }

    if (row.targetScreen && row.targetPayload) {
      onOpenScreen(row.targetScreen, row.targetPayload);
      return;
    }

    if (row.sourceType === 'sales_invoice') {
      onOpenScreen('sales-invoice', {
        salesDraftId: row.sourceId,
        invoiceNo: row.sourceDocumentNo,
      });
      return;
    }

    if (row.sourceType === 'purchase_invoice') {
      onOpenScreen('purchase-invoice', {
        purchaseDraftId: row.sourceId,
        invoiceNo: row.sourceDocumentNo,
      });
      return;
    }

    onOpenScreen('stock-movements', {
      productId: activeProductId,
      stockCode: form.stockCode,
    });
  }

  function openUsageParty(row) {
    if (!onOpenScreen) {
      return;
    }

    if (row.partyTargetScreen && row.partyTargetPayload) {
      onOpenScreen(row.partyTargetScreen, row.partyTargetPayload);
      return;
    }

    if (row.customerId) {
      onOpenScreen('customer-card', {
        customerId: row.customerId,
        customerName: row.customerName,
      });
      return;
    }

    if (row.supplierId) {
      onOpenScreen('supplier-card', {
        supplierId: row.supplierId,
        supplierName: row.supplierName,
      });
    }
  }

  async function saveProduct() {
    const missing = validateProductForm(form, mode);

    if (!canSave) {
      setErrorMessage('Bu islem icin product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

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
      purchaseDiscountRate: Number(form.purchaseDiscountRate || 0),
      supplierName: form.supplierName,
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
      setSuccessMessage(response.message || (mode === 'create' ? 'Urun olusturuldu ve audit kaydi yazildi.' : 'Urun guncellendi ve audit kaydi yazildi.'));
    } catch (error) {
      setProductError(error, 'Urun kaydedilemedi.');
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

    if (!canTogglePassive) {
      setErrorMessage('Bu islem icin product.passive yetkisi gerekli.');
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
      setSuccessMessage(response.message || (nextIsPassive
        ? 'Urun pasif yapildi ve audit kaydi yazildi.'
        : 'Urun aktif yapildi ve audit kaydi yazildi.'));
    } catch (error) {
      setErrorMessage(`${error.message || 'Pasif/Aktif islemi basarisiz.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsPassiveSaving(false);
    }
  }

  async function addBarcode(payload) {
    if (!activeProductId) {
      setErrorMessage('Ek barkod eklemek icin once urunu kaydedin.');
      setSuccessMessage('');
      return;
    }

    if (!canSave) {
      setErrorMessage('Bu islem icin product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await addProductBarcode(activeProductId, payload);
      setForm(mapDetailToForm(response.data));
      setSuccessMessage('Barkod kaydedildi. Terminal barkod aramasinda kullanilabilir.');
    } catch (error) {
      setProductError(error, 'Barkod kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleBarcode(barcodeId, currentIsActive) {
    if (!activeProductId || barcodeId === 'pending-primary') {
      return;
    }

    if (!canSave) {
      setErrorMessage('Bu islem icin product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await changeProductBarcodePassive(activeProductId, barcodeId, currentIsActive);
      setForm(mapDetailToForm(response.data));
      setSuccessMessage(currentIsActive ? 'Barkod pasif yapildi.' : 'Barkod aktif yapildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Barkod durumu degistirilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveImage(payload) {
    if (!activeProductId) {
      setErrorMessage('Gorsel kaydetmek icin once urunu kaydedin.');
      setSuccessMessage('');
      return;
    }

    if (!canSave) {
      setErrorMessage('Bu islem icin product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await saveProductImage(activeProductId, payload);
      setForm(mapDetailToForm(response.data));
      setSuccessMessage('Urun gorseli kaydedildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Gorsel kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
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
            canSave={canSave}
            canTogglePassive={canTogglePassive}
            onSave={saveProduct}
            onNew={startNewProduct}
            onTogglePassive={togglePassiveProduct}
          />
          {errorMessage && (
            <div className="list-state list-state-error product-duplicate-error">
              <span>{errorMessage}</span>
              {duplicateProductSuggestion ? (
                <button onClick={openDuplicateProduct} type="button">
                  Kullanılan stok kartını aç: {duplicateProductSuggestion.stockCode} / {duplicateProductSuggestion.productName}
                </button>
              ) : null}
            </div>
          )}
          {successMessage && <div className="list-state list-state-success">{successMessage}</div>}
          {form.isPassive && (
            <div className="list-state list-state-passive">
              PASİF kayıt: yeni fişlerde seçilemez, geçmiş rapor ve hareketlerde görünmeye devam eder.
            </div>
          )}
          <section className="product-card-layout">
            <ProductCardForm
              product={productView}
              form={form}
              mode={mode}
              suggestions={productSuggestions}
              onChange={updateField}
            />
            <aside className="product-side-panels">
              <ProductImagePanel
                product={productView}
                images={images}
                canEdit={canSave}
                disabled={isSaving || !activeProductId}
                onSaveImage={saveImage}
              />
              <ProductStockSummary summary={stockSummary} />
            </aside>
            <ProductBarcodePanel
              barcodes={barcodes}
              canEdit={canSave}
              disabled={isSaving || !activeProductId}
              onAddBarcode={addBarcode}
              onToggleBarcode={toggleBarcode}
            />
            <ProductStockUsagePanel
              isLoading={isMovementsLoading}
              movements={stockMovements}
              onOpenMovement={openStockMovement}
              onOpenParty={openUsageParty}
            />
          </section>
          <section className="screen-summary product-card-summary">
            <span>Ürün: {productView.stockCode}</span>
            <span>Durum: {productView.status}</span>
            <span>Mod: {mode === 'create' ? 'Yeni kayıt' : 'Güncelleme'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
