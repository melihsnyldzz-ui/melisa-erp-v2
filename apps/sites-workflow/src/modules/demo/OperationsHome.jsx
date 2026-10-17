import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCheck, ChevronRight, ClipboardList, CreditCard, FileText, Landmark, PackageCheck, Plus, ReceiptText, Wallet } from 'lucide-react';
import { accountBalance, financialChannels, today } from '../../demo/operationsStore.js';
import { demoRoleCanOpen } from '../../config/demoRolePolicy.js';
import './operations-home.css';

const money = (amount, currency) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount / 100);
const dateLabel = date => date ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`)) : '—';
const taskIcons = { billing: FileText, collection: ArrowDownLeft, payment: ArrowUpRight, refund: ArrowUpRight, cash: Wallet, stock: PackageCheck, draft: ClipboardList, order: ReceiptText };
const accountIcons = { CASH: Wallet, BANK: Landmark, CARD: CreditCard, OTHER: Banknote };
const statusLabels = { DRAFT: 'Taslak', APPROVED: 'Onaylandı', CANCELLED: 'İptal', REVERSED: 'Düzeltildi' };

function RecentDocuments({ title, Icon, docs, parties, route, onOpenScreen, emptyText, actionLabel }) {
  return <section className="home-panel home-recent" aria-label={title}>
    <header className="home-panel-title"><h2><Icon size={18} aria-hidden="true"/>{title}</h2><button className="home-text-button" onClick={() => onOpenScreen?.(route)}>Tümü <ChevronRight size={14} aria-hidden="true"/></button></header>
    <div className="home-table-scroll"><table><thead><tr><th>Fiş / cari</th><th>Tarih</th><th>Tutar</th></tr></thead><tbody>
      {docs.map(doc => <tr key={doc.id}><td><button className="home-document-link" onClick={() => onOpenScreen?.(route, { selectedDocumentId: doc.id, workflowTaskId: `home-document-${doc.id}` })}>{doc.number}</button><span className="home-cell-detail">{parties.find(p => p.id === doc.partyId)?.name || '—'}</span></td><td>{dateLabel(doc.date)}<span className={`home-cell-detail home-doc-status is-${doc.status.toLowerCase()}`}>{statusLabels[doc.status]}</span></td><td className="home-money">{money(doc.amount, doc.currency)}<span className="home-cell-detail">{doc.currency}</span></td></tr>)}
    </tbody></table></div>
    {!docs.length && <div className="home-empty"><Icon size={23} aria-hidden="true"/><div><strong>{emptyText}</strong><span>Kaydedilen fişler burada görünecek.</span></div><button className="home-text-button" onClick={() => onOpenScreen?.(route)}>{actionLabel}<ChevronRight size={14} aria-hidden="true"/></button></div>}
  </section>;
}

export function OperationsHome({ state, tasks, roleViewId, onOpenScreen }) {
  const [account, setAccount] = useState('CASH');
  const [taskFilter, setTaskFilter] = useState('all');
  const canFinance = !['satis', 'depo'].includes(roleViewId);
  const canOpen = route => demoRoleCanOpen(roleViewId, route);
  const visibleTasks = tasks.filter(task => taskFilter === 'all' || (taskFilter === 'receipt' ? task.screenId === 'inventory-receipt-list' : taskFilter === 'billing' ? task.type === 'billing' || task.screenId.startsWith('purchase-invoice') : task.screenId === 'cash-register'));
  const taskGroups = [
    ['all', 'Tüm işler', tasks.length],
    ['receipt', 'Mal kabulü', tasks.filter(t => t.screenId === 'inventory-receipt-list').length],
    ['billing', 'Alış faturası', tasks.filter(t => t.type === 'billing' || t.screenId.startsWith('purchase-invoice')).length],
    ...(canFinance ? [['cash', 'Kasa', tasks.filter(t => t.screenId === 'cash-register').length]] : []),
  ];
  const recent = kind => state.documents.filter(d => d.kind === kind).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5);
  const sales = recent('sale');
  const collections = recent('collection');
  const approvedToday = state.documents.filter(d => d.status === 'APPROVED' && d.date === today());
  const AccountIcon = accountIcons[account];
  const shortcuts = [
    { title: 'Mal kabulü', detail: 'Koli, barkod ve miktar', Icon: PackageCheck, route: 'inventory-receipt-list', payload: { kind: 'receipt' }, tone: 'blue' },
    { title: 'Alış faturası', detail: 'Tedarikçi belgesini işle', Icon: FileText, route: 'purchase-invoice-list', payload: { kind: 'purchase' }, tone: 'violet' },
    { title: 'Tahsilat', detail: 'Müşteri ödemesini kaydet', Icon: ArrowDownLeft, route: 'cash-register', payload: { kind: 'collection' }, tone: 'green' },
    { title: 'Satış fişi', detail: 'Müşteri satışlarını aç', Icon: ReceiptText, route: 'sales-invoice-list', payload: { kind: 'sale' }, tone: 'blue' },
  ].filter(item => canOpen(item.route) && (canFinance || item.route !== 'cash-register'));

  return <main className="work-area operations-home">
    <header className="home-heading"><div><span className="home-eyebrow">{new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date(`${today()}T12:00:00`))}</span><h1>Günlük çalışma</h1></div><div className="home-day-status"><CheckCheck size={17} aria-hidden="true"/><span>Bugün <strong>{approvedToday.length}</strong> onaylı işlem</span></div></header>

    {canFinance && <section className="home-panel home-accounts" aria-label="Kasa ve hesap bakiyeleri">
      <div className="home-account-label"><span className="home-icon tone-blue"><AccountIcon size={19} aria-hidden="true"/></span><div><label htmlFor="home-account">Hesap bakiyesi</label><select id="home-account" value={account} onChange={event => setAccount(event.target.value)}>{Object.entries(financialChannels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></div>
      {[['USD', '$', 'green'], ['EUR', '€', 'blue'], ['TRY', '₺', 'violet']].map(([currency, symbol, tone]) => <div className="home-currency" key={currency}><span className={`home-currency-symbol tone-${tone}`} aria-hidden="true">{symbol}</span><div><span className="home-currency-code">{currency}</span><strong>{money(accountBalance(state, account, currency), currency)}</strong></div></div>)}
      <button className={`home-cash-state ${state.cashOpen ? 'is-open' : ''}`} onClick={() => onOpenScreen?.('cash-register', { kind: state.cashOpen ? 'cash-close' : 'cash-open' })}>{state.cashOpen ? 'Kasa açık' : 'Kasa kapalı'}<ChevronRight size={14} aria-hidden="true"/></button>
    </section>}

    <div className="home-work-grid">
      <section className="home-panel home-work-list" aria-label="Bekleyen işler">
        <header className="home-panel-title"><h2><ClipboardList size={18} aria-hidden="true"/>Bekleyen işler <span className="home-count">{tasks.length}</span></h2><span className="home-secondary">Öncelik sırasıyla</span></header>
        <nav className="home-task-tabs" aria-label="İş listesi filtreleri">{taskGroups.map(([key, label, count]) => <button key={key} aria-pressed={taskFilter === key} onClick={() => setTaskFilter(key)}>{label}<span>{count}</span></button>)}</nav>
        <div className="home-queue" aria-live="polite">{visibleTasks.map(task => {
          const Icon = taskIcons[task.type] || ClipboardList;
          const source = state.documents.find(d => d.id === (task.payload.selectedDocumentId || task.payload.referenceId));
          const party = [...state.suppliers, ...state.customers].find(p => p.id === (source?.partyId || task.payload.partyId));
          return <button className="home-task-row" key={task.id} onClick={() => onOpenScreen?.(task.screenId, task.payload)}><span className={`home-icon ${task.priority === 0 ? 'tone-amber' : 'tone-blue'}`}><Icon size={18} aria-hidden="true"/></span><span className="home-task-content"><strong>{task.title}</strong><span>{party ? `${party.name} · ` : ''}{task.detail}</span></span><span className="home-task-meta"><span className={`home-status ${task.status === 'Gecikti' ? 'is-late' : ''}`}>{task.status}</span><small>{task.dueDate ? dateLabel(task.dueDate) : task.owner}</small></span><ChevronRight size={16} aria-hidden="true"/></button>;
        })}</div>
        {!visibleTasks.length && <div className="home-empty home-empty-queue"><CheckCheck size={23} aria-hidden="true"/><div><strong>Bu listede bekleyen iş yok</strong><span>İşlem oluşturulduğunda ilgili görev burada görünür.</span></div></div>}
        <footer className="home-queue-footer"><span>{visibleTasks.length} iş listeleniyor</span><span>Her satır ilgili işlemi açar</span></footer>
      </section>
      <aside className="home-panel home-quick" aria-label="Hızlı işlemler"><header className="home-panel-title"><h2><Plus size={18} aria-hidden="true"/>Hızlı işlem</h2></header>{shortcuts.map(item => <button key={item.title} className="home-shortcut" onClick={() => onOpenScreen?.(item.route, item.payload)}><span className={`home-icon tone-${item.tone}`}><item.Icon size={18} aria-hidden="true"/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={15} aria-hidden="true"/></button>)}</aside>
    </div>

    <div className="home-recent-grid">
      {canOpen('sales-invoice-list') && <RecentDocuments title="Son satış fişleri" Icon={ReceiptText} docs={sales} parties={state.customers} route="sales-invoice-list" onOpenScreen={onOpenScreen} emptyText="Henüz satış fişi yok" actionLabel="Satışları aç"/>}
      {canFinance && <RecentDocuments title="Son tahsilatlar" Icon={ArrowDownLeft} docs={collections} parties={state.customers} route="cash-register" onOpenScreen={onOpenScreen} emptyText="Henüz tahsilat yok" actionLabel="Tahsilat gir"/>}
      {!canFinance && canOpen('inventory-receipt-list') && <RecentDocuments title="Son mal kabulleri" Icon={PackageCheck} docs={recent('receipt')} parties={state.suppliers} route="inventory-receipt-list" onOpenScreen={onOpenScreen} emptyText="Henüz mal kabulü yok" actionLabel="Mal kabulünü aç"/>}
    </div>
    <footer className="home-footnote"><span>Örnek veriler · Bu tarayıcıdaki kayıtlar</span>{canOpen('reports-overview') && <button className="home-text-button" onClick={() => onOpenScreen?.('reports-overview')}>İşlem toplamları ve raporlar<ChevronRight size={14} aria-hidden="true"/></button>}</footer>
  </main>;
}
