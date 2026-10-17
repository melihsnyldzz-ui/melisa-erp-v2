import React, { useMemo, useState } from 'react';
import { MessageCircle, Search, Send, UserRound } from 'lucide-react';
import { formatContactTime, formatCrmMoney, quoteTotal } from './crmWorkspaceData.js';

const stageOrder = ['Yeni', 'Gorusuluyor', 'Teklif', 'Teslimat', 'Kazanildi'];
const stageLabels = { Yeni: 'Yeni', Gorusuluyor: 'Görüşülüyor', Teklif: 'Teklif', Teslimat: 'Teslimat', Kazanildi: 'Kazanıldı' };

function Avatar({ customer }) {
  return customer.avatarUrl
    ? <img alt="" className="crm-suite-avatar" src={customer.avatarUrl} />
    : <span className="crm-suite-avatar fallback">{customer.avatar}</span>;
}

function Customer360({ conversation, onOpenInbox }) {
  const total = quoteTotal(conversation);
  const activity = [
    ...(conversation.messages || []).slice(-2).map((message) => ({
      type: 'WhatsApp mesajı',
      detail: message.text || '[Medya mesajı]',
      time: message.time || '',
    })),
    ...(conversation.products || []).slice(-1).map((product) => ({
      type: 'Ürün ilgisi eklendi',
      detail: product.productName || product.stockCode || 'Ürün',
      time: '',
    })),
    ...(conversation.quotes || []).slice(-2).map((quote) => ({
      type: 'Teklif oluşturuldu',
      detail: quote.quoteNo || quote.documentNo || `Teklif #${quote.id || '-'}`,
      time: quote.createdAt || '',
    })),
  ].reverse();

  return (
    <aside className="crm-directory-detail" aria-label="Müşteri 360">
      <div className="crm-suite-panel-title"><div><strong>Müşteri 360</strong><span>Tüm temas ve ERP bağlamı</span></div></div>
      <section className="crm-directory-profile">
        <Avatar customer={conversation} />
        <div><h3>{conversation.name} <span>{conversation.flag}</span></h3><p>{conversation.phone || 'Telefon doğrulanmadı'}</p></div>
        <span className="crm-match-badge crm-only">CRM kişisi</span>
        <dl>
          <div><dt>Ülke</dt><dd>{conversation.country}</dd></div>
          <div><dt>Dil</dt><dd>{conversation.language}</dd></div>
          <div><dt>Sorumlu</dt><dd>{conversation.owner}</dd></div>
        </dl>
      </section>
      <section className="crm-directory-kpis">
        <article><span>Son mesaj</span><strong>{formatContactTime(conversation.lastMessageAt)}</strong></article>
        <article><span>Toplam teklif</span><strong>{formatCrmMoney(total)}</strong></article>
        <article><span>Açık görev</span><strong>{conversation.tasks.filter((task) => task.status !== 'done').length}</strong></article>
        <article><span>Etiket</span><strong>{conversation.tags.length}</strong></article>
      </section>
      <div className="crm-directory-actions">
        <button className="primary" onClick={() => onOpenInbox(conversation.id)} type="button"><MessageCircle size={16} /> Görüşmeyi Aç</button>
      </div>
      <section className="crm-activity-panel">
        <header><strong>Aktivite Geçmişi</strong><span>{activity.length} kayıt</span></header>
        {activity.length ? activity.map((item, index) => (
          <article key={`${item.type}-${index}`}><span className="crm-activity-icon"><Send size={14} /></span><div><strong>{item.type}</strong><p>{item.detail}</p></div><time>{formatContactTime(item.time)}</time></article>
        )) : <div className="crm-suite-empty">Bu müşteri için henüz aktivite bulunamadı.</div>}
      </section>
    </aside>
  );
}

export function CrmCustomerDirectoryScreen({ data, onOpenInbox }) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [owner, setOwner] = useState('');
  const [stage, setStage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const countries = useMemo(() => [...new Set(data.conversations.map((item) => item.country).filter(Boolean))].sort(), [data.conversations]);
  const owners = useMemo(() => [...new Set(data.conversations.map((item) => item.owner).filter(Boolean))].sort(), [data.conversations]);
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return data.conversations.filter((item) => {
      if (country && item.country !== country) return false;
      if (owner && item.owner !== owner) return false;
      if (stage && item.stage !== stage) return false;
      return !query || [item.name, item.phone, item.country, item.owner, ...(item.tags || [])]
        .some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query));
    });
  }, [country, data.conversations, owner, search, stage]);
  const selected = rows.find((item) => item.id === selectedId) || rows[0] || null;

  return (
    <div className="crm-directory-layout">
      <section className="crm-directory-list">
        <header className="crm-page-heading"><div><span className="crm-page-icon"><UserRound size={20} /></span><div><h2>CRM Müşteri Rehberi</h2><p>WhatsApp kişileri, ülkeler, sorumlular ve satış aşamaları</p></div></div><button className="crm-refresh-button" onClick={() => data.refresh()} type="button">Verileri Yenile</button></header>
        <div className="crm-directory-filters">
          <label><Search size={16} /><input onChange={(event) => setSearch(event.target.value)} placeholder="Ad, telefon veya ülke ara" type="search" value={search} /></label>
          <select aria-label="Ülke" onChange={(event) => setCountry(event.target.value)} value={country}><option value="">Tüm ülkeler</option>{countries.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Personel" onChange={(event) => setOwner(event.target.value)} value={owner}><option value="">Tüm personel</option>{owners.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Aşama" onChange={(event) => setStage(event.target.value)} value={stage}><option value="">Tüm aşamalar</option>{stageOrder.map((item) => <option key={item} value={item}>{stageLabels[item]}</option>)}</select>
        </div>
        <div className="crm-directory-table" role="table" aria-label="CRM müşterileri">
          <div className="crm-directory-row header" role="row"><span>Müşteri</span><span>Ülke</span><span>Sorumlu</span><span>Aşama</span><span>Son iletişim</span><span>Toplam teklif</span></div>
          {rows.map((row) => (
            <button className={`crm-directory-row ${selected?.id === row.id ? 'selected' : ''}`} key={row.id} onClick={() => setSelectedId(row.id)} role="row" type="button">
              <span className="crm-directory-person"><Avatar customer={row} /><span><strong>{row.name}</strong><small>{row.phone || 'Telefon yok'}</small></span>{row.unread ? <em>{row.unread}</em> : null}</span>
              <span>{row.flag} {row.country}</span><span>{row.owner}</span><span><b className={`crm-stage-badge stage-${row.stage.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşıöç]+/g, '-')}`}>{stageLabels[row.stage] || row.stage}</b></span><span>{formatContactTime(row.lastMessageAt)}</span><span>{formatCrmMoney(quoteTotal(row))}</span>
            </button>
          ))}
          {!data.loading && !rows.length ? <div className="crm-suite-empty">Filtrelere uygun müşteri bulunamadı.</div> : null}
        </div>
      </section>
      {selected ? <Customer360 conversation={selected} onOpenInbox={onOpenInbox} /> : <aside className="crm-directory-detail"><div className="crm-suite-empty">Bir müşteri seçin.</div></aside>}
    </div>
  );
}
