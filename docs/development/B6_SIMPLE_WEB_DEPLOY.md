# B6 — sade WEB yayın sözleşmesi / 2 Kasım 2026

Mevcut `ERP-B6-SIMPLE-WEB-DEPLOY-SOURCE-20261102-1022` işinin kaynak ve pasif paket teslimidir. Yeni bitiş yaprağı, LIVE onayı veya çalışan kurulum değildir. Kurulu5244, API4144, native4146, SQL ve mevcut task/config/roller bu teslimde değişmez. Eski0742/arşiv/consumed marker yolu tekrar kullanılmaz.

## Tek yayın yolu

Tarayıcı → **Node5244 socket/BFF sınırı** → API4144 veya bellekte doğrulanmış statik dosya. **IIS yalnız private IPv4 loopback statik origin** olur; örnek5254 bir tasarım değeridir, ayrılmış/kurulmuş port değildir. IIS API reverse proxy değildir; ARR, URLRewrite, forwarded-header güveni veya ortak ingress sırrı eklenmez. Mevcut LAN/Tailscale/loopback host+socket+origin kuralları Node önünde aynen kalır. Node `business-preview-session.mjs` dosyasını değiştirmeden kullanır.

IIS yalnız release'in `ui/` klasörünü görür. Runtime/protocol/ayarlar farklı kardeş dizinlerdedir. Gateway yalnız manifestteki public dosyaları, browser cookie/Authorization/header taşımadan `Accept-Encoding: identity` ile alır. Redirect, Set-Cookie, identity dışı response encoding, boyut veya SHA farkında hiçbir dosyayı sunmaz. Tam başlangıç doğrulaması sonrası en fazla32MiB immutable cache kullanır; katalog istekleri IIS veya belge taraması başlatmaz. Bu bir gerçek TEST hız ölçümü değildir.

| Sözleşme | Korunan davranış |
| --- | --- |
| Browser origin | Aynı5244 host/port; localStorage journal anahtarı `melisa-work-sale-v1:${host}:${actorId}` |
| Refresh | Mevcut host-only HttpOnly/SameSite=Strict cookie, `/api/auth`; yeni signer/token veya rol yok |
| Normal aktör | API tarafından doğrulanan17/rol17; her satış isteğinde taze Bearer `/auth/me` ve mevcut izin denetimi |
| API kapsamı | Mevcut workface/satış allowlist'i; genel proxy/admin/SQL/CRM/receiving yolu yok |
| Satış | UUID/body/revision/witness kuralları ve mevcut15s/60s süreler; yalnız bir upstream POST; otomatik replay yok |
| Pending journal | İki doğrulanmış public UI kaynak blobu + creator ve transitive helper closure hash'i; journal silme/migrate/reset yok |
| Backend | Sabit TEST/4144 + source/package + AFDB overlay manifest + gerçek API/native PID/birth/owner/argv/listener bağı |
| Rollback | Aynı backend ve protocol; **UI+gateway birlikte** sürümlü pair, önceki/yeni hashed chunks her iki release'te korunur |

## Süreç kanıtı ve kaynak bütünlüğü

`business-web-backend-proof.ps1` stateless ve salt okunur collector'dır. Startup metadata ve manifestleri okur; SQL/parola taşıyan private uygulama config'ini açmaz. CIM/owner sorgusu erişilemezse durur; ayrıcalık/ACL, SeDebug, yönetici veya başka araç fallback'i yoktur. API direct parent ve devralınmış native'nin kendi kimliği korunur. CIM'in altı ondalık saniye hassasiyetiyle tam birth karşılaştırması yapılır; bir saniyelik tolerans yoktur. Aktif supervisor kaydı paylaşımlı ReadWrite/Delete ile önce/sonra okunur; supervisor'ın yazma/replace işlemi kilitlenmez.

Gateway ilk başta Node binary ve manifestleri doğrular; kendi ilk backend aktörlerini sabitler. Salt okunur istekler en fazla5s probe cache kullanır; upstream POST öncesi taze doğrulama zorunludur. API yeniden doğmuşsa otomatik sahiplenme yoktur; yeni yetkili startup admission gerekir. Probe hata/drift'i bu gateway örneğini fail-closed yapar. Bu snapshot gözlemi atomik T1 veya SQL transaction kanıtı değildir.

