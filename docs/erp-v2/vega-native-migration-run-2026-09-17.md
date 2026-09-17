# Kalıcı native TEST migration run

Run: `native-spec-20260917-02`.
Durum: `COMMITTED_AWAITING_INDEPENDENT_VERIFICATION`.
Tek hedef: `Semih\MELISADEV / MELISA_ERP_FULL_TEST_20260916`.
Kaynak: salt okunur olarak alınmış, hash doğrulamalı `spec-20260917-01`.
Başlangıç: 01.01.2020. Vega'ya veya canlı ERP'ye yazılmadı.

İşletme sahibinin doğrudan talimatı, şartname ve arşivle durmadan native
TEST kayıtlarının oluşturulmasını, güvenli kayıtların belirsizlerden bağımsız
aktarılmasını ve başarılı sonucun rollback edilmemesini kapsar. Başarılı
aşamalar commit edilmiştir. Başarısız/bitmemiş aşama denemeleri kendi
transaction'larında kaldı; daha önce commit edilen aşamalar geri alınmadı.
Nihai kaynak–hedef karşılaştırması migration tarafından başarılı ilan edilmez.

## Yazıcı ve güvenlik

Giriş: `apps/api/scripts/vega-native-migration-run.mjs`.
`runtime`, `store`, `adapters`, `masters`, `documents`, `movements`, `adoption`,
`preserve`, `readfields`, `finalize`, `backup`, `reader` modülleri ayrı
sorumlulukları taşır. Hedef kimliği bağlantıda doğrulanır. Writer Vega bağlantısı
açmaz; tarihçe dosyalarının içerik hash'lerini doğrular. Kaynak kimliği şirket,
dönem, tablo ve IND içerir. Mevcut native kayıtlar bu kimlikle veya tekil
kanıtlı eşleşmeyle yeniden kullanılır. Temizleme/reset/restore yoktur.

Yeni COPY_ONLY/CHECKSUM yedeği RESTORE VERIFYONLY ile doğrulandı; yedek GUID:
`473114AB-25E3-4706-8E5F-321A8F818546`. Üç terminal fişinin 105 satırı,
105 stok hareketi, 3 cari hareketi ve 3 kuyruk kaydı her commit öncesi aynı
özgün kolon/hash manifestiyle korundu. Yeni nullable kolonlar karşılaştırmanın
eski kolon projeksiyonunu değiştirmez.

Her başarılı aşamanın receipt'i, önceki hedef snapshot'ı, kaynak dosyaları,
karar ayrıntıları ve bağlantı kanıtı repo dışındadır:
`%LOCALAPPDATA%/MelisaERPServer/migration-spec/native-spec-20260917-02`.
SQL'de `migration_runs` ve `migration_decisions` bulunur. İşletme verileri,
yedekler, credentials ve özel loglar Git'e eklenmez.

## Native model

- `products`: 49.432 mevcut kayıt; 890 yeni ürün. Şartname kapsamındaki
  16.477 ürün `migration_scope_status=IN_SCOPE`. Önceden TEST'te bulunan
  32.955 kapsam dışı kart silinmedi ve `PRESERVED_PREEXISTING_OUTSIDE_SCOPE`
  olarak ayrıldı. Bunlar bu run'da yeni kapsam dışı ürün oluşturulduğu anlamına gelmez.
- 433 müşteri, 491 tedarikçi ve 1.040 ayrı döviz hesabı kaynak kimliğiyle
  bağlandı. `party_entities`, `party_currency_accounts`, `party_source_links`
  kimlik, döviz ve özgün kodları ayırır. Üç PEŞİN kartı ayrıdır. Tek başına
  benzer isim birleştirme kanıtı değildir.
- 19.061 satış, 11.221 alış, 208 iade, 2.322 stok ve 19.879 finans/cari
  belge başlığı native tablolardadır. 521.868 farklı kaynak satırı korunur.
  Önceki alış satırlarının 129'u yalnız kaynak toplamındaki eski hesaplama
  farkı nedeniyle ilk aşamada ayrı referans olmuştu. Fatura/ürün/adet/döviz/
  birim fiyatla çift yönlü tekil eşleşme kurularak mevcut satırlar kullanıldı;
  yardımcı kayıtlar `is_reference_only=1` ve canonical hedef kimliği taşır.
