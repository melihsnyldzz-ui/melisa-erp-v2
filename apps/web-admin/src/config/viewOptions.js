export const defaultViewOptions = {
  simpleMode: false,
  focusMode: false,
  showSidebar: true,
  showTabs: true,
  showStatusBar: true,
  showSmartPanel: true,
  smartPanelCollapsed: false,
  showFilters: true,
  showKpis: true,
  showSummaries: true,
  showToolbarSubtitles: true,
  showConnectionDetails: true,
  compactRows: true,
};

export const viewOptionsStorageKey = 'melisaErpViewOptions';

const globalViewOptions = [
  { key: 'simpleMode', label: 'Sade mod', description: 'Daha az kalabalik, daha genis calışma alani' },
  { key: 'focusMode', label: 'Odak modu', description: 'Menu ve yardimci panelleri gecici gizle' },
  { key: 'showSidebar', label: 'Sol modül paneli', description: 'Ekran listesini göster/gizle' },
  { key: 'showSmartPanel', label: 'Akıllı özet paneli', description: 'Bugün önemli kısayollarını göster/gizle' },
  { key: 'smartPanelCollapsed', label: 'Ozet panelini daralt', description: 'Sag paneli ince bir kisayol seridine cevir' },
  { key: 'showTabs', label: 'Sekmeler', description: 'Açık pencereleri göster/gizle' },
  { key: 'showStatusBar', label: 'Alt durum cubugu', description: 'Firma, oturum ve durum bilgileri' },
];

const contextualViewOptions = {
  dashboard: [
    { key: 'showKpis', label: 'KPI kartlari', description: 'Dashboard ozet kartlari' },
    { key: 'showSummaries', label: 'Alt ozetler', description: 'Ekran sonundaki bilgi satırlari' },
  ],
  liste: [
    { key: 'showFilters', label: 'Filtre paneli', description: 'Liste arama ve filtre alanlari' },
    { key: 'showSummaries', label: 'Liste özeti', description: 'Seçim ve kayıt bilgileri' },
  ],
  ozet: [
    { key: 'showKpis', label: 'KPI kartlari', description: 'Rapor ozet kartlari' },
    { key: 'showSummaries', label: 'Rapor özeti', description: 'Kaynak ve yetki bilgileri' },
  ],
  fis: [
    { key: 'showFilters', label: 'Fiş yardımcı alanları', description: 'Seçim ve kontrol panelleri' },
    { key: 'showSummaries', label: 'Fiş özeti', description: 'Alt bilgi ve hesap özetleri' },
  ],
  kart: [
    { key: 'showSummaries', label: 'Kart özeti', description: 'Alt bilgi ve hızlı özetler' },
  ],
};

const helperOptions = [
  { key: 'showToolbarSubtitles', label: 'Baslik aciklamalari', description: 'Toolbar alt metinlerini göster/gizle' },
  { key: 'showConnectionDetails', label: 'Bağlantı detayları', description: 'API/SQL durum bloklarını göster/gizle' },
  { key: 'compactRows', label: 'Kompakt tablo satırlari', description: 'Listelerde daha fazla satır goster' },
];

export function getViewOptionItems(activeTab) {
  const screenType = activeTab.type || 'dashboard';
  const screenOptions = contextualViewOptions[screenType] || contextualViewOptions.dashboard;
  return [...globalViewOptions, ...screenOptions, ...helperOptions];
}

export function readStoredViewOptions() {
  try {
    const stored = window.localStorage.getItem(viewOptionsStorageKey);
    return stored ? { ...defaultViewOptions, ...JSON.parse(stored) } : defaultViewOptions;
  } catch (error) {
    return defaultViewOptions;
  }
}
