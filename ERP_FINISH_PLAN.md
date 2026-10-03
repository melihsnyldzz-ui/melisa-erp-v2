# Melisa ERP — bitirme planı

Güncel yerel kaynak toplama: [3 Ekim kanonik baseline](docs/erp-v2/canonical-20261003/README.md). Aşağıdaki ilk envanter, EVDEKIPC devir anının tarihsel kaydıdır; SEMIH kaynak eşlemesi bu bağlantıdaki kanıtla güncellenir.

Güncelleme: 3 Ekim 2026. Bu dosya ERP bitirme işinin **tek güncel kaynağıdır**. Kısa görünüm: [STATUS.md](STATUS.md). Kaynak ve ortam kanıtları: [envanter](docs/erp-v2/inventory-20261003.md).

## 3 Ekim SEMIH sonucu — bu bölüm güncel

F02 teknik kaynak/runtime baseline tamamlandı; Android fiziksel kabul ayrı. F03 dosya farkları sınıflandı; değişen işlevlerin eski kabulü otomatik taşınmadı. F04 kesin paket ve salt okunur smoke tamamlandı. Kullanıcı son seçiminde **Sites yeşil arayüzünü** istedi; 5194 eski LIVE UI yerine onu sunar. F05 açık: Sites iş akışlarının gerçek TEST SQL/native ile uçtan uca uzlaştırılması. F06 LIVE geçişi yapılmadı.

