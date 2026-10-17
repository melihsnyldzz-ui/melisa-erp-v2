import React, { useMemo } from 'react';
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, PanelRightClose, PanelRightOpen, TrendingUp } from 'lucide-react';
import { getRoleView } from '../../config/roleViews.js';

const roleInsights = {
  yonetici: [
    { tone: 'info', title: 'Stok değerlemesini incele', detail: 'Stok değerleme ekranını aç', screenId: 'stock-valuation' },
    { tone: 'info', title: 'Tahsilat ve ödemeler', detail: 'Kasa/banka hareketlerini incele', screenId: 'collections-overview' },
    { tone: 'info', title: 'Yönetim raporları', detail: 'Rapor ekranını aç', screenId: 'reports-overview' },
  ],
  patron: [
    { tone: 'info', title: 'Yönetim raporlarını incele', detail: 'Dönem ve rapor seçimini yap', screenId: 'reports-overview' },
    { tone: 'info', title: 'Cari riskleri izle', detail: 'Tahsilat önceliklerini gözden geçir', screenId: 'customer-list' },
    { tone: 'info', title: 'Finans özetini incele', detail: 'Cari bakiye ve hareketleri gör', screenId: 'finance-overview' },
  ],
  muhasebe: [
    { tone: 'info', title: 'Cari ekstreleri', detail: 'Cari ve dönem seçerek incele', screenId: 'customer-statement' },
    { tone: 'info', title: 'Satış fişlerini incele', detail: 'Fiş listesini aç', screenId: 'sales-invoice-list' },
    { tone: 'info', title: 'Tahsilat hareketleri', detail: 'Tahsilat ve ödeme ekranını aç', screenId: 'collections-overview' },
  ],
  depo: [
    { tone: 'info', title: 'Stok hareketlerini incele', detail: 'Ürün ve dönem seçerek kontrol et', screenId: 'stock-movements' },
    { tone: 'info', title: 'Terminal ekranları', detail: 'El terminali yönetimini aç', screenId: 'terminal-overview' },
    { tone: 'info', title: 'Aktarım araçları', detail: 'Aktarım ekranını incele', screenId: 'import-foundation' },
  ],
  satis: [
    { tone: 'info', title: 'Satış teklifleri', detail: 'Teklif ekranını aç', screenId: 'sales-offers' },
    { tone: 'info', title: 'Cari fiyat kontrolü', detail: 'Cari ve fiyat kontrolünü yap', screenId: 'customer-list' },
    { tone: 'info', title: 'WhatsApp hazırlık listesi', detail: 'Manuel kopyalama listesini gör', screenId: 'whatsapp-planner' },
  ],
};

const toneIcons = {
  danger: AlertTriangle,
  warn: CalendarClock,
  info: BarChart3,
  good: CheckCircle2,
};

export function SmartInsightsPanel({ activeTab, isCollapsed = false, roleViewId, onOpenScreen, onToggleCollapsed }) {
  const roleView = getRoleView(roleViewId);
  const insights = useMemo(() => roleInsights[roleView.id] || roleInsights.yonetici, [roleView.id]);
  const activeContext = activeTab.label || 'Operasyon Masası';

  return (
    <aside className={isCollapsed ? 'smart-panel collapsed' : 'smart-panel'} aria-label="Ekran kısayolları">
      <div className="smart-panel-header">
        <span><TrendingUp size={16} /> Ekran kısayolları</span>
        <strong>{roleView.label}</strong>
        <button
          aria-label={isCollapsed ? 'Akıllı paneli genişlet' : 'Akıllı paneli daralt'}
          className="smart-panel-toggle"
          onClick={onToggleCollapsed}
          type="button"
        >
          {isCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
        </button>
      </div>
      <p className="smart-panel-context">{activeContext} açıkken öne çıkan kısayollar</p>
      <div className="smart-insight-list">
        {insights.map((insight) => {
          const Icon = toneIcons[insight.tone] || BarChart3;

          return (
            <button
              className={`smart-insight ${insight.tone}`}
              key={`${roleView.id}-${insight.title}`}
              onClick={() => onOpenScreen(insight.screenId)}
              type="button"
            >
              <span className="smart-insight-icon"><Icon size={16} /></span>
              <span>
                <strong>{insight.title}</strong>
                <small>{insight.detail}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="smart-panel-note">
        Kısayollar ilgili ekranı açar. Güncel durumu açılan ekranda kontrol edin.
      </div>
    </aside>
  );
}
