# Vega 2026 → Yeni ERP migration şartnamesi ve uygulama durumu

Karar sahibi: işletme sahibi, 17.09.2026 tarihli 18 maddelik doğrudan talimat.
Tek hedef: `Semih\MELISADEV / MELISA_ERP_FULL_TEST_20260916`.
Kaynak: `VEGA2026`, yalnız SELECT ve etkin yazma yetkileri reddedilmiş bağlantı.

## Durum

**COMMITTED_AWAITING_INDEPENDENT_VERIFICATION.** İşletme sahibinin devam
talimatıyla `native-spec-20260917-02` native TEST aktarımı commit edildi ve
başarılı kayıtlar geri alınmadı. [Kalıcı run, native model ve açık kararlar](vega-native-migration-run-2026-09-17.md)
ayrı kayıttadır. Vega ↔ Yeni ERP nihai karşılaştırması ve kabulü ChatGPT'ye
bırakılmıştır. Aşağıdaki `spec-20260917-01` kanıtları önceki kaynak inceleme
aşamasını tarif eder; native aktarımın yerine geçmez.

Yeni giriş noktaları `vega-migration-spec-*.mjs` dosyalarıdır. Eski
`vega-full-cutover-persist-20260917.mjs` temizleme ve tek dönem varsayımları
içerdiğinden bu şartname için tekrar çalıştırılmamalıdır.

## Onaylı iş kuralları

| No | Kural ve korunacak veri |
|---|---|
| 1 | Aktif kartların tamamı, sıfır stok dahil; pasif kartlardan sıfır olmayanlar taşınır. Pasif sıfır kartlar yeni kapsama alınmaz. Eksi miktar aynen korunur ve ayrıca raporlanır. Stok kodu, marka, kategori, not, alış ve tüm satış fiyatları korunur. Resim kapsam dışıdır. |
| 2 | Bütün barkodlar aynı ürün kimliğine bağlanır. Ticari birim ADET; farklı teknik birim ID'leri, ADET/çarpan 1 ise aynı birimdir. Çakışan barkod raporlanır. Gerçek mükerrer birleştirmesi barkod ve ad/model kanıtına bağlıdır; kararsız eşleşme otomatik uygulanmaz. Birleştirilen kodlar kaynak alias'ı olarak saklanır. |
| 3 | Farklı kaynak depolar MERKEZ'e toplanır; toplam işaretli miktar değişmez. Aynı depo snapshot'ı iki defa toplanamaz. F0103/F0104 ürün ad alanı, kanıtsız ikinci fiziksel stok sayılmaz. |
| 4 | Açılış yanında stok hareketleri, giriş/çıkış fişleri ve gerçek iadeler taşınır. Belge numarası ve özgün tarih korunur. Başlangıç 01.01.2020; daha geç başlangıç yalnız tarih ve karar referansı içeren işletme sahibi onayıyla mümkündür. Önceki stok/cari devirleri kaybolamaz. |
| 5 | F0102/MELİSA BEBE müşteri kaynağıdır. `1-PEŞİN $`, `2-PEŞİN TL`, `3-PEŞİN €` ayrı genel müşterilerdir. Gerçek müşterinin farklı döviz kartları kanıtlı tek müşteri altında ayrı hesaplar olur. Kod, telefon, adres, ülke ve kart alanları korunur. Yalnız biçim/boşluk temizliği yapılır; belirsiz ad tahmin edilmez. |
| 6 | F0103/MELİSA MUHASEBE tedarikçi kaynağıdır; PAKEL, NOYNOY, AYLİN BEBE, BEBECİX, BABUSH, BONCUK BEBE vb. bu roldedir. Farklı döviz kartları kanıtlı tek tedarikçide ayrı hesaplar olur. F0104/FATURA'nın rolü ve belge ilişkileri incelemeye tabidir; otomatik müşteri/tedarikçi veya ikinci belge etkisi oluşturulmaz. |
| 7 | Pasif cari; bakiyesi veya seçilen dönemde hareketi/belgesi varsa dahil edilir. İkisinin de yokluğu kanıtlanırsa hariç tutulur. Eksik veri sıfır kabul edilmez. |
| 8 | Fatura, satır, stok bağlantısı, tahsilat, ödeme, cari/finans hareketi, iade ve notlar geçmişiyle korunur. Son bakiye geçmişin sonucu olarak doğrulanır. |
| 9 | Başlangıç devirleri açık `Vega Devir Bakiyesi` hareketidir. USD/EUR/TRY ayrı kalır; keyfi dönüşüm yoktur. Her yılın devir belgesi yeniden ticari hareket sayılmaz. Başlangıç 2020 olsa da 2020 öncesinden gelen kanıtlı devir korunur. |
| 10 | Alış faturası, satırları, ürün/adet/fiyat/indirim/toplam ve stok giriş fişleri korunur. Aynı olayın stok etkisi yalnız bir kez oluşturulur. |
| 11 | Müşteri satışının esas stok belgesi Stok Çıkış Fişidir. Fatura ile aynı olay bağlantısı kanıtlıysa belge izleri korunarak satış/stok etkisi tekleştirilir. |
| 12 | İptal belgeleri ile bağlı stok/cari etkileri hedefe uygulanmaz. Kaynak inceleme arşivinde hariç tutma kanıtı olarak tutulabilirler. Gerçek iade iptal sayılmaz. |
| 13 | MERKEZ fiziksel nakit kanıtı değildir. Cari, finans, belge ve not ilişkisi korunur; açık kaynak yöntemi yoksa UNKNOWN kalır. Aynı finansal olay iki defa oluşturulmaz. PAKEL 23.01.2026: 16.310 USD ↔ 701.330 / 43 kaynak ilişkisi zorunlu kabul vakasıdır. |
| 14 | Çek, senet ve sipariş geçmişi migration kapsamı dışındadır. |
| 15 | AHM, MEH, TUR, ANG vb. özgün ön ekler kaybolmaz. Kesin personel kimliği eşleşmesi yoksa aday liste üretilir; kişi tahmini yapılmaz. Personel bazlı geçmiş raporlama tamamlanmadan kabul verilmez. |
| 16 | Ürün, marka, müşteri, ülke, satış personeli, yıl/dönem, ürün hareketi ve cari hareketi rapor boyutları korunur. |
| 17 | Ürün, barkod, işaretli stok, cariler, ayrı döviz bakiyeleri, tüm belge ve satırlar, fiyat/indirim, iadeler, finans, tarih/numara, marka/kategori, personel ve notlar kayıt bazında karşılaştırılır. Önce özet, sonra kaynak kimlikli detay dosyası. Eksik doğrulama PASS değildir. |
| 18 | Canlı ERP'ye yazma yoktur. TEST hedef kimliği zorunludur. Önce doğrulanmış COPY_ONLY/CHECKSUM yedeği; otomatik restore/temizleme yoktur. Başarılı TEST kayıtları rollback edilmez. Vega'ya gitmemiş terminal kayıtları ve ilişkileri hash ile korunur. Kaynak, karar, plan, hedef ve farklar denetlenebilir olmalıdır. |

