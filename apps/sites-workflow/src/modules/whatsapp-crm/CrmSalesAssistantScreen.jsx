import React, { useEffect, useMemo, useState } from 'react';
import { Minus, PackageSearch, Plus, Search, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/apiConfig.js';
import { fetchProducts } from '../../services/productApi.js';
import { createWhatsappCrmQuote } from '../../services/whatsappCrmApi.js';
import { formatCrmMoney } from './crmWorkspaceData.js';

function imageUrl(value) {
  const path = String(value || '').trim().replace(/\\/g, '/');
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function CrmSalesAssistantScreen({ data, onOpenInbox }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [basket, setBasket] = useState([]);
  const [result, setResult] = useState('');
  const selectedConversation = data.conversations.find((item) => item.id === conversationId) || data.conversations[0] || null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProducts({ page: 1, limit: 60, activeOnly: true })
      .then((response) => { if (active) setProducts(Array.isArray(response?.data) ? response.data : []); })
      .catch((loadError) => { if (active) setError(loadError.message || 'Ürünler alınamadı.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const brands = useMemo(() => [...new Set(products.map((item) => item.brand).filter(Boolean))].sort(), [products]);
  const categories = useMemo(() => [...new Set(products.map((item) => item.category).filter(Boolean))].sort(), [products]);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return products.filter((item) => (!brand || item.brand === brand) && (!category || item.category === category) && (!query || [item.stockCode, item.productName, item.brand, item.category].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query))));
  }, [brand, category, products, search]);
  const subtotal = basket.reduce((sum, item) => sum + item.quantity * Number(item.salePrice || 0), 0);

  function addProduct(product) {
    setBasket((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }];
    });
  }

  function changeQuantity(productId, amount) {
    setBasket((current) => current.map((item) => item.id === productId ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item));
  }

  async function saveQuote() {
    if (!selectedConversation || !basket.length) return;
    setResult('Teklif kaydediliyor...');
    try {
      await createWhatsappCrmQuote(selectedConversation.id, {
        contact: { name: selectedConversation.name, phone: selectedConversation.phone, country: selectedConversation.country },
        lines: basket,
      });
      setResult('CRM teklifi hazırlandı. Göndermeden önce Gelen Kutusu’nda kontrol edin.');
    } catch (saveError) {
      setResult(saveError.message || 'Teklif kaydedilemedi.');
    }
  }

  return (
    <div className="crm-sales-layout">
      <aside className="crm-sales-conversations"><div className="crm-suite-panel-title"><div><strong>Görüşmeler</strong><span>Teklif hazırlanacak müşteri</span></div></div>{data.conversations.map((item) => <button className={selectedConversation?.id === item.id ? 'selected' : ''} key={item.id} onClick={() => setConversationId(item.id)} type="button"><span className="crm-mini-avatar">{item.avatar}</span><span><strong>{item.name}</strong><small>{item.preview}</small></span>{item.unread ? <em>{item.unread}</em> : null}</button>)}</aside>
      <section className="crm-product-catalog">
        <header className="crm-page-heading"><div><span className="crm-page-icon"><PackageSearch size={20} /></span><div><h2>Satış Asistanı</h2><p>ERP stoklarından ürün seçin ve güvenli teklif taslağı hazırlayın</p></div></div></header>
        <div className="crm-product-filters"><label><Search size={16} /><input onChange={(event) => setSearch(event.target.value)} placeholder="Ürün ara" value={search} /></label><select aria-label="Marka" onChange={(event) => setBrand(event.target.value)} value={brand}><option value="">Tüm markalar</option>{brands.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Kategori" onChange={(event) => setCategory(event.target.value)} value={category}><option value="">Tüm kategoriler</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
        {error ? <div className="crm-suite-warning">{error}</div> : null}
        <div className="crm-product-grid">{visibleProducts.map((product) => <article key={product.id}><div className="crm-product-image">{product.imageUrl ? <img alt={product.productName} src={imageUrl(product.imageUrl)} /> : <PackageSearch size={34} />}</div><small>STK: {product.stockCode}</small><h3>{product.productName}</h3><p>{product.brand || '-'} / {product.category || '-'}</p><div><span className={Number(product.stockQuantity || 0) > 0 ? 'in-stock' : 'out-stock'}>Stok: {Number(product.stockQuantity || 0)}</span><strong>{formatCrmMoney(product.salePrice, product.currency)}</strong></div><button disabled={Number(product.stockQuantity || 0) <= 0} onClick={() => addProduct(product)} type="button">Teklife Ekle <Plus size={15} /></button></article>)}</div>
        {loading ? <div className="crm-suite-empty">Ürünler yükleniyor...</div> : null}
      </section>
      <aside className="crm-quote-basket"><div className="crm-suite-panel-title"><div><strong><ShoppingCart size={17} /> Teklif Sepeti</strong><span>{selectedConversation?.name || 'CRM kişisi seçilmedi'} · CRM kaydı</span></div></div><div className="crm-basket-lines">{basket.map((item) => <article key={item.id}><div><strong>{item.productName}</strong><small>{item.stockCode}</small></div><strong>{formatCrmMoney(item.salePrice, item.currency)}</strong><div className="crm-quantity"><button onClick={() => changeQuantity(item.id, -1)} type="button"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} type="button"><Plus size={13} /></button></div><span>{formatCrmMoney(item.quantity * item.salePrice, item.currency)}</span><button aria-label="Ürünü çıkar" onClick={() => setBasket((current) => current.filter((row) => row.id !== item.id))} type="button"><Trash2 size={15} /></button></article>)}</div>{!basket.length ? <div className="crm-suite-empty">Sepete ürün ekleyin.</div> : null}<div className="crm-quote-totals"><p><span>Toplam</span><strong>{formatCrmMoney(subtotal, basket[0]?.currency)}</strong></p></div><button className="crm-quote-primary" disabled={!selectedConversation || !basket.length} onClick={saveQuote} type="button"><Send size={17} /> Teklifi Hazırla</button><button className="crm-quote-secondary" disabled={!selectedConversation} onClick={() => onOpenInbox(selectedConversation.id)} type="button">Gelen Kutusu’nda Kontrol Et</button>{result ? <div className="crm-suite-notice">{result}</div> : null}</aside>
    </div>
  );
}
