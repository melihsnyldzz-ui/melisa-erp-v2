# Gerçek müşteri kartı — C06 TEST kabulü

## Kapsam ve kabul durumu

Normal Müşteriler ekranı, tek satış denemesi carisi yerine SQL müşteri kartlarını arama ve sayfalama ile açar. Her döviz hesabı kendi para biriminde ve müşteri borç/alacak işaretiyle gösterilir. Dövizler toplanmaz. Kaynak eşleşmesi, güncel bakiye mutabakatı ve karantina birbirinden ayrılır; NULL/bilinmeyen değer sıfır yapılmaz.

Bu dilim salt okunur gerçek TEST kartı kabulünü hazırlar. Yetkili kart düzenleme, gerçek ticari kart yazımı ve personel kabulü bu belge oluşturulduğunda tamamlanmamıştır. Teknik sonuç, paket ve gerçek ekran kanıtı doğrulandıktan sonra aşağıya kaydedilir. Genel C06 henüz tamam değildir.

Kaynak kesimi 30 Eylül 2026'dır; bugünkü canlı Vega verisi olarak sunulmaz. Güncellenmiş native hesapların eski migration etiketi taşıyabilmesi nedeniyle eşleşme yalnız migration_run_id alanından çıkarılmaz. Kaynak kimliği/firma/rol bağı tekil olmalıdır. Kaynakta bilinmeyen ve native geçmişte eşleşmeyen hesaplar açıkça gösterilir.

Normal görüntüleme `customer.view` gerektirir. Kart düzenleme yetkisi görüntüleme yetkisi yerine geçmez. Mevcut TEST kullanıcılarının izinleri değiştirilmez. Canonical TEST yazma politikası ve eski migration/karantina korumaları korunur.

## Personelin deneyeceği beş adım

1. [Müşteriler](http://127.0.0.1:5194/is-akisi-taslagi.html#customers) ekranında kendi bildiğiniz müşteri kodunu/adını arayın; sonraki sayfa ve aktif/pasif filtresini deneyin.
2. Bir kartı açın. TRY/USD/EUR hesaplarının ayrı olduğunu, borç/alacak işaretinin doğru olduğunu ve kaynağın 30 Eylül kesimi olarak belirtildiğini kontrol edin.
3. Doğrulanmamış veya bilinmeyen hesabın gerçek sıfırdan ayırt edildiğini görün. Kaynak eşleşmesinin tek başına güncel bakiye doğrulaması sayılmadığını kontrol edin.
4. Karantinadaki bir kartı inceleyin. Engel gerekçesi görünmeli; bu salt okunur karttan ticari işlem veya düzenleme yapılmamalı.
5. 1440/1024/390 genişlikte arama, kart açma/kapatma ve sayfa geçişini deneyin. Yenilemede kartlar SQL'den okunmalı; hata/boş sonuçta örnek veri gösterilmemeli.

## Teknik kanıt

5 Ekim 2026: **Dar salt okunur teknik TEST kapsamı doğrulandı; genel C06 PARTIAL.**

- Uygulama8933b01da60271d52851be66690262c78d25b949/paket23;1177manifest hash eşleşti. Normalactor16oturumu,441müşteri/25sayfa/28karantina; kod/ad arama,ikinci sayfa,boş sonuç,kart aç/kapat ve gerekçeli karantina gerçek ekranda doğrulandı.
- 18gerçek API denemesi PASS: liste/detail,155ikiSOURCE+current+ledgerexact8hesap/1nativeunverified,217UNKNOWN/hold,593unmapped0account,held28,literal%/page2,401/400/404. customer.view/customer.edit-only olumsuz ve bağlantısız diğer modül/geçyanıt/logout yarışları offline actual middleware/UIcontroller testleriyle doğrulandı. Gerçekview-denied403/hataekranı için yeni kullanıcı/izin oluşturulmadı; bunlarda normaloturum kabulü NOT_VERIFIED.
- İlk gerçek liste30sn zaman aşımı verdi; tekrarlı JSON çözümü ve hareket taraması yerelpublic #temp cache ve selectedpage aggregate ile giderildi. RootrestrictedODBC542ms,bağımsızrestricted25card895ms; bütün proof arrays/exactstrings geçerli. Hash7FE6BEE7728312D666FF3B68151CA60A08B84E4A6D5B33B36F300A48381E6C8E; kurulumreplayNOOP/yazma0.
- SERIALIZABLE,806kaynak içerik+RUN06/176hold mühürleri,42eski tanım/37FIRST/15+17guard aynı. DarEXEC1,stage/runs/holds/manifestSELECT0,readerALTER0. Bağımsız155/217/593/168 hesap/UNKNOWN/hold denetimi geçti; 27tüm ticari/finans tablo count/maxId/digest aynı.
- Müşteri kartı iframe1440/1024/390 gerçek çalışma ekranında client=scroll1427/1011/377; yataytaşma0.390mobil44px kart kapat/arama/boş sonuç doğrulandı. Browser viewport override hedef ölçüyü uygulamadığından ölçekliiframe ölçümleri esas alındı; JPEG dış görüntü ölçeklidir. Fizikseltelefon/terminal/personel kabulü değildir.
- Source008047d ilk API/UI teslimi;8933b01 performans/bağımsızoturum başlık düzeltmesi. 14SQL+4workspace hedef testi PASS;8933b01push37235624448/PR37235627439 tüm4hostedUbuntuquality/secretjobSUCCESS. Backend/UI/SQL bağımsız çapraz inceleme; yeniP1/P2yok. Nihai belge head PR23üzerinden doğrulanır.
- Paket23 aynılock/dependencybytehashleriyle newdirectories/hardlinks;cache paylaşılmaz. Old22source/assets/manifesthashleri aynı; unchangedweb-admin build reuse ve yeniSitesbuild kanıtlıdır.1177dosya manifest eşleşti. Launcherbefore23backup/old21/22retained; TEST5194/4144/4146exactDB;LIVEownerchange0.

Ham kartlar ve cevaplar privateevidence/c06-api-8ed440a5-0755-4fda-b248-870711820c1c.json; anonim independent-current.json ve27digest commercial-before/after.json. Git/web paketinde ham kart/veri/secret yok.

**Açık:** yetkili müşteri düzenleme ve sentetik pozitif/negatif audit/stale kabulü; personel günlük kart kabulü; gerçekdeniedrole/errorUI; fizikseltelefon. Personel kabulü/tarih: Henüz bulunamadı. LIVE değişikliği, main merge, yeni kullanıcı yetkisi veya ticari müşteri yazması yapılmadı.
