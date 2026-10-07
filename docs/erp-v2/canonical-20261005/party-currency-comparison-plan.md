# Goal7.1 — ayrı döviz karşılaştırması ve kalan aktarım planı

**7 Ekim Goal7.2 devam kaydı:** Bu eski yakalama ve araştırma korunur. Dört eksik bağın hedefinin gerçekten bulunmadığı,ayrı yeni kart gereksinimi;57hesabın carry/dönem belge zinciri ve güncel10cari kaynak değişimi [yeni planda](party-currency-transfer-readiness.md) kayıtlıdır. Aşağıdaki eski LL genel soru listesi tekrar sorulmaz;önceki+5deneme açıklaması ve gerçek104açılışbelge kökeni yeni kayıtta ayrıldı. Tarihli bağımsız rapor olmadanfinance-ready0,holdlift0;ERP-UA24bekler.

7 Ekim 2026; ERP-DEC-021 ve kullanıcının Goal7.1 talimatı. Bu teslim okuma, gösterim ve plandır; finans yazması, hold kaldırma veya insan kabulü değildir.

## Kaynak ve kapsam

PR23 [6033375310 karşılaştırma notundaki](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6033375310) 14 cari / 26 grup incelemesi yeniden yapılmadı. Bunun üzerine eski paketteki 122 cari ile 85 değişmiş carinin karantina dışında kalan 78'i incelendi. Yedi örtüşen cari ikinci kez sayılmadı.

| Ölçüm | Sonuç |
| --- | ---: |
| Cari kapsamı | 200: 56 müşteri, 144 tedarikçi |
| Eski karantina / dışarıda değişmiş | 122 / 78 |
| Kesin native kaynak bağı / bağ eksikliği | 196 / 4 |
| Ayrı ham döviz grubu | 209 |
| Hesaplanabilen kayıtlı hareket neti | 124 |
| Dönemde hareket olmayan grup | 83 |
| Bilinmeyen döviz grubu | 2 |
| Birden fazla dövizli cari | 9 |
| Gerçek hesaplanmış sıfır net | 10 |
| Tekil dönem hareketi / bağımsız SQL grup kontrolü | 3.799 / 192; fark 0 |
| Kaynak matematiği ve kimliği hazır salt okunur hesap | 120 |
| Açılış + yerel etkileri native hesap ve defterle mutabık hesap | 84 / 84 |
| Güncel kaynak + aynı yerel etkileri native ile eşit hesap | 7 |
| Sayısal delta adayı / sıfır dışı aday | 84 / 77 |
| Finans uygulanabilirliği tamamlanmış veya uygulanan hesap | 0 |

Cari sayısı, döviz hesabı sayısından ayrıdır. 120 hesap kimlik ve kaynak matematiği kontrolüdür; güncel ticari bakiye veya native eşitliği değildir. Dört kaynak kartı başka kişiye tahminle bağlanmadı.

Kaynak DESKTOP-KSRK0EQ / VEGA2026; F0102 ve F0103, D0007 gerçek 2026 dönemi. Kaynak 7 Ekim 12:06:10–12:06:11 Türkiye saatinde, native kanıtları 12:06:14'e kadar SELECT ile yakalandı. Aralık 1 Ocak dahil, 8 Ekim hariçtir. On beş projection iki geçişte sabittir; tablolar arası atomik snapshot iddia edilmez.

30 Eylül kabul edilmiş açılışı ayrı tutulur. Bu yakalama canlı bağlantı veya finans delta uygulaması değildir. Normal kartta yakalama tarihli kaynak neti mevcut ERP bakiyesine eklenmez.

## Bakiye ve yön sözleşmesi

- Cari türü, müşteri/tedarikçi rolü, her hesabın dövizi/tutarı/B-A yönü korunur. Varsayılan döviz diğer hesapları gizlemez.
- ERP bakiyesi mevcut okuyucunun kabul edilmiş açılış + yerel etkiler = native hesap = native defter kanıtıyla gösterilir. Müşteri native pozitif B, tedarikçi native pozitif A'dır; ters yönler ve küçük tutarlar korunur.
- Kaynak tanısal neti (BORC − ALACAK) / pozitif kayıtlı KUR esasındadır. Kaynak pozitif B, negatif A'dır; cari rolü bunu değiştirmez. SQL'in gerçek decimal bölme/CAST davranışı bağımsız tam sayı modeliyle yeniden üretildi; kayan nokta kullanılmadı.
- Genel Bakiye veya ham kart BAKIYE netin yerine konulmaz veya üzerine eklenmez. Kaynak hareket neti tamamen kanıtlanmış ticari bakiye ilan edilmez.
- 1 Ocak 103/104 yalnız **açılış adayıdır**: 86 satır / 82 cari. Dönem ve 30/31 ayrı kategoridir; bu kapsamda 30/31 satırı 0'dır. Açılış ikinci kez eklenmez.
- Hareket bulunamaması, doğrulanmış sıfır ve bilinmeyen ayrıdır. Hareketsiz 83 carinin 20'sinde 2025 geçmişi bulundu; 127 eski satır 2026'ya eklenmedi.
- (-), NULL, LL ve eksik kur tahminle çözülmez. Eksik miktar/kur 0; LL iki hesapta. Kaynak döviz sözlüğünde LL ve $2 karşılığı doğrulanamadı.

