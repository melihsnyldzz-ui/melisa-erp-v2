# Goal7.2 — cari aktarımına hazır kapsam

7 Ekim 2026. ERP-DEC-022; [PR23 görev kaydı](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6035708061). Goal7.1 araştırması yeniden başlatılmadı. Bu teslim salt okunur araştırma, hesap bazında plan ve offline doğrulamadır. **Finans uygulanabilirliği tamamen kanıtlanmış hesap: 0; gerçek yazma: 0.**

## Başlangıç ve değişen kanıt

Başlangıç kaynak teslimi `35a70a14ca3309fc6658ca9d5824d81f35d20f0d`; çalışan TEST84 uygulaması `07101548d4af1f4a9344fe7cf7f19e64ffa26edb`. Yeni paket/restart/deploy yok. Web5194 → API4144 → native4146; `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01` aynı kaldı. Kaynak Vega `DESKTOP-KSRK0EQ / VEGA2026`, F0102/F0103, D0007/2026. ERP-DEC-021 tutar+döviz+B/A ve rol korunumu yürürlükte.

| Kanıt | Goal7.2 sonucu |
| --- | ---: |
| Önceki araştırma kapsamı | 200 cari / 209 ayrı ham döviz hesabı |
| Dört eksik bağın somut sonucu | 4 hedef kart yok; 4 ayrı yeni kart planı |
| Güncel kaynak hareketi / exact belge bağı | 3.806 / 3.806 |
| 1 Ocak 103/104 satırı / exact iptalsiz başlık | 86 / 86 |
| Önceki sürümden değişmiş cari | 10 |
| Değişmiş/yeni hareket satırı / silinmiş kaynak satırı | 14 / 1 |
| Güncel iki geçişte sabit projection | 4; atomik snapshot değildir |
| Önceden native açılış+yerel ile mutabık araştırma hesabı | 84 |
| Yenilenen sayısal sıfır dışı fark | 77; aktarım onayı değildir |
| Bu havuzda açılış ve dönem belge bağı kanıtlı hesap | 57 |
| Bu havuzda açık açılış kanıtı olmayan hesap | 27; 14'ünde önceki dönem hareketi var |
| Dönemde hareket bulunmayan hesap | 83; sıfıra dönüştürülmedi |
| LL hesabı | 2; diğer hesapları engellemez |
| Tarihli bağımsız Vega Döviz Bakiye mutabakatı | 0 |
| KANITI TAMAM / KANIT EKSİK / İŞLETME KARARI / EŞLEŞME YOK | 0 / 203 / 2 / 4 |

14 değişmiş/yeni satır, 14 ticari fark veya 14 cari demek değildir. Değişim 10 kaynak caride görülmüştür. Kart projectionları değişmemiştir. Eski 12:06 yakalamasının tutarı güncel borç olarak kullanılmaz. Kaynak yenilemesinde yalnız hash farkı olan carilerin neti yeniden hesaplandı; önceki bağımsız 3.799 satır/192 grup aritmetik kanıtı korunur. Güncel belge ilişki kontrolü ayrı yeni kanıttır; yeni bağımsız Vega raporu yerine geçmez.

## Dört kimlik bağı: araştırma kapandı, kart oluşturma ayrı iş

Dört F0103 tedarikçi kimliği için hem müşteri hem tedarikçi tarafında exact kaynak anahtarı/kod/UID; party entity, source link, döviz hesabı ve kaynak alış belgesi kayıtları tarandı. Karşılık **0**. Kaynak UID'leri F0102/F0103 içinde tekil, alias boş, kartlar Eylül2026'da açılmıştır. Dokuz dönem hareketinin gerçek alış/ödeme başlıkları exact bağlandı. İsim/telefon benzerliği kullanılmadı.

Her biri için repo dışındaki planda kaynak şirket+dönem+ID+UID, kod/ad, tedarikçi rolü, TRY hesabı, kaynak hash, gerekli alanlar ve ayrı `NEW_CARD_REQUIRED` sonucu vardır. Mevcut olmayan hedefi arama döngüsü bitmiştir. Yeni kartın oluşturulması/bağlanması, native ID tahsisi ve finans açılışı **uygulanmadı**. Kart kurulsa bile mevcut kaynak hold'u korunmalı; finans bilgisi doğrulanmadan bilinen sıfır ilan edilmemelidir. ID'ler ve ticari bilgiler public Git'e konmadı.

## Devir, dönem ve iptal