PowerShell binary SHA private maintenance settings'e bağlıdır. Normal, **encoded olmayan** literal bootstrap, proof helper'ı manifest SHA ile doğrulayıp `FileShare.Read` handle'ını tüm çağrı boyunca tutar; yazma/replace engeli own-temp fixture'da denenir. Çalıştırma pathname'i yeniden açmaz: hashlenmiş aynı byte dizisi `ScriptBlock.Create` ile çağrılır; ancestor rename başka script çalıştıramaz. ExecutionPolicy değiştirilmez. Gerçek collector bu kaynak turunda kurulu sisteme karşı çalıştırılmaz.

## Pasif çıktı

`scripts/canonical/prepare-simple-business-web.mjs --prepare` yalnız kendi exact feature source'unun ilk push+PR CI'sı (üçer job ve bütün step'ler başarılı) sonrası kullanılabilir. Girdi mevcut onaylı5457 aday ve8530 rollback UI manifestleridir; kaynak dosyalarından session/workface/read-model byte eşliği ve journal closure karşılaştırılır. Yeni `WEB-SIMPLE-<source12>-CANDIDATE/ROLLBACK` dizinleri CreateNew ile oluşturulur; mevcut release'e yazılmaz. `--verify` aynı çiftin manifest/file SHA ve byte sonuçlarını geri okur. Source/protocol proof'lar public koddur; ham journal/işletme verisi/fotoğraf/config/credential taşınmaz. Hiçbir pasif çıktı `installed`, `runtimeVerified` veya `executionAuthority` true yapmaz.

Gerçek private settings dosyası üretilmez. Gelecekteki şema `releaseDigest`, Node/PowerShell binary SHA'ları, private IIS origin, mevcut izinli Tail peers ve **ayrı bakım onayına** bağlı maintenance kimliği/runtimeStartAuthorized içerir. Kaynak repo/paket bu izni kendisine vermez. Gateway doğrudan dosya girişi yalnız bu bağlar ve mevcut business network/interface koşullarıyla dinleyici açabilir; bu tur `--serve` çalıştırılmaz.

## Ayrı yetkili bakımda kesinleşmesi gerekenler

1. IIS Static Content özelliğinin mevcut durumu, seçilecek loopback site/port ve sürümlü physical path. Firewall/ağ açma bu kaynak turunda yok.
2. Standart servis wrapper'ın doğrulanmış sürümü ve somut düşük yetkili Windows servis kimliği. WinSW bir tasarım adayıdır; binary indirilmez/çalıştırılmaz, varsayılan LocalSystem ile XML üretilmez. Kimliğin yalnız gereken public release/metadata okuma ve CIM sorgu hakları ayrıca kanıtlanmalıdır; eksikse kurulum engelidir.
3. Mevcut5244 owner'ın desteklenen temiz devri ve yalnız eski WEB hazır hook'unun yeniden5244 sahiplenmemesi. API/native canonical task'ını topluca kapatmak, eski consumed once'ı replay etmek veya korumayı kaldırmak çözüm değildir. Desteklenen dar devir yolu kesinleşmeden bakım GO yok.
4. Before-image: mevcut WEB entry/owner/task/config kimlikleri, iki manifest ve kaynak koruması. SQL/finans/stok/rol/parola yazısı kapsam dışı kalır.
5. Bakımda yalnız WEB handoff, private IIS site, seçilen gateway servis kimliği/başlangıç bağlantısı ve onaylanan dosya izinleri adlandırılır. Değişen parçaların explicit inverse'i aynı bakımda hazır olur; otomatik DB restore yok.
6. Gerçek IIS → gateway asset SHA/cache, normal login/refresh/logout, mevcut pending journal salt okuma, katalog/kart ve izinli GET ekranları gerçek tarayıcıda doğrulanır. Satış POST için ayrıca o senaryo yetkisi gerekir.
7. Hata varsa önceki **aynı protocol/backend** UI+gateway pair'e geri dönülür; yalnız HTML rollback yapılmaz. Servis stop davranışı yalnız kendi gateway sürecini kapsamalı; zorla eski ERP owner/SQL kapatma yok.

Bu maddeler gerçek makinede henüz uygulanmadı. Kaynak/offline PASS, pasif dosya varlığı, gerçek kurulum ve insan kabulü ayrı raporlanır. 49ERP+25CRM ve özgün UA durumları değişmez.

Resmî başvuru kaynakları: [Microsoft IIS statik içerik](https://learn.microsoft.com/en-us/iis/manage/creating-websites/scenario-build-a-static-website-on-iis), [Node24 HTTP server](https://nodejs.org/docs/latest-v24.x/api/http.html), [WinSW servis ayarları](https://github.com/winsw/winsw/blob/v3/docs/xml-config-file.md). Bunlar desteklenen bileşenlerin belgeleridir; mevcut Windows hostunda uygun kimlik/kurulum kanıtı yerine geçmez.
