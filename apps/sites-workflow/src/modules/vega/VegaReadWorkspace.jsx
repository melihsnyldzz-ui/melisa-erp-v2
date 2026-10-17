import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, ArrowRight, ArrowLeft, Boxes, Users, ShieldCheck, WifiOff } from 'lucide-react';
import { fetchVegaBridgeProducts, fetchVegaBridgeProduct, fetchVegaBridgeAccounts, fetchVegaBridgeAccount, fetchVegaBridgeHealth } from '../../services/vegaBridgeApi.js';
import { canOpenVegaScreen, display, quantity, currency, priceRows } from './vegaReadModel.js';
import { WorkspaceHeading } from '../demo/WorkspaceChrome.jsx';
import './vega-read.css';

function readTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'Doğrulanmadı';
}
function ErrorState({ error, retry }) {
  return <div className="vega-error" role="alert"><WifiOff size={20} /><div><strong>Veri okunamadı</strong><p>{error?.status === 403 ? 'Bu kayıtları görüntüleme yetkiniz veya bağlantı izni yok.' : error?.message || 'Bağlantıyı kontrol edin.'}</p><small>{error?.code}</small></div>{retry && <button type="button" onClick={retry}>Tekrar dene</button>}</div>;
}
function Source({ meta }) {
  if (!meta) return null;
  return <div className="vega-source"><ShieldCheck size={15} /><span>{meta.source?.database} · Firma {meta.source?.company} · Dönem {meta.source?.period}</span><span>Okuma: {readTime(meta.readAt)} (İstanbul)</span></div>;
}
function Fields({ entries }) {
  return <dl className="vega-fields">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>;
}
function DataTable({ columns, rows, empty }) {
  if (!rows.length) return <p className="vega-muted">{empty}</p>;
  return <div className="vega-table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(([key, , format]) => <td key={key}>{format ? format(row[key], row) : display(row[key])}</td>)}</tr>)}</tbody></table></div>;
}
function ProductDetail({ response }) {
  const { product, stock, units, prices } = response.data;
  const times = response.meta.componentReadAt;
  return <div className="vega-product-content">
    <Fields entries={[["Stok kodu", product.stockCode], ["Marka", product.brand], ["Kategori", product.category]]} />
    <section className="vega-product-section" aria-label="Stok miktarı">
      <h3>Stok miktarı</h3>
      {stock.length ? <div className="vega-stock-summary">{stock.map((row, index) => <div key={index} className={String(row.erp_quantity).startsWith('-') ? 'negative' : ''}><strong>{quantity(row.erp_quantity)}</strong><span>{display(row.source_unit)}</span></div>)}</div> : <p className="vega-muted">Stok bilgisi gelmedi.</p>}
    </section>
    <section className="vega-product-section" aria-label="Birimler ve barkodlar">
      <h3>Birimler ve barkodlar</h3>
      <DataTable columns={[["BIRIMADI", "Birim"], ["BARCODE", "Barkod"], ["ANABIRIM", "Ana birim", value => value === true ? 'Evet' : value === false ? 'Hayır' : display(value)]]} rows={units} empty="Birim veya barkod bilgisi gelmedi." />
    </section>
    <section className="vega-product-section" aria-label="Kayıtlı fiyatlar">
      <h3>Kayıtlı fiyatlar</h3>
      <DataTable columns={[["unit", "Birim / barkod", (value, row) => <><strong>{display(value)}</strong>{row.barcode && <small className="vega-cell-secondary">{row.barcode}</small>}</>], ["label", "Fiyat türü"], ["amount", "Tutar", quantity], ["currency", "Döviz", currency]]} rows={priceRows(prices)} empty="Fiyat bilgisi gelmedi." />
      <p className="vega-muted">Fiyatlar birimi ve döviziyle gösterilir.</p>
    </section>
    <details className="vega-source-info"><summary>Kaynak ve güncellik</summary>
      <Source meta={response.meta} />
      <Fields entries={[["Vega kayıt no", product.identity.sourceId]]} />
      <DataTable columns={[["erp_quantity", "Kaynak miktarı", quantity], ["source_unit", "Kaynak birimi"], ["quantity_basis", "Hesap kaynağı", value => value === 'stock_card_fallback' ? 'Stok kartı kaydı' : display(value)]]} rows={stock} empty="Stok bilgisi bulunmuyor; sıfır kabul edilmedi." />
      <DataTable columns={[["BIRIMADI", "Birim"], ["CARPAN", "Kaynak çarpanı", quantity]]} rows={units} empty="Birim bilgisi bulunmuyor." />
      <p className="vega-muted">Birimler birbirine çevrilmez. Kayıtlı fiyatlar onaylı teklif değildir. Sayısal döviz kodlarına para birimi atanmaz.</p>
      {times && <Fields entries={[["Kart", readTime(times.card)], ["Stok", (times.stock || []).map(readTime).join(', ')], ["Birim", (times.units || []).map(readTime).join(', ')], ["Fiyat", (times.prices || []).map(readTime).join(', ')]]} />}
    </details>
  </div>;
}
function RecordDetail({ id, account = false, onClose }) {
  const detailRef = useRef(null);
  const [result, setResult] = useState({ loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setResult({ loading: true });
    const request = account ? fetchVegaBridgeAccount : fetchVegaBridgeProduct;
    request(id, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setResult({ response, loading: false });
    }).catch(error => { if (!controller.signal.aborted) setResult({ error, loading: false }); });
    return () => controller.abort();
  }, [id, account, revision]);
  const row = account ? result.response?.data : result.response?.data.product;
  return <section ref={detailRef} className="vega-card vega-detail" tabIndex={-1} aria-label={account ? 'Cari detayı' : 'Ürün detayı'} aria-busy={result.loading}>
    <div className="vega-card-heading"><div><span className="vega-eyebrow">{account ? 'Cari kartı' : 'Ürün kartı'}</span><h2>{row?.name || 'Kayıt detayı'}</h2></div>{onClose && <button type="button" onClick={onClose} aria-label="Listeye dön"><ArrowLeft size={15} />Listeye dön</button>}</div>
    {result.loading && <p role="status">{account ? 'Cari okunuyor…' : 'Stok, birim ve fiyat kayıtları okunuyor…'}</p>}
    {result.error && <ErrorState error={result.error} retry={() => setRevision(value => value + 1)} />}
    {result.response && <>
      {account && <Source meta={result.response.meta} />}
      {account ? <><Fields entries={[["Cari kodu", row.accountCode], ["Grup", row.groupCode], ["Döviz", currency(row.currency)], ["Vega durum kodu", row.status], ["Vega kayıt no", row.identity.sourceId]]} /><p className="vega-note">Bu bağlantı cari kartını gösterir. Bakiye, tahsilat ve hareket geçmişi henüz bağlı değil.</p></> : <ProductDetail response={result.response} />}
      <button type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />Detayı yenile</button>
    </>}
  </section>;
}
function RecordList({ account = false, embedded = false }) {
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const [mode, setMode] = useState('search');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState({ mode: 'list', query: '', cursor: undefined, page: 1, history: [] });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, rows: [] });
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, rows: [] });
    setSelected(null);
    const request = account ? fetchVegaBridgeAccounts : fetchVegaBridgeProducts;
    request(query, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState({ ...result, loading: false });
    }).catch(error => { if (!controller.signal.aborted) setState({ rows: [], loading: false, error }); });
    return () => controller.abort();
  }, [account, query, revision]);
  const visibleRows = useMemo(() => account && input.trim()
    ? state.rows.filter(row => `${row.accountCode || ''} ${row.name || ''}`.toLocaleLowerCase('tr-TR').includes(input.trim().toLocaleLowerCase('tr-TR')))
    : state.rows, [account, input, state.rows]);
  useEffect(() => {
    if (selected && !visibleRows.some(row => row.sourceId === selected)) setSelected(null);
  }, [selected, visibleRows]);
  function closeDetail() {
    setSelected(null);
    triggerRef.current?.focus({ preventScroll: true });
    triggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function openDetail(row, event) {
    triggerRef.current = event.currentTarget;
    setSelected(row.sourceId);
    if (selected === row.sourceId) listRef.current?.parentElement?.querySelector('.vega-detail')?.focus({ preventScroll: true });
  }
  function search(event) {
    event.preventDefault();
    const term = input.trim();
    setQuery({ mode: term ? mode : 'list', query: term, page: 1, history: [], cursor: undefined });
  }
  function next() {
    const cursor = state.meta?.pagination?.nextCursor;
    if (!cursor || cursor === query.cursor || query.history.includes(cursor)) return;
    setQuery(current => ({ ...current, cursor, page: current.page + 1, history: [...current.history, current.cursor] }));
  }
  function previous() {
    setQuery(current => ({ ...current, cursor: current.history.at(-1), page: current.page - 1, history: current.history.slice(0, -1) }));
  }
  const nextAvailable = (!account && query.mode !== 'list') ? false : state.meta?.pagination?.hasMore && Boolean(state.meta.pagination.nextCursor) && state.meta.pagination.nextCursor !== query.cursor && !query.history.includes(state.meta.pagination.nextCursor);
  const refreshAction = <button type="button" disabled={state.loading} onClick={() => { setSelected(null); setRevision(value => value + 1); }}><RefreshCw size={16} />Yenile</button>;
  return <main className={`vega-workspace${embedded ? ' work-area connected-operations vega-integrated' : ''}`}>
    {embedded ? <WorkspaceHeading screen="stock-list" title="Ürün & Stok" actions={refreshAction} /> : <header className="vega-heading"><div><span className="vega-eyebrow">Vega · Salt okunur</span><h1>{account ? 'Cari Kartları' : 'Ürün & Stok'}</h1><p>{account ? 'Vega cari kartları; müşteri ve tedarikçi ayrımı bu bağlantıda sunulmuyor.' : 'Ürünü bulun; stok, birim, barkod ve fiyat kayıtlarını inceleyin.'}</p></div>{refreshAction}</header>}
    <div className={`vega-record-layout${selected ? ' has-selection' : ''}`}><section ref={listRef} className={`vega-card vega-record-list${embedded ? ' erp-panel' : ''}`}>
      <form className="vega-search" onSubmit={account ? event => event.preventDefault() : search}>
        {!account && <label><span>Arama türü</span><select value={mode} onChange={event => setMode(event.target.value)}><option value="search">Stok kodu / ürün adı</option><option value="barcode">Tam barkod</option></select></label>}
        <label className="vega-search-input"><span>{account ? 'Bu sayfada cari ara' : mode === 'barcode' ? 'Barkod' : 'Ürün arama'}</span><input maxLength={120} value={input} onChange={event => setInput(event.target.value)} placeholder={account ? 'Cari kodu veya adı' : mode === 'barcode' ? 'Barkodu okutun veya yazın' : 'Stok kodu veya ürün adı'} /></label>
        {!account && <><button type="submit" disabled={state.loading}><Search size={16} />Ara</button><button type="button" disabled={state.loading} onClick={() => { setInput(''); setQuery({ mode: 'list', query: '', cursor: undefined, page: 1, history: [] }); }}>Temizle</button></>}
      </form>
      <p className="vega-muted">{account ? 'Arama yalnızca açık sayfadaki kartları süzer. Diğer kartlar için sonraki sayfayı açın.' : query.mode === 'list' ? 'Aktif ürünler · Sayfada en çok 50 kayıt. Stok ve fiyat için ürünü seçin.' : 'Arama en çok 50 eşleşme gösterir; daha fazla sonuç için aramanızı daraltın. Pasif kartlar da bulunabilir.'}</p>
      {embedded ? <details className="vega-source-info"><summary>Kaynak ve güncellik</summary><Source meta={state.meta} /></details> : <Source meta={state.meta} />}
      {state.loading && <p role="status">{account ? 'Cari kartları okunuyor…' : 'Ürün kartları okunuyor…'}</p>}
      {state.error && <ErrorState error={state.error} retry={() => setRevision(value => value + 1)} />}
      {!state.loading && !state.error && <>
        {state.unmatched > 0 && <p className="vega-note">{state.unmatched} barkod satırının ürün kartı eşleştirilemedi.</p>}
        {!visibleRows.length ? <p className="vega-empty">{account && input.trim() ? 'Bu sayfada aramanızla eşleşen cari yok.' : 'Bu sorgu için kayıt bulunamadı.'}</p> : <div className="vega-table-scroll vega-product-list-table"><table><thead><tr><th>{account ? 'Cari kodu' : 'Stok kodu'}</th><th>{account ? 'Cari adı' : 'Ürün adı'}</th><th>{account ? 'Grup' : 'Marka'}</th><th>{account ? 'Döviz' : 'Kategori'}</th><th>Detay</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.sourceId} className={selected === row.sourceId ? 'selected' : ''}><td>{display(account ? row.accountCode : row.stockCode)}{row.matchedUnits?.map((unit, index) => <small className="vega-cell-secondary" key={index}>{display(unit.BIRIMADI)} · {display(unit.BARCODE)}</small>)}</td><td><button type="button" className="vega-product-name" onClick={event => openDetail(row, event)}>{display(row.name)}</button></td><td>{display(account ? row.groupCode : row.brand)}</td><td>{account ? currency(row.currency) : display(row.category)}</td><td><button type="button" aria-label={`${row.name || row.sourceId} detayını aç`} onClick={event => openDetail(row, event)}>İncele<ArrowRight size={15} /></button></td></tr>)}</tbody></table></div>}
        <div className="vega-pagination"><span>Sayfa {query.page} · {visibleRows.length} kayıt{account && input.trim() ? ` / sayfadaki ${state.rows.length}` : ''}</span><div><button type="button" disabled={query.page <= 1} onClick={previous}><ArrowLeft size={15} />Önceki</button><button type="button" disabled={!nextAvailable} onClick={next}>Sonraki<ArrowRight size={15} /></button></div></div>
      </>}
    </section>
    {selected && <RecordDetail key={`${account}:${selected}`} id={selected} account={account} onClose={closeDetail} />}
    </div>
  </main>;
}
function Overview({ permissions, onOpenScreen }) {
  const [health, setHealth] = useState({ loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setHealth({ loading: true });
    fetchVegaBridgeHealth({ signal: controller.signal }).then(response => { if (!controller.signal.aborted) setHealth({ response }); }).catch(error => { if (!controller.signal.aborted) setHealth({ error }); });
    return () => controller.abort();
  }, [revision]);
  const data = health.response?.data;
  const healthy = data?.readOnly === true && data?.erpAuthReachable === true && data?.vegaMcpReachable === true;
  return <main className="vega-workspace"><header className="vega-heading"><div><span className="vega-eyebrow">Melisa ERP</span><h1>Vega çalışma alanı</h1><p>Mevcut ürün, stok ve cari kartlarını kaynağından inceleyin.</p></div></header><div className="vega-overview-grid">
    <section className="vega-card"><Boxes size={25} /><h2>Ürün & Stok</h2><p>Stok kodu veya barkodla arama, ürün kartı, kayıtlı miktar ve fiyatlar.</p><button type="button" disabled={!permissions.includes('product.view')} onClick={() => onOpenScreen('stock-list')}>Ürünleri aç<ArrowRight size={16} /></button>{!permissions.includes('product.view') && <p className="vega-muted">Ürün görüntüleme yetkiniz yok.</p>}</section>
    <section className="vega-card"><Users size={25} /><h2>Cari Kartları</h2><p>Cari kodu, adı, grup ve kayıtlı döviz bilgisi.</p><button type="button" disabled={!permissions.includes('customer.view')} onClick={() => onOpenScreen('customer-list')}>Carileri aç<ArrowRight size={16} /></button>{!permissions.includes('customer.view') && <p className="vega-muted">Cari görüntüleme yetkiniz yok.</p>}</section>
  </div><section className="vega-card"><div className="vega-card-heading"><h2>Bağlantı durumu</h2><button type="button" disabled={health.loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Kontrol et</button></div>{health.loading ? <p role="status">Vega bağlantısı kontrol ediliyor…</p> : health.error ? <ErrorState error={health.error} /> : <><p className="vega-note">{healthy ? 'ERP giriş servisi ve Vega okuma servisi erişilebilir.' : 'Bağlantının tüm bileşenleri doğrulanamadı.'}</p><p className="vega-muted">Son kontrol: {readTime(health.response?.meta?.checkedAt)} (İstanbul). Kullanıcı yetkileri her veri isteğinde ayrıca kontrol edilir.</p></>}<p className="vega-muted">Şirket bilgisayarı açık ve Windows kullanıcı oturumu etkin olmalı. Uyku veya oturum kapanması bağlantıyı kesebilir.</p></section><section className="vega-card"><h2>Bu aşamanın kapsamı</h2><p>Vega kayıtları salt okunur gösterilir. Satış/alış belgeleri, cari bakiye ve hareketler, kasa ve raporlar henüz bu bağlantıya eklenmedi.</p></section></main>;
}
export function VegaReadWorkspace({ screenId, payload, permissions, onOpenScreen, embedded = false }) {
  if (!canOpenVegaScreen(screenId, permissions)) return <main className="vega-workspace"><section className="vega-card"><h1>Ekran kullanıma açık değil</h1><p>Bu ekran için bağlantı kapsamı veya kullanıcı yetkisi bulunmuyor.</p></section></main>;
  if (screenId === 'dashboard') return <Overview permissions={permissions} onOpenScreen={onOpenScreen} />;
  if (screenId === 'customer-list') return <RecordList key="accounts" account />;
  if (screenId === 'product-card' && payload?.vegaSourceId) return <main className="vega-workspace"><RecordDetail id={payload.vegaSourceId} /></main>;
  return <RecordList key="products" embedded={embedded} />;
}
