const screenTypeLabels = {
  dashboard: 'ana ekran',
  izleme: 'izleme',
  liste: 'liste',
  kart: 'kart',
  islem: 'işlem',
  hareket: 'hareket',
  rapor: 'rapor',
  ekstre: 'ekstre',
  fis: 'fiş',
  operasyon: 'operasyon',
  ozet: 'özet',
  belge: 'belge',
  defter: 'defter',
  kontrol: 'kontrol',
  plan: 'plan',
  kuyruk: 'kuyruk',
  'gelen-kutusu': 'gelen kutusu',
  import: 'aktarım',
  ayar: 'ayar',
};

export function screenTypeLabel(value) {
  return screenTypeLabels[value] || String(value || '');
}
