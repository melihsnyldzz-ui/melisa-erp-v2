# K10-SALES-OWNERSHIP / K10-T08 — Kendi fiş ve satış geçmişi

DES-19, satış personelinin kendi fiyat/geçmişini görmesini ve finansın ayrı yetkiyle çalışmasını ister. Mevcut Desktop sales.view okuyucuları bütün fişleri gösterebiliyordu. Sunucu görünümü artık aynı transaction içinde yeniden doğrulanmış kullanıcı ve güncel mevcut permission anahtarlarından belirler.

| İzinler | Satış okuması |
| --- | --- |
| sales.view yok | Kapalı; depo üç hakkı satış okuması vermez |
| sales.view; yalnız create/edit/finalize veya diğer haklar | OWN: i.created_by doğrulanmış aktöre eşit |
| sales.view + sales.cancel veya finance.collection veya finance.payment | ALL: mevcut yetkili genel görünüm |

Rol adı, yönetici adı, request/query/response içindeki actor veya all alanı yetki vermez. Private auth getter yalnız gerçek kayıtlı auth/pool, aktif leased transaction, aynı aktör ve o transaction'da doğrulanan sales.view ile scope üretir. Logout, rol/user revision veya güncel izin reddi sınırı korunur. Yeni kullanıcı/role/permission satırı veya SQL GRANT yoktur; mevcut TEST operatörünün19 hakkı aynı kalır.

## Sunucu yolları

- Fiş listesinde COUNT ve PAGE aynı creator koşulunu kullanır; filtre sayfalama ve toplamdan önce uygulanır.
- Doğrudan workflow GET önce kapsamlı başlığı yetkilendirir, ardından kalem/koli okur. Başka personelin ve NULL sahipli kaydın kalem sorguları çalışmaz. Mevcut route bu ret için generic503 döndürür; 403 olduğu iddia edilmez.
- Legacy receipt servisi başlık ve kalemleri ayrı yetkilendirir. Bu servisin mevcut Desktop HTTP assembly'sinde monte edildiği kanıtlanmadı; kaynak sınaması gerçek ekran kanıtı sayılmaz.
- Müşteri lastSale, hesap satış geçmişi ve onun item sorguları da aynı creator sınırını kullanır. OWN geçmiş DTO'su toplam balanceExact8 içermez; yalnız salesVisibility.scope=own ve doğrulanmış actorId taşır. ALL yanıtı eski DTO'yu korur.
- Genel müşteri ekstresi OWN için route'ta403 ve transaction'da ret verir. Aynı customer.view ile önceden yetkili müşteri/kart/hesap cari toplamları ayrı görünüm olarak korunur; kişisel satış toplamı sayılmaz. Bu çalışma beş şirket rolünün bütün mali görünürlüğünü kapatmış değildir.

Tarihsel NULL created_by değerlerine sahip yazılmaz; journal, prepared_by veya sent_by üzerinden varsayılan sahip uydurulmaz. Bu değişiklik READ kapsamıdır. Mevcut POST/yazma izin matrisi ve gerçekten gönderilmiş UNKNOWN'un aynı UUID/body ile kurtarılması değiştirilmez; depo ortak hazırlama yolu korunur.

## Ekran ve doğrulama

Normal green core/fiş listesi/kart geçmişi/workflow dönüşü sentetik server transport ile sınandı. Yeni okuma başlarken veya reddedilince eski fiş verisi ve düğmeleri temizlenir; eski callback yeni UUID/POST üretmez. Geç yanıtın actor veya own/all kapsamı değiştiyse gösterilmez. OWN hesap geçmişi bireysel görünümü açıkça belirtir ve hesap bakiyesi satırı göstermez; ALL görünümü mevcut bakiyeyi korur. Kalıcı pending ve UNKNOWN byte'ları silinmez.

104 hedefli test PASS,0 skip: aynı scope COUNT/PAGE, kendi/başka/NULL fiş, kalemden önce başlık, kendi geçmiş sayfalaması, sahte actor/all ve ret sonrası eski veri/aksiyon/pending koruma için kaynak/VM/sentetik ekran kanıtı. VM kaynak denemelerinin SQL/auth module double'ları gerçek private auth kaydının kanıtı değildir. Gerçek Express + normal auth + sentetik SQL assembly fixture'ı aynı pozitif/negatifleri ve OWN ledger403'ü içerir; ayrı auth fixture'ı genuine getter, aynı leased transaction/actor ve güncel izin değişimini sınar. Bunları hosted CI ayrı doğrular. Yerelde dependency install, loader/junction veya build yapılmadı. Kaynak incelemesinde yeni P1/P2 yok.

Dal codex/erp-desktop-sales-ownership-20261107; taban PR98 kaynak77d4db3ed52e34b6f04aec73b980957c92d712d2. Bu işte gerçek SQL, hesap, grant, runtime, kurulum veya çalışan tarayıcı denemesi yoktur. PR98 pasif depo paketi ve özgün ödeme isteği ayrı korunur. Normal GUI/kişisel gerçek hesap, SQL readback, şirket rol matrisi, yazma sahipliği, insan kabulü ve LIVE açık kalır.
