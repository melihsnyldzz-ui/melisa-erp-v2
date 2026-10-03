export const defaultViewOptions = {
  darkMode: false,
  simpleMode: true,
  focusMode: false,
  showSidebar: true,
  showTabs: true,
  showStatusBar: true,
  showSmartPanel: false,
  smartPanelCollapsed: false,
  showFilters: true,
  showKpis: true,
  showSummaries: false,
  showToolbarSubtitles: false,
  showConnectionDetails: false,
  compactRows: false,
  rowDensity: 'normal',
};

export const viewOptionsStorageKey = 'melisaErpViewOptions';

export const simpleViewPreset = {
  darkMode: false,
  simpleMode: true,
  focusMode: false,
  showSidebar: true,
  showTabs: true,
  showStatusBar: true,
  showSmartPanel: false,
  smartPanelCollapsed: false,
  showFilters: true,
  showKpis: true,
  showSummaries: false,
  showToolbarSubtitles: false,
  showConnectionDetails: false,
  compactRows: false,
  rowDensity: 'normal',
};

export const detailedViewPreset = {
  darkMode: false,
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
  rowDensity: 'compact',
};

const globalViewOptions = [
  { key: 'darkMode', label: 'Koyu mod', description: 'Koyu arka plan ve düşük parlaklık' },
  { key: 'simpleMode', label: 'Sade mod', description: 'Daha az kalabalık ve daha geniş çalışma alanı' },
  { key: 'focusMode', label: 'Odak modu', description: 'Menüyü ve yardımcı panelleri geçici olarak gizle' },
  { key: 'showSidebar', label: 'Sol modül paneli', description: 'Ekran listesini göster/gizle' },
  { key: 'showSmartPanel', label: 'Akıllı özet paneli', description: 'Bugün önemli kısayollarını göster/gizle' },
  { key: 'smartPanelCollapsed', label: 'Özet panelini daralt', description: 'Sağ paneli ince bir kısayol şeridine çevir' },
  { key: 'showTabs', label: 'Sekmeler', description: 'Açık pencereleri göster/gizle' },
  { key: 'showStatusBar', label: 'Alt durum çubuğu', description: 'Firma, oturum ve durum bilgileri' },
];

const contextualViewOptions = {
  dashboard: [
    { key: 'showKpis', label: 'Özet bilgi kartları', description: 'Ana sayfa özet kartları' },
    { key: 'showSummaries', label: 'Alt özetler', description: 'Ekran sonundaki bilgi satırları' },
  ],
  liste: [
    { key: 'showFilters', label: 'Filtre paneli', description: 'Liste arama ve filtre alanları' },
    { key: 'showSummaries', label: 'Liste özeti', description: 'Seçim ve kayıt bilgileri' },
  ],
  ozet: [
    { key: 'showKpis', label: 'Özet bilgi kartları', description: 'Rapor özet kartları' },
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
  { key: 'showToolbarSubtitles', label: 'Başlık açıklamaları', description: 'Üst araç çubuğu açıklamalarını göster/gizle' },
  { key: 'showConnectionDetails', label: 'Bağlantı ayrıntıları', description: 'Uygulama ve veritabanı bağlantı durumlarını göster/gizle' },
  { key: 'compactRows', label: 'Sık tablo satırları', description: 'Listelerde daha fazla satır göster' },
  {
    key: 'rowDensity',
    label: 'Tablo yoğunluğu',
    description: 'Satır aralığı: sıkı / normal / rahat',
    type: 'select',
    values: [
      { value: 'compact', label: 'Sıkı' },
      { value: 'normal', label: 'Normal' },
      { value: 'comfortable', label: 'Rahat' },
    ],
  },
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
