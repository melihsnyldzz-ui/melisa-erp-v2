# ERP + CRM son hazırlık — 10 Ekim 2026

**Sonlu TRY günlük teknik zincir teslim edildi; geniş mağaza TEST'i ve LIVE hazırlığı koşullu.** ERP-DEC-041 / CRM-DEC-009 / ERP-CRM-FINAL01. [Makine özeti](summary.json), [tek15–20 dakika turu](store-day-tour.md). İnsan kabulü ERP-UA30/CRM-UA08 **bekliyor**. Ham ticari kayıt, kimlik, tutar ve ekranlar yalnız private kanıt alanındadır.

## Günlük akış ve çalışan paket

Çalışan izole ERP uygulama source **a51b117** / paket **CANONICAL-BUSINESS-TEST-20261010-a51b117**, CRM uygulama source **5f8cb237** / belge teslimi **43ff598**, ortak hedef **DB02**. TEST125 / source edb3c891 ve kabul edilmiş aktarımlar korunur. Native günlük sonlu TRY zinciri 25 kontrol ile, sayım ve alış iadesi ters kayıtları ayrıca SQL/API ve aynı UUID tekrarlarıyla doğrulandı. Personel onayı/ödeme denemesi reddedildi; ikinci stok veya finans etkisi oluşmadı. Normal satış/alış/ödeme, iade ve sayım geçmişi, ayrı dövizli günlük rapor ve CRM 50 ürün / 3.830 görsel kapsamı gerçek ekranda kontrol edildi. Bu teknik kanıt bütün mağaza ve TRY/USD/EUR günlük finans akışlarının kabulü değildir.

| Akış | Teknik sonuç | Sınır |
|---|---|---|
| Personel sayımı → yetkili onay | Native tek stok etkisi, personel ret, aynı UUID tekrar0 | Sahipliği kanıtlı sonlu seçilmiş kayıt |
| Mal kabul → alış → tedarikçi borcu | Kaynak kabul bağlı fatura; ikinci stok girişi0 | Sonlu TRY kaynaklı sentetik TEST |
| Satış → müşteri borcu → tahsilat | Native kayıt ve ayrı tahsilat, tekrar0, fiş yenilemesi | Gerçek müşteri işlemi veya açılış kabulü değil |
| Tedarikçi ödemesi | Native borç/kasa etkisi, personel ret, normal geçmiş/yenileme | Mevcut sentetik kasa; gerçek açılış değil |
| Alış iadesi / ters kaydı | Bir kez stok/tedarikçi etkisi, kaynak alış geçmişi aynı, inverse/replay 0 | Orijinal finans geçmişi korunur |
| Sayım ters kaydı | Teknative inverse; aynı UUID'de ikinci stok/finans etkisi0 | Yalnız bir sahipliği kanıtlı sentetik sayım |
| Raporlar | Native günlük satış, ayrı TRY/USD/EUR, kaynak/deneme ayrımı | Bütün mağazanın gerçek gün sonu kabulü değil |
| CRM katalog / mevcut sipariş | V6'da 19 taze GET kontrolü; V2'den 30 eski kanıt ayrıreuse; normalGUI50 fotoğraflı ürün/3.830 kapsam; TRY/USD/EUR taslak readback/refresh | Yeni ticari sipariş/WhatsApp/AI gönderimi yok |

Dar sayım eki eski trusted CHECK tanımını bütünüyle korur. Sahip altında ilkprova547, sonraki2812 yordam yaşam döngüsü hataları geri alınmıştır. Sabit,parametresiz ayrı SQLbatch düzeltmesiyle gerçek writer outer-rollback provası PASS; temizleme sonrası tam şema aynı. Aynı aday yalnız DB02'de bir kez kuruldu:51 ticari/11 eski proof grubu ve diğerCHECK/modül/trigger/FK/izin/rol tamhashi aynı; yeniimmutable kanıt ve trustedconstraint bağı doğrulandı, tek kullanımlık helper kendini kaldırdı. Native sayım inverse sonradan ayrı uygulandı; kurulum ticari etkisi 0, bu sentetik inverse1, replay 0. Aktif DB reset/restore yok.

Eski immutable iade yanıtında tarihJSON kusuru ayrı korunur. a51 yeni journal'larda DateISO düzeltmesi içerir; eski journal geri yazılmadı. Tarih karşılaştırma yardımcısı sürücüDate/JSON eşliğini doğrular, geçmişi değiştirmez.

## Hız ve normal ekran kanıtı

Güncel a51API okumaları3ardışık örnek medyanı: ilk50 **2080ms**, sonraki50 **2332ms**, kod **2186ms**, sıfırlı barkod **1748ms**, kart/fiyat **1515ms**, HOME **2809ms**, sayım **4939ms**, ödemegeçmişi **3994ms**, günlük satış raporu **3995ms**. Doğru tam koddaki marka boşluğu özel ölçüm yardımcısında düzeltildi; ilk olumsuz kanıt saklandı, yalnız iki içerik ölçümü tekrarlandı. Uygulama verisi veya kodu bu nedenle değiştirilmedi.

Önceki ortak644 ms ilk50baseline'ına göre regresyon var. CRM normal ilkcatalog çağrısında15 sn bridge timeout gözlendi; sonraki aynıparametre200/~2.1 sn ve gerçekGUI açıldı. Timeout/rol/güvenlik değiştirilmedi. Kaynak incelemesinde herokumada185 modulehash+v4/v5 tekrarhash işi görüldü; regresyonun bütün nedeni profil ölçümüyle kanıtlanmış değildir. Bu kalan performans konusu gizlenmez.

