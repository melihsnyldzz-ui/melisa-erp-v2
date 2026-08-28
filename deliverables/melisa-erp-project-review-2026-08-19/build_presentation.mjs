import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const artifactPath = "C:/Users/Xaser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";
const { Presentation, PresentationFile } = await import(pathToFileURL(artifactPath).href);

const OUT = "deliverables/melisa-erp-project-review-2026-08-19";
const RENDER = `${OUT}/pptx_render`;
const PPTX = `${OUT}/Melisa_ERP_Yonetim_Sunumu_2026-08-19.pptx`;
await fs.mkdir(RENDER, { recursive: true });

const C = {
  navy: "#10233F", teal: "#008B8B", blue: "#3D6FE8", red: "#D64545",
  gold: "#F0A43A", green: "#198754", white: "#FFFFFF", bg: "#F4F7FA",
  pale: "#E8EFF6", gray: "#5C6B7A", light: "#D8E2EC", ink: "#27364A",
};

const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

function box(slide, x, y, w, h, fill=C.white, radius="rounded-xl", line=C.light, lw=1) {
  return slide.shapes.add({
    geometry: "roundRect", position: { left:x, top:y, width:w, height:h },
    fill, line: { style:"solid", fill:line, width:lw }, borderRadius: radius,
  });
}

function line(slide, x1, y1, x2, y2, color=C.light, width=2) {
  const left=Math.min(x1,x2), top=Math.min(y1,y2);
  return slide.shapes.add({ geometry:"straightConnector1", position:{left,top,width:Math.max(0.01,Math.abs(x2-x1)),height:Math.max(0.01,Math.abs(y2-y1))}, fill:"none", line:{style:"solid",fill:color,width} });
}

function text(slide, value, x, y, w, h, opts={}) {
  const s = slide.shapes.add({ geometry:"textbox", position:{left:x,top:y,width:w,height:h}, fill:"none", line:{style:"solid",fill:"none",width:0} });
  s.text = value;
  s.text.style = {
    fontSize: opts.size ?? 24, typeface: opts.font ?? "Aptos", color: opts.color ?? C.ink,
    bold: opts.bold ?? false, alignment: opts.align ?? "left", verticalAlignment: opts.valign ?? "top",
    autoFit: "shrinkText", insets: { top:0, right:0, bottom:0, left:0 },
  };
  return s;
}

function circle(slide, x, y, d, fill, label, labelColor=C.white, size=20) {
  slide.shapes.add({ geometry:"ellipse", position:{left:x,top:y,width:d,height:d}, fill, line:{style:"solid",fill,width:0} });
  text(slide,label,x,y+d*.20,d,d*.55,{size,bold:true,color:labelColor,align:"center",valign:"middle"});
}

function header(slide, title, kicker, index) {
  slide.background.fill = C.bg;
  text(slide, kicker.toUpperCase(), 54, 34, 500, 24, {size:14,bold:true,color:C.teal});
  text(slide, title, 54, 72, 1110, 72, {size:37,bold:true,color:C.navy});
  line(slide,54,154,1226,154,C.light,2);
  text(slide,String(index).padStart(2,"0"),1182,34,44,22,{size:14,bold:true,color:C.gray,align:"right"});
}

function note(slide, body, sources=[]) {
  let content = body;
  if (sources.length) content += `\n\n[Sources]\n${sources.join("\n")}`;
  slide.speakerNotes.textFrame.setText(content);
}

function metric(slide, x, y, w, label, value, color=C.teal, detail="") {
  box(slide,x,y,w,154,C.white,"rounded-xl",C.light,1);
  slide.shapes.add({geometry:"rect",position:{left:x,top:y,width:8,height:154},fill:color,line:{style:"solid",fill:color,width:0}});
  text(slide,label.toUpperCase(),x+24,y+20,w-42,22,{size:13,bold:true,color:C.gray});
  text(slide,value,x+24,y+49,w-42,54,{size:34,bold:true,color:C.navy});
  text(slide,detail,x+24,y+112,w-42,28,{size:14,color:C.gray});
}