Paket commit: dc2fdfeece74f7fd89d9b22f36c89264c4cd0710. 354 Sites + 15 baseline testi, 26 smoke PASS. [Kanonik kaynak dalı](https://github.com/melihsnyldzz-ui/melisa-erp-v2/tree/codex/canonical-live-20261003). [Son teslim kaydı](docs/erp-v2/canonical-20261003/delivery.json). Aşağıdaki önceki host envanteri tarihsel devir kaydıdır.

## Çalışma ilkesi ve mevcut durum

**Çalışanı koru; kanıtlı kabulü yeniden açma; dağınık kaynakları eşleştir; yalnız gerçek eksikleri düzelt.** Mevcut çalışan ERP işlevsel baseline'dır. GitHub'da en yeni tarihli dosya veya `main` etiketi, kendiliğinden çalışan sürüm anlamına gelmez.

ERP sıfırdan yapılmayacak. [9 Temmuz insan kabulü](docs/erp-v2/final-human-acceptance-log.md) ve Eylül ayındaki sınırlı gerçek SQL/tarayıcı kabulleri korunur. Bunlar kendi sürüm ve kapsamlarında geçerlidir; yeni bir ortamın tamamı için otomatik kabul sayılmaz. Bir özellik ancak somut hata, ilgili kod değişikliği veya farklı veri kaynağı varsa yeniden incelenir.

3 Ekim'de inceleme **EVDEKIPC / WARD-V2** üzerinde başladı. Yerel eski kaynaklar ile GitHub incelendi. **SEMIH'teki çalışan kaynak, tüm worktree'ler, TEST/LIVE süreçleri ve gerçek DB kimlikleri henüz doğrudan envanterlenmedi.** Bu nedenle kanonik deployment seçimi ve TEST kurulumu tamamlanmış değildir. Kullanıcı aynı sohbeti SEMIH'e geçiremediğini ve orada yeni sohbet açacağını bildirdi. Devir kaynağı bu dosyadır; kullanıcı uzun görev metnini yeniden taşımayacak. Yeni sohbette önce araçların host/çalışma yolu kontrol edilir.

Bu oturumda mevcut ERP kopyalarına, servislere veya ticari verilere müdahale edilmedi. GitHub `main`den bağımsız `codex/erp-finish-20261003` dalında dokümantasyon hazırlanıyor. Bu dalın tabanı `577c0cb9d0953635b30088fa23e1e887c7b75775`; LIVE tabanı olarak kabul edilmedi.

## Yetki ve ilerleme

Kullanıcının 3 Ekim talimatı, TEST'te gerekli kod düzeltmesi, restart, branch/commit/push ve testleri ayrıca onay almadan yürütmeye izin verir. Eski dokümanlardaki genel onay maddeleri bu yetkilendirilmiş işler için tekrar onay döngüsü oluşturmaz. İşe ek bridge, test kotası veya yapay onay paneli eklenmez; uygulamanın gerçek kullanıcı yetkileri ve ticari veri bütünlüğü korunur.

Yalnız geri dönüşü zor LIVE değişikliği, veri kaybı, gerçek ticari kayda istenmeyen yazma veya credential riski için açık onay istenir. TEST adlı bir servisin gerçekten ayrı DB'ye bağlı olduğu anlaşılmadan ticari test yazımı yapılmaz. Şifre, token, connection string, müşteri dökümü, yedek ve ortam dosyası Git'e girmez. Eski kopyalar kanıtlanmadan silinmez.

## Tek repo ve ortam düzeni

Mevcut `melihsnyldzz-ui/melisa-erp-v2` ailesi korunacak; yeni ERP reposu açmaya şu an gerek gösteren kanıt yok. Uygulanacak düzen:

| Parça | Hedef | Bugünkü durum |
|---|---|---|
| Kaynak | Tek ERP repo; web/API/native terminal ve gerekli ortak sözleşmeler burada | GitHub aile ve dalları bulundu; SEMIH kaynakları eksik |
| `main` | Kabul edilmiş kaynak; çalışan LIVE sürümü ayrıca tam commit ile kayıtlı | Mevcut `main` ile LIVE eşitliği bilinmiyor |
| `candidate/test` | Çalışan baseline üzerine yalnız seçilmiş eksik/düzeltmeler | Çalışan baseline eşleşmesinden sonra kurulacak |
| TEST | Web 5194 → API 4144 / native 4146; tek launcher ve açık TEST etiketi | Kullanıcının bildirdiği düzen; güncel yerel süreç/DB kanıtı bekliyor |
| LIVE | Web 5188 → API 4114 / native 4116; sabit sürüm ve geri dönüş kaydı | Kullanıcının bildirdiği düzen; mevcut çalışma korunuyor |
| Geliştirme | API 4100; TEST/LIVE ile karıştırılmaz | SEMIH Tailscale adresinden health/version yanıtı alındı |
| Vega | VEGA2026 kaynak bağlantısı ayrı kaydedilir | Kaynak rolü biliniyor; güncel server/instance/firma/dönem eşlemesi eksik |

Her deployment kaydı yalnız host, checkout yolu, branch, tam commit, varsa yerel fark özeti, web/API adresleri, servis/launcher adı, DB server/instance/adı, rolü ve son kabul bağlantısını içerir. Gerçek secret içermez. Host görülmeden yeni port, ikinci TEST veya tahmini DB yaratılmaz. Geri dönüş; önceki uygulama sürümü ve yapılandırmasıyla yapılır, iş kayıtlarını silerek yapılmaz.

## Önce yapılacak somut işler

| İş | Durum | Tamamlanınca görülecek sonuç |
|---|---|---|
| F01 — EVDEKIPC ve GitHub kaynak envanteri | Tamam, kapsamı sınırlı | 10 mevcut ilgili repo + bu inceleme checkout'u, korunacak yerel farklar, 14 uzak dal kayıtlı |
| F02 — SEMIH çalışan kaynak eşlemesi | SEMIH erişimi bekliyor | LIVE/TEST süreç → dosya → commit → DB haritası; native backend dahil |
| F03 — Değerli adayları çalışan kaynakla uzlaştırma | Karşılaştırma kısmen hazır | Her fark için zaten mevcut / alınacak / gereksiz kararı; eski kopyalar korunur |
| F04 — Tek TEST çalıştırma ve sürüm kaydı | F02'ye bağlı | Kullanıcının açabildiği 5194 ve doğru TEST API/DB bağlantısı |
| F05 — Gerçek iş akışındaki açık eksikleri kapatma | F02 sonrası hata bazında | Her düzeltme TEST ekranında görülebilir; bilinen kabuller tekrarlanmaz |
| F06 — Günlük kullanım ve LIVE geçişi | Açık | Kabul edilmiş TEST sürümü, somut kalan riskler ve gerektiğinde tek LIVE onayı |

F02 için SEMIH'te ilk bakılacak yerler: çalışan süreçlerin gerçek dosya yolları; `C:\Sirket\ERP`; `C:\Users\Xaser\Documents\Codex\2026-09-30\task`; kullanıcı GitHub/Codex worktree dizinleri. Bunlar geçmiş kayıtlardan gelen arama başlangıçlarıdır, güncel kanıt değildir. Eski `ERP_STATUS.md` ve teslim paketleri silinmez. Önceki erişim/gate metinleri yeni iş listesi gibi kopyalanmaz; yeni hostta gerçek erişim ve mevcut çalışan durum esas alınır.

## İşyerinin günlük akışı

“Mevcut/kabulü kayıtlı” yeniden geliştirme işi değildir. “Eşleme eksik” de özellik bozuk demek değildir. Her açık satır yalnız somut eksik bulunduğunda kod işine dönüşür.

| İş akışı | Korunan çalışma / kayıt | Gerçekten tamamlanacak nokta |
|---|---|---|
| Sabah gelen malı sayma, barkod indirme/etiket | Ürün/barkod ekranları mevcut; stok sayımı için Eylül tarayıcı/SQL kabulü var | SEMIH'te kullanılan mal kabul ve barkod indirme yolunu eşleştir; eksik veya çalışmayan indirme/etiketi düzelt |
| İlker'in alış, stok ve fatura girişi | Eylül kabulünde 10 × 12 TRY alış: stok 10, tedarikçi borcu 120; taslak etkisiz | Çalışan ekrandaki karşılığı ve açık hatalar; tüm alış modülünü yeniden yapma |
| Terminal satışı ve stok düşümü | ERP Core satışı kabul edilmiş; terminal mükerrer gönderim/transaction için ayrı gerçek SQL kabulü mevcut | Native istemci ile çalışan native API kaynağını eşleştir; mevcut kabulün hangi sürüme ait olduğunu koru |
| Muhasebenin eşzamanlı tahsilat/kasa/cari işlemi | 20 tahsilat + 10 ödeme; cari 40, tedarikçi 110, net kasa 10 örneği kayıtlı. Kasa kapanışı/çakışma düzeltmeleri ayrı dalda | Çalışan kaynakta bu düzeltmelerin bulunup bulunmadığı; yalnız eksik farkın eşzamanlı akışı |
| KDV toplamda | Kullanıcının açık gereksinimi | Mevcut fiş toplamı, indirim sonrası KDV ve çıktıyı incele; eksikse toplamda gösterimi düzelt. Vergi oranı uydurma |
| USD / EUR | İşlem anı kur snapshot'ı, ayrı döviz kasa ve eksik kur görünürlüğü için mevcut çalışma/kabuller var | Güncel kaynakta doğru dalı koru; farklı dövizleri tek para gibi toplama; eksik kuru 1 veya 0 sayma |
| Açık hesap | 26 Eylül şirket kararı: yetkili açık hesap satışı tahsilat olmadan cari borç oluşturabilir | Güncel uygulanmış akışı ve yetki/limit/vade bağını eşleştir; satışa sahte tahsilat ekleme |
| Tedarikçi borç / ödeme / dönüş | Alış borcu ve ödeme kabulü; tedarikçi hareketleri mevcut | Tedarikçiye mal dönüşünün gerçek ekranı ve stok/borç/ödeme etkisindeki eksikler |
| Müşteri iadesi | Satış iptali kabulü mevcut; iptal otomatik nakit iade değildir | Kısmi/tam mal iadesi, cari alacak ve gerekiyorsa ayrı ödeme akışının mevcut kapsamını bul; eksik kısmı tamamla |
| Sayım / fark | Gerçek tarayıcı 5→7→6→8; üç hareket, üç audit; neden/yetki/stale kontrolleri kayıtlı | Bu sürümün çalışan kaynakta olup olmadığını eşleştir; aynı kabulleri sırf belge için yeniden çalıştırma |
| İptal / düzeltme | Gerçek servis/SQL kabulünde mükerrer iptal tek etki; kapanmış kasaya parasal düzeltme engeli | Güncel TEST'e alınacak fark varsa yalnız etkilenen akış; geçmiş fişleri silme |
| Son alışa göre fiyat / maliyet | Son net alış maliyeti ve ağırlıklı ortalama maliyet ayrı mevcut kavramlar | İlker'in kullandığı son alış fiyatının öneri ve ekranda görünmesi; geçmiş satış maliyet snapshot'ını güncel fiyatla ezme |

## Değerli kaynaklar ve kabulün devri

- `codex/commerce-erp-quality-20260908` (`f787cfe…`), mevcut `main`den 64 commit ileride; 275 dosya farkı var. Terminal satış güvenliği, kasa/fiş/sayım/döviz/rapor ve çıktı düzeltmeleri içeriyor. Hepsini körlemesine birleştirme. SEMIH'te zaten olanları ayır, yalnız eksikleri aktar. [Kabul kayıtlarının dizini](docs/erp-v2/inventory-20261003.md#korunan-kabul-kayıtları).
- `review/erp-simplification-20260915` (`aea716f…`): 1 commit, 10 dosya; menü sadeleştirmesi ve kanıtsız “hazır/eksi stok yok” etiketlerinin kaldırılması. Ticari kabul veya native backend teslimi değildir. Commerce dalıyla ortak menü dosyaları var; kaynak okunarak uzlaştırılmalı.
- `codex/native-terminal-source-20260929` (`552491b…`): 1 commit, 74 dosya; native Android candidate.18-t2 kaynak koruması. **Uyumlu native backend bu teslimde yok.** Android kaynağını main'e almak tek başına terminal entegrasyonunu bitirmez.
- Mayıs/Haziran EVDEKIPC kopyaları ve değiştirilmiş UI/terminal dosyaları envanterde korunuyor. Son tarih tek başına değer ölçüsü değildir; kullanıcı farkları kaybolmaz.

## Kabul ve bitiş ölçütü

Bir düzeltme için kayıt: sorun → değişen dosya/commit → TEST adresi → iş ekranındaki sonuç → stok/cari/kasa etkisi → kalan somut eksik. Otomatik test/HTTP 200 yalnız teknik destek kanıtıdır. Önceden kabul edilmiş değişmeyen özellikler yeniden açılmaz. Yeni/düzeltilen akış kullanıcıya gerçek ERP ekranında gösterilir; iş kabulü kullanıcının gördüğü sonuca bağlanır.

Son teslim: tek kanonik kaynak; tek anlaşılır TEST/LIVE eşlemesi; korunan eski kopyalar; bu plan ve kısa STATUS; sabah mal kabulden satış/tahsilat ve gün sonuna günlük kullanılabilir ERP. **Bu teslim henüz tamamlanmadı.** Mevcut sonraki adım F02'dir; sırf yeni sprint üretmek için özellik açılmaz.
