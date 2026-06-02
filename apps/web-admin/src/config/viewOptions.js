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
  { key: 'simpleMode', label: 'Sade mod', description: 'Daha az kalabalik, daha genis calisma alani' },
  { key: 'focusMode', label: 'Odak modu', description: 'Menu ve yardimci panelleri gecici gizle' },
  { key: 'showSidebar', label: 'Sol modul paneli', description: 'Ekran listesini goster/gizle' },
  { key: 'showSmartPanel', label: 'Akilli ozet paneli', description: 'Bugun onemli kisayollarini goster/gizle' },
  { key: 'smartPanelCollapsed', label: 'Ozet panelini daralt', description: 'Sag paneli ince bir kisayol seridine cevir' },
  { key: 'showTabs', label: 'Sekmeler', description: 'Acik pencereleri goster/gizle' },
  { key: 'showStatusBar', label: 'Alt durum cubugu', description: 'Firma, oturum ve durum bilgileri' },
];

const contextualViewOptions = {
  dashboard: [
    { key: 'showKpis', label: 'KPI kartlari', description: 'Dashboard ozet kartlari' },
    { key: 'showSummaries', label: 'Alt ozetler', description: 'Ekran sonundaki bilgi satirlari' },
  ],
  liste: [
    { key: 'showFilters', label: 'Filtre paneli', description: 'Liste arama ve filtre alanlari' },
    { key: 'showSummaries', label: 'Liste ozeti', description: 'Secim ve kayit bilgileri' },
  ],
  ozet: [
    { key: 'showKpis', label: 'KPI kartlari', description: 'Rapor ozet kartlari' },
    { key: 'showSummaries', label: 'Rapor ozeti', description: 'Kaynak ve yetki bilgileri' },
  ],
  fis: [
    { key: 'showFilters', label: 'Fis yardimci alanlari', description: 'Secim ve kontrol panelleri' },
    { key: 'showSummaries', label: 'Fis ozeti', description: 'Alt bilgi ve hesap ozetleri' },
  ],
  kart: [
    { key: 'showSummaries', label: 'Kart ozeti', description: 'Alt bilgi ve hizli ozetler' },
  ],
};

const helperOptions = [
  { key: 'showToolbarSubtitles', label: 'Baslik aciklamalari', description: 'Toolbar alt metinlerini goster/gizle' },
  { key: 'showConnectionDetails', label: 'Baglanti detaylari', description: 'API/SQL durum bloklarini goster/gizle' },
  { key: 'compactRows', label: 'Kompakt tablo satirlari', description: 'Listelerde daha fazla satir goster' },
];

export function getViewOptionItems(activeTab) {
  const screenType = activeTab?.type || 'dashboard';
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