// 1 — cover
{
  const s=p.slides.add(); s.background.fill=C.white;
  text(s,"MELİSA BABY  /  YÖNETİM DOSYASI",54,36,500,28,{size:14,bold:true,color:C.teal});
  text(s,"ERP v2",54,145,470,110,{size:86,bold:true,color:C.navy});
  text(s,"Proje hafızası, şirket verisi\nve 10 milyon USD yol haritası",54,282,610,120,{size:36,color:C.teal});
  box(s,760,95,430,470,C.navy,"rounded-2xl",C.navy,0);
  text(s,"Mayıs → Ağustos\n2026",805,142,340,120,{size:42,bold:true,color:C.white});
  const stats=[["244","commit"],["43","ERP Core sprint"],["8 + 8","UX / CRM sprint"],["5","canlı servis yüzeyi"]];
  stats.forEach((v,i)=>{ const yy=298+i*62; text(s,v[0],805,yy,100,40,{size:27,bold:true,color:i===3?C.gold:C.white}); text(s,v[1],920,yy+6,220,28,{size:17,color:C.pale}); });
  text(s,"19 Ağustos 2026  •  Şirket içi ve kontrollü AI değerlendirmesi",54,630,800,26,{size:16,color:C.gray});
  note(s,"Sunum, ayrıntılı ana raporun yönetici özetidir. Sayısal durumlar tarih ve doğruluk etiketiyle okunmalıdır.");
}

// 2 — thesis
{
  const s=p.slides.add(); header(s,"Bir stok programından işletim sistemine","Yönetici özeti",2);
  text(s,"Melisa ERP; operasyon, mobil saha, dış veri ve WhatsApp satışını aynı iş gerçeğinde birleştirdi.",54,182,1130,56,{size:28,bold:true,color:C.navy});
  metric(s,54,272,270,"ERP Core","Kabul edildi",C.green,"Uyarılar ve üretim kapıları açık");
  metric(s,348,272,270,"Canlı servis","5 yüzey",C.blue,"Web, API, CRM, Chatwoot, Evolution");
  metric(s,642,272,270,"Baz ciro","$3,86m",C.gold,"2026 yıllık USD eşdeğeri tahmin");
  metric(s,936,272,270,"Ana risk","Dirty tree",C.red,"Temmuz sonrası tek release değil");
  box(s,54,458,1152,148,C.pale,"rounded-xl",C.pale,0);
  text(s,"Sonraki doğru adım",80,482,300,30,{size:18,bold:true,color:C.teal});
  text(s,"Yeni özellik eklemekten önce temiz sürüm, gerçek yedek/geri dönüş, stok-muhasebe mutabakatı ve saha testi.",80,526,1080,52,{size:26,bold:true,color:C.navy});
  note(s,"ERP Core final test için kabul edilmiştir; üretime hazır sertifikası değildir.", ["docs/erp-v2/final-closure-decision.md", "19 Ağustos 2026 yerel sağlık kontrolleri"]);
}

// 3 — timeline
{
  const s=p.slides.add(); header(s,"Dört ayda dört dönüşüm","Proje kronolojisi",3);
  const xs=[86,385,684,983]; const months=["MAYIS","HAZİRAN","TEMMUZ","AĞUSTOS"];
  const titles=["Temel ERP","Operasyonel güven","Test + kabul","Canlı veri + büyüme"];
  const bodies=["Stok, cari, satış, alış, finans\nAPI + SQL + taslak/kesin", "Yetki, audit, import, finans\nyedek sınırları ve sağlık", "43 sprint, terminal, CRM sınırı\ninsan kabulü: uyarılarla", "Vega salt okunur, UX/CRM\nOCR, rapor ve $10m planı"];
  line(s,105,326,1130,326,C.navy,3);
  xs.forEach((x,i)=>{ circle(s,x,302,48,[C.blue,C.teal,C.gold,C.red][i],String(i+1)); text(s,months[i],x-10,228,190,26,{size:15,bold:true,color:C.gray}); text(s,titles[i],x-10,374,235,38,{size:23,bold:true,color:C.navy}); text(s,bodies[i],x-10,428,235,92,{size:17,color:C.ink}); });
  box(s,54,568,1152,70,C.white,"rounded-xl",C.light,1);
  text(s,"Kazanım: ekran geliştirmeden veri bütünlüğü, saha, CRM ve karar desteğine geçiş.",78,589,1090,30,{size:22,bold:true,color:C.teal});
  note(s,"Kronoloji Git geçmişi, sprint raporları ve Ağustos entegrasyon çalışmaları üzerinden özetlenmiştir.");
}

