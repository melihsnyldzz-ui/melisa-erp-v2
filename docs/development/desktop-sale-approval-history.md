# Satış indirim onayı ve fiş bağı

9 Kasım 2026. Mevcut DES-06 / K10 satış sözleşmesinin dar devamıdır.

## Kullanıcı akışı

Kişisel sınırı aşan satış için önce müşteri, iki ürün, miktar, fiyat, döviz ve fiş geneli iskonto içeriğine bağlı kalıcı onay isteği açılır. Bu aşamada satış fişi oluşmaz; stok ve cari etkisi yoktur. Yetkili patronun gerekçeli kararı aynı teklifin onay kaydına bağlanır. Satışçı onayı seçip sunucunun yeniden doğruladığı içerikle taslağı kaydettiğinde, aynı transaction içinde `sales.pricing.bound` olayı oluşan fişi ve CREATE_DRAFT komutunu kaydeder. Sevk, mevcut fiyat/onay/işlem günlüğü doğrulamasından geçer.

Onay ekranı artık isteğin açılma zamanını, karar veren kullanıcının gerçek kayıt kimliğini, karar zamanını ve gerekçesini gösterir. Fiş oluştuğunda doğrulanmış fiş kimliği aynı kartta görünür. Bağlanmış bir onay ikinci taslağa uygulanamaz. Süresi dolmuş onayın seçimi kapalıdır; geçmişteki onay, güncel işlem yetkisi sayılmaz.

## Sunucunun doğruladığı bağ

`createdAt`, `decision` ve `invoice` alanları istemcinin beyanından üretilmez. İstek, onay, fiyat bağı ve CREATE_DRAFT günlüğündeki aktör, içerik/teklif hash'i, fiş, UUID ve payload hash'i karşılaştırılır. Aynı onayın birden çok fişe bağlanması, tek fişte birden çok fiyat kanıtı, farklı ürün/tutar veya çelişkili günlük reddedilir. Geçmiş okumaları yeni onay, fiş, yetki veya finans hareketi yazmaz.

## Korunan kararlar ve açık sınırlar

- Kişisel %5 satış sınırı, başkasının indirimini onaylama hakkı değildir. Mevcut `canApproveAboveFive` patron şartı korunur; TEST hesaplarının hakları genişletilmez.
- PR54 `dce0fff4` içindeki `approvalsModel.js` ve `approvalsCompletion.test.mjs`, müşteri/indirim/gerekçe/karar/fiş görünümü için referanstır. Demo kişi adları yetkilendirme kaynağı değildir.
- Talep edenin ayrı gerekçesi, ret kararı ve önceden yaratılmış bir fişin onay beklemesi mevcut sözleşmede yoktur; bunlar varmış gibi gösterilmez. Yeni fiş durumu veya zaman aşımı kuralı eklenmez.
- Onay ve istek için mevcut on dakikalık süreler ile kayıt/sevk anındaki politika ve içerik doğrulamaları değişmez.
- Kaynak/sentetik test, gerçek SQL, kurulmuş paket, normal ekran ve gerçek çalışan kabulü ayrı kanıt sınıflarıdır. Yetkili patron hesabı olmadan normal ekranda patron kararı doğrulanmış sayılmaz.

Mevcut fiş15 sevki, hesap kurulumu ve kişisel sınır denemeleri tekrarlanmaz. SQL şeması, SQL yetkileri, uygulama rolleri ve eski veriler bu kaynak değişikliğinin kapsamında değişmez.
