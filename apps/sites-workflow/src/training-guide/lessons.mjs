// PR #27 attribution: reuse the pure short-step + question content approach
// from src/training/lesson.js. Progress belongs to the guide UI; no training
// session, API adapter, database, business write or role change is reused here.
export const trainingCompletionNotice='Dersi tamamlamak, gerçek işyeri veya cihaz kabulü değildir. Gerçek kullanım yetkili kişiyle ayrıca kontrol edilir.';

export const lessons=Object.freeze([
 {
  id:'receiving',title:'Gelen malı say ve kontrole gönder',role:'Personel → İlker → Muhasebe kontrolü',duration:'3 dk',screen:'/ornek-akis.html#goods',image:'01-receiving.png',
  steps:[
   {title:'Malı ve tedarikçiyi bul',text:'Gelen mal ekranını açın. Tedarikçiyi seçin; ürün kodunu, barkodu ve ürünü karşılaştırın.',watch:'Ürün ve tedarikçi gelen belgeyle aynı olmalı.',stop:'Ürün bulunamıyor veya kart eşleşmiyorsa adet uydurmayın; İlker incelemesine bırakın.'},
   {title:'Fiziksel adedi kaydet',text:'Personel gelen ürünleri sayar. Fiziksel adetleri ve varsa eksik, fazla veya yanlış ürün notunu kaydeder.',watch:'Kaydetmek ve kontrole göndermek henüz stoğu artırmaz.',stop:'Adet, ürün veya tedarikçi yanlışsa göndermeden önce düzeltin.'},
   {title:'İlker kontrolüne gönder',text:'Sayımı kaydedip İlker kontrolüne gönderin. İlker satırları inceler ve mevcut yetkisiyle kabulü onaylar.',watch:'Stok, mal kabulü onayında bir kez artar. Personelin gönderimi onay yerine geçmez.',stop:'Onay düğmesi kapalıysa başka bir kullanıcı gibi davranmayın; yetkili kişiye bırakın.'},
   {title:'Belgeyi faturaya devret',text:'Muhasebe gelen belgeyi, tutarı ve dövizi kontrol eder. Bağlı alış faturasını ekrandaki mevcut yetkili kişi kaydeder.',watch:'Kabul edilen mal, bağlı faturada stoğa tekrar eklenmez.',stop:'Belge veya döviz farklıysa faturayı kesinleştirmeden önce kontrol edin.'}
  ],
  quiz:{question:'Gelen ürün ne zaman stoğa eklenir?',options:['Sayımı kaydedince','Sayımı kontrole gönderince','Mal kabulü yetkili tarafından onaylanınca'],answer:2,explanation:'Sayım adetleri saklar. Stoğu artıran işlem, mal kabulünü yetkili olarak onaylamaktır.'}
 },
 {
  id:'sale',title:'Satış taslağı ve satış fişi',role:'Satış personeli · mevcut satış yetkisi · Muhasebe kontrolü',duration:'3 dk',screen:'/ornek-akis.html#sales',image:'02-sales.png',
  steps:[
   {title:'Önce müşteriyi seç',text:'Satış ekranında müşteriyi seçin. Ardından barkodu okutun veya ürün koduyla arayın; doğru ürünü sepete ekleyin.',watch:'Müşteri seçilmeden ürün ekleme düğmesi kapalı kalabilir.',stop:'Müşteri, ürün veya fiyat bulunamıyorsa rastgele başka kayıt seçmeyin.'},
   {title:'Adet, fiyat ve dövizi kontrol et',text:'Sepetteki adetleri ve dövizi kontrol edin. Fiyatı kontrol et düğmesiyle satış toplamını görün.',watch:'Ürün, adet ve döviz aynı satış için doğru olmalı; farklı dövizleri tek toplam gibi düşünmeyin.',stop:'Tutar veya adet beklediğiniz gibi değilse taslağı kaydetmeden düzeltin.'},
   {title:'Taslağı kaydet, sonra tamamla',text:'Taslağı kaydedin. Satışı tamamlamak ayrı adımdır ve yalnız mevcut satış yetkisi olan kişi yapar.',watch:'Taslak stok ve müşteri borcunu değiştirmez. Muhasebe belgeyi ve tutarı kontrol eder; tahsilat ayrı kaydedilir.',stop:'Sonucun doğrulanması isteniyorsa yeni satış açmayın; Son işlemi doğrula düğmesini kullanın.'}
  ],
  quiz:{question:'Satış taslağını kaydetmek ne yapar?',options:['Taslağı saklar; satışı tamamlamak ayrı adımdır','Ürünü hemen stoktan düşer ve parasını tahsil eder','Tahsilat yerine geçer'],answer:0,explanation:'Taslak, kontrol edilecek satış kaydıdır. Satışı tamamlamak ve tahsilat kaydetmek ayrı işlemlerdir.'}
 },
 {
  id:'purchase',title:'Kabulden alış faturasına geç',role:'Personel → İlker → Muhasebe kontrolü',duration:'3 dk',screen:'/ornek-akis.html#purchases',image:'03-purchases.png',
  steps:[
   {title:'Onaylanan kabulü seç',text:'Personelin sayıp gönderdiği ve İlker tarafından mevcut yetkiyle onaylanan mal kabulünü seçin.',watch:'Yalnız kullanılabilir kabul adedi faturaya bağlanır.',stop:'Kabul henüz onaylanmadıysa veya uygun adet yoksa yeni kabul uydurmayın.'},
   {title:'Belge ve tutarı kontrol et',text:'Muhasebe fatura belgesini, tarihi, adetleri, tutarı ve dövizi kontrol eder. Fatura tutarını kontrol et düğmesiyle özeti inceleyin.',watch:'Fatura kabul edilen ürünlere bağlıdır. Başka döviz kendiliğinden çevrilmez.',stop:'Belge, fiyat veya döviz uyuşmuyorsa kesinleştirmeyi bekletin.'},
   {title:'Taslak ve kesinleşmeyi ayır',text:'Alış taslağını kaydedin. Mevcut yetkili kişi Faturayı kesinleştir düğmesiyle ayrı olarak tamamlar.',watch:'Bağlı alış faturası stoğu ikinci kez artırmaz; kesinleşen fatura tedarikçi borcuna işlenir.',stop:'Kesinleştirme veya iptal düğmesi kapalıysa mevcut yetki ve ekran sınırına uyun.'},
   {title:'Tedarikçi hareketini incele',text:'Tedarikçi hareketinde kabul, fatura ve borç bağlantısını kontrol edin. Belgeyi yeniden görmek için Faturayı yenile düğmesini kullanın.',watch:'Fatura kaydı ile ödeme kaydı ayrı adımlardır.',stop:'Son işlemin sonucu belirsizse aynı işlemi doğrulayın; ikinci fatura oluşturmayın.'}
  ],
  quiz:{question:'Mal kabulüne bağlı alış faturası kesinleşince stok ne olur?',options:['Aynı ürünler tekrar eklenir','Stok tekrar artmaz; tedarikçi borcu kaydedilir','Fatura tahsilat olarak kaydedilir'],answer:1,explanation:'Ürün stoğa mal kabulünde girmiştir. Bağlı fatura ikinci stok girişi yapmaz.'}
 },
 {
  id:'collection',title:'Satış fişine tahsilat kaydet',role:'Tahsilat yetkisi olan kişi · Muhasebe kontrolü',duration:'2 dk',screen:'/ornek-akis.html#collections',image:'04-collection.png',
  steps:[
   {title:'Müşterinin fişini incele',text:'Tahsilat ekranında tamamlanmış satış fişini bulun. Fişi incele düğmesiyle müşteriyi, fiş toplamını ve kalan tutarı okuyun.',watch:'Tahsilat yalnız seçilen fişe bağlanır. Muhasebe belge ve kalan tutarı kontrol eder.',stop:'Müşteri veya fiş yanlışsa tahsilat kaydetmeyin.'},
   {title:'Aynı dövizde hesabı seç',text:'Fişin dövizine uygun hesabı seçin. Kısmi tutar girin veya kalan tutarın tamamını seçin; işlem tarihini kontrol edin.',watch:'TRY, USD ve EUR tutarları birbirine eklenmez. Geçmiş kasa açılışı ile bu fişin tahsilatı farklıdır.',stop:'Uygun hesap yoksa başka dövizde bir hesap seçmeyin.'},
   {title:'Kontrol et ve kaydet',text:'Tutarı kontrol edin. Yalnız tahsilat yetkisi olan kişi Tahsilatı kaydet düğmesini kullanır; ardından kalan tutarı inceleyin.',watch:'Satışın tamamlanması, paranın tahsil edildiği anlamına gelmez.',stop:'Sonuç belirsizse Son işlemi doğrula düğmesini kullanın; yeni tahsilat oluşturmayın.'}
  ],
  quiz:{question:'TRY fişin tahsilatı için nasıl hesap seçilir?',options:['Herhangi bir dövizdeki hesap seçilir','Uygun TRY hesabı seçilir; dövizler otomatik birleştirilmez','Satış fişi tamamlanınca ayrıca tahsilat gerekmez'],answer:1,explanation:'Tahsilat fişin kendi dövizinde yapılır. Satış ve tahsilat birbirinden ayrı kayıtlardır.'}
 },
 {
  id:'payment',title:'Tedarikçi borcuna ödeme kaydet',role:'Ödeme yetkisi olan kişi · Muhasebe kontrolü',duration:'2 dk',screen:'/ornek-akis.html#supplier-payments',image:'05-payment.png',
  steps:[
   {title:'Borç belgesini seç',text:'Tedarikçiyi ve bağlı alış faturasını seçin. Muhasebe belgeyi, kalan borcu ve dövizi kontrol eder.',watch:'Doğrulanmamış geçmiş açılış borcu, bağlı fatura yerine kullanılamaz.',stop:'Borç kaynağı bilinmiyorsa veya fatura yanlışsa ödeme kaydetmeyin.'},
   {title:'Hesabı ve tutarı kontrol et',text:'Borçla aynı dövizde kasa veya banka hesabı seçin. Kısmi tutar ya da kalan borcun tamamını girin; tarihi kontrol edin.',watch:'TRY, USD ve EUR borçları otomatik birleştirilmez. Ödeme fiziksel stoğu değiştirmez.',stop:'Uygun hesap bulunmuyorsa veya tutar borçtan fazlaysa işlemi bekletin.'},
   {title:'Ödemeyi kaydet ve geçmişi oku',text:'Ödemeyi kontrol edin. Yalnız mevcut ödeme yetkisi olan kişi kaydeder. Ödeme geçmişinde belgeyi ve tutarı inceleyin; eski açıklama Açıklama bölümünde korunur.',watch:'İptal ödemeyi silmez; borç ve para hareketi geri alınır. İptal de mevcut yetki ister.',stop:'Sonuç belirsizse son işlemi doğrulayın; ikinci ödeme oluşturmayın.'}
  ],
  quiz:{question:'Tedarikçi ödemesi fiziksel stoğu değiştirir mi?',options:['Evet, malı yeniden stoğa ekler','Evet, satış gibi stoktan düşer','Hayır; borç ve para hareketi ayrı kaydedilir'],answer:2,explanation:'Ödeme, tedarikçi borcu ve para hesabıyla ilgilidir. Fiziksel stok bu işlemde değişmez.'}
 },
 {
  id:'return',title:'Kaynak belgeye bağlı iade',role:'Personel → İlker → Muhasebe kontrolü',duration:'3 dk',screen:'/ornek-akis.html#returns',image:'06-return.png',
  steps:[
   {title:'Doğru iade belgesini bul',text:'Müşteri iadesi için satış fişini, tedarikçi iadesi için bağlı alış faturasını bulun. Ürünü ve iade edilebilir adedi kontrol edin.',watch:'Müşteri iadesi ile tedarikçiye iade farklı işlemlerdir.',stop:'Kaynak belge bulunamıyorsa yeni satış veya alışla iade gibi göstermeyin.'},
   {title:'Adedi ve nedeni gönder',text:'Personel iade adedini ve nedenini kaydeder; incelemeye gönderir.',watch:'İade taslağı stok veya borç etkisi oluşturmaz.',stop:'Adet, ürün veya neden yanlışsa yetkili onayından önce düzeltin.'},
   {title:'Yetkili kontrolünü bekle',text:'İlker kaynağı ve fiziksel iadeyi kontrol eder; mevcut yetkisiyle onaylar. Muhasebe belgeyi, tutarı ve dövizi kontrol eder.',watch:'Stok ve müşteri ya da tedarikçi hesabı, ilgili iade onayında güncellenir. Para iadesi ayrı işlemdir.',stop:'Onay düğmesi kapalıysa mevcut rol sınırına uyun. Para iadesi yapıldığını varsaymayın.'},
   {title:'Geçmişi koru',text:'Kaydedilen iadeyi ve bağlı belgeyi yeniden inceleyin. Hatalı kayıt düzeltmesi ile gerçekten geri gelen malı birbirinden ayırın.',watch:'İptal eski kaydı silmez; ilgili etkiyi geri alır.',stop:'Sonuç belirsizse aynı işlemi doğrulayın; aynı iadeyi yeniden oluşturmayın.'}
  ],
  quiz:{question:'İade taslağını kaydetmek ne anlama gelir?',options:['İade incelemeye hazırdır; stok ve hesap etkisi yetkili onayında oluşur','Para iadesi de otomatik yapılmıştır','Eski fatura silinmiştir'],answer:0,explanation:'Taslak kontrol için saklanır. İade onayı ve varsa para iadesi ayrı işlemlerdir.'}
 },
 {
  id:'count',title:'Fiziksel sayım ve stok farkı',role:'Personel → İlker → Muhasebe kontrolü',duration:'3 dk',screen:'/ornek-akis.html#count',image:'07-count.png',
  steps:[
   {title:'Ürünleri fiziksel olarak say',text:'Yeni sayım açın. Barkodu okutun, fiziksel adedi ve fark nedenini yazın. Personel bütün ürünleri aynı sayımda kaydeder.',watch:'Aynı ürünün tekrar okutulması adedi artırabilir; listede toplam adedi kontrol edin.',stop:'Ürün kartı bulunamıyorsa eşleşmeyi uydurmayın; inceleme bekleyin.'},
   {title:'Kaydet ve onaya gönder',text:'Sayımı kaydedin, ardından onaya gönderin. Yarım kalan sayımı aynı kayıttan sürdürebilirsiniz.',watch:'Kaydetmek veya göndermek stok farkını henüz uygulamaz.',stop:'Son değişiklik kaydedilmediyse ya da satır eksikse göndermeden önce düzeltin.'},
   {title:'İlker farkı kontrol eder',text:'İlker fiziksel adedi, sistem miktarını ve fark nedenini inceler; mevcut stok yetkisiyle bütün satırları birlikte onaylar.',watch:'Sayan kişi ile onaylayan kişi geçmişte görünür. Sayımdan sonra stok hareketi varsa tekrar sayım gerekebilir.',stop:'Güncel stok kontrolü başarısızsa eski farkı zorla uygulamayın.'},
   {title:'Sonucu ve belgeyi incele',text:'Onaydan sonra güncel stoğu ve sayım geçmişini kontrol edin. Muhasebe sonucu ve ilgili belgeleri inceler; sayım onayı stok yetkilisindedir.',watch:'Sayım onayı ikinci kez stok düzeltmesi oluşturmamalıdır. Eğitim tamamlanması işyeri kabulü yerine geçmez.',stop:'Hatalı sayımda geçmişi silmeyin; yetkili incelemesiyle mevcut düzeltme yolunu kullanın.'}
  ],
  quiz:{question:'Fiziksel sayım farkı ne zaman stoğa uygulanır?',options:['Barkodu okutunca','Sayım taslağını kaydedince','Yetkili stok sorumlusu kontrol edip onaylayınca'],answer:2,explanation:'Personel sayımı hazırlar. Fark, mevcut stok yetkisi olan kişinin kontrol ve onayından sonra uygulanır.'}
 },
 {
  id:'crm-order',title:'Müşteri ürünleri ve taslak sipariş',role:'Satış personeli · sipariş taslağı kontrolü',duration:'2 dk',screen:null,image:'08-crm.png',
  steps:[
   {title:'Müşteriyi ve ürünleri incele',text:'Müşterilerim ekranında doğru müşteriyi açın. Ürünü, fotoğrafı, adedi, fiyatı ve dövizi kontrol edin.',watch:'Müşteri ürün incelemesi, satış fişi oluşturmak değildir.',stop:'Müşteri veya ürün bilgisi yanlışsa taslağa eklemeyin.'},
   {title:'Taslak siparişi hazırla',text:'İstenen ürünleri ve adetleri taslağa ekleyin. Taslağı müşteri isteğiyle karşılaştırın.',watch:'CRM sipariş taslağı satış, tahsilat veya stok çıkışı değildir.',stop:'Toplam ya da döviz beklediğiniz gibi değilse taslağı hazır saymayın.'},
   {title:'Kontrol için devret',text:'Satış personeli taslağı kontrol eder. Gereken ERP satışını ve belge kontrolünü mevcut yetkili kişiler ayrı akışta yapar.',watch:'Muhasebe belge ve tutarı kontrol eder; bu ders yeni yetki veya otomatik satış oluşturmaz.',stop:'Taslak siparişi tamamlanmış satış gibi bildirmeyin. Eğitim, gerçek müşteri ve cihaz kabulü yerine geçmez.'}
  ],
  quiz:{question:'CRM sipariş taslağı oluşturulunca ne olur?',options:['ERP satışı ve tahsilatı otomatik tamamlanır','Müşteri isteği kontrol için hazırlanır; satış ayrı işlemdir','Stok hemen düşer'],answer:1,explanation:'CRM taslağı müşteri isteğini hazırlar. Gerçek satış ve tahsilat mevcut yetkili ERP akışında ayrı yapılır.'}
 }
]);
