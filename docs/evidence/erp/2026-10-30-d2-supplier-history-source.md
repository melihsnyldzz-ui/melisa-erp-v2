# D2 — tedarikçi kartı ve hesap geçmişi kaynak entegrasyon testleri

30 Ekim 2026. Yalnız bağımsız kaynak/çevrimdışı test teslimi; D2 kurulumu veya insan kabulü değildir.

## Seçim ve dosya sahipliği

- Mevcut kapsam: ERP_FINISH_PLAN.md içindeki D2 tedarikçi kartı, ödeme/hareket geçmişi bağlantısı; özgün ERP-UA12 / ERP-UA13 insan kabulü açık kalır.
- Taban: `06ce7a54458f56527a9bb80dbdbd9c28f0ca2d19`, PR54'ün incelenen güncel kaynağı.
- İzole dal: `codex/d2-supplier-source-20261030`; mevcut eski `work` checkout'u ve yerel ERP sahibinin çalışma ağacı korunur.
- Test kaynak commit'i: `401b40e6261cd616c8477a08c62506da6263588c`. İzleyen belge commit'i test veya üretim davranışını değiştirmez.
- Teslim: [taslak PR65](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/65), hedef mevcut PR54 dalı; [güncel tam head CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/65/checks). Main hedeflenmez. PR oluşturulurken yerel owner'ın tabanı `9558b6660dfcf42190d7a8bfcfd1c1f76d7adb32` olmuştu; GitHub birleştirilebilirlik kontrolü çakışmasız. Owner'ın yeni kaynakları bu test dalına otomatik birleştirilmedi.
- Yerel ERP sahibinin etkin işi B6'nın üç prosedür/iki descriptor hash alanı için dar SQL bakım bağlantısıdır. Bu teslim o kodu, kurulumu, onayı veya kanıtı devralmaz.
- Değişen kaynak dosyası yalnız yeni `apps/sites-workflow/src/workflow/workSuppliersHistory.test.mjs`; ayrıca bu kanıt ve ayrı dalın STATUS notu. Üretim kaynakları, SQL, API, auth, config, bağımlılık veya workflow değişikliği yoktur.
- Kaynak öncesi kontrolde yeni test yolu tabanda yoktu; ayrı D2 teslim PR'si bulunmadı. Etkin yerel konuşmada görülen çalışma bakım/owner/installer hattındaydı. Görünmeyen kuyruk için sahiplik iddiası yapılmaz; bu yeni dosya ortak kaynaklara yazmaz.

## Somut test eksiği

`testSupplierWorkspaceAccess.test.mjs` normal giriş yönlendirmesinde tedarikçi modülünü stub'lar. `currencyAccountPresentation.test.mjs` gerçek parent/child bağlantısında tek hesap ve boş hareket listesinin yenilenmesini kapsar. `workBusinessPartyHistory.test.mjs` ise geçmiş denetleyicisini tek başına sınar.

Yeni dosya gerçek `createWorkSuppliers` → `createBusinessPartyHistory` → gerçek sorgu/yanıt modeli zincirini birlikte çalıştırır. Mevcut kaynak yükleme desenindeki yalnız CSS importu çıkarılır. Oturum servisi ve küçük DOM fixture'ı sentetiktir; ağ veya gerçek SQL bağlantısı yoktur.

## Eklenen doğrulama

1. İki USD hesabından ikincisi açıkça seçilir; tarih aralığı ve ikinci sayfa, parent yenilemesinde tek yeni geçmiş isteğiyle korunur. Alış/ödeme/ödeme iptali satırları gerçek modelden geçer; belge ve cari dövizi ayrı gösterilir.
2. Başka hesap, cari, müşteri alanı veya döviz kapsamındaki yanıt reddedilir; önceki finans satırları görünmez.
3. Gecikmiş eski kart detayı yeni seçilen tedarikçiyi ve hesap geçmişini değiştiremez.
4. Eski hesap geçmişi kart değişiminden sonra görünmez; dispose sonrası geç yanıt DOM'a yazamaz.
5. Yenilemede seçili hesap kaldırılmışsa aynı dövizdeki başka hesaba otomatik geçilmez ve eski hareketler temizlenir.

İlgisiz mal kabul, sentetik finans, iletişim yazısı ve müşteri satış fişi servislerine çağrı ayrıca kaydedilir ve sıfır olması doğrulanır; yakalanmış hata test başarısı sayılmaz.

## Teknik sonuç

Node `v24.19.0`, mevcut offline guard etkin:

```sh
node --require ./scripts/ci/offline-guard.cjs --test apps/sites-workflow/src/workflow/workSuppliersHistory.test.mjs
node --require ./scripts/ci/offline-guard.cjs --test apps/sites-workflow/src/workflow/workBusinessPartyHistory.test.mjs apps/sites-workflow/src/workflow/currencyAccountPresentation.test.mjs apps/sites-workflow/src/workflow/workSupplierContact.test.mjs
```

- Yeni dosya: 5 üst test + 4 alt senaryo, Node sayımı 9 PASS / 0 FAIL / 0 SKIP.
- Üç ilgili mevcut dosya: 28 PASS / 0 FAIL / 0 SKIP.
- Bağımsız salt okunur inceleme: engelleyici P0/P1/P2 bulunmadı; yeni dosya mevcut CI keşfine otomatik girer. Reviewer'ın aynı dokuz testi tekrar çalıştırması ek benzersiz test sayılmaz.
- Test-only değişiklik için yerel uygulama build'i, eski tam baseline veya Windows suite'i tekrarlanmadı. Tam kaynak CI sonucu PR'nin aynı head commit'inde ayrıca okunur; yerel PASS, hosted CI PASS değildir.

## Kalan sınır

Bu sonuç gerçek tarayıcı, native SQL, kurulu 5244 veya insan/personel kabulü değildir. D2'nin normal kurulum/bağlantı ve kaynak karşılaştırması açık; B6 bitince mevcut owner kendi sırasıyla ilerler. [Özgün insan kabul kaydı](../../../USER_ACCEPTANCE.md) ve 49 ERP / 25 CRM / 17 başlık / 74 yaprak sayımları değişmedi.

SQL/servis/config/hesap/rol/oturum değişimi, gerçek ticari işlem, deploy, merge, PR onayı, Vega/LIVE/T1 yazması veya dış iletişim yapılmadı. Yeni bakım veya onay yetkisi üretilmedi.
