# Ana dal uzlaştırması ve dış stok kaynağı

577c0cb ana dalı ticaret adayına yerel olarak alındı. main.jsx stil çatışmasında yeni phase2/phase3/dashboard stilleri korunur; commerce-navigation ve commerce-invoice-layout kuralları bunlardan sonra yüklenir. Product sales evidence ve Bionic route mountları birlikte korunur. Ayrı externalReadOnlyServer, ana uygulamanın içine eklenmez veya çalıştırılmaz.

Ana daldaki dış gateway source=vega parametresini Melisa-only işlevlere geçiriyor, cevapta Vega kaynağı yazıyordu. Yeni externalReadOnlyStockService kaynağı doğrular; Melisa seçimi mevcut Melisa işlevlerine, Vega seçimi mevcut Vega ürün listesine ve ayrı Vega SQL pool üzerinden kart sayımına gider. Vega sorgusu VEGA2026/F0102/D0007 kapsamıyla sınırlıdır. Liste250üst sınır, tek kod sorgusu en fazla2satır; farklı veya yinelenen kod başarılı tek ürün sayılmaz. Tanınmayan source400; yanlış kapsam503; yanlış kaynak yanıtı502; yinelenen kod409. Vega arızası Melisa fallback üretmez.

4yeni bağımlılık izole test ve178ticari testPASS. Birleşik web paketi/derlemePASS4.59sn. Typecheck API165/web187/terminal38/desktop3kök,0hata; değişenJSdosyalar lintPASS. GerçekSQL/gateway çağrısı yok. Aktif ticari verilerde yazma ve messaging testleri yok.

Kalan: birleşik temanın tarayıcı görünümü ve dış gateway route→service HTTP kabulü ayrıca doğrulanmalıdır. Bu yerel kaynak uzlaştırması PR merge veya production yayın değildir. Ana hedef ve PR taslak kalır.
