import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Calculator,
  ListFilter,
  LockKeyhole,
  RefreshCw,
  Save,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  closeCashRegister,
  createCashExpense,
  createCashTransfer,
  fetchCashRegister,
  openCashRegister,
} from '../../services/financeApi.js';
import { businessDateInIstanbul } from './cashRegisterDate.js';
import { resolveCashRegisterCapabilities } from './cashRegisterPermissions.js';
import { formatCashMoney, sumCashAmounts, cashUnits } from './cashReadMoney.js';

const CURRENCIES = ['TRY', 'USD', 'EUR'];

const MOVEMENT_FILTERS = [
  { id: 'all', label: 'Tümü', icon: ListFilter },
  { id: 'income', label: 'Girişler', icon: TrendingUp },
  { id: 'expense', label: 'Çıkışlar', icon: TrendingDown },
  { id: 'transfer', label: 'Transferler', icon: ArrowLeftRight },
];

function movementGroup(row) {
  if (row.sourceType === 'cash_transfer') return 'transfer';
  return row.direction === 'in' ? 'income' : 'expense';
}

function formatMoney(value, currency) {
  return formatCashMoney(value, currency);
}

function currencySummary(overview, currency) {
  const currencyState = overview.currencies?.find((row) => row.currency === currency);
  if (!currencyState) return { incoming: null, outgoing: null };
  const movements = (overview.movements || []).filter((row) => row.currency === currency);
  const total = direction => sumCashAmounts(movements.filter(row => row.direction === direction).map(row => row.amount));
  const incoming = total('in');
  const outgoing = total('out');
  return { ...currencyState, incoming, outgoing };
}

function CurrencyPicker({ value, onChange }) {
  return (
    <div className="cash-field-group">
      <span>Para birimi</span>
      <div className="cash-currency-buttons" role="group" aria-label="Para birimi">
        {CURRENCIES.map((currency) => (
          <button
            key={currency}
            type="button"
            aria-pressed={value === currency}
            className={value === currency ? 'active' : ''}
            onClick={() => onChange(currency)}
          >
            {currency}
          </button>
        ))}
      </div>
    </div>
  );
}

