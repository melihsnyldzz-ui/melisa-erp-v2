# Depo devamı için çevrimdışı hazırlık

Aktivasyon öncesi runtime kanıtı `warehouse-lifecycle-preactivation-runtime-r3.json`,
aktivasyon sonrası normal form/pasifleştirme kanıtı `normal-form-source-runtime.json`
olarak ayrıdır. İki dosya da kendi gerçek fazını değişmez byte/hash ile korur;
önceki kanıt üzerine aktif durum yazılmaz. Salt okunur gerçek yürütme ön kontrolü
SQL515 ile sonuç üretmediğinden mevcut senaryo hâlâ NOT_RUN'dır; dosya adı düzeltmesi
bu ayrı SQL ön kontrol engelini çözmüş sayılmaz.

Bu klasör K10-WH-CONT-20261109-01 önerisinin iki eksik önkoşulunu hazırlar:
mevcut depo sırrını normal parola formuna taşıyan dar tüketici ve mevcut 404
SQL izin profiline bağlı kullanıcı30007 etkinleştirme/pasifleştirme araçları.
Hazırlık sırasında gerçek broker, credential, SQL, tarayıcı veya runtime kullanılmaz.
Kaynak teslimi, gelecekteki gerçek yürütme ve normal ekran kabulü ayrı sonuçlardır.

Fiş15'te kullanılan mevcut `k10-warehouse-provision-v1/read-warehouse.ps1`
broker'ı değişmeden kullanılır; kamuya açık kaynak SHA256 değeri
`894205d42f8793104dcfd87639feb229d3c4890df93799abff9b230b1e86cd5d`.
Eski geçici tab/AX numaraları, eski paket400bd ve önceki çalıştırıcının
RV111ED1 bağı yeniden kullanılmaz. Satış/müdür tüketicisinin kapsamı genişletilmez.

Yeni giriş tüketicisi yalnız mevcut depo hesabını, sabit yerel TEST hedefini,
güncel koşullu kararı ve bağımsız doğrulanmış aktif hesap/runtime kanıtlarını
normal, maskelenmiş parola formuna bağlar. Pipe çıktısı yalnız bu formda kullanılır;
ham değer hata mesajı, kayıt, pano, dosya, ortam değişkeni veya API oturumuna verilmez.
Gerçek etkinleştirme kanıtı henüz bulunmadığından hazırlık paketi kullanılabilir
bir canlı giriş binding'i üretmez.

Yaşam döngüsü araçları yalnız aynı30007/rol10 ve üç mevcut depo hakkını kullanır.
CAS ile is_active ve doğal rowversion değişir; her aşama bir audit ekler.
Kullanıcının diğer alanları ve diğer kullanıcı/rol/izin/ayar/iş kayıtları korunur.
Yeni karar, exact hedef/baseline ve bağımsız okuma bağları olmadan yürütme yoktur.
Sonucu bilinmeyen yazma tekrar gönderilmez; özgün denemenin okuma ile uzlaştırılması
ayrı tutulur. Eski SQL ve runner dosyaları değiştirilmez.

`offline-fence.mjs` yalnız Node test ön yükleyicisidir. Node'un ağ ve alt süreç
girişlerini, özel credential dosyası okumalarını yerel test sürecinde engeller.
Bu bir Windows güvenlik duvarı değişikliği değildir. PowerShell kaynağı ayrıca
yalnız AST olarak incelenir; gerçek Execute dalı bu hazırlıkta çalıştırılmaz.

Normal giriş testleri sahte dosya sistemi, sahte özel pipe ve sahte normal form;
yaşam döngüsü testleri sentetik executor ve readback kullanır. Gerçek sır veya
canlı SQL sonucu test fixture'i olarak kopyalanmaz.

Yabancı fişte kişisel satış yazma reddi bu çalışmanın dışındadır. Depo yolunun
başka satışçının hazırlama fişini işlemesi, o ayrı reddin kanıtı sayılmaz.