Satır indirimlerini tarihçede özgün biçimiyle koruma şartı, yeni satış girişinin
fiş geneli yüzde indirimi kuralını değiştirmez. Mevcut native model kaynak satırını
ifade edemiyorsa fiyat veya iskonto değiştirilerek uyum sağlanmaz; adaptör/model
eksikliği raporlanır. Teknik eşleşme yetersizliği ticari karar uydurularak çözülmez.

## Uygulanan kod

- `apps/api/src/services/vegaMigrationSpecification.mjs`: iş kuralları, kayıpsız
  ondalık işlemler, kapsam, barkod/kimlik grupları, döviz hesap ayrımı, tarih/devir,
  belge/etki tekilleştirme, iptal/iade, personel, PAKEL ve 32 doğrulama boyutu.
- `apps/api/scripts/vega-migration-spec-preflight.mjs`: etkin SELECT-only izinlerini,
  2020–2026 dönemlerini, tabloları, tam kart/birim alanlarını ve yalnız TEST hedefini
  inceler. Kaynak kartları iki okumada hash ile doğrular. Gizli ve resim alanları
  dışarıda bırakılır; ticari ham veri repo dışında saklanır.
- `apps/api/scripts/vega-migration-spec-plan.mjs`: eski tek barkod/pasif kart eleme
  varsayımları yerine yeni kuralları gerçek snapshot'a uygular; kaynak kodları ve
  negatif miktarlar değişmeden kalır. Belirsiz kararlar ayrı listelenir.
- `apps/api/scripts/vega-migration-spec-history.mjs`: bütün seçili yıllardaki
  desteklenen ticari başlık, satır ve hareket tablolarını sayfalayarak JSONL'a alır;
  ikinci okumayla doğrular. Dönemler arası aynı IND çakışmaz. Cari genel bağlantı
  kaydı ikinci cari etkisi sayılmaz. Fiziksel finans yöntemi tahmin edilmez.
