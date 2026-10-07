# Goal7.3 — onaylı 16 tedarikçi hesabı TEST'e uygulandı

[PR23 onay6038754582](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6038754582), ERP-DEC-024 / ERP-MIG07.3. **Teknik tamamlandı; ERP-UA24 insan kabulü bekliyor.** Yalnız plandaki 16 F0103 tedarikçi hesabı: 14 TRY / 2 USD; 15 fark uygulandı, 1 hesap değişmeden doğrulandı. Müşteri hesaplarına veya diğer döviz hesaplarına yazılmadı.

## Önce / fark / sonra

Parent v04 planı değişmedi: hash `87d1afc526da80464e47249f69be5dc69ed78000645d13fdb94a1041828f19d0`, sourceVersionHash `8d0d72b5dd591e3a73f0c38dd504f556a675e9b89bc71cf9bdcea4ba1f6434eb`, financialWriteAuthorized:false. Kullanıcı onayını bağlayan yeni execution-v04 hash `4de684f0ae29d4a2a770095403a937a181c42c4f1a3cc3ee64a7e0d4481418ad`; kalıcı run `GOAL73-0fa4ec2f-23fd-4424-bd9b-7979372247cf`. Tutarlar yeniden hesaplanıp kapsam değiştirilmedi. Uygulamadan hemen önce onaylı 16 kaynağın iki geçişi, iptalsiz belge bağı, native kimlik/açılış/defter/yerel hareket/hold hashleri doğrulandı. Atomik T1 değildir; sonraki Vega hareketlerini içerdiği iddia edilmez.

Formül: **kabul edilen native açılış + korunan yerel etki + negate(kanıtlı yeni kaynak neti − kabul edilmiş kaynak neti)**. decimal(28,8) hesap/defter; yalnız mevcut ana döviz projection'ında decimal(18,4). TRY/USD/EUR birleştirilmez; cari türü/rolü ve hesap B/A yönü korunur. Bağımsız SQL 16/16 önce+fark=sonra=defter; 15 yeni fark hareketi / 15 audit / 16 journal satırı / 1 committed run. No-op hesap/defter/kart hashleri değişmedi; hareket/audit yok.

37 koruma kümesinde kapsam dışı eski kayıtlar aynı: stok, fiyat, müşteri, faturalar, ödemeler, kasa, sayım, iade, diğer hesaplar ve önceki defter/audit. Ayrı beş yetki/hold hash kontrolü PASS; yeni kullanıcı/rol/GRANT veya hold kaldırma yok. Başarısız önceki iki deneme rollback0 olarak private kanıtlıdır. İkinci denemedeki EXECUTE AS OWNER bağlamı için exact-plan guard, mevcut operatörün ORIGINAL_LOGIN sysadmin durumunu fail-closed doğrular; geçici değişen guardlar aynı transaction içinde orijinal byte/sırasına döndü ve bağımsız SQL ile doğrulandı.

## Replay ve geri dönüş

Committed aynı UUID/body tekrarında yeni etki **0**; farklı body GOAL73_UUID_BODY_CONFLICT. İlk yanıt teslim kanıtı olarak kullanılmadan kalıcı --status kaydı okundu. Parent plan+account unique kısıtı yeni UUID ile aynı onayın yeniden uygulanmasını engeller. Hesap + hareket + audit + journal tek transaction'da tutarlıdır.

Yeni COPY_ONLY / CHECKSUM yedek: 7.748.976.640 bayt, SQL VERIFYONLY PASS; SHA256 `949b835f062fc3d3d45f01e81de1bebde51dc3a624244e4b103c6d5e60232ca0`. Dosya: `C:\Sirket\ERP\backups\ERP-GOAL7-20261007\GOAL73_TEST_20261007_01.bak`. Private before-image/inverse plan hazır. Üç izole SQL temp hesabında batch telafisi sonraki yerel hareketleri korudu; gerçek 16 hesaba sahte ödeme/sayım yazılmadı. Önceki Goal6 gerçek ayrı restore DB'sinin ONLINE/READ_ONLY kimliği doğrulandı; yeni yedek aktif DB üzerine restore edilmedi. Gerçek batch inverse uygulanmadı; gerekirse mevcut bakiyeden yalnız batch etkisi çıkarılır, eski bakiye üzerine yazılmaz.

## Gerçek ekran ve paket

[Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers): güncel normal liste/kart, her hesabın dövizi ve B/A yönü; detayda 30 Eylül açılışı, korunan yerel hareket, onaylı kaynak bakiye güncellemesi ve güncel ERP bakiyesi ayrı. Mevcut yeşil tasarım korunur. TRY artış, USD azalış, B yönüne geçen tedarikçi ve no-op/diğer döviz görünürlüğü dört gerçek örnekle doğrulandı; ham ekranlar private. Eski source-comparison index'in tarihi/rapor uyarısı aynıdır: tarihli eski karşılaştırma, yeni efektif bakiye değildir.

TEST86: `C:\Sirket\ERP\releases\CANONICAL-GOAL73-TEST-20261007-86`; uygulama source769031cb88de8ab26720266c62ce0e63d62d0877, finans writer sourcec9e0629714db312602d24dae121387fd6decdad8. Web5194/API4144/native4146; Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01; API/native sysadmin0, LIVE erişimi0. Runtime config aynı; LIVE/CRM beş süreç kimliği aynı. Finansal batch TEST85/source7a7c01f çalışırken writer c9e0629 ile işlendi; TEST86 yalnız güncel okuyucu/gösterim paketidir ve batch tekrar uygulanmadı. TEST85 ara paket kanıtı ayrıca korunur; source commit ile izleyen doküman HEAD'i ayrı tutulur.

Gerçek detay API 16/16; medyan TEST85 önce 119ms → TEST86 sonra 106ms. Katalog50 üç cold/warm örnek 1331/676/814ms; katalog kodu değişmedi, bu küçük örnekten performans kazancı iddia edilmez. 488 API / 618 ekran / 55 migration testi PASS. Uygulama exact [push CI37635080643](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37635080643) / [PR CI37635088356](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37635088356), writer exact [CI37633381145](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37633381145): 3/3 SUCCESS. Son doküman HEAD sonucu PR23checks ve repo dışı final-delivery makbuzunda doğrulanır.

[Anonim teknik kanıt](../../evidence/erp/2026-10-07-goal73/README.md). Ham kaynak/tutar/önce-fark-sonra/manifest/ekran kanıtı: `C:\Sirket\ERP\evidence\ERP-GOAL7.3-20261007\private` (ACL; Git'e alınmadı).

## Kalan

İnsan ERP-UA24 bekliyor. Genel migration D02/D06 açık; 30 hassasiyet kanıtı, 27 açılış/devir, dört yeni kart, LL/(-) ve diğer ayrı kaynak kararları bu onay kapsamında değildir. Finish **49 toplam / 9 tamam / 34 kısmi / 6 açık** aynı. Goal7.3 teknik tesliminden sonra duruldu; başka aktarım/Goal/CRM/LIVE/Vega write/main merge otomatik başlamaz.
