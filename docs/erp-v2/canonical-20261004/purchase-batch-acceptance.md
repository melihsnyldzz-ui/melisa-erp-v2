# Çok satırlı alış kabulü — 4 Ekim 2026

## Kapsam ve güncel durum

C01 çok satırlı mal kabulü ve ona bağlı C02 kalıcı ayrıntılı alış taslağı. Teknik kaynak ve bağımsız backend incelemesi hazır; SQL kurulumu, çalışan paket ve normal ekran/SQL kabulü henüz doğrulanmadı. Personel kabulü bekliyor. Genel alış modülü PASS değildir.

Kanonik kaynak `C:\Sirket\ERP\melisa-erp-v2`; dal `codex/erp-finish-20261004`; [PR #23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Kabul edilmiş `e0c18e3` migration/fiyat/karantina tabanı korunur. Hedef yalnız `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`; TEST web/API/native 5194/4144/4146.

İlk prova iki farklı sentetik ürün: `TEST-V70-GOODS-P` 60 TRY ve `TEST-FINISH-GOODS-P2` 80 TRY, aynı TEST tedarikçi/depo, satır başına 1–5 tam ADET, indirim ve KDV açıkça 0. Genel dövizli alış, gerçek ticari kartlarda yazma, çok satırlı fatura iadesi/ödemesi ve fiziksel terminal bu kabul değildir.

## Personelin açacağı ekranlar

- [Mal kabulü](http://127.0.0.1:5194/is-akisi-taslagi.html#goods)
- [Alış taslakları ve faturalar](http://127.0.0.1:5194/is-akisi-taslagi.html#purchases)

Mevcut TEST oturumunu kullanın; şifre bu belgede bulunmaz. Yeni paket devrede değilse ikinci ürün görünmez; bu durumda eski tek satırlı akışta yeni kabul başlatmayın.

1. Yeni mal kabulüne iki farklı ürün ve ayrı adetler girin. Kontrole gönderilen belge iki satırı saklamalı; stok ve tedarikçi borcu değişmemeli.
2. İlker TEST oturumunda kabulü inceleyip onaylayın. Her ürünün stoğu yalnız kendi adedi kadar bir kez artmalı. Ret gerekçesi girilen başka bir kabul stok oluşturmamalı.
3. Onaylı kabulden alış taslağı açın. İki ürünün ayrı fiyat/adetlerini, TRY ve açık 0 KDV/indirim ile toplamı kontrol edin. Kaydettikten sonra sayfayı yenileyin; taslak SQL'den geri gelmeli, stok ve borç değişmemeli.
4. Taslağı kesinleştirin. Tedarikçi borcu yalnız fatura toplamı kadar değişmeli; kabul stoğu tekrar artmamalı. Aynı işlemin sonucunu tekrar kontrol etmek ikinci stok/borç üretmemeli.
5. Taslağı veya kesinleşmiş faturayı gerekçeli iptal edin. Taslak rezervasyonu serbest kalmalı; kesinleşmiş faturanın borcu terslenmeli. Fiziksel kabul stoğu korunmalı. 1440/1024/390 genişlikte ürün, adet, toplam ve işlem butonları kullanılabilir olmalı.

## Teknik kanıt ve sınırları

- API 218, Sites 373, web-admin 5 ve migration 37 offline test PASS; build PASS. SQL erişimi CI'da kapalıdır.
- Bağımsız backend review: goods-only mutasyon/replay cevabında fiyat alanı çıkarılır; son 100 listesine girmeyen kabul, kaynak kimliğiyle ayrıca yüklenir. İki regresyon testi PASS.
- Gerçek TEST COPY_ONLY/CHECKSUM yedeği ve VERIFYONLY PASS. 14 mevcut ticari tablo için değiştirme öncesi count/tam satır digest'i yerel kanıtta saklandı; değerler Git'e taşınmaz.
- SQL kurulum/manifest, installer replay, negatif API/yetki, gerçek tarayıcı ve stok/borç/migration seal farkı: henüz doğrulanmadı.
- Kullanıcı/personel kabulü: henüz bulunamadı. Teknik testler bu alanı tamamlamaz.

## Geri dönüş

Önceki TEST paket #16 ve launcher kimliği yerinde korunur. Yeni schema kurulumu tek transaction'dır; bilinmeyen guard/scope/karantina hedefi fail-closed reddedilir. Kurulum eski guard tanımlarını ve exact before/after hash'lerini saklar. Başarılı ticari TEST işlemlerini schema silerek geri alma yok: önce uygulama iptali, sonra gözden geçirilmiş kaynak rollback gerekir. Yedek restore provası bu dilimde yapılmadı; mevcut DB üzerine restore veya reset yetkisi yoktur.
