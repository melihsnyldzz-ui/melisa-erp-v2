# Goal6 teknik kanıtı — 6 Ekim 2026

Kullanıcı talimatı ERP-DEC-019 / CRM-DEC-006. İnsan kabulü bekler; LIVE/Vega/CRM provider/main/delta/Goal7 yok.

ERP son uygulama source `4f918c51fd49c86953a69484714af41bec1cf794`, TEST77 `CANONICAL-GOAL6-TEST-20261006-77`, manifest `A3AAE6CB40ED93ADBB63DAE472B33F91D8399BD225EED726E1C704D5E5744F01`.
CRM source `77a2fa346b4c3653b77e33625e185c1259402af7`, immutable `crm-test-77a2fa346b4c3653b77e33625e185c1259402af7`, manifest `ccdaab18c33973ef5a7e95e28f696fb8ff0426c41c339faefc00bf9eb9929b31`.

## Veri ve rapor kapsamı

Yedi rapor yalnız Melisa ERP içinde oluşturulmuş kayıtlardır. Mevcut veritabanında geçmiş Vega belgeleri de bulunur; `is_migrated` ve hareket provenance filtreleriyle bu rapora dahil edilmez. Yeni historical import/delta yapılmadı. Görünen kaynak kapsamı 30 Eylül açılış verisi + Melisa ERP TEST hareketleridir. Türkiye kayıtlı belge günü DATE olarak seçilir; UTC yarı açık aralık kapsam bilgisidir.

Satış/alış kesinleşmiş fiş toplamlarıdır. Marka/tür/ürün kırılımı kayıtlı satır tutarlarını gösterir; fiş indirimi dağıtımı icat edilmez. Gerçek KOD1/KOD4 provenance kayıtları kullanılır. Tahsilat/ödeme belge dövizi tutarı, ters kayıtta negatif; genel cari hareketi hesap dövizi ve signed balance_effect olarak gösterilir. TRY/USD/EUR birleştirilmez. NULL maliyet sıfır değildir; personel maliyet/kâr alamaz. Yetkili görünümde işlem maliyeti bilinen/bilinmeyen satır sayısı ayrı, doğrulanmamış işlem maliyetinden kâr üretilmez. CSV aynı filtre/kapsam/toplam ve 10.000 satır sınırını taşır; normal DOM sayfası 50 satırdır.

## Gerçek backup / restore

[Backup sonucu](backup-result.json): 7.283.015.680 bayt, COPY_ONLY/CHECKSUM, 87,351 sn; VERIFYONLY 9,590 sn. Express sıkıştırmayı desteklemediği için sıkıştırmasız alındı. SHA256 `238D65006C7515CCEA30F79B1678AA65AFA6BB2A366EF4337F8CA6745C1EE47D`.

[Gerçek restore](restore-result.json): yalnız yeni `MELISA_ERP_GOAL6_RESTORE_TEST_20261006_01`, 17,823 sn; ONLINE/READ_ONLY. Aktif TEST üzerine restore, REPLACE, LIVE bağlantısı veya silme yok. Backup, MDF/LDF ve restore DB repo dışında korunur.

[33 kritik tablo ve 177 prosedür/trigger](restore-comparison.json) ile [iki native sipariş tablosu](native-order-comparison.json) kaynak önce/sonra/restore count/hash eşit: toplam35 kritik tablo. Bu kanıt tüm DB atomik hash iddiası değildir; kaynak durgun aralıkta ayrıca önce/sonra karşılaştırıldı.

[Bağımsız uygulama okuması](restore-application-read.json) gerçek doğrulanmış TEST74 source5972 connector'ünü ayrı geçici süreçte kullanır; çalışan hizmet config'i yönlendirilmedi. 16.622 katalog ürünü,63.774 fiyat,10.552 NULL maliyet;0161 sıfırı ve9,66USD/802315,78USD; native taslak9/25,44USD/two1qty, pending sayım43/iade44/mal kabul7 okundu. 1,031 sn connector doğrulaması UI HTTP ölçümü değildir.

[Backup sırasında eşzamanlı katalog okuması](backup-concurrent-read.json) ve [beş negatif](backup-restore-negatives.json). Yanlış kaynak başlığı gerçek ikinci backup değildir; üretim guard'ına kontrollü başlık girdisiyle reddedildi. Bozuk backup SQL HEADERONLY öncesi/restore olmadan reddedildi.

## Geri dönüş

ERP önceki TEST74 source5972f847; CRM önceki4eadb51 paketi değiştirilmeden korundu. Önceki launcher/config/task XML ve owner/creation/port kayıtları repo dışındaki `C:\Sirket\ERP\evidence\ERP-GOAL6-20261006\ops-rollback-before` içindedir. Sadece doğrulanmış TEST süreçlerinin mevcut owner/pin prosedürüyle geri dönüşü uygulanır; fiziksel logon/reboot kabulü ayrıdır.

## Doğrulama