Normal yeşil satış fişi yenidenokuma, alışkaynak bağlantısı, ödemegeçmişi yenileme, iadeinverse yenileme, sayımiptal geçmişi, günlük rapor ve CRMfotoğraflı katalog kareleri private/gui'dedir. Tam insan mağaza turu başlatılmadı; eskiGUI kareleri kendi kaynak tarihleriyle ayrı korunur.

## Kaynak farkı / işletme kararları

10 Ekim **17:01 TR /14:01 UTC** ikiardışık saltokunur Vega geçişi kararlı, atomik değil ve yazıcılar dondurulmadı. Ürün tabanı8 Ekim, cari tabanı6 Ekim: **233ürün /22müşteri döviz hesabı /28tedarikçi döviz hesabı** değişti. Nedenler örtüşür; ürün/barkod/fiyat/hesap sayıları toplanmaz. Bu normal drift gerçekT1 veya yeniuygulama değildir.

- **18 UNKNOWN belge:**6satış/5alış/7iptal kaynağı gerçek/deneme/bilinmiyor kararı; teknik çözülen4taslak yeniden sorulmaz.
- **39 native kasa/banka kaydı, gerçek açılış hazır0:** gerçek fiziksel hesap ve ayrıdöviz listesi, aynıkesim kasa sayımı/banka ekstresi/POS/yoldaki/devir kapsamı gerekir. Bu39kaydı doğrudan39doğrulanmış fiziksel hesap saymak doğru değildir.
- **8 kişi/hesap takma adı:** gerçekpersonel/İlker/cihaz ve CRMsohbet↔cari bağı;15/16TESTaktörü gerçek insan kabulü değildir.
- Depo/birim, cari hesabı/kendiB-A yönü, açılışotoritesi ve gerekli gerçekkullanım istisnaları tekilprivate karar listesinde korunur. Bilinmeyen miktar, kur, kimlik veya tutar tahmin edilmez. Kabul edilen37residual kanıtı yeni gözlemle değiştirilmez.

## Yedek / kurtarma / finalT1

Yeni DB02 yedeği10 Ekim13:58UTC, yaklaşık9.2 GB COPY_ONLY/CHECKSUM/VERIFYONLY PASS. **Bu yeni yedek restore edilmedi.** Önceki gerçek ayrıDB02restore ve Aşama5kurtarma/inverse kanıtı yeniden kullanıldı:343stok/59hesap/46fiyat/34master; sonraki yerel/sentetik ve manuelCAS etkileri korunmuştu. Bu eski sonuç yeni yedeğinrestore veya gerçekT1 sonucu değildir.

[Finalkesim prosedürü](../../../erp-v2/canonical-20261007/final-cutover-procedure.md) kaynak yazıcı/kuyruk dondurma, kesin kesimve kapsam, yeni yedek+ayrırestore, source-onlyT0→T1delta ve yerel etki korunumu, kayıtbazımutabakat/replay/inverse, insan ve ayrıLIVEuygulama onayı ister. GerçekT1/LIVE hazır veya başlamış değildir. Güncel diskte yaklaşık15.8GBboşluk gözlendi; yeniizole restore için alan planı ayrıca doğrulanmalıdır.

## Teslim / sınırlar

ERPdal codex/erp-finish-20261004 / [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23); çalışan source a51b117 ve bu doküman teslimcommit'i ayrı. CRMdal codex/crm-agents-on-completion-20261003 / [PR3](https://github.com/melihsnyldzz-ui/melisa-crm/pull/3); çalışan source 5f8, docs 43ff598. Yerel hedefli test/build/secret taraması ve bağımsız review kanıtları ayrı; exact GitHub işlerihesap/harcama engeliyle başlamadı, CIyeşil değil. Son bu-belge commit'inin CI makbuzu özel teslimraporu/PRyorumunda kaydedilir.

**Genel işletme TEST'i / LIVE hazır değil; ERP-UA30 ve CRM-UA08 bekliyor.** 18 UNKNOWN belge, gerçek açılışı hazır0/39 native kasa-banka kaydı ve8 kişi/hesap takma adı için işletme kanıtı; fiziksel Zebra/personel/İlker turu ve geniş dövizli günlük kapsam açık. Yeni9,2 GB COPY_ONLY/CHECKSUM yedeği VERIFYONLY PASS, bu yeni yedek restore edilmedi; önceki gerçek izole restore ve Aşama5 inverse kanıtı yeniden kullanıldı. 10 Ekim17:01 TR tarihli atomik olmayan okumada ürün 233 / müşteri döviz hesabı 22 / tedarikçi 28 kaynak farkı; yeniden aktarım veya gerçekT1 yok. Katalog ilk50medyan2.080 sn önceki ortak644 ms'den yavaş; bu regresyon ve CRM'nin önceki15 sn timeoutu saklandı, sonraki darliste200/~2.1 sn. Koruma/timeout kaldırılmadı. GitHub CI hesap/harcama nedeniyle başlamadı; yeşil değil. Vega/LIVE/gerçekT1/main/gerçekWhatsApp/ücretliAI/EğitimPR27 değişimi yok.

Bu hazırlık tesliminde durulur. Tam kapsamlı işletme TEST'i, diğer migration veyaLIVE geçişi kendiliğinden başlatılmaz.