## qqq.xls karşılaştırması

Desktop ve Telegram kopyaları aynı SHA256'dadır. Döviz Bakiye ayrı hücrede, B/A tutarla birlikte, para birimi ayrı sütundadır. Tarih ve şirket/filtre kapsamı doğrulanamadığından güncel kaynakla aynı tarih/kapsam tutar mutabakatı **0** olarak kaydedilir. Dosya değişiklik zamanı rapor tarihi sayılmaz; Genel Bakiye referans alınmaz, (-) sıfır yapılmaz.

## Kalan işler ve gerçek işletme sorusu

Kapanan teknik konular: güncel kaynak/okuyucu ayrımı; 200 cari kapsamı; 196 kesin bağ; 3.799 hareketin decimal matematiği; 192 bağımsız SQL kontrolü; yön sözleşmesi; 84 açılış+yerel native mutabakatı; hareketsizliğin sıfır olmadığının ayrılması. Bunlar 122 ayrı kullanıcı sorusu değildir.

Kalan teknik araştırma:

1. Dört kaydın gerçek native kimlik bağı.
2. 103/104 açılış/devir ve iptal/30–31 belge anlamı, dönem tamlığı; sayısal benzerlik yetmez.
3. Tarihli, aynı şirket/kapsamlı Döviz Bakiye raporu; tarihsiz qqq güncel tutar kabulü değildir.
4. Hareketsiz hesapların açılış kanıtı; 2025 toplamını 2026'ya ekleme yok.

Tek kanıtlı işletme sorusu grubu: **İki LL hesabı hangi gerçek para birimini veya özel hesap kullanımını temsil ediyor?** Exact kimlikler ve gerekçeler private pakette. Kanıt bulunmayan özel/ortak hesap soruları üretilmedi.

## Önerilen güvenli aktarım

Bu tur finans uygulaması **0**; 122 karantina korunur. Sonraki ayrı uygulama için karantina dışındaki 84 sayısal hesap ve 77 sıfır dışı fark yalnız araştırma havuzudur:

1. Aynı tarih/şirket/dönem ve Döviz Bakiye anlamını belgelerle kanıtla; LL, hareketsiz ve kimliği eksik hesapları dışarıda tut.
2. Şirket+dönem+ID+rol+döviz; 30 Eylül kaynağı, yeni hash, native hesap/defter ve yerel hareketleri yeniden doğrula.
3. Kaynak delta = güncel net − kabul edilmiş kaynak neti. Tedarikçi native işaret eşlemesi ayrıca korunur. Beklenen native = kabul edilmiş native açılışı + yerel etkiler + eşlenmiş kaynak delta. Bakiye overwrite veya açılışı yeniden ekleme yok.
4. Yalnız kanıtı tamamlanan alt kapsam için immutable idempotent batch, bağımsız mutabakat, güncel backup ve sonraki yerel hareketi koruyan inverse planı hazırla. Finans uygulaması ve hold kaldırma ayrı açık kapsam ister.

## Kanıtlar

GitHub anonim yöntem/sayı/hash taşır; adlar, tutarlar, Excel ve ham kayıtlar repo dışındadır.

| Kanıt | SHA256 |
| --- | --- |
| Kaynak/bağ yakalaması | b6190bb8240d74e277b9247bd96eb50d24b0d9203883313b5565ee500780e3cb |
| Immutable ekran indeksi | 48750147ba237320e9158e641b5e53ccff50f780e0b1d06c6304bed7006c004a |
| qqq.xls | 2dcef8ca7e63ef02fb0e413e0aeb25d030e2b08877ffdbb28f6bff4a9fa83f31 |
| Bağımsız mutabakat | 929e1a65f35b333721432d468075944a1f607e1d265c3f0168173c82177e0fa5 |
| Private plan MD | 1fcb4c5963b655195770f8ab014e53d2ee2286d83db9b6f1a87475dba15cc39d |
| Private plan JSON | 288c6639ab2a79a10e787406c526db332fa3ddb0e81fe2e5ca3ee478ed2d7974 |
| 52 private kanıtın manifesti | 5d8bc8a60f67c4ebac425523dae4b447474502df17eb3b6502ea42d2a87e6863 |

Private plan: C:\Sirket\ERP\evidence\ERP-GOAL7.1-20261007\sql-private\PRIVATE_TRANSFER_PLAN_20261007.md ve private-transfer-plan-01.json.

Ekran indeksi: C:\Sirket\ERP\data\TEST-20260929-01\party-currency-comparison-goal71\index.json. Başlangıçta exact TEST kimliği/hash doğrulanır; belleğe alınır. Sayfa başına Vega taraması veya yeni ticari veritabanı yoktur.

ERP-UA24 insan kabulü bekler. D02/D06 renkleri ve finish toplamı korunur; finans uygulaması tamam sayılmaz. Goal7.1 tesliminden sonra durulur.
