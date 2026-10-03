import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { get } from '../../services/apiClient.js';
import { VEGA_HISTORY_SOURCES, createVegaHistoryApi, historyAllowedSources, historyDateTime, historyError, historyField, historyFlag, historyInitialSelection, historyPageRange, historyPartyName, historyRelationAction, historyRelationFor, historyRelationLabel, historyValue, readVegaHistoryResponse } from './vegaHistoryView.js';
import './vega-history.css';

const defaultApi = createVegaHistoryApi(get);
const PAGE_SIZE = 100;
const companyOrDefault = value => VEGA_HISTORY_SOURCES.some(source => source.company === value) ? value : 'F0102';

function useHistoryRequest(api, request) {
  const key = request ? JSON.stringify(request) : '';
  const [state, setState] = useState({ key: '', data: null, loading: false, error: '' });
  useEffect(() => {
    let cancelled = false;
    if (!request) { setState({ key, data: null, loading: false, error: '' }); return undefined; }
    setState({ key, data: null, loading: true, error: '' });
    Promise.resolve().then(() => api[request.method](request.params))
      .then(response => readVegaHistoryResponse(response, { ...request.params, kind: request.kind, partySourceId: request.partySourceId || request.params.partySourceId }))
      .then(data => { if (!cancelled) setState({ key, data, loading: false, error: '' }); })
      .catch(error => { if (!cancelled) setState({ key, data: null, loading: false, error: historyError(error) }); });
    return () => { cancelled = true; };
  }, [api, key]); // The key contains every request/filter and refresh revision.
  // Never paint the preceding company/party/page while its replacement effect starts.
  return state.key === key ? state : { key, data: null, loading: Boolean(request), error: '' };
}

function LoadState({ state, empty, children }) {
  if (state.loading) return <p className="vega-history-state" role="status">Geçmiş kayıtları yükleniyor…</p>;
  if (state.error) return <p className="vega-history-state vega-history-error" role="alert">{state.error}</p>;
  if (!state.data) return <p className="vega-history-state">{empty}</p>;
  return children;
}

function PageControls({ meta, onPage, label }) {
  if (!meta) return null;
  const last = Math.max(1, meta.totalPages);
  return <nav className="vega-history-pagination" aria-label={`${label} sayfaları`}>
    <span>{historyPageRange(meta)}</span>
    <div>
      <button type="button" disabled={meta.page <= 1} onClick={() => onPage(1)} aria-label={`${label}: ilk sayfa`}>İlk</button>
      <button type="button" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label={`${label}: önceki sayfa`}>Önceki</button>
      <span>Sayfa {meta.page} / {last}</span>
      <button type="button" disabled={meta.page >= last} onClick={() => onPage(meta.page + 1)} aria-label={`${label}: sonraki sayfa`}>Sonraki</button>
      <button type="button" disabled={meta.page >= last} onClick={() => onPage(last)} aria-label={`${label}: son sayfa`}>Son</button>
    </div>
  </nav>;
}

function SourceFlags({ record, party = false }) {
  const fields = party ? [['DELETED', 'Silinmiş']] : [['IPTAL', 'İptal'], ['IADE', 'İade']];
  return <span className="vega-history-flags">{fields.map(([field, label]) => {
    const flag = historyFlag(historyField(record, field));
    return <span key={field} className={`vega-history-flag is-${flag}`} title={`${field}: ${historyValue(record?.payload?.[field])}`}>
      {flag === 'yes' ? label : flag === 'no' ? `${label} değil` : `${label} bilgisi yok`}
    </span>;
  })}</span>;
}