const defaultCashApi={closeCashRegister,createCashExpense,createCashTransfer,fetchCashRegister,openCashRegister};
export function CashRegisterScreen({ onDirtyChange, permissions = [], api=defaultCashApi, initialDate, fixedDate=false }) {
  const [businessDate, setBusinessDate] = useState(()=>initialDate??businessDateInIstanbul());
  const requestSequence = useRef(0);
  const [loadedDate, setLoadedDate] = useState(null);
  const [overview, setOverview] = useState({ drawers: [], categories: [], session: null, currencies: [], movements: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [openCounts, setOpenCounts] = useState(() => Object.fromEntries(CURRENCIES.map((currency) => [currency, { physicalOpening: '', openingTransfer: '' }])));
  const [openingNote, setOpeningNote] = useState('');
  const [expense, setExpense] = useState({ currency: 'TRY', amount: '', categoryId: '', description: '', documentNo: '' });
  const [transfer, setTransfer] = useState({ currency: 'TRY', amount: '', direction: 'main_to_drawer', description: '' });
  const [closeCounts, setCloseCounts] = useState(() => Object.fromEntries(CURRENCIES.map((currency) => [currency, { physicalClosing: '', carryForward: '' }])));
  const [closingNote, setClosingNote] = useState('');
  const [activeAction, setActiveAction] = useState('expense');
  const [movementFilter, setMovementFilter] = useState('all');
  const {
    canOpenOrClose,
    canRecordExpenseOrTransfer,
    isReadOnly,
  } = resolveCashRegisterCapabilities(overview.capabilities?permissions.filter(p=>p!=='finance.collection'&&p!=='finance.payment'||p==='finance.collection'&&overview.capabilities.canOpenOrClose===true||p==='finance.payment'&&overview.capabilities.canRecordExpenseOrTransfer===true):permissions);
  const selectedAction = canRecordExpenseOrTransfer ? activeAction : canOpenOrClose ? 'close' : null;

  async function load(nextDate = businessDate) {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await api.fetchCashRegister({ businessDate: nextDate });
      if (sequence !== requestSequence.current) return;
      if (!response?.data || !Array.isArray(response.data.drawers) || !Array.isArray(response.data.currencies)
        || !Array.isArray(response.data.movements) || !Array.isArray(response.data.categories)) {
        throw Object.assign(new Error('Günlük kasa yanıtı doğrulanamadı.'), { code: 'CASH_RESPONSE_INVALID' });
      }
      setOverview(response.data);
      setLoadedDate(nextDate);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setLoadedDate(null);
      setOverview({ drawers: [], categories: [], session: null, currencies: [], movements: [] });
      setErrorMessage(error.code === 'CASH_REGISTER_SCHEMA_MISSING'
        ? 'Günlük kasa altyapısı henüz hazır değil. Sistem yöneticiniz kurulum adımını tamamlamalı.'
        : `${error.message || 'Günlük kasa okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => { requestSequence.current += 1; };
  }, []);

  const hasCurrentRead = loadedDate === businessDate && !isLoading && !errorMessage;
  const isOpen = hasCurrentRead && overview.session?.status === 'open';
  const isClosed = hasCurrentRead && overview.session?.status === 'closed';
  const drawer = overview.drawers?.find((row) => row.id === overview.session?.drawerId) || overview.drawers?.[0];
  const summaries = useMemo(() => Object.fromEntries(CURRENCIES.map((currency) => [currency, currencySummary(overview, currency)])), [overview]);
  const movementCounts = useMemo(() => {
    const counts = { all: overview.movements.length, income: 0, expense: 0, transfer: 0 };
    overview.movements.forEach((row) => { counts[movementGroup(row)] += 1; });
    return counts;
  }, [overview.movements]);
  const filteredMovements = useMemo(
    () => movementFilter === 'all'
      ? overview.movements
      : overview.movements.filter((row) => movementGroup(row) === movementFilter),
    [movementFilter, overview.movements],
  );

  useEffect(() => {
    onDirtyChange?.(Boolean(
      openingNote.trim() || closingNote.trim()
      || expense.amount || expense.categoryId || expense.description.trim() || expense.documentNo.trim() || expense.currency !== 'TRY'
      || transfer.amount || transfer.description.trim() || transfer.currency !== 'TRY' || transfer.direction !== 'main_to_drawer'
      || Object.values(openCounts).some((row) => row.physicalOpening || row.openingTransfer)
      || Object.values(closeCounts).some((row) => row.physicalClosing || row.carryForward),
    ));
  }, [closeCounts, closingNote, expense, onDirtyChange, openCounts, openingNote, transfer]);

  function updateCurrencyState(setter, currency, key, value) {
    setter((current) => ({ ...current, [currency]: { ...current[currency], [key]: value } }));
  }

  async function runAction(action, successText) {
    if (!hasCurrentRead || savingRef.current) return false;
    savingRef.current=true;
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    try {
      await action();
      setMessage(successText);
      await load();
      return true;
    } catch (error) {
      setErrorMessage(error.message || 'İşlem tamamlanamadı.');
      return false;
    } finally {
      savingRef.current=false;
      setIsSaving(false);
    }
  }

  async function submitOpen(event) {
    event.preventDefault();
    if (!canOpenOrClose) {
      setErrorMessage('Kasayı açma yetkiniz yok. Bu ekran yalnız görüntüleme amacıyla kullanılabilir.');
      return;
    }
    const succeeded = await runAction(() => api.openCashRegister({
      drawerId: drawer?.id,
      businessDate,
      openingNote,
      counts: Object.fromEntries(CURRENCIES.map((currency) => [currency, {
        physicalOpening: Number(openCounts[currency].physicalOpening || 0),
        openingTransfer: Number(openCounts[currency].openingTransfer || 0),
      }])),
    }), 'Kasa oturumu açıldı. Nakit hareketler artık çekmeceye yönlenecek.');
    if (succeeded) {
      setOpenCounts(Object.fromEntries(CURRENCIES.map((currency) => [currency, { physicalOpening: '', openingTransfer: '' }])));
      setOpeningNote('');
    }
  }

  async function submitExpense(event) {
    event.preventDefault();
    if (!canRecordExpenseOrTransfer) {
      setErrorMessage('Masraf kaydetmek için ödeme işlemi yetkisi gerekir.');
      return;
    }
    const succeeded = await runAction(() => api.createCashExpense({
      sessionId: overview.session.id,
      categoryId: Number(expense.categoryId),
      currency: expense.currency,
      amount: Number(expense.amount),
      description: expense.description,
      documentNo: expense.documentNo,
    }), 'Masraf çekmeceden düşüldü.');
    if (succeeded) setExpense((current) => ({ ...current, amount: '', description: '', documentNo: '' }));
  }

  async function submitTransfer(event) {
    event.preventDefault();
    if (!canRecordExpenseOrTransfer) {
      setErrorMessage('Para transferi kaydetmek için ödeme işlemi yetkisi gerekir.');
      return;
    }
    const succeeded = await runAction(() => api.createCashTransfer({
      sessionId: overview.session.id,
      ...transfer,
      amount: Number(transfer.amount),
    }), 'Kasa transferi kaydedildi.');
    if (succeeded) setTransfer((current) => ({ ...current, amount: '', description: '' }));
  }

  async function submitClose(event) {
    event.preventDefault();
    if (!canOpenOrClose) {
      setErrorMessage('Kasayı kapatma yetkiniz yok. Bu ekran yalnız görüntüleme amacıyla kullanılabilir.');
      return;
    }
    const succeeded = await runAction(() => api.closeCashRegister({
      sessionId: overview.session.id,
      closingNote,
      counts: Object.fromEntries(CURRENCIES.map((currency) => [currency, {
        physicalClosing: Number(closeCounts[currency].physicalClosing || 0),
        carryForward: Number(closeCounts[currency].carryForward || 0),
      }])),
    }), 'Kasa kapatıldı; teslim ve ertesi gün devirleri kaydedildi.');
    if (succeeded) {
      setCloseCounts(Object.fromEntries(CURRENCIES.map((currency) => [currency, { physicalClosing: '', carryForward: '' }])));
      setClosingNote('');
    }
  }

  return (
    <main className="work-area cash-register-screen">
      <section className="dashboard-toolbar cash-register-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Günlük Kasa Oturumu</strong>
          <span>TRY, USD ve EUR fiziki çekmece kontrolü</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <label>
            <span>Tarih</span>
            <input type="date" disabled={isSaving||fixedDate} value={businessDate} onChange={(event) => {
              requestSequence.current += 1;
              setBusinessDate(event.target.value);
              setIsLoading(false);
              setErrorMessage('');
              setMessage('');
            }} />
          </label>
          <button type="button" disabled={isLoading} onClick={() => load(businessDate)}><RefreshCw size={15} />Yenile</button>
          <span className={`cash-session-status ${isOpen ? 'open' : isClosed ? 'closed' : ''}`}>
            {!hasCurrentRead ? 'Kasa durumu doğrulanmadı' : isOpen ? 'Kasa Açık' : isClosed ? 'Kasa Kapalı' : 'Kasa Açılmadı'}
          </span>
        </div>
      </section>

      {message && <div className="list-state list-state-success" role="status">{message}</div>}
      {errorMessage && <div className="list-state list-state-error" role="alert">{errorMessage}</div>}
      {isLoading && <div className="list-state">Günlük kasa verisi yükleniyor...</div>}
      {Array.isArray(overview.accounts)&&overview.accounts.length===6&&<section className="cash-access-note" aria-label="Ana kasa ve günlük çekmece bakiyeleri"><table><thead><tr><th>Döviz</th><th>Ana kasa</th><th>Günlük çekmece</th></tr></thead><tbody>{CURRENCIES.map(currency=><tr key={currency}><th>{currency}</th><td>{formatMoney(overview.accounts.find(a=>a.kind==='main'&&a.currency===currency)?.balanceExact4,currency)}</td><td>{formatMoney(overview.accounts.find(a=>a.kind==='drawer'&&a.currency===currency)?.balanceExact4,currency)}</td></tr>)}</tbody></table></section>}
      {!isLoading && !errorMessage && !hasCurrentRead && <div className="list-state">Seçilen tarih için Yenile ile kasa kaydını okuyun.</div>}

      {isReadOnly && (
        <section className="cash-access-note read-only" role="status">
          <LockKeyhole size={18} aria-hidden="true" />
          <div>
            <strong>Yalnız görüntüleme</strong>
            <span>Kasa hareketlerini inceleyebilirsiniz. Kasa açma, kapatma, masraf ve transfer işlemleri yetkiniz olmadığı için gösterilmez.</span>
          </div>
        </section>
      )}

      {!isReadOnly && canOpenOrClose && !canRecordExpenseOrTransfer && (
        <section className="cash-access-note limited" role="status">
          <LockKeyhole size={18} aria-hidden="true" />
          <div>
            <strong>Sınırlı işlem yetkisi</strong>
            <span>Kasayı açıp kapatabilirsiniz. Masraf ve para transferi işlemleri için ödeme yetkisi gerekir.</span>
          </div>
        </section>
      )}

      {hasCurrentRead && !overview.session && canOpenOrClose && (
        <>
          <form className="erp-panel cash-opening-panel" onSubmit={submitOpen}>
            <div className="panel-title">
              <strong>Sabah Sayımı ve Kasa Açılışı</strong>
              <span>Önce fiziki parayı, sonra ana kasadan eklenecek tutarı yazın</span>
            </div>
            <div className="cash-currency-entry-grid">
              {CURRENCIES.map((currency) => (
                <fieldset key={currency}>
                  <legend>{currency}</legend>
                  <label><span>Fiziki sabah sayımı</span><input min="0" step="0.01" type="number" value={openCounts[currency].physicalOpening} onChange={(event) => updateCurrencyState(setOpenCounts, currency, 'physicalOpening', event.target.value)} /></label>
                  <label><span>Ana kasadan eklenecek</span><input min="0" step="0.01" type="number" value={openCounts[currency].openingTransfer} onChange={(event) => updateCurrencyState(setOpenCounts, currency, 'openingTransfer', event.target.value)} /></label>
                </fieldset>
              ))}
            </div>
            <div className="cash-form-footer">
              <label><span>Açılış notu <small>Sayım ile defter farklıysa zorunlu</small></span><input value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} placeholder="Sayım ve para ekleme açıklaması" /></label>
              <button className="primary" disabled={isSaving || !drawer} type="submit"><WalletCards size={16} />Kasayı Aç</button>
            </div>
          </form>

          <section className="cash-opening-guide" aria-label="Kasa açılış adımları">
            <article>
              <b>1</b>
              <div><strong>Çekmeceyi sayın</strong><span>Kasada fiilen bulunan TRY, USD ve EUR tutarlarını ayrı ayrı yazın.</span></div>
            </article>
            <article>
              <b>2</b>
              <div><strong>Eklenecek parayı belirtin</strong><span>Ana kasadan bugün çekmeceye aktarılacak tutarı ayrı alana girin.</span></div>
            </article>
            <article>
              <b>3</b>
              <div><strong>Farkı açıklayın ve açın</strong><span>Defter ile sayım farklıysa not ekleyin; ardından kasayı açın.</span></div>
            </article>
            <p><strong>Kontrol:</strong> “Fiziki sabah sayımı” mevcut parayı, “ana kasadan eklenecek” ise yeni transferi ifade eder. Aynı tutarı iki alana birden yazmayın.</p>
          </section>
        </>
      )}

      {hasCurrentRead && !overview.session && !canOpenOrClose && (
        <section className="erp-panel cash-readonly-empty" role="status">
          <div className="panel-title">
            <strong>Bu tarihte kasa oturumu yok</strong>
            <span>Kasa açma yetkiniz olmadığı için işlem formu gösterilmiyor</span>
          </div>
          <p>Başka bir tarih seçip mevcut kasa kayıtlarını inceleyebilir veya yetkili kullanıcıdan kasayı açmasını isteyebilirsiniz.</p>
        </section>
      )}

      {hasCurrentRead && overview.session && (
        <>
          <section className="cash-currency-summary" aria-label="Para birimi kasa özeti">
            {CURRENCIES.map((currency) => {
              const row = summaries[currency];
              const difference = row.difference;
              return (
                <article key={currency}>
                  <header><strong>{currency}</strong><span>{formatMoney(row.expected, currency)}</span></header>
                  <dl>
                    <div><dt>Açılış</dt><dd>{formatMoney(row.physicalOpening, currency)}</dd></div>
                    <div className="in"><dt>Giriş</dt><dd>+{formatMoney(row.incoming, currency)}</dd></div>
                    <div className="out"><dt>Çıkış</dt><dd>-{formatMoney(row.outgoing, currency)}</dd></div>
                    <div><dt>Fiziki</dt><dd>{row.physicalClosing === null || row.physicalClosing === undefined ? '-' : formatMoney(row.physicalClosing, currency)}</dd></div>
                    <div className={cashUnits(difference) === 0n ? 'balanced' : 'difference'}><dt>Fark</dt><dd>{difference === null || difference === undefined ? '-' : formatMoney(difference, currency)}</dd></div>
                  </dl>
                </article>
              );
            })}
          </section>

          <section className={`cash-register-workspace ${isOpen && canOpenOrClose ? '' : 'closed'}`}>
            <section className="erp-panel cash-movements-panel">
              <div className="panel-title">
                <strong>Günlük Nakit Hareketleri</strong>
                <span>Nakit tahsilat giriş; nakit ödeme ve masraf çıkış oluşturur</span>
              </div>
              <div className="cash-movement-tabs" role="group" aria-label="Kasa hareket filtresi">
                {MOVEMENT_FILTERS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={movementFilter === id}
                    className={movementFilter === id ? `active ${id}` : id}
                    onClick={() => setMovementFilter(id)}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                    <b>{movementCounts[id]}</b>
                  </button>
                ))}
              </div>
              {filteredMovements.length === 0 ? (
                <div className="list-state cash-empty-state">
                  {overview.movements.length === 0 ? 'Açılıştan sonra hareket yok.' : 'Bu grupta kasa hareketi yok.'}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Saat</th><th>Para Birimi</th><th>İşlem</th><th>Kategori / Açıklama</th><th>Belge</th><th>Giriş</th><th>Çıkış</th><th>Son Bakiye</th></tr></thead>
                    <tbody>{filteredMovements.map((row) => (
                      <tr key={row.id} className={row.direction === 'in' ? 'cash-in-row' : 'cash-out-row'}>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td><b>{row.currency}</b></td>
                        <td>{row.typeLabel}</td>
                        <td>{row.categoryName || row.description || '-'}</td>
                        <td>{row.documentNo}</td>
                        <td className="money-cell in-cell">{row.direction === 'in' ? formatMoney(row.amount, row.currency) : '-'}</td>
                        <td className="money-cell out-cell">{row.direction === 'out' ? formatMoney(row.amount, row.currency) : '-'}</td>
                        <td className="money-cell running-cell">{formatMoney(row.runningBalance, row.currency)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>

            {isOpen && canOpenOrClose && (
              <aside className="erp-panel cash-action-panel">
                <div className="panel-title">
                  <strong>Kasa İşlemi</strong>
                  <span>Bir işlem türü seçin</span>
                </div>
                <div className="cash-action-tabs" role="group" aria-label="Kasa işlem türleri">
                  {canRecordExpenseOrTransfer && <button type="button" aria-pressed={selectedAction === 'expense'} className={`expense-tab ${selectedAction === 'expense' ? 'active' : ''}`} onClick={() => setActiveAction('expense')}><Save size={17} /><span>Masraf Ekle</span></button>}
                  {canRecordExpenseOrTransfer && <button type="button" aria-pressed={selectedAction === 'transfer'} className={`transfer-tab ${selectedAction === 'transfer' ? 'active' : ''}`} onClick={() => setActiveAction('transfer')}><ArrowLeftRight size={17} /><span>Para Transferi</span></button>}
                  <button type="button" aria-pressed={selectedAction === 'close'} className={`close-tab ${selectedAction === 'close' ? 'active' : ''}`} onClick={() => setActiveAction('close')}><LockKeyhole size={17} /><span>Kasayı Kapat</span></button>
                </div>

                {selectedAction === 'expense' && canRecordExpenseOrTransfer && (
                  <form className="cash-action-form" onSubmit={submitExpense}>
                    <div className="cash-action-intro"><strong>Masraf Ekle</strong><span>Nakit masraf seçilen para biriminden düşer.</span></div>
                    <div className="cash-form-grid">
                      <CurrencyPicker value={expense.currency} onChange={(currency) => setExpense((current) => ({ ...current, currency }))} />
                      <label><span>Tutar</span><input required min="0.01" step="0.01" type="number" value={expense.amount} onChange={(event) => setExpense((current) => ({ ...current, amount: event.target.value }))} /></label>
                      <label><span>Kategori</span><select required value={expense.categoryId} onChange={(event) => setExpense((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Seçin</option>{overview.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                      <label><span>Fiş / Belge</span><input value={expense.documentNo} onChange={(event) => setExpense((current) => ({ ...current, documentNo: event.target.value }))} /></label>
                      <label className="wide"><span>Açıklama</span><input required value={expense.description} onChange={(event) => setExpense((current) => ({ ...current, description: event.target.value }))} /></label>
                    </div>
                    <button className="cash-submit-button expense-submit" disabled={isSaving} type="submit"><Save size={16} />Masrafı Kaydet</button>
                  </form>
                )}

                {selectedAction === 'transfer' && canRecordExpenseOrTransfer && (
                  <form className="cash-action-form" onSubmit={submitTransfer}>
                    <div className="cash-action-intro"><strong>Para Transferi</strong><span>Ana kasa ile günlük çekmece arasında para taşıyın.</span></div>
                    <div className="cash-form-grid">
                      <label className="wide"><span>Yön</span><select value={transfer.direction} onChange={(event) => setTransfer((current) => ({ ...current, direction: event.target.value }))}><option value="main_to_drawer">Ana kasadan çekmeceye</option><option value="drawer_to_main">Çekmeceden ana kasaya</option></select></label>
                      <CurrencyPicker value={transfer.currency} onChange={(currency) => setTransfer((current) => ({ ...current, currency }))} />
                      <label><span>Tutar</span><input required min="0.01" step="0.01" type="number" value={transfer.amount} onChange={(event) => setTransfer((current) => ({ ...current, amount: event.target.value }))} /></label>
                      <label className="wide"><span>Açıklama</span><input value={transfer.description} onChange={(event) => setTransfer((current) => ({ ...current, description: event.target.value }))} /></label>
                    </div>
                    <button className="cash-submit-button transfer-submit" disabled={isSaving} type="submit"><ArrowDownToLine size={16} />Transferi Kaydet</button>
                  </form>
                )}

                {selectedAction === 'close' && (
                  <form className="cash-action-form cash-close-form" onSubmit={submitClose}>
                    <div className="cash-action-intro warning"><strong>Akşam Sayımı</strong><span>Her para birimini sayın; kasada kalacak tutarı ayrıca yazın.</span></div>
                    <div className="cash-close-currencies">
                      {CURRENCIES.map((currency) => (
                        <fieldset key={currency}>
                          <legend>{currency}</legend>
                          <label><span>Fiziki sayım</span><input required min="0" step="0.01" type="number" value={closeCounts[currency].physicalClosing} onChange={(event) => updateCurrencyState(setCloseCounts, currency, 'physicalClosing', event.target.value)} /></label>
                          <label><span>Ertesi güne bırak</span><input required min="0" step="0.01" type="number" value={closeCounts[currency].carryForward} onChange={(event) => updateCurrencyState(setCloseCounts, currency, 'carryForward', event.target.value)} /></label>
                        </fieldset>
                      ))}
                    </div>
                    <label><span>Kapanış notu <small>Fark varsa zorunlu</small></span><input value={closingNote} onChange={(event) => setClosingNote(event.target.value)} /></label>
                    <button className="danger cash-submit-button" disabled={isSaving} type="submit"><Calculator size={15} />Kasayı Say ve Kapat</button>
                  </form>
                )}
              </aside>
            )}
          </section>
        </>
      )}
    </main>
  );
}
