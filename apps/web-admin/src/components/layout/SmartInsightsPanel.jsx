import React, { useMemo } from 'react';
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, PanelRightClose, PanelRightOpen, TrendingUp } from 'lucide-react';
import { getRoleView } from '../../config/roleViews.js';

const roleInsights = {
  yonetici: [
    { tone: 'good', title: 'Stok kontrolü temiz', detail: 'Canlı stok değerleme raporunu aç', screenId: 'stock-valuation' },
    { tone: 'info', title: 'Tahsilat ekranı hazır', detail: 'Bugünün kasa/banka hareketlerini kontrol et', screenId: 'collections-overview' },
    { tone: 'info', title: 'Yönetim raporu hazır', detail: 'Kârlılık ve kanal performansını incele', screenId: 'reports-overview' },
  ],
  patron: [
    { tone: 'info', title: 'Brüt kâr raporu hazır', detail: 'Son 7 gün raporunu aç', screenId: 'reports-overview' },
    { tone: 'info', title: 'Cari riskleri izle', detail: 'Tahsilat önceliklerini gözden geçir', screenId: 'customer-list' },
    { tone: 'good', title: 'Terminal özeti hazır', detail: 'Kanal özetini kontrol et', screenId: 'finance-overview' },
  ],
  muhasebe: [
    { tone: 'info', title: 'Ekstre ekranı hazır', detail: 'Cari ekstreleri sıraya al', screenId: 'customer-statement' },
    { tone: 'info', title: 'Fiş kontrolü hazır', detail: 'Satış ve alış fişlerini karşılaştır', screenId: 'sales-invoice-list' },
    { tone: 'info', title: 'Tahsilat takibi açık', detail: 'Bugünün hareket listesini gör', screenId: 'collections-overview' },
  ],
  depo: [
    { tone: 'good', title: 'Eksi stok yok', detail: 'Stok hareketlerini kontrol et', screenId: 'stock-movements' },
    { tone: 'info', title: 'Terminal kuyruğu hazır', detail: 'El terminali iş kuyruğunu aç', screenId: 'terminal-overview' },
    { tone: 'info', title: 'CSV şablonu hazır', detail: 'Aktarım ekranını incele', screenId: 'import-foundation' },
  ],
  satis: [
    { tone: 'good', title: 'Satış ekranı hazır', detail: 'Teklif ve sipariş ekranını aç', screenId: 'sales-offers' },
    { tone: 'info', title: 'Cari fiyat kontrolü', detail: 'Cari ve fiyat kontrolünü yap', screenId: 'customer-list' },
    { tone: 'info', title: 'WhatsApp paylaşım hazır', detail: 'Katalog gönderim listesini gör', screenId: 'whatsapp-planner' },
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
    <aside className={isCollapsed ? 'smart-panel collapsed' : 'smart-panel'} aria-label="Bugün önemli">
      <div className="smart-panel-header">
        <span><TrendingUp size={16} /> Bugün önemli</span>
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
      <p className="smart-panel-context">{activeContext} açıkken öne çıkan kısa yollar</p>
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
        Bu panel sadece ekran açar; kayıt, finalize veya canlı DB yazımı yapmaz.
      </div>
    </aside>
  );
}