- 503.908 tarihsel stok hareketi `affects_inventory=0` ile tutulur.
  Operasyon stoğu önceki cutover ve 890 yeni ürün açılışı ile terminal
  hareketlerinden gelir; geçmişi eklemek ikinci stok etkisi oluşturmaz.
  Miktarlar işaretli olarak korunur, depo adı MERKEZ'dir.
- 28.662 müşteri, 23.759 tedarikçi ve 16.685 finans hareketi korunur.
  Gerçek kaynak ledger tutarı ve kaynak kuru kullanılır; dövizler birbirine
  keyfi çevrilmez. Yıllık devirler yeniden bakiye oluşturmaz. İlk erişilebilir
  döviz döneminin devri ayrıca işaretlenir. Önceki cari hareketlerin tamamı
  yeniden kullanıldı; terminal hareketleri ayrıdır.
- Aynı cari hareketin kanıtlı finans parçaları kendi kaynak anahtarlarını
  taşır. Native işlemler için eski tekillik koruması filtreli index olarak
  sürer; migration satırları kaynak kimliğiyle tekildir. `MERKEZ` yöntemi
  `unknown` kalır. PAKEL'in cari ve finans kayıtları aynı belgeye ve birbirine
  bağlıdır; bu, bağımsız kaynak karşılaştırması yapıldığı iddiası değildir.
- 35.759 genel cari belge ilişkisi `document_links` içinde ek mali etki
  oluşturmadan tutulur. 8 personel ön eki korunur; kişi adları tahmin edilmez.
- Altı satır indirimi ve dört belge indirimi sayısal kaynak alanlarıdır.
  Yerel/döviz alış fiyatları, fiyat seviyeleri, notlar ve kaynak hassasiyetindeki
  miktar/tutar alanları ayrıdır. Bilinmeyen maliyet/kâr sıfır sayılmaz.
  Cari ülke etiketi mevcut Vega servislerindeki TBLCARI.KOD1 eşlemesidir;
  etiketten coğrafi ülke tahmini yapılmaz. Önceki dolu iletişim alanları korunur.

## Açık kararlar ve erişim

1.120 eski barkod eksiğinin 834'ü ürün eşleşmesi, 286'sı mevcut ürünün
alternatif barkodu eksikliğidir. 1.115 çözüldü, 5 sahiplik uyuşmazlığı kaldı.
49 kaynak barkod çakışması ayrıca karardadır. Hedefteki 19 çakışmalı barkod
satırı sahipliği değiştirilmeden pasifleştirildi; otomatik yanlış seçim yapmaz.

Ürün bağlantısı çözülemeyen tarihsel satırlar ve hareketler silinmedi;
ürün bağlantısı nullable, özgün kaynak kimliği ve snapshot alanları doludur.
F0104, yetim bağlantılar, bilinmeyen kur/tutarlar, kimlik birleştirme ve
personel isimleri için kararlar SQL'de kayıt bazında saklanır.
`related_source_key` doğrudan sorgulanabilir. Kapsam gereği oluşturulmayan
pasif/sıfır ürünlerin tarihsel kaynak snapshot'ları karar durumu bakımından
belirsiz eşleşmelerden ayrıdır.

Yeni ERP MCP 45 TEST tablosunu salt okunur sorgular. Ek tablolar için yalnız
SELECT verildi; etkin INSERT/UPDATE/DELETE izinleri yoktur. Ürün, cari, 2020
belgesi/satırı ve bağlı finans hareketleri gerçek bağlı MCP üzerinden okundu.
Gözden geçirilmiş ürün/kur snapshot alanları açıktır. Not/iletişim alanları
tekil primary key, açık kişisel veri seçimi ve amaç gerektirir. Gizli alanlar
ve genel payload/config JSON açılmaz. Canlı ERP/Vega alan politikası değişmedi.

Şartname/adaptör testleri ve MCP erişim/izin kontrolleri, migration'ın bağımsız
ticari mutabakatı değildir. Nihai Vega ↔ Yeni ERP doğrulamasını ChatGPT yapacaktır.
