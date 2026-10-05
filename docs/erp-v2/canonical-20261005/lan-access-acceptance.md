# ERP-LAN01 — yerel ağ erişimi

5 Ekim2026. Kullanıcı ERP çalışma yüzünü ağdaki personele açmayı istedi. İzleyen “var ama sabit sonra yaparız ipyi” talimatıyla **kalıcıIP sabitlemesi ertelendi**. Modem/DHCP veya WindowsIP ayarı değiştirilmedi. Mevcut Ethernet2 adresi192.168.1.46/24, gateway192.168.1.1, DHCPaktif ve WindowsPrivateprofile.

## Açılacak adres

http://192.168.1.46:5194/ornek-akis.html#home

Aynı yerel ağdaki kullanıcı mevcut ERP hesabıyla giriş yapar. Otomatik TESTADMIN yalnız localhost'ta korunur; LAN'da normal giriş gerekir. Yeni hesap veya izin oluşturulmadı. Normal stok için `#stock` kullanılabilir. IP'nin router rezervasyonu bu teslimin tamamlanmış işi sayılmaz; kullanıcı daha sonra başlatacak.

## Çalışan kaynak

TEST paket48: `C:\Sirket\ERP\releases\CANONICAL-LAN-TEST-20261005-48`, uygulama source `4b46a3fe4597a07c2d971ee3f9307bdca6d7149d`, packageIdCANONICAL-TEST-4b46a3fe4597. Launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1` bu exactpaketi açar. İzleyen doküman/PR head çalışan source değildir.

Web5194 ve API4144 yalnız127.0.0.1 +192.168.1.46 üzerinde dinler. Native4146 yalnız127.0.0.1. API → Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01, sysadmin0/control0/LIVE0; nativewritesfalse/dışişlemlerfalse. Dual-interfacehealth her iki socket başarıyla açılana kadar503; yalnız ikisi hazırsa200. Opt-in private `lanHost` alanı dışında private config birebir aynı. Modem/OSIP/firewall/LIVEservisleri değiştirilmedi; eski47 ve exactconfig/launcher yedekleri korundu.

## Erişim sınırı

LANopt-in yalnız exact192.168.1.46; wildcard0.0.0.0/IPv6bind yok. İlk middleware gerçek TCPpeer loopback veya192.168.1.0/24 ve exactHost/doğruport ister. Proxy/forwardedheader kimlik oluşturmaz. CORS yalnız localhostorigins +http://192.168.1.46:5194; webCSP exactLAN4144 bağlantısına izin verir. Native, outboundnetworkpolicy, SQL login/yetki/karantina ve TESTyazma sınırları değişmedi.

Frontend doğrulanmış TESTbuild base1274144 için exactLAN5194 konumunda kendiLAN4144 hedefini seçer; yanlışhost/port/protokol veya LIVE hedefleri reddedilir. LAN'da adminbootstrapsız loginformu açılır; LABTESTADMINdüğmesi gizlidir ve doğrudan frontendçağrı da reddedilir. Sunucu gerçek socketpeer için mevcutloopback admincontext'i korur: LANbootstrap401 ve localadmintoken'ın LAN'da yeniden kullanımı401. Normal rolebearer çalışır. Kimlik bilgileri veya tokenlar rapora/repo içine yazılmadı.

Windows'ta kullanılan C:\Program Files\nodejs\node.exe için önceden kayıtlı PrivateTCPinboundallow bulundu. Rule eklenmedi/değiştirilmedi ve firewall kapatılmadı. Uygulama kaynak/Host sınırı bu mevcut genel programrule'undan bağımsızdır.

## Gerçek teknik kanıt

- API+frontend32 hedefli offline test PASS; bağımsız incelemede blocker kalmadı. Erkenhealthreadiness yarışı test edilip düzeltildi.
- Paket build PASS;1300manifestdosyası ve16977dependency eski/yeni hashleri doğrulandı. İlk hazırlık helper'ı önceki47 exactpathguard'ı yüzünden durdu; yalnız bu turun48 helper'ı düzeltildi, yeni48dizini üzerinden devam edildi. Eski paketler değiştirilmedi.
- LANweb200 / APIidentity200. YetkisizHOME401; LANadminbootstrap401; localadmintoken→LANauth/me401; gerçeknormal İlker16 login200/CORSexactorigin.
- HOMEüçokuma104/27/23ms; ilk50katalog733ms,50satır/16.622accepted/54hold; local/LANticariDTOlar birebir aynı. Bu süre aynı PC'den LANIP ile ölçüldü; başka cihazın ağ gecikmesini temsil etmez.
- 8023CONCEPT ERP36724 thumbnail200/image/3213byte. Gerçek tarayıcı LANlogin→AnaSayfa→katalog→8023kod/CONCEPTmarka/TAKIMtür, stok0ADET,15,78USD, barkod3617221176192 ve büyükfotoğraf doğrulandı.
- LANAnaSayfa→MalKabul mevcutLABekranı aynı normaloturumla açıldı; TESTADMINdüğmesi0, consoleerror/warn0. Hiçbir ticari kaydet/onay/satış/ödeme düğmesi çalıştırılmadı.
- ForgedHost ham HTTPisteği403. İlk fetchHosttesti Nodefetch'in Hostheader'ı değiştirmemesi nedeniyle uygun değildi; hamHTTPile gerçekHostnegatif kanıtı alındı, uygulama değiştirilmedi.
- Native4146LANlisteneryok, loopbackhealthwritefalse. LIVE5188/4114/4116 ownerPIDleri aynı. Normallocalhost erişimi, kabul edilmiş katalog/medya ve B01kaynakları korunur. CRM/mainmerge/migration/schema/role/ticariwrite yok.

Ham kanıt `C:\Sirket\ERP\evidence\ERP-LAN-20261005`: `actual-lan.json`, `runtime-switch-lan-48.json`, `network-before.json`, `firewall-existing.json`, browserhome/stock/goods metinleri. Secret içerenconfigbackup yalnız özel repo dışı kanıt alanında kalır.

Görüntüler: `C:\Users\Xaser\Documents\Codex\2026-10-04\referenced-chatgpt-conversation-this-is-an-6\outputs\ERP-LAN-home.png` ve aynıklasörde `ERP-LAN-stock-8023.png`.

## Teslim ve kabul

Dal codex/erp-finish-20261004 / [draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Uygulama4b46 source hosted push37370374306/PR37370378559, rapor yazılırken GitHub'da queued; CI PASS iddiası yapılmaz. Son belgehead için requiredCI ayrıca PRChecks'ten izlenir. Bekleyen runner için selfhosted/TESTSQL bağlantısı veya workflowdeğişikliği yapılmaz.

ERP-UA06 gerçek başka cihaz/personel kabulü **bekliyor**. Ajan bu bilgisayardaki gerçek tarayıcıdan192.168 adresini doğruladı; başka fizikselLANistemcisinde denemiş gibi sunulmaz. Kullanıcı aynı ağdaki bilgisayardan URLyi açar, mevcut hesabıyla girer, AnaSayfa ve stok/8023fotoğrafını kontrol edip sonuç verir. ERP-UA05B01 ve diğer mevcut insan kabul durumları değişmedi. IPsabitleme açıkça ertelendi; başka finish işi başlatılmaz.
