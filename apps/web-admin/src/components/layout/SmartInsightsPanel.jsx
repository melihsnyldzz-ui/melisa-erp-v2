import React, { useMemo } from 'react';
import { ArrowRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { getRoleView } from '../../config/roleViews.js';

// Static navigation shortcuts, not live findings or health measurements.
const roleShortcuts = {
  yonetici: [
    { title: 'Stok değerleme', detail: 'Stok değerleme raporunu aç', screenId: 'stock-valuation' },
    { title: 'Tahsilat / Ödeme', detail: 'Finans işlemlerini aç', screenId: 'collections-overview' },
    { title: 'Yönetim raporları', detail: 'Dönem raporlarını aç', screenId: 'reports-overview' },
  ],
  patron: [
    { title: 'Yönetim raporları', detail: 'Satış ve kârlılık raporlarını aç', screenId: 'reports-overview' },
    { title: 'Müşteri carileri', detail: 'Cari listesini aç', screenId: 'customer-list' },
    { title: 'Finans özeti', detail: 'Finans özetini aç', screenId: 'finance-overview' },
  ],
  muhasebe: [
    { title: 'Cari ekstre', detail: 'Müşteri ekstrelerini aç', screenId: 'customer-statement' },
    { title: 'Satış fişleri (Vega)', detail: 'Mevcut Vega listesine git', screenId: 'sales-invoice-list' },
    { title: 'Tahsilat / Ödeme', detail: 'Finans hareketlerini aç', screenId: 'collections-overview' },
  ],
  depo: [
    { title: 'Stok hareketleri', detail: 'Stok hareket listesini aç', screenId: 'stock-movements' },
    { title: 'Terminal yönetimi', detail: 'Cihaz ve kuyruk yönetimini aç', screenId: 'terminal-overview' },
    { title: 'Excel / CSV aktarım', detail: 'Aktarım ekranını aç', screenId: 'import-foundation' },
  ],
  satis: [
    { title: 'Teklifler', detail: 'Teklif listesini aç', screenId: 'sales-offers' },
    { title: 'Müşteri carileri', detail: 'Cari listesini aç', screenId: 'customer-list' },
    { title: 'Fiyat listesi', detail: 'Fiyat kontrol ekranını aç', screenId: 'price-list' },
  ],
};

export function SmartInsightsPanel({ activeTab, isCollapsed = false, roleViewId, onOpenScreen, onToggleCollapsed }) {
  const roleView = getRoleView(roleViewId);
  const shortcuts = useMemo(() => roleShortcuts[roleView.id] || roleShortcuts.yonetici, [roleView.id]);
  return (
    <aside className={isCollapsed ? 'smart-panel collapsed' : 'smart-panel'} aria-label="Ekran kısayolları">
      <div className="smart-panel-header">
        <span><ArrowRight size={16} /> Kısayollar</span>
        <strong>{roleView.label}</strong>
        <button
          aria-label={isCollapsed ? 'Kısayolları genişlet' : 'Kısayolları daralt'}
          className="smart-panel-toggle"
          onClick={onToggleCollapsed}
          type="button"
        >
          {isCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
        </button>
      </div>
      <p className="smart-panel-context">{activeTab.label || 'Operasyon Masası'} · ekran kısayolları</p>
      <div className="smart-insight-list">
        {shortcuts.map((shortcut) => (
          <button className="smart-insight info" key={shortcut.screenId} onClick={() => onOpenScreen(shortcut.screenId)} type="button">
            <span className="smart-insight-icon"><ArrowRight size={16} /></span>
            <span><strong>{shortcut.title}</strong><small>{shortcut.detail}</small></span>
          </button>
        ))}
      </div>
      <div className="smart-panel-note">Bu alan yalnızca kısayol içerir; canlı analiz veya sistem sağlığı sonucu göstermez.</div>
    </aside>
  );
}