// 4 — architecture
{
  const s=p.slides.add(); header(s,"Tek merkez, kontrollü dış bağlantılar","Sistem mimarisi",4);
  box(s,50,190,260,392,C.navy,"rounded-xl",C.navy,0);
  text(s,"KULLANICI\nYÜZEYLERİ",80,214,200,52,{size:18,bold:true,color:C.pale});
  [["Web ERP",":5173"],["Android Terminal","Expo / APK"],["Windows Masaüstü","Electron"],["WhatsApp CRM",":3100"]].forEach((v,i)=>{box(s,75,288+i*64,210,48,"#17375F","rounded-lg","#31577F",1); text(s,v[0],90,299+i*64,140,22,{size:17,bold:true,color:C.white}); text(s,v[1],228,301+i*64,44,20,{size:13,color:C.gold,align:"right"});});
  box(s,404,224,350,130,C.white,"rounded-xl",C.blue,2); text(s,"ERP API  :4100",432,247,290,30,{size:27,bold:true,color:C.navy}); text(s,"İş kuralları • audit • yetki",432,295,290,24,{size:17,color:C.gray});
  box(s,404,414,350,130,C.white,"rounded-xl",C.teal,2); text(s,"CRM API  :4200",432,437,290,30,{size:27,bold:true,color:C.navy}); text(s,"Atama • görev • teklif",432,485,290,24,{size:17,color:C.gray});
  line(s,310,385,404,289,C.gray,2); line(s,310,420,404,479,C.gray,2);
  box(s,850,188,370,116,C.pale,"rounded-xl",C.light,1); text(s,"MELISA_ERP_V2",880,216,310,28,{size:24,bold:true,color:C.navy}); text(s,"Operasyonel SQL Server",880,259,310,22,{size:16,color:C.gray});
  box(s,850,328,370,116,C.pale,"rounded-xl",C.light,1); text(s,"VEGA 2026",880,356,310,28,{size:24,bold:true,color:C.navy}); text(s,"F0102/F0103 • SELECT-only",880,399,310,22,{size:16,color:C.red});
  box(s,850,468,370,116,C.pale,"rounded-xl",C.light,1); text(s,"CHATWOOT + EVOLUTION",880,496,310,28,{size:23,bold:true,color:C.navy}); text(s,"Gelen kutusu ve WhatsApp",880,539,310,22,{size:16,color:C.gray});
  line(s,754,289,850,246,C.gray,2); line(s,754,289,850,386,C.gray,2); line(s,754,479,850,526,C.gray,2);
  note(s,"Vega sadece salt okunur kullanılmalıdır. Ürün fotoğrafları ve operasyonel yazmalar Melisa ERP tarafında kalır.");
}

// 5 — ERP core
{
  const s=p.slides.add(); header(s,"ERP Core: geniş kapsam, kontrollü etki","Başarılar",5);
  const cards=[
    ["01","Ticari omurga","Stok • cari • satış • alış • finans",C.blue],
    ["02","Belge gerçeği","Taslak • kesin • iptal • ters kayıt",C.teal],
    ["03","Kontrol katmanı","Yetki • audit • import önizleme",C.gold],
    ["04","Karar desteği","Rapor • dashboard • döviz görüntüsü",C.red],
  ];
  cards.forEach((v,i)=>{const x=54+(i%2)*576,y=190+Math.floor(i/2)*205; box(s,x,y,546,176,C.white,"rounded-xl",C.light,1); circle(s,x+22,y+25,54,v[3],v[0],C.white,16); text(s,v[1],x+96,y+26,410,34,{size:25,bold:true,color:C.navy}); text(s,v[2],x+96,y+78,410,42,{size:19,color:C.ink});});
  box(s,54,618,1122,48,"#FFF4E5","rounded-lg",C.gold,1); text(s,"Kabul kararı ≠ üretim kapılarının kapanması",76,630,1080,24,{size:19,bold:true,color:C.red});
  note(s,"ERP Core kapsamı 43 sprintlik stabilizasyon zinciriyle doğrulandı. Üretim readiness ayrı bir kapıdır.",["docs/erp-v2/current-status.md","docs/erp-v2/final-closure-decision.md"]);
}

