# Eksik cari kartı hazırlığı — 27 Ekim 2026

Bu teslim source ve çevrimdışı fixture hazırlığıdır. Gerçek kart/bakiye yazılmadı; 5244/5194, hesap, rol, grant veya profil değiştirilmedi. Çalışan uygulama veya insan kabulü değildir. Mevcut ERP03/A01–B02 kapsamı korunur.

## Mevcut yol ve somut boşluk

Normal `customerService.createCustomer` / `supplierService.createSupplier` yeni yerel kart için transaction, duplicate kontrolü ve audit kullanır; fakat bakiyeyi 0, aktifliği true başlatır ve Vega şirket/ID/UID–party entity–currency account–source link zincirini oluşturmaz. Bu yöntem eksik kaynak kartına doğrudan uygulanmadı. Telefon veya kaynakta olmayan alan üretilmedi.

`mapping-opening.mapOpening` mevcut migration eşleyicisidir: bilinmeyen ana kart ve hesap bakiyesini NULL/UNKNOWN olarak korur, finans açılışı üretmez. Yeni `party-card-completion-plan.mjs` yalnız bu eşleyiciye tek eksik kartın iki geçişli kaynak/yokluk kanıtını bağlayan saf hazırlıktır. SQL/bağlantı/CLI/writer/engine içermez ve hiçbir durumda executionAllowed=true üretmez.

Önceki 283 tutar yazıcısı ve eski frozen opening run'ı yeni kart için değiştirilmedi veya tekrar çalıştırılmadı. Yerel/finans geçmişi ve 283+16 korunur.

## Gerçek aday ve korumalar

İlk aday F0102/TBLCARI/5536'dır. Kaynak UID (Vega'nın süslü parantezli GUID biçimi dahil), tam kod, şirket ve fiziksel kaynak ID aynen korunur. Dar güncel SELECT-only iki okumada aynı kaynak; mevcut native kaynak anahtarı/kod sahibi0, link0, hold0. Ham isim/kod/UID ve before-image'lar yalnız private kanıttadır.

Hazırlık bir parti/kart ve bir ayrı USD hesap kaydı için mapped payload üretir; iki bakiye NULL, durum UNKNOWN; **finans hareketi0**. Kaynak SUM adayı veya ham kart BAKIYE doğrulanmış açılışa çevrilmez. İleride gerekli native tablolar müşteriler/tedarikçiler, party_entities, party_currency_accounts ve party_source_links'tir; native ID henüz yoktur ve uydurulmaz.

Şirket/rol uyuşmazlığı, UID drift/eksikliği, kod veya kaynak bağı sahibi, mevcut karta zorla bağlama, hold, kaynak status belirsizliği, bilinmeyen döviz, LL324/379 ve native metin kapasitesi aşımı reddedilir. Pasif STATUS2 kart korunur; farklı şirketlerde aynı sayısal ID/ad ayrı kimliktir. Diğer 19 eksik kart için UID/yokluk kanıtı alınmış veya uygulama planı tamamlanmış iddia edilmez.

## Neden gerçek aday henüz uygulanabilir değil?

1. Kullanıcının 5244'ü sentetik CLEAN DB'ye, varsayılan teknik hedef TEST125 gerçek-veri DB'sine bağlıdır. Plan bunu **ASSUMED_TEST125_NOT_USER_WORKFACE_5244** diye işaretler. Tek DB/normal oturum/rol ve günlük adapter uyumu henüz çözülmedi.
2. Gerçek TEST125'te `customers.balance` ve `suppliers.balance` NOT NULL ve varsayılan0; `party_currency_accounts.current_balance` ise nullable. Hazırlık `UNKNOWN_BALANCE_NOT_NULL:customers.balance` ile durur. NULL yerine 0 koyma, implicit default kullanma, constraint/guard gevşetme veya şema değiştirme yapılmadı.

Bir sonraki dar kaynak işi, seçilmiş tek uygulama/DB hedefinde bilinmeyen ana kart bakiyesinin depolama **ve bütün kullanılan okuyucularda** doğru sunulacağı sözleşmeyi belirlemektir. Yalnız ayrı hesap satırını UNKNOWN yapıp eski DTO'ların 0 göstermesine güvenilmez; normal kart oluşturma yolunda balance için 0/NULL dönüşümü vardır. Bu sözleşme ve mevcut guarded insert admission tamamlanmadan gerçek insert yoktur. Daha geniş şema değişikliği gerektiği varsayılıp kendiliğinden uygulanmaz.

## Fixture ve geri dönüş

8 hedefli test geçti: UNKNOWN/no opening, mevcut NOT NULL/hedef engeli, gerçek UID biçimi ve drift, pasif/unknown status, şirket/rol ayrımı, kod/link/hold/yerel hedef reddi, LL/döviz ve metin sınırları. Fixture'da nullable sözleşme hazırlanabilir; çıktı yine runtimeInstalled=false/executionAllowed=false. Gerçek DB test/restore/kurulum yapılmadı, eski kapsam CI/build tekrarlanmadı.

Gerçek yazma öncesi kaynak/UID/kod ve yokluk CAS'i tazelenmeli, tek owner ve güncel yedek doğrulanmalıdır. Commit öncesi mevcut transaction rollback; commit sonrası yalnız gerçek yeni ID/rowHash ve sonraki belge/hareket referansları kontrol edilerek dar inverse. Eski 283/16 veya sonraki yerel hareketleri kaldıran restore/reset yoktur. Bu aşamada geri alma işlemi gerektiren DML oluşmadı.

Private: `ERP-CARICOMPLETION01-20261008/private/review-20261027/card5536-contract.json`, `card5536-offline-preparation*.json`; genel sayım ve 20 eksik kart `current-party-readiness.md` içinde. Ham ticari veri GitHub'a yüklenmedi. İnsan kabulü bekler.
