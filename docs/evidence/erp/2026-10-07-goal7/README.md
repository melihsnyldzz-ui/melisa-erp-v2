# Goal7 — Faz A ve güvenli Faz B teknik tamamlandı

İnsan karar/kabulü bekliyor; genel migration/cutover PASS değildir. [Anonim makine kanıtı](summary.json), [T0 analizi](../../../erp-v2/canonical-20261007/goal7-analysis-summary.md), [T0/T1 ve arşiv planı](../../../erp-v2/canonical-20261007/goal7-cutover-archive-plan.md).

## Gerçek kaynak ve TEST delta

7 Ekim00:40:52–00:41:05TRT T0 sekiz projeksiyon iki geçiş sabit; atomik snapshot/T1 değil. Vega SELECT-only/source a681b7f98003fa1c61dc57bda25f725536849efadc0d823f81c875c4909b53e4. Eski71/341/74 tarihsel; güncel86yeni/752değişen ürün,29müşteri/56tedarikçi. Kaybolan ürün0; kapsam84new/748changed.

563güvenli quantity atomu563nativehareket/1126write.45ürün önceki yerel etkisi ve321NULLcost korunur. Ayrı source-native49new/12master:241priceinsert16update,62barcode49alias43nonzeroopening/468nativewrite. Yeni maliyet20kanıtlı29NULL. Cari/FXwrite0;176sourcehold/172nativehold, RUN06 ve önceki yerel history korunur.

Mühürlü version16671products/64015prices. Satır bazında eski30Eylül veya yeni7Ekim lineage; tüm fiyatlar güncelVega diye sunulmaz. Stok native okuma anından gelir. Eski dört reader gövdesi/C09 byte-exact, yeni dört opt-in companion reader exact source/hash/guard proof ile okunur. Frontend16622/tarih sabit kabulü yalnız mühürlü current sürüme uyarlandı; tasarım/debugcopy eklenmedi.

## Replay ve bağımsız mutabakat

İki gerçek source replay0; stock replay immutable effectini doğrular. Source-native replay immediate46global seal ile kanıtlı; sonra ilgisiz business drift altında tekrar çalışacağı iddia edilmez. Same stock UUID/farklı documentDate/hash gerçek writer DELTA_RUN_PAYLOAD_CONFLICT/0write.

Bağımsız native SELECT:563stock ve468nativeeffect,49new/12preservedstockcost/43opening/46protectedtable/16guard fark0. Importer staging tek kanıt değil. Cari/FX önceki yerel defter hashleri değişmedi; güncelVega finansı anlam belirsizliği nedeniyle uygulanmadı.

## Committed rollback

Gerçek committedfixture−2 → daha yeni normal nativecount−1 → committedinverse+2: stok30→28→27→29; count/audit aynı ID/hash. Ayrı nativecleanup+1→30; iki sayım ve migration etkileri geçmişte kalır. Fixture/inverse replay0. Fixture20opening özgün provisioning dosyası ve live scope row hash ile kanıtlı;30−10 farkından tahmin edilmedi. Bu offset source-safe writer için uygulanmaz. Açık transaction rollback/aktifDBrestore yok.

## Negatifler ve kanıt düzeyi

| Koruma | Kanıt |
| --- | --- |
| Çift source/target, çoklu barkod/sahiplik | Offline plan/SQL builder rejection; gerçek belirsizler batch dışında |
| Bilinmeyen birim/temsil edilemeyen miktar | Offline rejection; gerçek10unit/13quantity review dışında |
| LL/tanınmayan döviz ve hesap dövizi | Offline rejection + gerçek privatekarar;financewrite0 |
| AnaBAKIYE/FX semantiği |276diagnostic karar listesi; zorla eşitleme yok |
| NULLcost | Gerçek29newNULL/321stockNULLpreserved;sıfıra dönüşüm yok |
| Kaynak negatifstok |2005inscope açık;160redquantity delta uygulanmadı |
| Sonraki yerel hareket | Gerçek count−1/audit inverse sonrası hash aynı |
| Capture/plan/beforeimage drift | Offline guard rejection + actualTEST pinnedbeforeimages |
| Same run replay | İki source vefixture/inverse gerçek0write |
| Same run farklıpayload | Gerçekstockwriter conflict0write |
| YanlışDB/LIVEDB | Offline guard rejection + actualexactTESTidentity;LIVEdeneme write yok |

