import React, { useEffect, useMemo, useState } from 'react';
import { ProductBarcodePanel } from './ProductBarcodePanel.jsx';
import { ProductCardForm } from './ProductCardForm.jsx';
import { ProductCardHeader } from './ProductCardHeader.jsx';
import { Product360Panel } from './Product360Panel.jsx';
import { ProductImagePanel } from './ProductImagePanel.jsx';
import { ProductStockUsagePanel } from './ProductStockUsagePanel.jsx';
import { ProductStockSummary } from './ProductStockSummary.jsx';
import {
  buildProduct360,
  buildProductView,
  emptyProductForm,
  mapBarcodes,
  mapDetailToForm,
  mapStockSummary,
  validateProductForm,
} from './productCardUtils.js';
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

export function ProductCardScreen({ productId, permissions = [], onDirtyChange, onOpenScreen }) {
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
  const [isEditing, setIsEditing] = useState(!productId);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setActiveProductId(productId || null);
    setIsEditing(!productId);
  }, [productId]);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!activeProductId) {
        setForm(emptyProductForm);
        setIsEditing(true);
        setErrorMessage('');
        setDuplicateProductSuggestion(null);
        setIsLoading(false);
        setIsDirty(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchProductDetail(activeProductId);

        if (isMounted) {
          setForm(mapDetailToForm(response.data));
          setIsEditing(false);
          setIsDirty(false);
        }
      } catch (error) {
        if (isMounted) {
          setForm(emptyProductForm);
          setErrorMessage(error.message || 'Ürün kartı API bağlantısı başarısız.');
          setIsDirty(false);
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
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    let isMounted = true;

    async function loadSuppliers() {
      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 300,
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
  const canEditForm = mode === 'create' || isEditing;
  const canSave = permissions.includes('product.edit');
  const canTogglePassive = permissions.includes('product.passive');
  const productView = useMemo(() => buildProductView(form, activeProductId), [form, activeProductId]);
  const stockSummary = useMemo(() => mapStockSummary(form), [form]);
  const product360 = useMemo(() => buildProduct360(form, stockMovements), [form, stockMovements]);
  const barcodes = useMemo(() => mapBarcodes(form), [form]);
  const images = useMemo(() => form.images || [], [form.images]);
  const productSuggestions = useMemo(() => {
    const suppliers = supplierSuggestions.length > 0 ? supplierSuggestions : stockFilterOptions.suppliers;
    return {
      ...stockFilterOptions,
      suppliers: [form.supplierName, ...suppliers].filter(Boolean),
    };
  }, [form.supplierName, supplierSuggestions]);

  function updateField(field, value) {
    if (!canEditForm) {
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setIsDirty(true);
    setSuccessMessage('');
    setDuplicateProductSuggestion(null);
  }

  function startNewProduct() {
    setActiveProductId(null);
    setForm(emptyProductForm);
    setIsEditing(true);
    setErrorMessage('');
    setDuplicateProductSuggestion(null);
    setSuccessMessage('');
    setIsDirty(false);
  }

  function setProductError(error, fallbackMessage) {
    const duplicateProduct = error.meta.duplicateProduct || null;
    setDuplicateProductSuggestion(duplicateProduct);
    setErrorMessage(`${error.message || fallbackMessage} (${error.code || 'API_ERROR'})`);
  }

  function openDuplicateProduct() {
    const duplicateProductId = Number(duplicateProductSuggestion.productId || duplicateProductSuggestion.id || 0);

    if (!duplicateProductId) {
      return;
    }

    setActiveProductId(duplicateProductId);
    setErrorMessage('');
    setDuplicateProductSuggestion(null);
    setSuccessMessage(`Kullanılan stok kartı açılıyor: ${duplicateProductSuggestion.stockCode || duplicateProductId}`);

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
      setIsEditing(false);
      setIsDirty(false);
      setSuccessMessage(response.message || (mode === 'create' ? 'Ürün oluşturuldu ve audit kaydı yazıldı.' : 'Ürün güncellendi ve audit kaydı yazıldı.'));
    } catch (error) {
      setProductError(error, 'Ürün kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePassiveProduct() {
    if (!activeProductId) {
      setErrorMessage('Pasif/Aktif işlemi için önce kayıtlı ürün açılmalı.');
      setSuccessMessage('');
      return;
    }

    if (!canTogglePassive) {
      setErrorMessage('Bu işlem için product.passive yetkisi gerekli.');
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
      setIsDirty(false);
      setSuccessMessage(response.message || (nextIsPassive
        ? 'Ürün pasif yapıldı ve audit kaydı yazıldı.'
        : 'Ürün aktif yapıldı ve audit kaydı yazıldı.'));
    } catch (error) {
      setErrorMessage(`${error.message || 'Pasif/Aktif işlemi başarısız.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsPassiveSaving(false);
    }
  }

  async function addBarcode(payload) {
    if (!activeProductId) {
      setErrorMessage('Ek barkod eklemek için önce ürünü kaydedin.');
      setSuccessMessage('');
      return;
    }

    if (!canSave) {
      setErrorMessage('Bu işlem için product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await addProductBarcode(activeProductId, payload);
      setForm(mapDetailToForm(response.data));
      setIsDirty(false);
      setSuccessMessage('Barkod kaydedildi. Terminal barkod aramasında kullanılabilir.');
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
      setErrorMessage('Bu işlem için product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await changeProductBarcodePassive(activeProductId, barcodeId, currentIsActive);
      setForm(mapDetailToForm(response.data));
      setIsDirty(false);
      setSuccessMessage(currentIsActive ? 'Barkod pasif yapıldı.' : 'Barkod aktif yapıldı.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Barkod durumu değiştirilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveImage(payload) {
    if (!activeProductId) {
      setErrorMessage('Görsel kaydetmek için önce ürünü kaydedin.');
      setSuccessMessage('');
      return;
    }

    if (!canSave) {
      setErrorMessage('Bu işlem için product.edit yetkisi gerekli.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await saveProductImage(activeProductId, payload);
      setForm(mapDetailToForm(response.data));
      setIsDirty(false);
      setSuccessMessage('Ürün görseli kaydedildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Görsel kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="work-area product-card-screen">
      {isLoading && <div className="list-state">API'den ürün kartı yükleniyor...</div>}
      {!isLoading && (
        <>
          <ProductCardHeader
            product={productView}
            mode={mode}
            isSaving={isSaving}
            isPassiveSaving={isPassiveSaving}
            isEditing={canEditForm}
            canSave={canSave}
            canTogglePassive={canTogglePassive}
            onEdit={() => setIsEditing(true)}
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
          <Product360Panel
            activeProductId={activeProductId}
            form={form}
            product360={product360}
            onOpenScreen={onOpenScreen}
          />
          <section className="product-card-layout">
            <ProductCardForm
              product={productView}
              form={form}
              mode={mode}
              suggestions={productSuggestions}
              isEditing={canEditForm}
              onChange={updateField}
            />
            <aside className="product-side-panels">
              <ProductImagePanel
                product={productView}
                images={images}
                canEdit={canSave && canEditForm}
                disabled={isSaving || !activeProductId}
                onSaveImage={saveImage}
              />
              <ProductStockSummary summary={stockSummary} />
            </aside>
            <ProductBarcodePanel
              barcodes={barcodes}
              canEdit={canSave && canEditForm}
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
            <span>Mod: {mode === 'create' ? 'Yeni kayıt' : canEditForm ? 'Düzenleme' : 'İzleme'}</span>
            <span>Kaynak: API</span>
          </section>
        </>
      )}
    </main>
  );
}