// 6 — commercial modules
{
  const s=p.slides.add(); header(s,"Stoktan tahsilata görev odaklı akış","Operasyon",6);
  const labels=["Ürün / Stok","Müşteri / Tedarikçi","Satış / Alış","Finans / Rapor"];
  const desc=["Anlık mükerrer uyarı\nToplu kart + OCR\nKart açılış tarihi", "Vega canlı cari\nHareket + belge popup\nMüşteri/tedarikçi ayrımı", "Detaylı arama\nPeşin TL/USD/EUR\nBaşlık + satır", "Tahsilat/ödeme\nÇoklu döviz\nPerformans raporu"];
  labels.forEach((v,i)=>{const x=54+i*289; circle(s,x+95,190,70,[C.blue,C.teal,C.gold,C.red][i],String(i+1)); text(s,v,x,282,260,42,{size:23,bold:true,color:C.navy,align:"center"}); text(s,desc[i],x,344,260,116,{size:18,color:C.ink,align:"center"}); if(i<3) text(s,"→",x+264,205,42,42,{size:34,bold:true,color:C.gray,align:"center"});});
  box(s,54,510,1120,116,C.pale,"rounded-xl",C.pale,0); text(s,"Vega etkilenmez",78,533,220,28,{size:20,bold:true,color:C.red}); text(s,"Stok kartı, cari ve belgeler canlı okunur; fotoğraf ve işlem yazmaları Melisa ERP’de kalır.",308,529,830,58,{size:24,bold:true,color:C.navy});
  note(s,"Ürün, müşteri, tedarikçi, satış/alış ve finans modülleri ana raporda ayrıntılıdır.");
}

// 7 — terminal + desktop
{
  const s=p.slides.add(); header(s,"Saha uygulaması iş sürekliliğini taşıyor","Terminal + masaüstü",7);
  box(s,54,190,390,430,C.navy,"rounded-2xl",C.navy,0);
  text(s,"ANDROID\nEL TERMİNALİ",90,224,320,74,{size:30,bold:true,color:C.white});
  ["Personel + şifre girişi","Değiştirilebilir API/IP","Klavye güvenli ekran","Otomatik taslak kurtarma","Offline kuyruk / senkron","ERP-PC yazdırma"].forEach((v,i)=>{circle(s,90,326+i*43,22,C.teal,"✓",C.white,13); text(s,v,126,324+i*43,270,24,{size:17,color:C.pale});});
  box(s,494,190,326,430,C.white,"rounded-2xl",C.light,1);
  text(s,"WINDOWS",528,224,250,32,{size:24,bold:true,color:C.navy}); text(s,"Electron masaüstü",528,268,250,28,{size:21,color:C.teal});
  text(s,"• Installer / EXE\n• Değiştirilebilir sunucu IP\n• DB ve sırlar pakete gömülmez\n• Logo, ikon ve splash",528,328,248,150,{size:18,color:C.ink});
  box(s,870,190,336,430,C.white,"rounded-2xl",C.light,1);
  text(s,"SUNUCU",904,224,250,32,{size:24,bold:true,color:C.navy}); text(s,"Yerel supervisor",904,268,250,28,{size:21,color:C.teal});
  text(s,"• Gizli Windows başlangıcı\n• Periyodik sağlık kontrolü\n• LocalAppData logları\n• API ve yardımcı servis izlemi",904,328,250,150,{size:18,color:C.ink});
  box(s,494,526,712,70,"#FFF4E5","rounded-xl",C.gold,1); text(s,"Saha hazır olmak için geçerli oturum + gerçek cihaz smoke zorunlu.",520,548,660,28,{size:19,bold:true,color:C.red});
  note(s,"Terminalde hata kuyruğu veya geçersiz oturum varsa cihaz field-ready sayılmaz.",["docs/erp-v2/terminal-device-sync-validation-sprint-025-report.md"]);
}

