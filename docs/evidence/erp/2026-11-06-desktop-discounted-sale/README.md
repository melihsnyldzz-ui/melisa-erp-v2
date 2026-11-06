# TRY fiş geneli iskonto: kaynak adayı

Kurulu paket hâlen `042f9a98...`, kaynak152a6694; PR79 dokümantasyon head7b042e71'in iki exact CI koşusu Windows dahil başarılıdır (`pr79-base-ci.json`). Bu yeni kaynak henüz SQL/GUI'ye kurulmadı ve insan kabulü BEKLİYOR.

- İskontolu tutar gerçek PR54 normalizer + bağımsız BigInt/Tedious hesabıyla eşlenir. Aynı normal actor/SQL işleminde güncel personel rolü %3 tavanını belirler; müdür/patron yetkisi varsayılmaz.
- Yeni optional yüzde alanı kalıcı komutun parçasıdır. Eski sıfır-iskonto UUID/gövde/hash şekli değişmez; yeni yüzde kayıp yanıt/tekrar/kalıcı no-commit çözümlemede korunur.
- Taslak başlığı yüzde/iskonto/subtotal/net toplamla geri okunur. Normal kaydetme yalnız güncel exact önizlemeyle açılır; fiş ve A4 görünümü ara toplam/fiş iskontosu/net toplamı gösterir.
- Fiziksel çıkışta PR54'ün mevcut maliyet resolver'ıyla aynı, aynı işlemde kilitlenen güncel ürün ortalama maliyeti kullanılır. Eski taslak maliyet snapshot'ı ayrıca native giriş korumasında doğrulanır; güncel maliyet de seçilmiş hazırlıkla eşleşir.
- Başlık iskontosu/kârı, satır maliyeti/kârı ve stok hareketi net satış tutarı/maliyeti aynı işlemde gerçek kayıtlarından geri okunur. Uyuşmazlık tüm işlemi geri alır. Miktar ve brüt birim fiyatı değişmez; iskonto iki kez uygulanmaz.
- Bu dar yazılabilir kapsam yalnız PR54 raw hesap ile decimal4 başlık/satır/net kâr sonuçları tam eşleşen değerleri kabul eder. Satır yuvarlamaları net toplamla birleşmiyorsa yeni bir dağıtım kuralı icat edilmez, yazma açılmaz.

`source-tests.txt`:23 dosyada103 test PASS. Gerçek native finalize + transaction'lı sahte SQL sürücüsü taslakcost8→güncel9 değişiminde32,98net/8,98kâr,7 ayrı bozuk geri okuma alanında rollback ve commit sonrası kayıpACK/tek exact replay'ı doğrular. Bu gerçek SQL Server veya normal ekran kabulü değildir. Normal eski0 satışı/native guard, yüzde sınırı, kalıcılık/resolve ve fiş okuma regresyonları da geçer.

Vite üretim derlemesi PASS: `desktopWriteGreen-qZqLsJ5q.js`; CSS `desktopWriteGreen-D6yoncVT.css` korunur. Readonly bağımsız incelemede bulunan güncel/saklı maliyet farkı ve eksik maliyet/kâr geri okuması giderildi; kapanış incelemesinde yeni somut P1/P2 yok.

Geniş yerel Windows API koşusu:1826 test,1811PASS/13skip/2FAIL. B6 whole-file eski hash beklentisi gerçek body+SQL byte karşılaştırması sonrası yenilendi ve ilgili8 test PASS; SQL17a2646f ve fonksiyon235d4119 değişmedi (`native-source-proof.json`). Mevcut Windows native ACL çocuk süreç testi `CI_OFFLINE_BOUNDARY` ile engellendi; guard gevşetilmedi, sonuç PASS sayılmadı. Son source exact GitHub CI ayrıca gereklidir.

DDL, SQL hesabı/grant/servis değişikliği, B6 SQL yürütmesi, eski ERP/ticari veri/yedek/Vega işlemi yok. Merkezi plan/Excel değiştirilmez. Dövizli satışta şirketin günlük kuru ve fişte kullanılan kur snapshot'ı kararı korunur; bu TRY işi o entegrasyonu kapatmaz.