function SourceFields({ record, title = 'Özgün kaynak alanları' }) {
  if (!record) return null;
  return <details className="vega-history-source-fields">
    <summary>{title}</summary>
    <dl className="vega-history-identity">
      <div><dt>Kaynak anahtarı</dt><dd>{record.sourceKey}</dd></div>
      <div><dt>Kaynak tablo / kayıt</dt><dd>{historyValue(record.table)} / {historyValue(record.sourceId)}</dd></div>
      <div><dt>İçerik özeti</dt><dd>{historyValue(record.payloadHash)}</dd></div>
    </dl>
    <div className="vega-history-table-scroll"><table><caption>{title} — değerler kaynaktaki biçimleriyle</caption><thead><tr><th>Kaynak alanı</th><th>Değer</th></tr></thead>
      <tbody>{Object.entries(record.payload).map(([field, value]) => <tr key={field}><th scope="row">{field === 'BAKIYE' ? 'Arşivdeki bakiye (BAKIYE)' : field}</th><td className="vega-history-verbatim">{historyValue(value)}</td></tr>)}</tbody>
    </table></div>
  </details>;
}

export function HistoryRelationButton({ relation, onActivate, label }) {
  return relation?.status === 'linked' ? <button type="button" className="vega-history-document-link" onClick={onActivate}>{label}</button>
    : <small>{historyRelationLabel(relation)}</small>;
}

function DocumentDetail({ state, onClose, onPage, relationAction }) {
  const focusRef = useRef(null);
  useEffect(() => { focusRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); focusRef.current?.focus({ preventScroll: true }); }, [state.key]);
  return <section ref={focusRef} tabIndex={-1} className="vega-history-panel vega-history-document" aria-label="Vega belge ayrıntısı">
    <div className="vega-history-panel-heading"><h3>Vega 2026 belge ayrıntısı</h3><button type="button" onClick={onClose}>Ayrıntıyı kapat</button></div>
    <LoadState state={state} empty="Belge ayrıntısı yüklenemedi.">
      {state.data && <>
        <div className="vega-history-document-summary">
          <div><span>Belge no</span><strong>{historyValue(historyField(state.data.data.document, 'BELGENO'))}</strong></div>
          <div><span>Tarih</span><strong>{historyValue(state.data.data.document.date)}</strong></div>
          <div><span>Tutar (kaynak)</span><strong>{historyValue(historyField(state.data.data.document, 'TUTAR'))}</strong></div>
          <div><span>Döviz (kaynak)</span><strong>{historyValue(state.data.data.document.currency)}</strong></div>
          <div><span>Cari kaynak ID</span><strong>{state.data.data.document.partySourceId || 'Cari bağlantısı yok'}</strong>
            {state.data.data.document.partySourceId && <HistoryRelationButton relation={historyRelationFor(state.data, state.data.data.document, 'account')} onActivate={relationAction(historyRelationFor(state.data, state.data.data.document, 'account'))} label="Kaynak cariyi aç" />}
          </div>
        </div>
        <SourceFlags record={state.data.data.document} />
        <SourceFields record={state.data.data.document} title="Belgenin özgün başlık alanları" />
        <h4>Belge satırları</h4>
        {state.data.data.lines.length ? <div className="vega-history-table-scroll"><table>
          <caption>Seçilen Vega belgesinin bu sayfadaki satırları</caption>
          <thead><tr><th>Satır</th><th>Ürün / açıklama</th><th>Miktar</th><th>Birim (kaynak)</th><th>Fiyat (kaynak)</th><th>Tutar (kaynak)</th><th>Döviz</th><th>Ayrıntı</th></tr></thead>
          <tbody>{state.data.data.lines.map(line => <tr key={line.sourceKey}>
            <td>{historyValue(historyField(line, 'SATIRNO') ?? line.sourceId)}</td>
            <td><strong>{historyValue(historyField(line, 'MALINCINSI', 'ACIKLAMA'))}</strong><small>{historyValue(historyField(line, 'STOKKODU'))}</small>
              <HistoryRelationButton relation={historyRelationFor(state.data, line, 'product')} onActivate={relationAction(historyRelationFor(state.data, line, 'product'))} label="Arşiv ürününü aç" />
            </td>
            <td className="vega-history-number">{historyValue(historyField(line, 'MIKTAR'))}</td>
            <td>{historyValue(historyField(line, 'BIRIM'))}</td>
            <td className="vega-history-number">{historyValue(historyField(line, 'FIYATI'))}</td>
            <td className="vega-history-number">{historyValue(historyField(line, 'GERCEKTOPLAM', 'TUTAR'))}</td>
            <td>{historyValue(line.currency)}</td>
            <td><SourceFields record={line} title="Satır alanları" /></td>
          </tr>)}</tbody>
        </table></div> : <p className="vega-history-state">Bu belge için arşivde satır bulunamadı. Bu durum tutarın sıfır olduğu anlamına gelmez.</p>}
        <PageControls meta={state.data.meta} onPage={onPage} label="Belge satırları" />
      </>}
    </LoadState>
  </section>;
}