// 8 — CRM
{
  const s=p.slides.add(); header(s,"WhatsApp konuşmasını satış sürecine çevir","CRM",8);
  const flow=["Mesaj","Ülke","Atama","Katalog","Teklif","Sipariş"];
  flow.forEach((v,i)=>{const x=55+i*190; box(s,x,190,155,74,i<3?C.navy:C.white,"rounded-xl",i<3?C.navy:C.light,1); text(s,v,x+10,213,135,28,{size:21,bold:true,color:i<3?C.white:C.navy,align:"center"}); if(i<5) text(s,"→",x+156,206,34,34,{size:28,bold:true,color:C.teal,align:"center"});});
  metric(s,54,316,264,"Sağlayıcı","Evolution",C.blue,"Canlı bağlantı");
  metric(s,340,316,264,"Gelen kutusu","Chatwoot",C.teal,"Özel CRM görünümü");
  metric(s,626,316,264,"Personel eşleme","4",C.gold,"Atama ve görev");
  metric(s,912,316,264,"Gönderim","Açık",C.green,"Canlı onaylı");
  box(s,54,510,1122,112,C.pale,"rounded-xl",C.pale,0);
  text(s,"Güvenlik sınırı",78,532,230,26,{size:18,bold:true,color:C.red});
  text(s,"Doğrulanmamış LID/grup numarasını uydurma • CRM lead’i hemen muhasebe carisine çevirme • kişisel ve şirket hattını karıştırma",310,528,830,58,{size:20,bold:true,color:C.navy});
  note(s,"19 Ağustos 2026 sağlık kontrolünde gönderim açık ve liveSendApproved=true. İdempotency hâlâ memory backend.",["CRM /api/health 19 Ağustos 2026","docs/erp-v2/whatsapp-crm-operational-hardening.md"]);
}

// 9 — quality
{
  const s=p.slides.add(); header(s,"Test kapsamı güçlü; üretim kanıtı ayrı","Kalite",9);
  metric(s,54,190,250,"ERP Core","43 sprint",C.blue,"Stabilizasyon zinciri");
  metric(s,322,190,250,"UX","105 / 105",C.teal,"7/7 paket");
  metric(s,590,190,250,"Final smoke","32 / 0",C.green,"başarılı / hatalı");
  metric(s,858,190,318,"Responsive","16 görünüm",C.gold,"4 ana çözünürlük");
  box(s,54,386,550,210,C.white,"rounded-xl",C.light,1); text(s,"KANITLANAN",82,410,200,26,{size:17,bold:true,color:C.green}); text(s,"• Rota ve ekran kapsamı\n• Kontrollü QA yazma akışı\n• Taşma ve responsive regresyon\n• CRM/ayar sınırları",82,454,470,116,{size:20,color:C.ink});
  box(s,626,386,550,210,"#FFF4E5","rounded-xl",C.gold,1); text(s,"KANITLANMAYAN",654,410,220,26,{size:17,bold:true,color:C.red}); text(s,"• Gerçek üretim yedek dönüşü\n• Tam saha personel kabulü\n• Host / HTTPS / env kapanışı\n• Temiz release etiketi",654,454,470,116,{size:20,color:C.ink});
  note(s,"İnsan kabulü 'accepted with warnings' olarak kaydedildi; granüler saha bulguları sınırlıdır.",["docs/erp-v2/final-human-acceptance-log.md","docs/erp-v2/erp-ux-sprint-008-final-regression-report.md"]);
}

