import React from 'react';
import { AlertTriangle, Clock3, MessageCircle, Send, Trophy, Wifi } from 'lucide-react';
import { formatContactTime } from './crmWorkspaceData.js';

const funnelStages = ['Yeni', 'Gorusuluyor', 'Teklif', 'Teslimat', 'Kazanildi'];
const stageLabels = { Yeni: 'Yeni', Gorusuluyor: 'Görüşülüyor', Teklif: 'Teklif', Teslimat: 'Teslimat', Kazanildi: 'Kazanıldı' };

export function CrmManagementDashboardScreen({ data, onOpenInbox }) {
  const personnel = new Map();
  data.conversations.forEach((item) => {
    const key = item.owner || 'Atanmadı';
    const current = personnel.get(key) || { name: key, conversations: 0, waiting: 0, won: 0 };
    current.conversations += 1;
    current.waiting += item.unread > 0 ? 1 : 0;
    current.won += item.stage === 'Kazanildi' ? 1 : 0;
    personnel.set(key, current);
  });
  const delayed = data.conversations.filter((item) => item.unread > 0 || item.status === 'pending').slice(0, 6);
  return (
    <div className="crm-dashboard">
      <header className="crm-page-heading"><div><span className="crm-page-icon"><Trophy size={20} /></span><div><h2>CRM Yönetim Paneli</h2><p>Canlı konuşmalar, satış hunisi ve ekip iş yükü</p></div></div><button className="crm-refresh-button" onClick={() => data.refresh()} type="button">Verileri Yenile</button></header>
      <section className="crm-dashboard-kpis"><article><span className="green"><MessageCircle /></span><div><small>Açık konuşmalar</small><strong>{data.metrics.open}</strong><p>{data.conversations.length} toplam kayıt</p></div></article><article><span className="amber"><Clock3 /></span><div><small>Cevap bekleyen</small><strong>{data.metrics.pending}</strong><p>{data.metrics.unread} okunmamış</p></div></article><article><span className="blue"><Send /></span><div><small>CRM teklifleri</small><strong>{data.metrics.quotes}</strong><p>Onay kapısı korunuyor</p></div></article><article><span className="green"><Trophy /></span><div><small>Kazanılan</small><strong>{data.metrics.stages.Kazanildi || 0}</strong><p>Konuşma aşaması</p></div></article><article><span className={data.health ? 'green' : 'red'}><Wifi /></span><div><small>WhatsApp hattı</small><strong>{data.health ? 'Bağlı' : 'Kontrol gerekli'}</strong><p>{data.health?.provider || 'Sağlayıcı bilinmiyor'}</p></div></article></section>
      <div className="crm-dashboard-grid">
        <section className="crm-funnel-card"><header><strong>Satış Hunisi</strong><span>Gerçek konuşma aşamaları</span></header><div className="crm-funnel">{funnelStages.map((stage, index) => <article key={stage}><span>{index + 1}</span><strong>{stageLabels[stage]}</strong><b>{data.metrics.stages[stage] || 0}</b><small>konuşma</small></article>)}</div></section>
        <section className="crm-personnel-card"><header><strong>Personel Performansı</strong><span>Konuşma dağılımı</span></header><div className="crm-personnel-table"><div className="header"><span>Personel</span><span>Konuşma</span><span>Bekleyen</span><span>Kazanılan</span><span>Dönüşüm</span></div>{[...personnel.values()].map((item) => <div key={item.name}><span><i>{item.name.slice(0, 2).toUpperCase()}</i><strong>{item.name}</strong></span><span>{item.conversations}</span><span className={item.waiting ? 'danger' : ''}>{item.waiting}</span><span>{item.won}</span><span>%{item.conversations ? Math.round(item.won / item.conversations * 100) : 0}</span></div>)}</div></section>
        <section className="crm-status-card"><header><strong>WhatsApp Hat Durumu</strong><span className={data.health ? 'online' : 'offline'}>{data.health ? 'Bağlı' : 'Kapalı'}</span></header><dl><div><dt>Sağlayıcı</dt><dd>{data.health?.provider || '-'}</dd></div><div><dt>Gönderim</dt><dd>{data.health?.sendEnabled ? 'Açık' : 'Kapalı'}</dd></div><div><dt>Kayıt kaynağı</dt><dd>{data.health?.inboxSource || '-'}</dd></div></dl><header className="delayed-title"><strong>Geciken Konuşmalar</strong><span>{delayed.length}</span></header>{delayed.map((item) => <button key={item.id} onClick={() => onOpenInbox(item.id)} type="button"><AlertTriangle size={15} /><span><strong>{item.name}</strong><small>{item.preview}</small></span><time>{formatContactTime(item.lastMessageAt)}</time></button>)}</section>
      </div>
    </div>
  );
}
