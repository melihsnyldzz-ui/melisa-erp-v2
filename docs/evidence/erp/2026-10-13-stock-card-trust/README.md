# ERP03 / A01–B02 — stok güven durumu

13 Ekim 2026; ERP-DEC-050/053 kapsamındaki dar sunum düzeltmesi.

Çalışan uygulama source **b79ce51db7af0f72bb7e72666dd11729d72e3578**, 1877 dosya, manifest **0f33efe6144ade8f3fb0ed025af99b5490034c7e48ada6d257b39ebf9e756b82**; web5234/API4184/native4186, DB02/copye16b70f0, actualT1=false. Normal liste ve kartta miktar NULL ise **Bilinmiyor**, miktar kayıtlı fakat hold/birim doğrulanmamış ise **Doğrulanmadı** görünür. Doğrulanmış sıfır ve işaretli negatif miktar mevcut exact gösterimle korunur. Üç frontend/test dosyası; root4/4, HighGO, build ve secret scan0. İki normal yetkili kart GET'inin bütün verisi ve readAt dışındaki metası önce–sonra aynı; API/native/veri/filtre/hesaplama/yetki değişikliği0, ticari yazma0. Startup225/CSS9/CRM kaynak ve sahibinin11staged kaydı/original TEST125/v22APK korunur. A01🟡, B02 geçmiş🟢 kabulü aynı;49 toplam/9 tamam/39 kısmi/1 açık, ERP-UA26/32 bekliyor, completeDelivery=false. Source6CI ödeme/harcama nedeniyle başlamadı; belge HEAD ayrı.

Paket CANONICAL-COMPLETE-TEST-20261011-b79ce51 / logical CANONICAL-TEST-b79ce51db7af. Normal adres <http://192.168.1.46:5234/ornek-akis.html#stock>. Uygulama source, çalışan paket ve sonraki belge teslimi ayrı kimliklerdir.

## Gözlenen sorun ve sonuç

Önceki normal kartta hold ve doğrulanmamış birim bulunan kayıt, stok alanında sayısal sıfır gösteriyordu. Native sıfırın hatalı olduğu veya NULL'ın sıfıra dönüştürüldüğü kanıtlanmadı. Değişiklik, kayıtlı miktarın güven durumunu liste ve kartta aynı biçimde gösterir; raw native miktarı veya stok etkisini değiştirmez. Gerçek doğrulanmış negatif kayıt önce–sonra aynı işaret ve birimle görüldü. NULL ve doğrulanmış sıfır ayrımı hedefli testte kanıtlandı; gerçek NULL kart açıldığı iddia edilmez.

| Miktar ve doğrulama | Normal gösterim |
| --- | --- |
| Miktar NULL | Bilinmiyor |
| Kayıtlı miktar, hold veya birim doğrulanmamış | Doğrulanmadı |
| Doğrulanmış gerçek sıfır | 0 ve kendi birimi |
| Doğrulanmış negatif miktar | İşaretli exact miktar ve kendi birimi |

Helper maskelemeden önce exact8/null ile hold/unit boolean alanlarını doğrular; bozuk yanıt gizlenmez. Birim, çarpan, fiyat ve barkod ayrı korunur; ADET/1 varsayımı, miktar/fiyat yuvarlaması veya yeni satış izni yok. Yeşil tasarım, CSS, fotoğraf, 50 ürün, filtre ve sıralama değişmez. Filtre hâlâ native kayıtlı miktar içindir; doğrulanmamış kart sıfır filtresinde bulunabilir. Bu fiziksel kullanılabilir stok veya fiyat kabulü değildir.

## Miktarın gerçek kaynağı

Normal ekranın mevcut workCatalog okuyucusu stockQuantityExact alanını native products.current_stock_qty üzerinden verir: okuma anındaki ERP TEST toplam kayıtlı miktarıdır. Güncel Vega veya fiziksel mağaza sayımı değildir. DTO kaynak katkısı/gerçek yerel/sentetik hareket ayrımını ayrı alanlarla sunmaz; bu dar görünümden genel kaynak mutabakatı çıkarılmaz. Kaynak şirket/tablo/kayıt kimliği, full stok kodu ve birim/barkod bağı eski sözleşmede korunur. Eski Vega/LAB servisinin bugünkü ekran olduğu varsayılmadı.

## Yeni hedefli kanıt

- Root4/4 yeni kontrol: NULL/güven önceliği, gerçek sıfır/negatif/sekiz basamak/input değişmezliği, bozuk alan reddi, gerçek liste ve kart render bağı. Eski kabul edilmiş barkod/arama testleri tekrarlanmadı.
- İlker16 normal yetkili oturumuyla yalnız iki mevcut kart GET'i karşılaştırıldı. Bütün DTO ve readAt dışındaki meta aynı; hold kartın raw native sıfırı sıfır kaldı. Kendi yardımcı oturumu normal giriş/çıkış yaptı; tarayıcı oturumu ve taslaklar korundu.
- Gerçek normal Chrome'da belirsiz kartın liste ve ayrıntısı Doğrulanmadı, doğrulanmış negatif kart işaretli exact miktar ve birimiyle görüldü. Yenile ve değişen metnin masaüstü/dar genişlik kontrolü private kanıtta. Fiziksel Android veya insan PASS değildir.
- Altı süreç/dört health/normal asset/manifest DB02 kimliğiyle eşleşti. CRM09ca/nativeOrder60e, original TEST125/source edb3c891 ve v22APK korunur; SQL yazması, restore, migration veya eski prova tekrarı yok. Private ham kartlar/ekranlar GitHub'a yüklenmez.

## Kalan veri ve kabul

[Aşama3](../2026-10-08-product-completion/README.md) tarihli 1.990 negatif kaynak miktarı kararı,185 ayrıştırılamayan stok kökeni ve54 ürün hold'u bu tur çözülmedi veya yeniden aktarılmadı. Tam kaynak–yerel–sentetik ayrımı, fiziksel stok ve final veri kararı ayrı bağımlılıktır. Geçmiş B02/ERP-UA02 ve UA04 kullanıcı sonuçları korunur; A01 genel kapsamı ve ERP-UA26/32 insan kabulü bekler. 49/9/39/1 aynı, completeDelivery=false.

[PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), branch codex/erp-finish-20261004. Source6CI FAILURE_BILLING_NOT_STARTED; yerel4test CI yerine geçmez. CRMpaused, iptal edilmiş Hub giriş ve cihaz/video ret sınırı aynı; LIVE/Vega/T1/main/gerçek mesaj/ücretli servis yok.