// 10 — sales data
{
  const s=p.slides.add(); header(s,"2026: Euro büyüyor, USD ve TRY geriliyor","Şirket verisi • 18 Ağustos 2026",10);
  metric(s,54,178,336,"USD YTD","$1,766m",C.blue,"881 belge • 58 müşteri • -%5,6");
  metric(s,402,178,336,"EUR YTD","€461k",C.teal,"412 belge • 16 müşteri • +%14,5");
  metric(s,750,178,336,"TRY YTD","₺2,600m",C.gold,"138 belge • 8 müşteri • -%20,6");
  s.charts.add("bar",{position:{left:54,top:374,width:700,height:250},categories:["USD","EUR","TRY","Miktar"],series:[{name:"2025 aynı dönem",values:[100,100,100,100],fill:C.light},{name:"2026 endeksi",values:[94.4,114.5,79.4,95.0],fill:C.teal}],hasLegend:true,legend:{position:"bottom",overlay:false},dataLabels:{showValue:true,position:"outEnd"},yAxis:{minimumScale:0,maximumScale:130,majorGridlines:{style:"solid",fill:C.light,width:1}},chartFill:C.bg,chartLine:{fill:C.bg,width:0}});
  box(s,790,374,386,250,C.navy,"rounded-xl",C.navy,0); text(s,"2026 BAZ\nPROJEKSİYONU",824,400,320,62,{size:22,bold:true,color:C.pale}); text(s,"$3,856m",824,476,320,58,{size:42,bold:true,color:C.gold}); text(s,"USD eşdeğeri\n2025 mevsimselliği",824,544,320,50,{size:18,color:C.white});
  note(s,"2026 YTD rakamları 18 Ağustos tarihli salt okunur Vega görüntüsüdür. 2026 tam yıl baz projeksiyondur.",["Vega 2026 salt okunur analiz, 18 Ağustos 2026","https://www.tcmb.gov.tr/kurlar/kurlar_tr.html"]);
}

// 11 — stock
{
  const s=p.slides.add(); header(s,"Stok büyümenin önündeki ilk operasyon kapısı","Stok sağlığı",11);
  const vals=[1843,8930,352], total=11125, cols=[C.green,"#CBD5E1",C.red]; let x=54;
  vals.forEach((v,i)=>{const w=1122*v/total; s.shapes.add({geometry:"rect",position:{left:x,top:206,width:w,height:82},fill:cols[i],line:{style:"solid",fill:cols[i],width:0}}); if(w>90) text(s,`${(100*v/total).toFixed(1)}%`,x,230,w,28,{size:20,bold:true,color:i===1?C.navy:C.white,align:"center"}); x+=w;});
  metric(s,54,330,264,"Pozitif","1.843",C.green,"yaklaşık $811k maliyet");
  metric(s,340,330,264,"Sıfır","8.930",C.gray,"aktif kartların %80,3'ü");
  metric(s,626,330,264,"Negatif","352",C.red,"işlem kök nedeni gerekli");
  metric(s,912,330,264,"Hareketsiz","$165k",C.gold,"pozitif değerin %20,3'ü");
  box(s,54,528,1122,94,"#FFF4E5","rounded-xl",C.gold,1); text(s,"Öncelik",78,552,120,26,{size:18,bold:true,color:C.red}); text(s,"Negatifi sıfırla → sıfır kartı arşivle → hareketsizi nakde çevir → 3.000+ güçlü pozitif ürün.",210,546,930,40,{size:23,bold:true,color:C.navy});
  note(s,"Stok sayıları 18 Ağustos 2026 tarihli Vega anlık görüntüsüdür.");
}

// 12 — customer and finance
{
  const s=p.slides.add(); header(s,"Ciro kadar tahsilat kalitesi de büyütür","Müşteri riski",12);
  box(s,54,190,536,196,C.white,"rounded-xl",C.red,2); text(s,"NUTSİ",84,218,220,32,{size:28,bold:true,color:C.navy}); text(s,"$141.674",84,270,220,48,{size:34,bold:true,color:C.red}); text(s,"yaklaşık 146 gün DSO",306,279,240,30,{size:19,color:C.gray});
  box(s,618,190,536,196,C.white,"rounded-xl",C.gold,2); text(s,"YASMİN",648,218,220,32,{size:28,bold:true,color:C.navy}); text(s,"₺217.490",648,270,220,48,{size:34,bold:true,color:C.red}); text(s,"yaklaşık 100 gün DSO",870,279,240,30,{size:19,color:C.gray});
  box(s,54,426,1100,178,C.pale,"rounded-xl",C.pale,0);
  text(s,"Müşteri skoru",82,452,250,30,{size:20,bold:true,color:C.teal});
  text(s,"Ciro + katkı marjı + açık bakiye + DSO + iade/iskonto + personel emeği",82,500,1020,40,{size:27,bold:true,color:C.navy});
  text(s,"Yaklaşık 82 aktif müşteri • ortalama ≈ $47k eşdeğer hacim",82,560,800,24,{size:17,color:C.gray});
  note(s,"Örnek müşteri bakiyeleri ve DSO rakamları tarihli analizdir; güncel karar öncesi yenilenmelidir.");
}

