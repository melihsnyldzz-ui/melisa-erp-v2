# Çok satırlı alış kabulü — 4 Ekim 2026

## Kapsam ve güncel durum

C01 çok satırlı mal kabulü ve ona bağlı C02 kalıcı ayrıntılı alış taslağı, aşağıdaki iki sentetik üründe normal TEST ekranı ve SQL etkileriyle doğrulandı. Personel kabulü bekliyor; genel alış modülü PARTIAL. 1440/1024/390 kontrolü doğrulanmadı.

Kanonik kaynak `C:\Sirket\ERP\melisa-erp-v2`; dal `codex/erp-finish-20261004`; [PR #23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Kabul edilmiş `e0c18e3` migration/fiyat/karantina tabanı korunur. Hedef yalnız `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`; TEST web/API/native 5194/4144/4146.

İlk prova iki farklı sentetik ürün: `TEST-V70-GOODS-P` 60 TRY ve `TEST-FINISH-GOODS-P2` 80 TRY, aynı TEST tedarikçi/depo, satır başına 1–5 tam ADET, indirim ve KDV açıkça 0. Genel dövizli alış, gerçek ticari kartlarda yazma, çok satırlı fatura iadesi/ödemesi ve fiziksel terminal bu kabul değildir.

## Personelin açacağı ekranlar

- [Mal kabulü](http://127.0.0.1:5194/is-akisi-taslagi.html#goods)
- [Alış taslakları ve faturalar](http://127.0.0.1:5194/is-akisi-taslagi.html#purchases)

Mevcut TEST oturumunu kullanın; şifre bu belgede bulunmaz. Paket18 devrede; ikinci ürün görünür. Deneme için `TSTB-FINISH-20261004-03` iki satırlı 220 TRY taslağı hazırdır. Başlangıç sentetik stokları29/2, tedarikçi bakiyesi-100 TRY'dir; eksi bakiye alacağı ifade eder.

1. Yeni mal kabulüne iki farklı ürün ve ayrı adetler girin. Kontrole gönderilen belge iki satırı saklamalı; stok ve tedarikçi borcu değişmemeli.
2. İlker TEST oturumunda kabulü inceleyip onaylayın. Her ürünün stoğu yalnız kendi adedi kadar bir kez artmalı. Ret gerekçesi girilen başka bir kabul stok oluşturmamalı.
3. Onaylı kabulden alış taslağı açın. İki ürünün ayrı fiyat/adetlerini, TRY ve açık 0 KDV/indirim ile toplamı kontrol edin. Kaydettikten sonra sayfayı yenileyin; taslak SQL'den geri gelmeli, stok ve borç değişmemeli.
4. Taslağı kesinleştirin. Tedarikçi borcu yalnız fatura toplamı kadar değişmeli; kabul stoğu tekrar artmamalı. Aynı işlemin sonucunu tekrar kontrol etmek ikinci stok/borç üretmemeli.
5. Taslağı veya kesinleşmiş faturayı gerekçeli iptal edin. Taslak rezervasyonu serbest kalmalı; kesinleşmiş faturanın borcu terslenmeli. Fiziksel kabul stoğu korunmalı. 1440/1024/390 genişlikte ürün, adet, toplam ve işlem butonları kullanılabilir olmalı.

## Teknik kanıt ve sınırları

- API218, Sites373, web-admin5, migration37 ve canonical SQL-source15 offline test PASS; build PASS. SQL erişimi CI'da kapalıdır. Kaynak `46e10ce` için push+PR quality-build-test/secret-scan PASS; bu belgenin nihai head'i PR'den izlenir.
- Bağımsız backend review: goods-only mutasyon/replay cevabında fiyat alanı çıkarılır; son 100 listesine girmeyen kabul, kaynak kimliğiyle ayrıca yüklenir. İki regresyon testi PASS.
- Gerçek TEST COPY_ONLY/CHECKSUM yedeği ve VERIFYONLY PASS. 14 mevcut ticari tablonun eski satır count/tam digest'i aynı; sonradan eklenen kayıtların kapsamı ayrıca incelenir. Finans ledger tablolarının before digest'i bu dosyada bulunmaz; bu kanıt bütün kasa/banka geçmişinin fark0 sonucu değildir. Görünen TEST kasa900 TRY, USD/EUR bankaları1000 aynı kaldı.
- Exact TEST SQL kurulum PASS; aynı installer replay ek yazma0. Yeni schema15 guard ile,42 önceki immutable/quarantine hash ve37 FIRST davranışı korunarak kurulmuştur. Ayrı stock-source companion eski CHECK ifadesini aynen saklar ve yalnız exact2 fixture için yeni kaynağa izin verir; trusted/enabled ve replay0. RUN06 karantina mührü değişmedi. Kaynak SQL hash'leri: ana `D634B3719B7C5E56C9BDDED2DC347BE42838AAEC3F3B992CE1FBBFD2A8675F38`; companion `199F24B9A18D9BF5FB9E8E4D19C82FACEAB65567F10158C107AC77ACD19DF9AC`.
- Normal İlker TEST oturumu: kabul1 ürün1qty1/ürün2qty2, pending etkisiz; approve stok28/0→29/2 ve tam2 hareket, borç-100 değişmedi. Kabul2 iki satırlı gerekçeli ret stok/borç oluşturmadı. Aynı approve request replay true, ikinci stok etkisi0.
- Fatura25084 / `TSTB-FINISH-20261004-01`: kısmi1+1 adet, toplam140 TRY. SQL taslağı sayfa yenilemesinde geri geldi, stok/borç değişmedi. Finalize borç-100→40, stok29/2; aynı finalize request replay true/ek etki0. Gerekçeli iptal borç40→-100; fiziksel stok korunur.
- Fatura25085 / `TSTB-FINISH-20261004-02`: yalnız ikinci ürün1adet80 TRY. Taslak iptali stok/borç oluşturmadan rezervasyonu serbest bıraktı. Fatura25086 / `TSTB-FINISH-20261004-03`: tam1+2adet220 TRY kalıcı taslak, kullanıcı kabulüne hazır; henüz kesinleştirilmedi.
- Negatif gerçek API9/9: oturumsuz401, seller approve403, duplicate400, bilinmeyen ürün403, pending fatura409, rezervasyon üstü tekrar fatura409, USD400, başka kabul satırı409, kısa iptal gerekçesi400. Bunların hiçbirinde başarılı ticari etki oluşmadı.
- Masaüstü yeni kart/form/toplam/aksiyonlar okunaklı. Tarayıcı ölçü ayarı ve desteklenen CDP denemesi gerçek ölçüyü değiştirmedi; yakalanan ekran1228×768'dir. Bu ekran1440 veya390 kanıtı olarak etiketlenmez; üç genişlik/personel kabulü açık.
- Kullanıcı/personel kabulü: henüz bulunamadı. Teknik testler bu alanı tamamlamaz.

## Kaynak ve çalışan TEST

Çalışan uygulama `4e6b606b2335d16a5bc9dade0c9b571e9a9a6c0f`, paket `CANONICAL-FINISH-PURCHASE-TEST-20261004-18`,1143 dosya manifest eşleşti. Kaynak `46e10ce` yalnız SQL companion ve CI kontrolünü ekler; ticari uygulama aynı kaldığı için yeniden restart yapılmadı. TEST launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1`. LIVE süreçleri/DB değişmedi; LIVE commit durumu doğrulanmadı. Main merge/LIVE deploy/Vega yazması yok. Özel backup/runtime/SQL/browser kanıtları yerel evidence alanında tutulur; secret ve ham ticari veri Git'e konmaz.

## Geri dönüş

Önceki TEST paket #16 ve launcher kimliği yerinde korunur. Yeni schema kurulumu tek transaction'dır; bilinmeyen guard/scope/karantina hedefi fail-closed reddedilir. Kurulum eski guard tanımlarını ve exact before/after hash'lerini saklar. Başarılı ticari TEST işlemlerini schema silerek geri alma yok: önce uygulama iptali, sonra gözden geçirilmiş kaynak rollback gerekir. Yedek restore provası bu dilimde yapılmadı; mevcut DB üzerine restore veya reset yetkisi yoktur.
