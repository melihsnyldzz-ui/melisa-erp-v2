# Normal personel / Wi-Fi satış ve iki koli — 11 Ekim 2026

ERP-COMPLETE01 / ERP-DEC-046–047. Gerçek TC21 v22, şirket Wi-Fi bağlantısı ve boş ADB reverse ile normal personel oturumunda kontrol edildi. Kullanıcıdan parola istenmedi; mevcut korumalı giriş teslimleri kullanıldı. İnsan ERP-UA32 **bekliyor**.

## Gerçek sonuç

- İzole DB02'de normal personel, kaynak bağlı müşteri ve TRY hesabını seçti; mevcut ürünün barkodunu metin olarak girdi. İki adetlik yeni sentetik satış taslağı kesinleştirildi, aynı fiş yeniden okundu. Bağımsız SQL kaydı stok −2 ve yalnız seçilen TRY hesap etkisini doğruladı. Ham cari/ürün/tutarlar özel kanıtta kalır.
- Bu fiş iki ayrı koliye 1+1 dağıtıldı, kalan 0 oldu; ortak kayıt kaydedildi ve fiş yeniden açıldı. Her kolide 1 tekrar görüldü. Paketleme öncesi/sonrası seçili ticari SQL snapshot tamamen aynı; ikinci stok/cari/kasa etkisi yok.
- LAN HTTP bağlamında bulunmayan `crypto.randomUUID` çağrısı gerçek cihazda hata verdi. Mevcut güvenli `tradeUuid` yolu kullanıldı; `getRandomValues` bulunmuyorsa işlem kapalı kalır. Math.random fallback yok. Root ve bağımsız reviewer 10/10 hedefli test: iki koli, yanıt kaybı, reload, aynı UUID/body ve RNG yokken taslağın korunması.
- Mevcut gönderilmiş mal kabul kaydı personel ekranında açıldı ve tekrar okundu. İlker'in mevcut normal rolü aynı sayımı/kabulü API'de gördü: sayım `submitted`, kabul `pending`, onay yetkisi görünür. **Yeni İlker onayı, stok kabulü veya alış faturası yapılmadı.**
- Normal ERP oturumu APK force-stop/yeniden açılışında korundu. CRM oturumu da yeniden açılışta korumalı yenilemeyle mevcut atanmış listeyi açtı. Taslak geri dönüşünde gerçek bir okuyucu sorunu bulundu; ayrı dar CRM düzeltmesi ve cihaz tekrarı bekliyor.

## Kaynak ve paket ayrımı

Satış çekimi ERP `2fbcd94a96df316c8e671e40bb8dda3248555621`; iki kolinin başarılı çekimi ve İlker okuması ERP `9cc84ff96981ebc38d7292ffc01087f77441211e` / CRM `09ca1dac346e42037fd02901baf3240aa6ce6285`. ERP release manifest SHA256 `2211faf364b6b18a1ae83f67d9e035de9ab12525df8096fc0c933ecddecb741b`; CRM manifest `9de545b7c06197d628234c67d6ace60780acde4c02685780207abde677cacc4a`. İzole API/native 4184/4186, Hub5234, CRM62700; DB `MELISA_ERP_CRM_SHARED_TEST_20261009_02`, copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`. Android v22 binary/build kaynağı ayrı tutulur; belge HEAD runtime source değildir.

Özel kanıt kökü `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private`:

| Kanıt | SHA256 |
| --- | --- |
| `recovery-proof/selected-sale-gui-before-2026-10-11T172439095Z.json` | `22dd603b64009dcb0c5f79e872e2d747afac56fbeec7e732bf4835645644d7df` |
| `recovery-proof/selected-sale-gui-after-sale-2026-10-11T173740570Z.json` | `2840a84fc63c74623c2ffe8d16a73b109cb354ca9504bdceda94dfe1fd6abd53` |
| `recovery-proof/selected-sale-gui-after-packing-2026-10-11T175633935Z.json` | `2cf7b81517e401f92d393f9b7e88d28167cabb2f8ae8ab35400b2ca7218b6420` |

SQL makbuzları okuyucu snapshot'tır; frontend paket kimliği controlled activation ve gerçek cihaz görüntüleriyle ayrıca bağlanır. Finans/tedarikçi count/maxId eşitliği bütün eski satır içeriklerinin hash eşitliği diye sunulmaz. İlker okuması ayrı `read-ilker-receipt10-result.json`, sıfır ticari yazma ve kendi helper oturumu logout kanıtıdır.

Satış95sn, mevcut mal kabul63sn ve iki koli87sn Türkçe sesli/altyazılı gerçek cihaz eğitimleri hazırlanmıştır. İlk iki çekim eski 2fb kaynağını korur; koli çekimi 9cc'dir. Dördüncü CRM dersi ve nihai dört video teslimi henüz tamamlanmadı. Videolar/müşteri görüntüleri GitHub'a yüklenmez. Yerel video sayfasını açma girişimi browser URL policy tarafından reddedildi; doğrulama offline video çözümleme/kare/ses üzerinden yürütülür, tarayıcı oynatımı yapıldı denmez.

ERP 9cc exact PR/push CI işleri hesap ödeme/harcama limiti nedeniyle başlamadı; [CI annotation](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38160832238/job/114533203570). Yerel testler GitHub CI PASS veya insan kabulü değildir. TEST125, mevcut aktarımlar, roller, LL, karantina ve yedekler korunur. Windows görevleri aynı kullanıcı logon başlangıcıdır; gerçek reboot/logoff denenmedi. 192.168.1.46 DHCP adresidir, modem rezervasyonu ertelenmiştir.
