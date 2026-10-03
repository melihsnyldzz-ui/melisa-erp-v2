import { screenRegistry, sidebarGroups } from '../data/mockNavigationData.js';

const pinnedCommands = [
  { label: 'Yeni Satış Fişi', screenId: 'sales-invoice', hint: 'Satış işlemi ekranını aç' },
  { label: 'Stok Listesi (Vega)', screenId: 'stock-list', hint: 'Mevcut Vega stok listesini aç' },
  { label: 'Müşteri Cari Listesi', screenId: 'customer-list', hint: 'Müşteri hesaplarını aç' },
  { label: 'Rapor Merkezi', screenId: 'reports-overview', hint: 'Yönetim ve operasyon raporları' },
];

export function buildScreenCommands(typeLabel = (value) => value) {
  const fromSidebar = sidebarGroups.flatMap((group) => group.items.map((item) => ({
    label: item.label,
    screenId: item.screenId,
    module: screenRegistry[item.screenId]?.module || group.title,
    group: group.title,
    hint: group.title,
  })));
  const fromRegistry = Object.values(screenRegistry).map((screen) => ({
    label: screen.label,
    screenId: screen.id,
    module: screen.module,
    group: typeLabel(screen.type),
    hint: `${screen.module} / ${typeLabel(screen.type)}`,
  }));
  const seen = new Set();
  return [...pinnedCommands, ...fromSidebar, ...fromRegistry]
    .filter((command) => {
      const screen = screenRegistry[command.screenId];
      if (!screen || screen.hiddenFromNavigation || seen.has(command.screenId)) return false;
      seen.add(command.screenId);
      return true;
    })
    .map((command) => ({
      id: `screen-${command.screenId}`,
      kind: 'screen',
      typeLabel: 'Ekran',
      module: screenRegistry[command.screenId].module,
      group: 'Hızlı işlem',
      ...command,
    }));
}
