import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchVegaProducts } from '../../services/productApi.js';
import { API_BASE_URL } from '../../config/apiConfig.js';
import { buildCatalogHtml, CATALOG_LAYOUTS, catalogPages, catalogSection, catalogPrice, prepareCatalogFrame, toCatalogProduct, refreshCatalogSelection } from './catalogPdf.js';
import './catalogPdf.css';

export function CatalogPdfScreen() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1, imageStatus: 'with-image' });
  const [result, setResult] = useState({ rows: [], total: 0, pages: 1 });
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Melisa Bebe Katalog');
  const [subtitle, setSubtitle] = useState('');
  const [layoutId, setLayoutId] = useState('grid');
  const [order, setOrder] = useState('selection');
  const [grouping, setGrouping] = useState('none');
  const [cover, setCover] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [showStock, setShowStock] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [imageFailures, setImageFailures] = useState(0);
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const frame = useRef(null);
  const previewVersion = useRef(0);
  useEffect(() => () => { previewVersion.current += 1; }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setResult({ rows: [], total: 0, pages: 1 });
    fetchVegaProducts({ ...query, limit: 48, activeOnly: true, imageUsage: 'catalog' }).then(response => {
      if (!current) return;
      const rows = response.data.map(row => toCatalogProduct(row, API_BASE_URL));
      if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Ürün sayfasında tekrar eden kayıt var. Yeniden deneyin.');
      const total = Number(response.meta?.total);
      const limit = Number(response.meta?.limit);
      if (!Number.isInteger(total) || total < 0 || !Number.isInteger(limit) || limit <= 0) throw new Error('Ürün sayfası bilgisi eksik. Yeniden deneyin.');
      setResult({ rows, total, pages: Math.max(1, Math.ceil(total / limit)) });
    }).catch(problem => { if (current) setError(problem.message || 'Ürünler okunamadı.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query]);

  const pages = useMemo(() => catalogPages(selected, layoutId, order, grouping), [selected, layoutId, order, grouping]);
  useEffect(() => {
    previewVersion.current += 1;
    setPreview('');
    setPreviewReady(false);
    setNotice('');
  }, [selected, title, subtitle, layoutId, order, grouping, cover, showPrices, showStock, showImages]);

  useEffect(() => {
    if (!preview || !frame.current) return undefined;
    const element = frame.current;
    const resize = () => element.contentDocument?.documentElement.style.setProperty('--preview-scale', String(Math.min(1, element.clientWidth / 810)));
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    element.addEventListener('load', resize);
    return () => { observer.disconnect(); element.removeEventListener('load', resize); };
  }, [preview]);

  function toggle(product) {
    setSelected(rows => rows.some(row => row.id === product.id) ? rows.filter(row => row.id !== product.id) : [...rows, product]);
  }
  function move(index, direction) {
    setOrder('selection');
    setSelected(rows => {
      const next = [...rows];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }
  async function validateSelection() {
    if (checkingRef.current) return false;
    const version = previewVersion.current;
    checkingRef.current = true;
    setChecking(true);
    try {
      const fresh = await refreshCatalogSelection(selected, fetchVegaProducts, API_BASE_URL, () => version === previewVersion.current);
      if (version !== previewVersion.current) return false;
      if (JSON.stringify(fresh) !== JSON.stringify(selected)) {
        setSelected(fresh);
        setResult(current => ({ ...current, rows: current.rows.map(row => fresh.find(product => product.id === row.id) || row) }));
        setError('Seçilen ürünlerin bilgileri veya fotoğraf onayı değişti. Liste güncellendi; kataloğu yeniden önizleyin.');
        return false;
      }
      return true;
    } catch (problem) {
      if (version === previewVersion.current) { setPreview(''); setPreviewReady(false); setError(problem.message || 'Ürünler yeniden doğrulanamadı.'); }
      return false;
    } finally { checkingRef.current = false; setChecking(false); }
  }
  async function openPreview() {
    if (checkingRef.current) return;
    setError('');
    setPreview('');
    setPreviewReady(false);
    setImageFailures(0);
    previewVersion.current += 1;
    if (!await validateSelection()) return;
    setPreview(buildCatalogHtml({ products: selected, title, subtitle, layoutId, order, grouping, cover, showPrices, showStock, showImages }));
  }
  async function loaded() {
    const version = previewVersion.current;
    try {
      const failed = await prepareCatalogFrame(frame.current);
      if (version !== previewVersion.current) return;
      setImageFailures(failed);
      setPreviewReady(true);
    } catch (problem) { if (version === previewVersion.current) setError(problem.message); }
  }
  async function print() {
    if (!previewReady || !frame.current?.contentWindow || checkingRef.current) return;
    setError('');
    if (!await validateSelection() || !frame.current?.contentWindow) return;
    frame.current.contentWindow.focus();
    frame.current.contentWindow.print();
    setNotice('Açılan yazdırma penceresinde “PDF olarak kaydet” seçin. Kağıt: A4; kenar boşlukları: yok; üst ve alt bilgiler: kapalı.');
  }

  return <main className="work-area pdf-catalog">
    <header className="pdf-catalog-heading"><div><span>KATALOG ATÖLYESİ</span><h1>Ürünlerinden bir katalog hazırla</h1><p>Ürünleri seç, sayfa düzenini belirle ve PDF olarak kaydet.</p></div><b>{selected.length} ürün · {selected.length ? pages.length + Number(cover) : 0} sayfa</b></header>
    {error && <div role="alert" className="list-state list-state-error">{error}</div>}
    <div className="pdf-catalog-workbench">
      <section className="pdf-catalog-panel">
        <h2><i>1</i> Ürünleri seç</h2>
        <form className="pdf-catalog-search" onSubmit={event => { event.preventDefault(); setQuery(current => ({ ...current, search, page: 1 })); }}>
          <input aria-label="Ürün ara" value={search} onChange={event => setSearch(event.target.value)} placeholder="Ürün kodu, adı veya marka" />
          <select aria-label="Görsel filtresi" value={query.imageStatus} onChange={event => setQuery(current => ({ ...current, imageStatus: event.target.value, page: 1 }))}><option value="with-image">Fotoğraf kaydı olanlar</option><option value="all">Tüm ürünler</option></select>
          <button type="submit">Ara</button>
        </form>
        <div className="pdf-catalog-line"><small>{loading ? 'Ürünler okunuyor…' : `${result.total} ürün · bu sayfada ${result.rows.length}`}</small><button type="button" disabled={loading || !result.rows.length} onClick={() => setSelected(rows => [...rows, ...result.rows.filter(product => !rows.some(row => row.id === product.id))])}>Bu sayfayı seç</button></div>
        {!loading && !result.rows.length && !error && <p>Bu aramada ürün bulunamadı.</p>}
        <div className="pdf-catalog-products">{result.rows.map(product => <label className={`pdf-product ${selected.some(row => row.id === product.id) ? 'is-selected' : ''}`} key={product.id}>
          <input type="checkbox" aria-label={`${product.code} seç`} checked={selected.some(row => row.id === product.id)} onChange={() => toggle(product)} />
          <div className="pdf-product-image">{product.image ? <img src={product.image} alt={product.code} loading="lazy" onLoad={event => event.currentTarget.nextElementSibling?.setAttribute('hidden', '')} onError={event => { event.currentTarget.style.display = 'none'; }} /> : null}<span>{product.imageNotice}</span></div>
          <small>{product.brand || 'Marka belirtilmemiş'}</small><strong>{product.code}</strong><span>{product.name}</span><b>{catalogPrice(product)}</b>
        </label>)}</div>
        <nav className="pdf-catalog-line" aria-label="Ürün sayfaları"><button type="button" disabled={loading || query.page <= 1} onClick={() => setQuery(current => ({ ...current, page: current.page - 1 }))}>Önceki</button><span>{query.page} / {result.pages}</span><button type="button" disabled={loading || query.page >= result.pages} onClick={() => setQuery(current => ({ ...current, page: current.page + 1 }))}>Sonraki</button></nav>
      </section>
      <aside className="pdf-catalog-panel pdf-catalog-settings">
        <h2><i>2</i> Kataloğunu düzenle</h2>
        <label>Katalog adı<input maxLength={80} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Alt başlık<input maxLength={100} value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Örn. Sonbahar koleksiyonu" /></label>
        <fieldset><legend>Sayfa düzeni</legend><div className="pdf-layout-options">{CATALOG_LAYOUTS.map(layout => <label className={layoutId === layout.id ? 'active' : ''} key={layout.id}><input type="radio" name="catalog-layout" value={layout.id} checked={layoutId === layout.id} onChange={() => setLayoutId(layout.id)} /><strong>{layout.name}</strong><span aria-hidden="true" className={`pdf-layout-thumbnail ${layout.id === 'list' ? 'is-list' : ''}`} style={{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}>{Array.from({ length: layout.count }, (_, index) => <i key={index} />)}</span><small>{layout.description}</small></label>)}</div></fieldset>
        <label>Sıralama<select value={order} onChange={event => setOrder(event.target.value)}><option value="selection">Seçim sırası</option><option value="code">Ürün kodu</option><option value="brand">Marka ve ürün kodu</option></select></label>
        <label>Bölümlere ayır<select value={grouping} onChange={event => setGrouping(event.target.value)}><option value="none">Tek bölüm</option><option value="brand">Her marka yeni sayfada</option><option value="category">Her kategori yeni sayfada</option></select></label>
        <div className="pdf-options"><label><input type="checkbox" checked={cover} onChange={event => setCover(event.target.checked)} /> Kapak sayfası</label><label><input type="checkbox" checked={showPrices} onChange={event => setShowPrices(event.target.checked)} /> ERP fiyat satırını göster</label><label><input type="checkbox" checked={showImages} onChange={event => setShowImages(event.target.checked)} /> Ürün fotoğraflarını göster</label><label><input type="checkbox" checked={showStock} onChange={event => setShowStock(event.target.checked)} /> Stok miktarını göster</label></div>
        {showImages && !showPrices && <p className="list-state" role="note">ERP fiyat satırı gizli. Fotoğraflara basılmış fiyatlar görünmeye devam eder. Fiyat içermeyen fotoğraflar kullanın veya ürün fotoğraflarını gizleyin.</p>}
        <div className="pdf-catalog-line"><strong>Seçilenler ({selected.length})</strong><button type="button" disabled={!selected.length} onClick={() => setSelected([])}>Temizle</button></div>
        <div className="pdf-selected">{selected.length ? selected.map((product, index) => <div key={product.id}><span><strong>{product.code}</strong><small>{product.name}</small></span><button aria-label={`${product.code} yukarı`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button aria-label={`${product.code} aşağı`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button aria-label={`${product.code} çıkar`} onClick={() => toggle(product)}>×</button></div>) : <p>Soldaki ürünlere dokunarak başlayın. Seçiminiz sayfa ve arama değiştirirken korunur.</p>}</div>
        {selected.length > 0 && <details className="pdf-page-plan"><summary>Sayfa planı · {pages.length + Number(cover)} sayfa</summary><ol>{cover && <li>Kapak</li>}{pages.map((page, index) => <li key={index}><strong>{catalogSection(page[0], grouping) || 'Ürünler'}</strong><span>{page.map(product => product.code).join(' · ')}</span></li>)}</ol></details>}
        <button type="button" className="pdf-primary" disabled={!selected.length || checking} onClick={openPreview}>{checking ? 'Ürünler doğrulanıyor…' : '3 · Kataloğu önizle'}</button>
        <small>PDF hazırlamak için müşteri veya kayıtlı taslak gerekmez. Fiyatlar kendi para birimiyle gösterilir.</small>
      </aside>
    </div>
    {preview && <section className="pdf-catalog-panel pdf-catalog-preview"><div className="pdf-catalog-line"><div><h2>PDF önizleme</h2><small>{selected.length} ürün · {pages.length + Number(cover)} sayfa · A4</small></div><button type="button" className="pdf-primary" disabled={!previewReady || checking} onClick={print}>{checking ? 'Ürünler doğrulanıyor…' : previewReady ? 'PDF kaydet / Yazdır' : 'Görseller hazırlanıyor…'}</button></div>{imageFailures > 0 && <p role="status">{imageFailures} görsel yüklenemedi; bu ürünlerde “Görsel bulunmuyor” yazacak.</p>}{notice && <p role="status">{notice}</p>}<iframe ref={frame} title="Katalog PDF önizleme" srcDoc={preview} onLoad={loaded} /></section>}
  </main>;
}