468 API,609 workflow ve hedefli startup/restore/network/UI testleri; syntax/build PASS. ERP son source CI37525098161/37525088953 SUCCESS; CRM source CI37522269385/37522269324/37522262766 SUCCESS. Son doküman commit'i uygulama source değildir; paketler yukarıdaki source'lara sabittir.

[Son TEST77/API kanıtı](report-api-proof.json) 15 kontrol; [bağımsız SQL karşılaştırması](report-independent-comparison.json) yedi rapor count/döviz toplamları ve stok net miktarı PASS. Bağımsız SQL kaydı TEST75 sırasında salt okunur alındı; aynı veri ve byte-identical rapor SQL/modeli TEST77 API ile karşılaştırıldı. [Birim kapsamı](report-unit-scope.json): mevcut127 native satış satırı unit_name NULL fakat bağlı ürünlerin hepsi ADET; tüm48771 native stok hareketi bağlı ürün birimi ADET. İşlem anı birim snapshot'ı varmış gibi ileriye dönük garanti verilmez.

## Gerçek başlatma/kurtarma ve negatifler

[Son pin/health/owner/task kimlikleri](ops-final-runtime-77.json). ERP75'te [ikinci launcher](ops-second-launcher.json), [API/web recovery](ops-api-web-recovery.json), [yabancı portu koruma](ops-foreign-port.json); ERP76'da [native/CRM DOWN görünümü ve recovery](ops-native-crm-recovery.json). [Kaynak eşitliği](ops-source-equivalence.json) ilgili owner dosyalarının75/76/77 ve API/SQL/network dosyalarının76/77 byte eşitliğini gösterir. TEST77 yalnız son paket/health ve UI kabul dili doğrulamasıdır.

Gerçek API recovery92,923sn bütünlük başlangıcını içerir; web18,757sn/native24,459sn/CRM13,456sn. 5/10/20/40/60 saniye sınırlı backoff, hızlı hatada devre kesme; scheduler ERP retry0/CRM retry3. Limited/Interactive/logon/IgnoreNew. LIVE ve ortak native62404 PID/creation değişmedi. CRM görevinin2147946720 sonucu ikinci başlatmanın already-running reddidir; görev/owner çalışıyor ve finalhealth READY.

[Yanlış DB/source/manifest](ops-startup-config-negatives.json) başlatmadan reddedildi. [Geç Chatwoot provası](ops-chatwoot-late-rehearsal.json) ayrı kontrollü loopback HTTP fixture kullanır; gerçek Docker/Chatwoot kapanmadı. API/native/CRM gerçek kapanma provaları ayrı kanıtlıdır. Personel finance403/maliyet alanı yok; geçersiz döviz/tarih/array/limit400; NULL model testlerinde korunur; boş dönem0; döviz toplamları ayrı.

CRM kontrolündeki gerçek ağ engeli yalnız sabit GET localhost62401/health için AsyncLocalStorage kapsamlı salt okunur helper ile giderildi. Genel62401/external/send engeli, exactTESTDB ve credentials sınırı korunur; yeni rol/izin verilmedi.

## Ekran ve hız

[Tarayıcı kontrolü](browser-verification.json): yedi tür, altı dönem, marka/tür/ürün gruplama, boş gelecek aralığı ve normal CSV başarı mesajı. Browser download event yakalanamadı; CSV içeriği/API filtre/toplam paritesi gerçek API yanıtıyla ayrı kanıtlıdır. İnsan dosya indirme kabulü bekler.

[Raporlar1440](reports-1440.jpg),[1024](reports-1024.jpg),[390](reports-390.jpg); [Ayarlar1440](settings-1440.jpg),[1024](settings-1024.jpg),[390](settings-390.jpg). Kullanıcının zoom1,21'i değiştirilmedi; gerçek document CSS width1440/1024/390 ölçüldü, global yatay taşma yok; geniş tablonun kendi kaydırması var. Görünür ekran görüntüleri native tab screenshot ile alındı.

HTTP üç örnek medyan: bugün246ms/7gün247ms/ay233ms/marka211ms/tür259ms/ürün223ms/müşteri226ms/CSV230ms/ledgerCSV211ms/Ayarlar10ms/health1ms. Stok hareketi ilk soğuk1673ms, sonraki452/391ms; soğuk maliyet gizlenmez. Tarayıcı tam sayfa rapor+veri532ms, Ayarlar273ms; tekrar menü geçişi cache kullanır ve ilk açılış ölçümü değildir. Backup87,351sn/restore17,823sn/connector1,031sn bu HTTP sürelerinden ayrıdır.

## Kapanış

ERP49/7🟢/29🟡/13🔴; B07/B08/C13/C14 kırmızıdan sarıya, C15 teknik tamam. CRM25/12🟢/13🟡/0🔴; O02 teknik tamam/sarı. ERP-UA19–22 veCRM-UA06 bekliyor; fiziksel logon/reboot/Zebra/insan PASS yapılmadı. Karar/pano/status/finish/UA güncellendi. Goal6 teknik tamamlandı; Goal7 başlamaz.