function ArchiveProductDetail({ record, onClose }) {
  const focusRef = useRef(null);
  useEffect(() => { focusRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); focusRef.current?.focus({ preventScroll: true }); }, [record.sourceKey]);
  return <section ref={focusRef} tabIndex={-1} className="vega-history-panel vega-history-document" aria-label="Vega arşiv ürünü">
    <div className="vega-history-panel-heading"><h3>Arşiv ürünü · {historyValue(historyField(record, 'STOKKODU'))}</h3><button type="button" onClick={onClose}>Ürünü kapat</button></div>
    <p><strong>{historyValue(historyField(record, 'MALINCINSI'))}</strong></p>
    <p>Bu kart {record.company} / {record.period} kaynak arşivine aittir. Miktarlar pakette kaydedilen değerlerdir.</p>
    <SourceFields record={record} title="Ürünün özgün kaynak alanları" />
  </section>;
}

export function VegaHistoryScreen({ api = defaultApi, permissions = [], initialCompany, initialPartySourceId }) {
  const fieldId = useId();
  const allowedSources = historyAllowedSources(permissions);
  const permissionKey = [...(Array.isArray(permissions) ? permissions : [])].sort().join('|');
  const [company, setCompany] = useState(() => historyInitialSelection(permissions, initialCompany, initialPartySourceId).company);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [partyPage, setPartyPage] = useState(1);
  const [partySourceId, setPartySourceId] = useState(() => historyInitialSelection(permissions, initialCompany, initialPartySourceId).partySourceId);
  const [chosenParty, setChosenParty] = useState(null);
  const [view, setView] = useState('documents');
  const [documentSearchInput, setDocumentSearchInput] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentPage, setDocumentPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerFamily, setLedgerFamily] = useState('CARIHAREKETLERI');
  const [documentKey, setDocumentKey] = useState('');
  const [linePage, setLinePage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [productSelection, setProductSelection] = useState(null);
  const contextKey = JSON.stringify([company, partySourceId, view, documentKey, linePage, ledgerPage, ledgerFamily, documentPage, revision, permissionKey]);
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;

  function clearParty(id = '', record = null) {
    setPartySourceId(id); setChosenParty(record); setView('documents'); setDocumentPage(1); setLedgerPage(1); setLedgerFamily('CARIHAREKETLERI');
    setDocumentKey(''); setLinePage(1); setProductSelection(null); setDocumentSearch(''); setDocumentSearchInput('');
  }
  function selectCompany(next, id = '') {
    setCompany(companyOrDefault(next)); setSearch(''); setSearchInput(''); setPartyPage(1); clearParty(id);
  }
  useEffect(() => {
    const next = historyInitialSelection(permissions, initialCompany, initialPartySourceId);
    setCompany(next.company); setSearch(''); setSearchInput(''); setPartyPage(1); clearParty(next.partySourceId);
  }, [initialCompany, initialPartySourceId, permissionKey]);
  const permitted = allowedSources.some(source => source.company === company);

  const partyRequest = useMemo(() => permitted ? { method: 'parties', kind: 'account', params: { company, search, page: partyPage, limit: PAGE_SIZE }, revision } : null, [permitted, company, search, partyPage, revision]);
  const documentRequest = useMemo(() => permitted && view === 'documents' ? { method: 'documents', kind: 'document', params: { company, partySourceId, search: documentSearch, page: documentPage, limit: PAGE_SIZE }, revision } : null, [permitted, company, partySourceId, view, documentSearch, documentPage, revision]);
  const ledgerRequest = useMemo(() => permitted && partySourceId && view === 'ledger' ? { method: 'ledger', kind: 'account_movement', params: { company, partySourceId, family: ledgerFamily, page: ledgerPage, limit: PAGE_SIZE }, revision } : null, [permitted, company, partySourceId, view, ledgerFamily, ledgerPage, revision]);
  const detailRequest = useMemo(() => permitted && documentKey ? { method: 'detail', kind: 'line', partySourceId, params: { company, sourceKey: documentKey, page: linePage, limit: PAGE_SIZE }, revision } : null, [permitted, company, partySourceId, documentKey, linePage, revision]);
  const parties = useHistoryRequest(api, partyRequest);
  const documents = useHistoryRequest(api, documentRequest);
  const ledger = useHistoryRequest(api, ledgerRequest);
  const detail = useHistoryRequest(api, detailRequest);
  const selectedParty = parties.data?.data.find(row => row.sourceId === partySourceId) || chosenParty;
  const selectedSource = VEGA_HISTORY_SOURCES.find(source => source.company === company);
  const packetSource = (view === 'ledger' ? ledger.data?.source : documents.data?.source) || parties.data?.source;
  const importedAt = historyDateTime(packetSource?.importedAt);
  const capturedAt = historyDateTime(packetSource?.captureCompletedAt);

  function chooseParty(record) { clearParty(record.sourceId, record); }
  function openDocument(record) { setDocumentKey(record.sourceKey); setLinePage(1); setProductSelection(null); }
  function relationAction(relation) {
    return historyRelationAction(relation, contextKey, () => contextRef.current, target => {
      if (target.kind === 'document') openDocument(target);
      else if (target.kind === 'account') chooseParty(target);
      else if (target.kind === 'product') setProductSelection({ contextKey, record: target });
    });
  }

  if (!permitted) return <main className="work-area vega-history-screen"><section className="vega-history-panel"><span className="vega-history-source-badge">VEGA 2026 · GEÇMİŞ</span><h2>2026 Cari ve Belge Geçmişi</h2><p className="vega-history-state" role={allowedSources.length ? 'status' : 'alert'}>{allowedSources.length ? 'Yetkili Vega kaynağı seçiliyor…' : 'Vega 2026 geçmişi için yetkiniz yok. İlgili şirketin cari, belge, finans ve ana sayfa görüntüleme izinleri birlikte gereklidir.'}</p></section></main>;

  return <main className="work-area vega-history-screen">
    <header className="vega-history-header">
      <div><span className="vega-history-source-badge">VEGA 2026 · GEÇMİŞ</span><h2>2026 Cari ve Belge Geçmişi</h2>
        <p>Geçmiş kayıtları Melisa stok, cari veya kasasında yeni hareket oluşturmaz.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)}>Listeleri yenile</button>
    </header>
    <div className="vega-history-toolbar">
      <label>Vega kaynağı<select value={company} onChange={event => selectCompany(event.target.value)}>{allowedSources.map(source => <option key={source.company} value={source.company}>{source.label} ({source.company})</option>)}</select></label>
      <p><strong>{selectedSource.label} · {company} / D0007</strong><span>Belge ve hareket dönemi: 01.01.2026–31.12.2026</span><span>{importedAt ? `Son aktarılan paket: ${importedAt} (Türkiye)` : 'Aktarım zamanı bilinmiyor'}{capturedAt ? ` · Kaynak okuma: ${capturedAt}` : ''}</span></p>
    </div>
    <div className="vega-history-layout">
      <aside className="vega-history-panel vega-history-parties" aria-label="Vega carileri">
        <h3>Kaynak cariler</h3>
        <button type="button" className="vega-history-all-documents" aria-pressed={!partySourceId} onClick={() => clearParty()}>Tüm belgeler</button>
        <form className="vega-history-search" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPartyPage(1); clearParty(); }}>
          <label className="vega-history-sr-only" htmlFor={`${fieldId}-party-search`}>Cari adı veya kodu</label>
          <input id={`${fieldId}-party-search`} maxLength={200} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Cari adı veya kodu" />
          <button type="submit">Ara</button>
        </form>
        <LoadState state={parties} empty="Kaynak cariler yükleniyor.">
          {parties.data?.data.length ? <ul className="vega-history-party-list">{parties.data.data.map(record => <li key={record.sourceKey}>
            <button type="button" className={partySourceId === record.sourceId ? 'is-selected' : ''} aria-pressed={partySourceId === record.sourceId} onClick={() => chooseParty(record)}>
              <strong>{historyPartyName(record)}</strong><span>{historyValue(historyField(record, 'FIRMAKODU'))} · Vega #{record.sourceId}</span>
              <span>Döviz: {historyValue(record.currency)} · Durum (kaynak): {historyValue(historyField(record, 'STATUS'))}</span><SourceFlags record={record} party />
            </button>
          </li>)}</ul> : <p className="vega-history-state">Bu kaynak ve arama için arşivde cari bulunamadı.</p>}
          <PageControls meta={parties.data?.meta} onPage={setPartyPage} label="Cariler" />
        </LoadState>
      </aside>
      <div className="vega-history-content">
        <>
          <section className="vega-history-panel">
            <div className="vega-history-panel-heading"><div><span className="vega-history-eyebrow">{selectedSource.label}{partySourceId ? ` · Vega cari #${partySourceId}` : ` · ${company}`}</span><h3>{partySourceId ? (selectedParty ? historyPartyName(selectedParty) : `Vega cari #${partySourceId}`) : 'Tüm 2026 belgeleri'}</h3></div><span className="vega-history-source-badge">Geçmiş kayıt</span></div>
            {selectedParty && <SourceFields record={selectedParty} title="Carinin özgün kaynak alanları" />}
            <p className="vega-history-caption">{partySourceId ? 'Arşivdeki bakiye, aktarılan paketin özgün alanıdır; bugünkü Melisa bakiyesi veya burada hesaplanmış dönem sonu değildir.' : 'Cari bağlantısı olmayan devir ve sayım belgeleri de bu listede yer alır. Ekstre için bir cari seçin.'}</p>
            <div className="vega-history-tabs" role="tablist" aria-label="Cari geçmişi">
              <button type="button" role="tab" aria-selected={view === 'documents'} onClick={() => setView('documents')}>2026 Belgeleri</button>
              <button type="button" role="tab" aria-selected={view === 'ledger'} disabled={!partySourceId} title={!partySourceId ? 'Ekstre için cari seçin.' : undefined} onClick={() => { setView('ledger'); setDocumentKey(''); }}>2026 Ekstresi</button>
            </div>
            {view === 'documents' ? <div role="tabpanel" aria-label="2026 Belgeleri">
              <form className="vega-history-search vega-history-document-search" onSubmit={event => { event.preventDefault(); setDocumentSearch(documentSearchInput.trim()); setDocumentPage(1); setDocumentKey(''); }}>
                <label className="vega-history-sr-only" htmlFor={`${fieldId}-document-search`}>Belge içinde ara</label><input id={`${fieldId}-document-search`} maxLength={200} value={documentSearchInput} onChange={event => setDocumentSearchInput(event.target.value)} placeholder="Belge no veya kaynak alanında ara" /><button type="submit">Ara</button>
              </form>
              <LoadState state={documents} empty="Belge listesi yükleniyor.">
                {documents.data?.data.length ? <div className="vega-history-table-scroll"><table><caption>{partySourceId ? 'Seçilen carinin Vega 2026 belgeleri' : 'Seçilen şirketin tüm Vega 2026 belgeleri'}</caption>
                  <thead><tr><th>Belge no</th><th>Tarih</th><th>Belge türü (kaynak)</th><th>Cari kaynak ID</th><th>Durum</th><th>Tutar (kaynak)</th><th>Döviz</th><th>Kaynak ID</th></tr></thead>
                  <tbody>{documents.data.data.map(record => <tr key={record.sourceKey} className={documentKey === record.sourceKey ? 'is-selected' : ''}>
                    <td><button type="button" className="vega-history-document-link" onClick={() => openDocument(record)}>{historyValue(historyField(record, 'BELGENO')) === 'Bilinmiyor' ? `Belge #${record.sourceId}` : historyValue(historyField(record, 'BELGENO'))}</button></td>
                    <td>{historyValue(record.date)}</td><td>{historyValue(record.documentFamily)}</td><td>{record.partySourceId || 'Cari bağlantısı yok'}</td><td><SourceFlags record={record} /></td><td className="vega-history-number">{historyValue(historyField(record, 'TUTAR'))}</td><td>{historyValue(record.currency)}</td><td>{record.sourceId}</td>
                  </tr>)}</tbody>
                </table></div> : <p className="vega-history-state">{partySourceId ? 'Bu cariye bağlı 2026 belgesi bulunamadı.' : 'Seçilen kaynak ve arama için 2026 belgesi bulunamadı.'} Eksik veya henüz aktarılmamış geçmiş için sıfır tutar varsayılmaz.</p>}
                <PageControls meta={documents.data?.meta} onPage={page => { setDocumentPage(page); setDocumentKey(''); }} label="Belgeler" />
              </LoadState>
            </div> : <div role="tabpanel" aria-label="2026 Ekstresi">
              <label className="vega-history-ledger-source">Ekstre kaynağı<select value={ledgerFamily} onChange={event => { setLedgerFamily(event.target.value); setLedgerPage(1); }}><option value="CARIHAREKETLERI">Cari hareketler</option><option value="CARIGENELHAREKET">Genel hareket kayıtları</option><option value="KASA">Kasa kayıtları</option></select></label>
              <p className="vega-history-caption">Kaynak görünümleri ayrı tutulur, birlikte toplanmaz. Tutarlar özgün döviz ve ondalık değerleriyle gösterilir; bu sayfadan dönem toplamı hesaplanmaz.</p>
              <LoadState state={ledger} empty="Ekstre yükleniyor.">
                {ledger.data?.data.length ? <div className="vega-history-table-scroll"><table><caption>Seçilen carinin Vega 2026 kaynak hareketleri</caption>
                  <thead><tr><th>Tarih / belge</th><th>Açıklama (kaynak)</th><th>{ledgerFamily === 'KASA' ? 'Gelir (kaynak)' : 'Borç'}</th><th>{ledgerFamily === 'KASA' ? 'Gider (kaynak)' : 'Alacak'}</th><th>Arşivdeki bakiye</th><th>Döviz</th><th>Durum / ayrıntı</th></tr></thead>
                  <tbody>{ledger.data.data.map(record => <tr key={record.sourceKey}>
                    <td>{historyValue(record.date)}<small>{historyValue(historyField(record, 'BELGENO', 'EVRAKNO', 'BELGEIND', 'BELGELINK'))}</small>
                      <HistoryRelationButton relation={historyRelationFor(ledger.data, record, 'document')} onActivate={relationAction(historyRelationFor(ledger.data, record, 'document'))} label="Belgeyi aç" />
                    </td><td>{historyValue(historyField(record, 'ACIKLAMA', 'IZAHAT', 'BELGEIZAHAT', 'ISLEMIZAHAT'))}</td>
                    <td className="vega-history-number">{historyValue(historyField(record, ledgerFamily === 'KASA' ? 'GELIR' : 'BORC'))}</td><td className="vega-history-number">{historyValue(historyField(record, ledgerFamily === 'KASA' ? 'GIDER' : 'ALACAK'))}</td><td className="vega-history-number">{historyValue(historyField(record, 'BAKIYE'))}</td><td>{historyValue(record.currency)}</td>
                    <td><SourceFlags record={record} /><SourceFields record={record} title="Hareket alanları" /></td>
                  </tr>)}</tbody>
                </table></div> : <p className="vega-history-state">Bu cariye bağlı 2026 cari hareketi bulunamadı. Arşivdeki bakiye sıfır olarak kabul edilmez.</p>}
                <PageControls meta={ledger.data?.meta} onPage={setLedgerPage} label="Ekstre" />
              </LoadState>
            </div>}
          </section>
          {documentKey && <DocumentDetail state={detail} onClose={() => { setDocumentKey(''); setProductSelection(null); }} onPage={setLinePage} relationAction={relationAction} />}
          {productSelection?.contextKey === contextKey && <ArchiveProductDetail record={productSelection.record} onClose={() => setProductSelection(null)} />}
        </>
      </div>
    </div>
  </main>;
}