// 13 — growth scenarios
{
  const s=p.slides.add(); header(s,"Talep yaratmak yetmez; kapasite birlikte büyümeli","Büyüme senaryoları",13);
  s.charts.add("line",{position:{left:54,top:178,width:760,height:414},categories:["Bugün","1. yıl","2. yıl","3. yıl"],series:[{name:"Temkinli",values:[100,120,138,155],fill:C.gray,line:{fill:C.gray,width:3}},{name:"Merkezi",values:[100,142,185,222],fill:C.teal,line:{fill:C.teal,width:4}},{name:"Güçlü",values:[100,170,238,309],fill:C.gold,line:{fill:C.gold,width:3}}],hasLegend:true,legend:{position:"bottom",overlay:false},dataLabels:{showValue:true},yAxis:{minimumScale:80,maximumScale:330,majorGridlines:{style:"solid",fill:C.light,width:1}},chartFill:C.bg,chartLine:{fill:C.bg,width:0}});
  box(s,852,178,324,124,C.white,"rounded-xl",C.light,1); text(s,"Temkinli",880,198,180,24,{size:17,bold:true,color:C.gray}); text(s,"+%20",880,232,180,42,{size:32,bold:true,color:C.navy});
  box(s,852,324,324,124,C.white,"rounded-xl",C.teal,2); text(s,"Merkezi",880,344,180,24,{size:17,bold:true,color:C.teal}); text(s,"+%42",880,378,180,42,{size:32,bold:true,color:C.navy});
  box(s,852,470,324,124,C.white,"rounded-xl",C.gold,2); text(s,"Güçlü",880,490,180,24,{size:17,bold:true,color:C.gold}); text(s,"+%70",880,524,180,42,{size:32,bold:true,color:C.navy});
  text(s,"Garanti değil: stok, satış kadrosu, lojistik ve çalışma sermayesine bağlıdır.",54,620,1100,24,{size:17,bold:true,color:C.red});
  note(s,"Senaryolar yönetim varsayımlarıdır; piyasa ve şirket kapasitesiyle stres test edilmelidir.",["https://icticaret.ticaret.gov.tr/haberler/turkiyede-e-ticaretin-gorunumu-raporu-2025in-ingilizce-versiyonu-yayimlandi","https://datareportal.com/reports/digital-2026-turkey","https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/"]);
}

// 14 — 10m
{
  const s=p.slides.add(); header(s,"10 milyon USD mümkün; 4 yıllık disiplin ister","Büyüme rotası",14);
  s.charts.add("line",{position:{left:54,top:182,width:690,height:390},categories:["Baz","2027","2028","2029","2030"],series:[{name:"USD eşdeğeri (m)",values:[3.856,5.0,6.5,8.2,10.0],fill:C.red,line:{fill:C.red,width:5}}],hasLegend:false,dataLabels:{showValue:true},yAxis:{minimumScale:0,maximumScale:11,majorGridlines:{style:"solid",fill:C.light,width:1}},chartFill:C.bg,chartLine:{fill:C.bg,width:0}});
  box(s,790,182,386,390,C.navy,"rounded-xl",C.navy,0);
  text(s,"GELİR KÖPRÜSÜ",820,208,320,28,{size:18,bold:true,color:C.pale});
  [["Mevcut müşteri","$4,60m"],["70 yeni perakendeci","$2,45m"],["8 distribütör","$2,00m"],["Private label / geri kazanım","$0,95m"]].forEach((v,i)=>{text(s,v[0],820,264+i*64,230,26,{size:17,color:C.white}); text(s,v[1],1050,264+i*64,90,26,{size:18,bold:true,color:i===3?C.gold:C.white,align:"right"}); line(s,820,298+i*64,1140,298+i*64,"#31577F",1);});
  text(s,"4 yılda gerekli CAGR  •  %26,9",54,610,700,28,{size:22,bold:true,color:C.teal});
  note(s,"10m köprüsü planlama modelidir. Gelir kalemleri, marj ve çalışma sermayesiyle birlikte doğrulanmalıdır.");
}