- `apps/api/scripts/vega-migration-spec-backup.mjs`: TEST hedefi ve plan hash'ini
  doğrular, hedefin plan sonrası değişmediğini kontrol eder, yedek alır ve
  `RESTORE VERIFYONLY` uygular; veritabanı restore etmez.
- `apps/api/scripts/vega-migration-spec-report.mjs`: arşiv hash'lerini yeniden
  doğrular, native belge kaynak izlerini, temel alanları ve ilişki incelemelerini
  ayrıntılarıyla raporlar. Bütün boyutlar için nihai migration kabulü vermez.

## Tekrar üretme

Repo kökünden, daha önce kullanılmamış bir run adı ile:

```powershell
node apps/api/scripts/vega-migration-spec-preflight.mjs YENI_RUN
node --max-old-space-size=4096 apps/api/scripts/vega-migration-spec-plan.mjs YENI_RUN
node --max-old-space-size=4096 apps/api/scripts/vega-migration-spec-history.mjs YENI_RUN
node apps/api/scripts/vega-migration-spec-backup.mjs YENI_RUN --backup-test
node --max-old-space-size=4096 apps/api/scripts/vega-migration-spec-report.mjs YENI_RUN
```

Yedek komutu yalnız açıkça onaylanmış TEST yedek işlemi içindir. Mevcut denemeler
üzerine yazılmaz. Hata/yarım koşu otomatik tekrar edilmez; yeni run yeni kanıttır.
Bu inceleme komutlarında **apply modu yoktur**. Kalıcı TEST yazıcısı
`vega-native-migration-run.mjs` ve ilgili adaptörlerdir; native run belgesindeki
hedef, yedek, kaynak hash ve terminal koruma sınırlarıyla çalışır. Bağımsız kabul
migration çalıştırıcısının görevi değildir.

Özel kayıtlar: `%LOCALAPPDATA%\MelisaERPServer\migration-spec\<run>`.
Özetler: `artifacts/migration-spec-20260917/`. Özel kayıtlar, yedekler ve işletme
verileri Git'e eklenmemelidir.

## 17.09.2026 doğrulama kanıtı

Run: `spec-20260917-01`. Başlangıç 2020 olarak kaldı. Kaynakta 6.664 tablo için
SELECT izinleri ve INSERT/UPDATE/DELETE/ALTER/CONTROL yokluğu kontrol edildi.
6.663 tablo envanteri alındı; 2020–2021'in incelenen çekirdek belge/satır/hareket
kolonlarında 2026'ya göre ad/tip farkı bulunmadı. Tarih taşmaları vardır: örneğin
2020 döneminde 2021 tarihli belgeler, bazı dönemlerde 2020 öncesi tarihler bulunur.
Yıl etiketinden tarih tahmini yapılamaz; bunun için başlangıç yılı değiştirilmedi.

Kaynakta 52.761 stok kartı, 56.321 teknik birim kaydı incelendi. İlk kapsam planı:
16.477 dahil kart, 36.268 pasif/sıfır hariç kart, 16 belirsiz kapsam.
Belirsizlerin 13'ünde miktar alanı null, 3'ünde faaliyet durumu belirsizdir.
Bu 13 miktar teknik birim kimliği farkı yüzünden UNKNOWN yapılmadı; gerçekten
kaynak miktar kanıtı eksiktir. 1.910 eksi kart ayrı listelendi.

İlk TEST karşılaştırması 49 barkod çakışması, 1.120 eksik/uyumsuz barkod eşleşmesi,
3.063 ürün alanı/kimlik fark kaydı, 100 stok farkı ve 12 eksik kesin kod/döviz
cari eşleşmesi üretti. Bunlar migration öncesi farklardır; 100 stok farkından
korunan terminal etkileri henüz düşülmemiştir. İptal etkisi, birleşen ürün ve
devir doğrulaması tamamlanmadan bu sayılar nihai kabul sayılmaz. Önceden TEST'e
ithal edilmiş fakat yeni kapsam dışında kalan kartlar silinmedi.

733 ticari tablodan 1.229.733 satır ve bunların içinde 61.441 başlık özel alana
arşivlendi; tablo bazında iki okuma eşleşti. Arşiv, tarih aralığı dışı/devir ve
iptal kayıtlarını inceleme kanıtı olarak da içerir; bu sayılar hedefe taşınacak
belge sayıları değildir. İki ardışık okumanın eşit olması atomik kesim garantisi
vermez. Kaynak tarihçenin arşivlenmesi native ERP'ye taşınması değildir.