103hedefli migration/reader/API test;50frontend hedefli test; bağımsız reviewer69frontend/workspace PASS. Teknik test insanPASS değildir.

## Normal ekran ve hız

TEST83 katalog okuyucusu, her istekte 16.671 sürüm kaydını geçici tabloya kopyalamak yerine mühürlü sürümün mevcut indekslerini kullanır. Kaynak/hash, immutable trigger, native eşleşme, yetki, karantina, medya ve transaction kontrolleri korunur. Stok, fiyat detayı ve sipariş okuyucuları TEST82 ile byte düzeyinde aynıdır. Beş ek SQL builder testi ve bağımsız review geçti.

TEST82 ara ölçümünde ilk sayfa 890 ms ve kod arama 851 ms idi. TEST83'te bunlar 777 ms ve 568 ms oldu. TEST77 başlangıcına göre ilk ve ikinci sayfa hâlâ daha yavaştır; aşağıdaki tablo bunu açıkça gösterir. Tüm liste ölçümleri bir saniyenin altındadır; güvenlik kontrolleri hız için gevşetilmedi.

[Ürün & stok](http://127.0.0.1:5194/ornek-akis.html#stock):64card native kod/ad/stock/main-sale tuple fark0. Baştaki sıfırlı01240465102508→29880,50+50disjoint,3830confirmedmedia/4620hold korunur. Gerçekbrowser yeni/yenilenmiş ürün, eskifotoğraf, barkod ve sayfa kanıtı privateACL; rawcommercial ekran Git alanına girmez.

| API ms medyan | TEST77 önce | TEST83 sonra |
| --- | ---: | ---: |
| first50 | 613 | 777 |
| next50 | 562 | 723 |
| code | 521 | 568 |
| barcode | 353 | 367 |
| card | 199 | 233 |

Beş gerçek authenticated request/case; aynı Molly barcode (leading-zero hız benchmarkı değil). Leading-zero ayrı doğrulandı. İlk yanlış barkodla sıfır sonuç veren deneme ölçümden çıkarıldı. Startup ve ağır SQL prova sırasında fail-closed503 gözlendi; idle tekrar64cardtam geçti.50/lazythumbnail davranışı korunur.

## Paket / backup / sınır

TEST83/source e2ffea6c96430699a37e0227c28f76fc66e22851;manifest 92b2dcd249b27f004b8a6b1f4ddfdfb2f56e967108521d5518e1a055afe6363b;1428files/baselineReproduced. Son docsHEAD uygulama source değildir. Branchcodex/erp-finish-20261004/[PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), exactfinalCI teslimde okunur.

Yeni COPY_ONLY/CHECKSUM/VERIFYONLY backup7.283.474.432byte/SHA C94267CED54085DA3A4D9C935E9D4DDBBE982CCCA56DE589BCC288D42DA62B53. AktifTEST/LIVErestore yok, Goal6restore kanıtı korunur. LIVEPIDs aynı. CRMsource77a2fa34/config değişmedi; mevcut recovery23:12:19kendi supervisor çıkışından sonra yeniden başladı, ajanCRMrestart komutu vermedi. TümCRMPIDler aynı iddiası yok.

## Melih kararı ve durma

Private ACL karar paketi: C:/Sirket/ERP/evidence/ERP-GOAL7-20261007/analysis-private/final-04/MELIH_KARAR_PAKETI_20261007.md;SHA 9fb08aa63293504c070de62f3513501d37e9fbd1d31f40460ce3874ed6078a20.54ürün/28müşteri/94tedarikçi,LL/$2/nonzero alış döviz kanıtı,20special,barcode/unit ve40yönetilebilircost önceliği. Öneri onay değil. TRY/USD/EUR ayrı;276card/ledgerdiagnostic confirmedmismatch değildir.

T0/T1 tümwriter/offlineterminalcutoff/sondelta/replay0/nativefark0/işletmekabulü/tekMelisawriter; VegaREADONLY/historicalSELECT planı hazır. GerçekT1/yetki değişikliği/LIVE/CRM/mainmerge/historicalinvoiceimport yok. Goal7 sonunda duruldu. UA19–23bekliyor.