// 15 — gaps and 30 days
{
  const s=p.slides.add(); header(s,"Önce güvence, sonra ölçek","Kritik açıklar ve 30 gün",15);
  box(s,54,184,534,420,"#FFF4E5","rounded-xl",C.gold,1); text(s,"ÜRETİM KAPILARI",82,210,300,28,{size:20,bold:true,color:C.red});
  ["Yedek + ayrı DB geri dönüş kanıtı","Migration rehearsal","SQL least-privilege / sertifika","Kullanıcı-rol-env sahipliği","Host • HTTPS • firewall","Temiz release branch/tag"].forEach((v,i)=>{circle(s,84,264+i*50,24,C.red,"!",C.white,14); text(s,v,122,262+i*50,420,28,{size:18,color:C.ink});});
  box(s,616,184,560,420,C.white,"rounded-xl",C.teal,2); text(s,"İLK 30 GÜN",644,210,300,28,{size:20,bold:true,color:C.teal});
  ["Dirty tree değişiklik envanteri","Gerçek backup/restore provası","Stok-cari-belge mutabakatı","Negatif stok kök nedenleri","CRM durable idempotency","Şirket hattı/personel smoke","Muhasebe ve operasyon sağlığını ayır"].forEach((v,i)=>{circle(s,646,260+i*44,24,C.teal,"✓",C.white,13); text(s,v,684,258+i*44,440,26,{size:17,color:C.ink});});
  text(s,"Bu kapılar kapanmadan yeni özellik sayısı başarı ölçüsü değildir.",54,628,1120,24,{size:18,bold:true,color:C.red});
  note(s,"Çalışma ağacında çok sayıda commit edilmemiş değişiklik vardır. Raporda bulunan güncel yeteneklerin bir bölümü henüz release-baselined değildir.");
}

// 16 — AI brief
{
  const s=p.slides.add(); s.background.fill=C.navy;
  text(s,"SONRAKİ YAPAY ZEKÂYA SOR",54,42,500,26,{size:15,bold:true,color:C.gold});
  text(s,"Bu sistemi nasıl\ndaha güvenilir ve\nkârlı ölçekleriz?",54,105,550,210,{size:51,bold:true,color:C.white});
  const qs=["En güçlü 10 kazanım?","Üretimi engelleyen 10 risk?","Neyi sadeleştirelim?","30 / 90 / 365 gün planı?","10m hedefinin zayıf varsayımları?","Her önerinin KPI / etki / eforu?"];
  qs.forEach((q,i)=>{const x=675+(i%2)*260,y=100+Math.floor(i/2)*148; box(s,x,y,230,114,"#17375F","rounded-xl","#31577F",1); text(s,String(i+1).padStart(2,"0"),x+18,y+16,38,22,{size:14,bold:true,color:C.gold}); text(s,q,x+18,y+48,194,48,{size:18,bold:true,color:C.white});});
  box(s,54,560,1120,88,C.teal,"rounded-xl",C.teal,0); text(s,"Kural: Canlı doğrulandı • Kodda var • Tarihli veri • Plan/hedef ayrımını bozma.",82,586,1060,32,{size:23,bold:true,color:C.white});
  note(s,"Ayrıntılı değerlendirme talimatı master raporun 15. bölümündedir.");
}

for (const [i, slide] of p.slides.items.entries()) {
  const stem = `slide-${String(i+1).padStart(2,"0")}`;
  const png = await p.export({slide,format:"png",scale:1});
  await fs.writeFile(`${RENDER}/${stem}.png`,new Uint8Array(await png.arrayBuffer()));
  const layout=await slide.export({format:"layout"});
  await fs.writeFile(`${RENDER}/${stem}.layout.json`,await layout.text());
}
const montage=await p.export({format:"webp",montage:true,scale:1});
await fs.writeFile(`${RENDER}/deck-montage.webp`,new Uint8Array(await montage.arrayBuffer()));
const out=await PresentationFile.exportPptx(p);
await out.save(PPTX);
console.log(PPTX);