PAKEL kaynak doğrulaması: `F0103D0007TBLCARIHAREKETLERI/297`,
`F0103D0007TBLKASA/107` ve `F0103D0007TBLCARCIKBASLIK/107` ilişkisi doğrulandı.
`16.310 × 43 = 701.330`; finans hesabı MERKEZ, yöntem UNKNOWN.
Bu kaynak doğrulamasıdır; yeni hedefteki karşılığın kabulü henüz yapılmadı.

TEST yedeği `PASS_VERIFIED_TEST_BACKUP`; COPY_ONLY, CHECKSUM ve VERIFYONLY geçti.
Yedek GUID: `08DA5C09-E915-4C9E-A3E7-BD833D260129`, boyut 660.177.920 bayt.
Yedek öncesi hedef iş tablolarının plan snapshot'ıyla aynı olduğu doğrulandı.
Restore yapılmadı. Terminal fişleri `10059`, `10060`, `10061` ve kuyruk kayıtları
koruma manifestinde bulunuyor; hiçbir iş verisi yazılmadı.

## 17.09.2026 ek kesin kural: 2026 cari açılışı

01.01.2026 müşteri/tedarikçi bakiyesinde Vega'nın açık devir kaydı esas alınır.
2020–2025 geçmişi değiştirilmez; fark her cari ve döviz için kaynak açılışa bağlı
`Vega 2026 Devir Düzeltmesi` hareketiyle tamamlanır. Dövizler çevrilmez, devir
ikinci kez sayılmaz. Açılış kaydı yokluğu sıfır kabul edilmez.
TEST uygulaması ve kapsamı: [2026 açılış patch raporu](vega-2026-opening-patch-2026-09-17.md).

## İlk şartname arşivi sırasında tamamlanmamış zorunlu işler

1. Tek müşteri/tedarikçi altında bağımsız döviz hesaplarını destekleyen native
   şema ve servisler; mevcut kartta tek `currency_code` ve `balance` bulunuyor.
2. Kaynak indirimlerini/notlarını kayıpsız koruyan tüm native tarihçe adaptörleri,
   iadeler ve genel finans hareketleri. Mevcut satış satırında indirim alanı yok.
3. İnceleme durumundaki kaynak ilişkileri, yıllık devir tekilleştirmesi, F0104
   bağlantıları ve mükerrer kart/cari kararları.
4. Özgün ön ek → kişi eşleştirmesi. Listede AHM/MEH/TUR/ANG yanında A/Z/VER/MELISA
   ve ön eksiz eski belgeler de var; isim uydurulmadı.
5. Güncel plan/yedek/koruma kanıtına bağlı TEST apply, tekrar çalıştırmada
   mükerrerlik kontrolü ve 32 boyutun tamamında kayıt bazında karşılaştırma.
6. Başarılı kayıtları TEST'te bırakarak ChatGPT Yeni ERP bağlantısından bağımsız
   okuma. Bu oturumda Yeni ERP connector aracı mevcut değildi; localhost/SQL
   erişimi connector doğrulaması olarak gösterilmedi.

Yeni kural ve mevcut regression testleri: **41/41 PASS**. İşletme kabulü, native apply ve canlıya geçiş
PASS değildir. Commit, push veya dağıtım yapılmadı; çalışma ağacındaki önceki
değişiklikler korundu.

Son kayıt düzeyi raporda 896 native satış/alış belgesinin doğrudan kaynak izi
eşleşti; bu eşleşenlerde 2 alan farkı bulundu. 32.317 kaynak belgede doğrudan native
fatura kaynak izi bulunamadı. Bu sayı aynı ticari olayın kanıtlı fiş/fatura
bağlantısıyla açıklanabilecek kayıtları da içerebilir; tek başına 32.317 ayrı eksik
ticari olay iddiası değildir. Finans belgeleri ayrı hareket eşlemeleri kullanır.

Cari genel hareket tablosunun `BELGEIND/ISLEMIND` alanları iki belge bağlantısı
olarak ayrıca incelendi. 36.089 kayıt ek finans etkisi oluşturmayan ilişki olarak
korundu. Son raporda 17.786 ilişki inceleme bekliyor. İlk arşiv manifestindeki
53.875 ilişki inceleme sayısı, ilk bağlantı kurallarının çıktısıdır; güncel sayı
`report/relation-counts.json` içindedir. Ham kaynak arşivi değiştirilmedi.