Kaynakta 103/104 kodu yalnız sayısal benzerlikle yorumlanmadı: `(şirket,dönem,LN=başlıkIND,FIRMANO,BELGETIPI,belge no)` exact bağı ve başlık iptal durumu okundu. 86 satır **TBLSTKGIRBASLIK / TBLSTKCIKBASLIK** belgelerine tekil bağlandı; 1 Ocak, aynı cari/döviz ve iptalsiz başlık koşulları sağlandı. Ayrı `TBLCARGIRDEVIR` tablolarının boş olması açılış yokluğu diye yorumlanmadı. [17 Eylül tarihli mevcut işletme kuralı](../vega-2026-opening-patch-2026-09-17.md) 1 Ocak Vega açılışını esas alır; eski TEST patch'i bugünkü DB'ye uygulanmış sayılmadı.

3.806 güncel hareketin typed başlık bağı exact ve iptalsizdir. 30/31 bu hesap kapsamlarında 0; bu yokluk başka hesaplara dahil/hariç kuralı olarak genellenmez. Hareket anahtarı tekilliği ve açılış/dönem ayrımı korunur. Dönem defterindeki açılış ayrıca ikinci kez eklenmez. Native 84 hesaptaki kabul edilmiş açılış+yerel=hesap=defter kanıtı, 12 tablo SHA/count ve iki okuyucu definition hash'inin Goal7.1'den beri değişmemesiyle tekrar kullanıldı.

57 araştırma hesabında açık açılış ve dönem belge zinciri tamamdır; kalan ortak eksik **tarihli bağımsız rapor**dur. 27 hesapta explicit açılış yoktur: 14'ünün 2025 hareketi vardır, 13'ünde bu dövizde 2025 hareketi bulunmamıştır. Bu sayılar sıfır veya taşıma onayı değildir. Her hesabın eski dönem satır sayısı ve sonraki tek kanıt adımı private matriste bulunur. Açılışı olmayan bir hesap 57 hesabın rapor mutabakatını bekletmez.

## Vega Döviz Bakiye: bulunan ve bulunamayan

Mevcut qqq.xls SHA'sı korunmuştur; tarih/şirket/period/cardtype/aktif/zero filtresi kanıtlı değildir. Yeniden istenmez ve güncel miktar onayı yapılmaz. Desktop/Telegram'da bu kapsamı kanıtlayan yeni Excel raporu bulunmadı.

Mevcut SELECT hesabında **VIEW DEFINITION=0, VIEW SERVER STATE=0**; DML/EXEC yetkisi de0. Cari view'ların tanımı NULL dönüyor; izleme veya yetki değişikliği yapılmadı. TBLRAPOR'daki11 kayıt finansal tablo şablonlarıdır, tarihler boş; gereken cari bakiye çıktısı değildir.

Yerel `C:\VEGA ESKİ` rapor DLL/FR3 dosyaları salt okunur incelendi, SHA kaydedildi. Özet rapor DLL'sinde DOVIZBAKIYE SQL parçası bulundu: hareket dövizi bazında net, ROUNDYTL ve boş/sıfır kur için1 fallback içeriyor. FR3'te negatif A, pozitif B, sıfır `(-)` koşulu ve iki ondalık formatı bulundu. **Bunlar arşiv sürümüne aittir; çalışan Vega rapor sürümü, filtre parametreleri ve tam sorgu zinciri doğrulanamadı.** Bu nedenle fragmentlerden yeni “resmî rapor” üretilmedi; kur fallback'i migration'a taşınmadı. qqq'deki her `(-)` sıfır ilan edilmedi. Küçük exact tutarlar ve yuvarlama farkı ayrı kalır.

Gerekli tek dış kanıt adımı: **Vega “Cari Hesap Listesi (Özet)” ekranından aynı kesim için F0102 müşteri ve F0103 tedarikçi ayrı çıktıları**. Firma/period2026-D0007, başlangıç01.01.2026, bitiş07.10.2026, kart türleri/aktiflik tümü, sıfır hesaplar dahil, para birimi filtresi tümü; FirmaKodu/kaynakID, Döviz Bakiye, ParaBirimi, B/A. Filtre ekranı ve rapor üretim tarihi/saatinin çıktıda veya yan kayıtla korunması gerekir. Genel Bakiye yerine Döviz Bakiye alınır. Aynı ekranın iki firma çıktısı tek rapor paketidir. Bu kanıttan sonra yalnız değişmiş hesaplar yeniden yakalanır; rapor ile kaynak belge sonucu bağımsız karşılaştırılır. İki geçişli SELECT, atomik T1 veya resmî rapor değildir.

## LL: genel soru tekrar edilmez

