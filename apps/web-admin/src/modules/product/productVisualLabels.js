const fields = { colors: 'Renk', patterns: 'Desen', details: 'Görünen detaylar', sleeves: 'Kol', style: 'Görünüm' };
const values = {
  WHITE: 'Beyaz', CREAM: 'Krem', BEIGE: 'Bej', BROWN: 'Kahverengi', PINK: 'Pembe', RED: 'Kırmızı',
  ORANGE: 'Turuncu', YELLOW: 'Sarı', GREEN: 'Yeşil', BLUE: 'Mavi', PURPLE: 'Mor', GRAY: 'Gri', BLACK: 'Siyah', MULTICOLOR: 'Çok renkli',
  SOLID: 'Düz', FLORAL: 'Çiçekli', STRIPED: 'Çizgili', CHECKED: 'Kareli', POLKA_DOT: 'Puantiyeli', ANIMAL_MOTIF: 'Hayvan motifli', GEOMETRIC: 'Geometrik', TEXT_PRINT: 'Yazı baskılı',
  HOOD: 'Kapüşon', BOW: 'Fiyonk', RUFFLE: 'Fırfır', LACE: 'Dantel görünümü', EMBROIDERY: 'Nakış görünümü', POCKET: 'Cep', BUTTONS: 'Düğme', ZIPPER: 'Fermuar', FOOTED: 'Patikli', COLLAR: 'Yaka',
  SLEEVELESS: 'Kolsuz', SHORT: 'Kısa kol', LONG: 'Uzun kol', PLAIN: 'Sade', CLASSIC: 'Klasik', SPORTY: 'Spor', DECORATIVE: 'Süslü',
};
const statuses = { VERIFIED: 'İnsan tarafından doğrulandı', AUTO_DERIVED: 'Otomatik analiz · kullanılabilir', REVIEW: 'İnceleme bekliyor', UNKNOWN: 'Bilinmiyor', STALE: 'Fotoğraf değişti · inceleme gerekli', REJECTED: 'Reddedildi' };
export const visualFieldLabel = (key) => fields[key] || 'Görsel özellik';
export const visualValueLabel = (value) => values[value] || 'Bilinmiyor';
export const visualStatusLabel = (status) => statuses[status] || 'Bilinmiyor';