[Görev yorumunda](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6035708061) ve [önceki CRM ERP sohbetindeki](https://chatgpt.com/c/6ac01ba3-0444-83eb-9ea8-1bb9d7ae5012) açıklamada LL, 27 Eylül kaydına atıfla kullanılmadan kalan TL alternatifi %5 fiyat denemesi olarak tarif edilir. Bu tur orijinal27Eylül karar belgesi bulunamadı; bu atıf yeni bir işletme kararı veya bağımsız orijinal belge doğrulaması sayılmadı. “LL neden oluşturuldu?” sorusu kullanıcı listesinden çıkarıldı.

İki güncel LL hesabındaki tek hareketler gerçek 104 / 1Ocak stok çıkış açılış başlıklarına bağlandı; her iki belge LL ve kayıtlı0,95 kur taşıyor. Önceki dönem LL hareketleri ayrıca private pakette tutuldu. Bu kanıt tutarın kaynak belgesini açıklar, güncel gerçek TL karşılığını veya kullanılmayan denemenin nasıl kapatılacağını onaylamaz. UNKNOWN/hold korunur; LL tutarı silinmez/sıfırlanmaz/TL'ye çevrilmez. Kalan olası işletme kararı yalnız **belge mutabakatından sonra bu iki eski deneme hesabına yapılacak ayrı işlem**dir; genel döviz tanımı tekrar sorulmaz.

## Hesap bazında öneri ve doğrulama

Private planın209 satırında kaynak kimliği/rol/döviz/target, carry ve dönem kanıtları, rapor eksikliği, kabul edilmiş eski kaynak neti, yeni kaynak neti, native açılış/korunacak yerel etki/current/defter, exact kaynak farkı/native işareti/beklenen tanısal sonuç ve somut eksikler bulunur. 84 hesabın77 farkı yalnız tanısaldır; 57 hesabın devir/dönem kanıtı tamam olsa da resmi rapor olmadan `KANITI TAMAM` verilmedi.

`sourceDelta = verifiedNewSourceNet - acceptedSourceNet`; müşteri native işareti korunur, tedarikçi ters eşlenir. `expectedNative = acceptedNativeOpening + preservedLocalEffects + mappedDelta`. Semantik eşitlik eksikse öneri uygulanabilir değildir. Açılış yorumu yanlış çıkarsa ayrı opening-correction planı gerekir; delta içine saklanmaz. Bakiye overwrite yok.

Yeni `party-currency-readonly-plan.mjs` yalnız in-memory proposal/verify'dır; DB/file/writer bağlantısı yok. Her hesabın eksik kanıtı diğer hesabı etkilemez. Gerçek hazır plan boş kapsamlıdır; gerçek para yazması yok. Offline sentetik9 test: determinism, tiny amount, rol işareti/yerel etki, tarih/filtre/bağımsız rapor, hold/carry/dönem, no-movement/zero/LL/kimlik, replay/body/run/source çatışması, yeniden hash'lenmiş yanlış proposal, target/ledger drift ve opening-correction ayrımı. Sentetik örneğin teknik sonucu gerçek ticari hesap kabulü değildir.

Aktif raporun iki ondalık yuvarlama ve yön sırası ayrıca hash'li kaynak kanıtıyla doğrulanmışsa, yalnız rapor mutabakatında bu gösterim uygulanabilir. Örneğin exact negatif küçük tutarın raporda0/(-) olması kaynak tutarını sıfırlamaz; native delta sekiz ondalık exact değeri korur. Bu mod eski DLL/FR3'ten tahminle açılmaz. Şu an gerçek report witness eksiktir. Planın bayrakları bağımsız kaynak doğrulamasının yerine geçmez; ileride gerçek writer kullanımı için ayrıca güncel source/hold/native witness kontrolü gerekir.

Sonraki **ayrı onaylı** TEST uygulaması için: yalnız KANITI TAMAM alt kapsam + güncel backup/restore doğrulaması + source/version/native/hold guard + immutable batch/tekUUID + replay0 + bağımsız after mutabakat + yalnız batch etkisini tersleyen inverse + sonraki yerel hareketin korunumu. Bu plan backup/restore/reset veya gerçek finans writer'ı yetkilendirmez.

Private kanıt: `C:\Sirket\ERP\evidence\ERP-GOAL7.2-20261007\private\ACCOUNT_TRANSFER_PLAN.md`, `account-transfer-plan.json`, `four-card-create-plan.json`, `summary.json`. Ham bakiye/isim/rapor public Git'te yok. [Anonim teknik makbuz](../../evidence/erp/2026-10-07-goal72/README.md). D02/D06 açık; finish49/9🟢/34🟡/6🔴, ERP-UA24 ve önceki insan kabulü bekler. Goal7.2 sonunda başka işe/finans uygulamasına geçilmez.
