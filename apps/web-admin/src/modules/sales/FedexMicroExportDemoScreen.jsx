import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Globe2,
  LockKeyhole,
  PackageCheck,
  Plane,
  Printer,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  fedexMicroExportDemo,
  fedexMicroExportItems,
  fedexMicroExportSteps,
} from './fedexMicroExportDemoData.js';
import {
  createFedexCustomerQuote,
  createFedexShippingQuote,
  downloadFedexCustomerQuotePdf,
  fetchFedexIntegrationStatus,
  fetchFedexProductionRates,
  finalizeFedexCustomerQuote,
} from '../../services/shippingIntegrationApi.js';

const storageKey = 'melisaErpFedexMicroExportDemoV1';

const requiredChecks = [
  { id: 'address', label: 'Alıcı adresi ve iletişim bilgileri demo senaryosu için doğrulandı.' },
  { id: 'weights', label: 'Koli sayısı, gerçek brüt ağırlıklar ve ölçüler saha ekibince doğrulandı.' },
  { id: 'gtip', label: 'GTİP ve ürün içerikleri gümrük müşaviri / ürün etiketiyle doğrulandı.' },
  { id: 'invoice', label: 'Resmî e-arşiv fatura ve İngilizce ticari fatura hazırlandı.' },
  { id: 'fedex', label: 'FedEx hesabı, canlı servis/fiyat ve ithalat vergisi ödeyeni doğrulandı.' },
];

function formatMoney(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatNumber(value, fractionDigits = 1) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: fractionDigits }).format(Number(value || 0));
}

function getRateTransport(rate) {
  const serviceCode = String(rate?.serviceCode || '').trim().toUpperCase();
  const serviceName = String(rate?.serviceName || '').trim().toUpperCase();
  const isRegionalEconomy = serviceCode === 'FEDEX_REGIONAL_ECONOMY'
    || serviceCode === 'FEDEX_REGIONAL_ECONOMY_FREIGHT'
    || serviceName.includes('REGIONAL ECONOMY');

  return isRegionalEconomy
    ? { className: 'road', label: 'Ekonomik Karayolu', detail: 'FedEx Avrupa karayolu ağı' }
    : { className: 'air', label: 'Hava / Express', detail: 'FedEx hava servisi' };
}

function readDemoState() {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

export function FedexMicroExportDemoScreen() {
  const saved = useMemo(readDemoState, []);
  const [activeStep, setActiveStep] = useState(saved.activeStep || 'file');
  const [packagePlan, setPackagePlan] = useState({ ...fedexMicroExportDemo.defaults, ...(saved.packagePlan || {}) });
  const [checks, setChecks] = useState(saved.checks || {});
  const [demoCompletedAt, setDemoCompletedAt] = useState(saved.demoCompletedAt || '');
  const [integration, setIntegration] = useState(null);
  const [integrationBusy, setIntegrationBusy] = useState('');
  const [integrationError, setIntegrationError] = useState('');
  const [shippingQuote, setShippingQuote] = useState(null);
  const [rates, setRates] = useState([]);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [customerQuote, setCustomerQuote] = useState(null);
  const [customerPrice, setCustomerPrice] = useState('');
  const [finalizeConfirmed, setFinalizeConfirmed] = useState(false);

  const packageCount = Math.max(1, Number(packagePlan.packageCount || 1));
  const grossWeight = packageCount * Number(packagePlan.packageGrossKg || 0);
  const volumetricWeight = packageCount
    * Number(packagePlan.packageLengthCm || 0)
    * Number(packagePlan.packageWidthCm || 0)
    * Number(packagePlan.packageHeightCm || 0)
    / 5000;
  const chargeableWeight = Math.max(grossWeight, volumetricWeight);
  const completedChecks = requiredChecks.filter((item) => checks[item.id]).length;
  const isReady = completedChecks === requiredChecks.length;

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ activeStep, packagePlan, checks, demoCompletedAt }));
  }, [activeStep, checks, demoCompletedAt, packagePlan]);

  async function refreshIntegration() {
    setIntegrationBusy('status');
    setIntegrationError('');
    try {
      setIntegration(await fetchFedexIntegrationStatus());
    } catch (error) {
      setIntegrationError(error.message);
    } finally {
      setIntegrationBusy('');
    }
  }

  useEffect(() => {
    refreshIntegration();
  }, []);

  function buildShippingQuotePayload() {
    const packageTotal = Math.max(1, Math.min(20, Number(packagePlan.packageCount || 1)));
    return {
      erpOrderId: fedexMicroExportDemo.reference,
      customerName: fedexMicroExportDemo.recipient.company,
      customerPhone: fedexMicroExportDemo.recipient.phone,
      customerEmail: fedexMicroExportDemo.recipient.email,
      destinationCountryCode: fedexMicroExportDemo.recipient.countryCode,
      destinationCity: fedexMicroExportDemo.recipient.city,
      destinationPostalCode: fedexMicroExportDemo.recipient.postalCode.replace(/\s+/g, ''),
      destinationAddressLine: `${fedexMicroExportDemo.recipient.addressLine1}, ${fedexMicroExportDemo.recipient.state}`,
      orderValue: fedexMicroExportDemo.invoice.declaredValue,
      currency: fedexMicroExportDemo.invoice.currency,
      packages: Array.from({ length: packageTotal }, () => ({
        weightKg: Number(packagePlan.packageGrossKg),
        lengthCm: Number(packagePlan.packageLengthCm),
        widthCm: Number(packagePlan.packageWidthCm),
        heightCm: Number(packagePlan.packageHeightCm),
      })),
    };
  }

  async function runIntegrationAction(name, action) {
    setIntegrationBusy(name);
    setIntegrationError('');
    try {
      await action();
    } catch (error) {
      setIntegrationError(error.message);
    } finally {
      setIntegrationBusy('');
    }
  }

  function createLiveDraft() {
    return runIntegrationAction('draft', async () => {
      const result = await createFedexShippingQuote(buildShippingQuotePayload());
      setShippingQuote(result.quote);
      setRates([]);
      setSelectedRateId('');
      setCustomerQuote(null);
    });
  }

  function loadLiveRates() {
    return runIntegrationAction('rates', async () => {
      const result = await fetchFedexProductionRates(shippingQuote.id, fedexMicroExportDemo.invoice.currency);
      setShippingQuote(result.quote || shippingQuote);
      setRates(result.rates || []);
      setSelectedRateId(result.rates?.[0]?.id || '');
    });
  }

  function createLiveCustomerQuote() {
    return runIntegrationAction('customer', async () => {
      const selectedRate = rates.find((rate) => rate.id === selectedRateId);
      const result = await createFedexCustomerQuote(shippingQuote.id, {
        carrierRateId: selectedRateId,
        finalCustomerShippingPrice: customerPrice === '' ? selectedRate?.totalNetCharge : Number(customerPrice),
        customerMessage: 'AHM10350 demo mikro ihracat nakliye teklifi',
      });
      setCustomerQuote(result.customerQuote);
    });
  }

  function finalizeLiveCustomerQuote() {
    return runIntegrationAction('finalize', async () => {
      const result = await finalizeFedexCustomerQuote(customerQuote.id);
      setCustomerQuote(result.customerQuote);
      setFinalizeConfirmed(false);
    });
  }

  function changePackage(field, value) {
    setDemoCompletedAt('');
    setPackagePlan((current) => ({ ...current, [field]: value }));
  }

  function toggleCheck(id) {
    setDemoCompletedAt('');
    setChecks((current) => ({ ...current, [id]: !current[id] }));
  }

  function completeDemo() {
    if (!isReady) return;
    setDemoCompletedAt(new Date().toISOString());
  }

  function resetDemo() {
    setActiveStep('file');
    setPackagePlan(fedexMicroExportDemo.defaults);
    setChecks({});
    setDemoCompletedAt('');
  }

  return (
    <main className="work-area fedex-demo-screen">
      <section className="fedex-demo-banner">
        <div className="fedex-demo-brand"><span className="fedex-demo-mark">F<span>ed</span>Ex</span><div><strong>Mikro İhracat Operasyon Dosyası</strong><small>AHM10350 · İrlanda · yalnızca ERP içi simülasyon</small></div></div>
        <div className="fedex-demo-guard"><ShieldCheck size={18} /><span><strong>DEMO MODU</strong><small>Dış servise veri göndermez, ücret veya ETGB oluşturmaz.</small></span></div>
      </section>

      <section className="fedex-demo-steps" aria-label="Mikro ihracat adımları">
        {fedexMicroExportSteps.map((step, index) => (
          <button className={activeStep === step.id ? 'active' : ''} key={step.id} onClick={() => setActiveStep(step.id)} type="button">
            <span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div>
          </button>
        ))}
      </section>

      <section className="fedex-demo-summary-grid">
        <SummaryCard icon={FileText} label="Kaynak fiş" value={fedexMicroExportDemo.invoice.documentNo} detail="Vega salt okunur" />
        <SummaryCard icon={CircleDollarSign} label="Beyan değeri" value={formatMoney(fedexMicroExportDemo.invoice.declaredValue)} detail={`${fedexMicroExportDemo.invoice.totalQuantity} adet`} />
        <SummaryCard icon={Boxes} label="Demo koli" value={`${packageCount} koli / ${formatNumber(grossWeight)} kg`} detail={`Hacimsel ${formatNumber(volumetricWeight)} kg`} />
        <SummaryCard icon={Globe2} label="Rota" value="Türkiye → İrlanda" detail={`${packagePlan.incoterm} · vergiler alıcı`} />
        <SummaryCard icon={PackageCheck} label="Hazırlık" value={`${completedChecks}/${requiredChecks.length} kontrol`} detail={isReady ? 'Demo onaya hazır' : 'Kontrol gerekiyor'} tone={isReady ? 'success' : 'warning'} />
      </section>

      <section className="fedex-demo-content">
        {activeStep === 'file' && <FileStep grossWeight={grossWeight} />}
        {activeStep === 'parties' && <PartiesStep />}
        {activeStep === 'products' && <ProductsStep />}
        {activeStep === 'packages' && <PackagesStep packagePlan={packagePlan} onChange={changePackage} grossWeight={grossWeight} volumetricWeight={volumetricWeight} chargeableWeight={chargeableWeight} />}
        {activeStep === 'documents' && <DocumentsStep onPrint={() => window.print()} />}
        {activeStep === 'fedex' && <FedexStep
          packagePlan={packagePlan}
          chargeableWeight={chargeableWeight}
          integration={integration}
          busy={integrationBusy}
          error={integrationError}
          shippingQuote={shippingQuote}
          rates={rates}
          selectedRateId={selectedRateId}
          customerQuote={customerQuote}
          customerPrice={customerPrice}
          finalizeConfirmed={finalizeConfirmed}
          onRefresh={refreshIntegration}
          onCreateDraft={createLiveDraft}
          onLoadRates={loadLiveRates}
          onSelectRate={setSelectedRateId}
          onCustomerPrice={setCustomerPrice}
          onCreateCustomerQuote={createLiveCustomerQuote}
          onFinalizeConfirmed={setFinalizeConfirmed}
          onFinalize={finalizeLiveCustomerQuote}
          onDownloadPdf={() => runIntegrationAction('pdf', () => downloadFedexCustomerQuotePdf(customerQuote.id, customerQuote.quoteNumber))}
        />}
        {activeStep === 'approval' && <ApprovalStep checks={checks} completedAt={demoCompletedAt} isReady={isReady} onComplete={completeDemo} onReset={resetDemo} onToggle={toggleCheck} />}
      </section>

      <footer className="fedex-demo-status">
        <span><span className="status-dot online" /> Senaryo yerel tarayıcıda saklanır</span>
        <span>Referans: {fedexMicroExportDemo.reference}</span>
        <strong className={integration?.connected ? 'connected' : ''}>Nakliyat / FedEx: {integration?.connected ? 'BAĞLI' : 'KAPALI'}</strong>
      </footer>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone = '' }) {
  return <article className={`fedex-summary-card ${tone}`}><Icon size={18} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function PanelTitle({ icon: Icon, title, detail }) {
  return <div className="panel-title fedex-panel-title"><span><Icon size={16} /><strong>{title}</strong></span><small>{detail}</small></div>;
}

function FileStep({ grossWeight }) {
  const valueOk = fedexMicroExportDemo.invoice.declaredValue <= 30000;
  const weightOk = grossWeight <= 600;
  return <div className="fedex-two-column">
    <section className="erp-panel"><PanelTitle icon={FileCheck2} title="Dosya Ön Kontrolü" detail="FedEx 2026 basitleştirilmiş ihracat sınırları" /><div className="fedex-check-table">
      <StatusRow label="Fatura değeri" value={`${formatMoney(fedexMicroExportDemo.invoice.declaredValue)} / €30.000`} ok={valueOk} />
      <StatusRow label="Toplam brüt ağırlık" value={`${formatNumber(grossWeight)} kg / 600 kg`} ok={weightOk} warning />
      <StatusRow label="Ürün adedi" value="679 adet / 20 stok kartı" ok />
      <StatusRow label="Kaynak veri" value="Vega 2026 — salt okunur" ok />
      <StatusRow label="Resmî e-arşiv" value="Henüz sisteme yüklenmedi" ok={false} warning />
    </div></section>
    <section className="erp-panel"><PanelTitle icon={AlertTriangle} title="Bu aşamada karşılaşılacaklar" detail="Gerçek operasyondan önce" /><ul className="fedex-issue-list">
      <li><strong>Fatura türü:</strong> AHM10350 operasyon fişidir; resmî e-arşiv/e-fatura yerine geçmez.</li>
      <li><strong>Ağırlık:</strong> Demo koli verileri tartım sonucuyla değiştirilmelidir.</li>
      <li><strong>GTİP:</strong> Kodlar taslaktır; ürün etiketi ve müşavir doğrulaması gerekir.</li>
      <li><strong>İrlanda ithalatı:</strong> Alıcının VAT/EORI durumu ayrıca teyit edilmelidir.</li>
      <li><strong>FedEx:</strong> Canlı servis uygunluğu ve fiyat ancak hesap oturumunda alınır.</li>
    </ul></section>
  </div>;
}

function PartiesStep() {
  const { exporter, recipient } = fedexMicroExportDemo;
  return <div className="fedex-two-column">
    <PartyCard title="Gönderici / İhracatçı" tone="exporter" data={exporter} />
    <PartyCard title="Alıcı / İthalatçı" tone="recipient" data={recipient} />
  </div>;
}

function PartyCard({ title, tone, data }) {
  const address = data.addressLine1 ? `${data.addressLine1}, ${data.city}, ${data.state}, ${data.postalCode}, ${data.country}` : data.country;
  return <section className={`erp-panel fedex-party-card ${tone}`}><PanelTitle icon={Globe2} title={title} detail={tone === 'exporter' ? 'Türkiye çıkışı' : 'İrlanda teslimatı'} /><dl>
    <div><dt>Firma</dt><dd>{data.company}</dd></div><div><dt>Yetkili</dt><dd>{data.contact}</dd></div><div><dt>Adres</dt><dd>{address}</dd></div>
    <div><dt>Telefon</dt><dd>{data.phone}</dd></div><div><dt>E-posta</dt><dd>{data.email}</dd></div>
    {data.taxNumber && <div><dt>Vergi / VAT</dt><dd>{data.taxNumber} <em>demo — doğrulanmadı</em></dd></div>}
  </dl></section>;
}

function ProductsStep() {
  return <section className="erp-panel fedex-product-panel"><PanelTitle icon={Boxes} title="Ürün ve GTİP Çalışma Listesi" detail="20 kart · kodlar taslak" /><div className="fedex-material-rule"><strong>Malzeme kuralı:</strong> Aksi belirtilmedikçe pamuk; velsoft, polar, polyester veya sentetik ibaresi bulunan ürünlerde sentetik içerik seçilir.</div><div className="fedex-inline-warning"><AlertTriangle size={15} /> Bu tablo gümrük beyanına otomatik gönderilemez. Düşük ve orta güvenli satırlar doğrulanmalıdır.</div><div className="table-shell"><table className="erp-table"><thead><tr><th>#</th><th>Stok Kodu</th><th>Ürün</th><th>Adet</th><th>Tutar</th><th>GTİP Taslağı</th><th>Malzeme</th><th>Kural / Dayanak</th><th>Güven</th></tr></thead><tbody>{fedexMicroExportItems.map((item) => <tr key={item.id}><td>{item.id}</td><td className="code-cell">{item.stockCode}</td><td>{item.productName}</td><td>{item.quantity}</td><td className="money-cell">{formatMoney(item.lineTotal)}</td><td className="code-cell">{item.gtip}</td><td>{item.material}</td><td>{item.materialRule}</td><td><span className={`fedex-confidence ${item.confidence.toLocaleLowerCase('tr-TR')}`}>{item.confidence}</span></td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Toplam</th><th>679</th><th>{formatMoney(3773.30)}</th><th colSpan={4}>20 ürün kartı</th></tr></tfoot></table></div></section>;
}

function PackagesStep({ packagePlan, onChange, grossWeight, volumetricWeight, chargeableWeight }) {
  const fields = [
    ['packageCount', 'Koli sayısı', 'number'], ['packageLengthCm', 'Boy (cm)', 'number'], ['packageWidthCm', 'En (cm)', 'number'],
    ['packageHeightCm', 'Yükseklik (cm)', 'number'], ['packageGrossKg', 'Koli başı brüt kg', 'number'],
  ];
  return <div className="fedex-package-layout"><section className="erp-panel"><PanelTitle icon={Boxes} title="Demo Koli Planı" detail="Tartım ve ölçümle değiştirilecek" /><div className="fedex-form-grid">{fields.map(([key, label, type]) => <label key={key}><span>{label}</span><input min="0" step={key === 'packageGrossKg' ? '0.1' : '1'} type={type} value={packagePlan[key]} onChange={(event) => onChange(key, event.target.value)} /></label>)}<label><span>Incoterm</span><select value={packagePlan.incoterm} onChange={(event) => onChange('incoterm', event.target.value)}><option value="DAP">DAP — vergiler alıcı</option><option value="DDP">DDP — vergiler gönderici</option><option value="EXW">EXW — alıcı teslim alır</option></select></label></div><div className="fedex-inline-warning"><AlertTriangle size={15} /> Bütün kolilerin aynı ölçü/ağırlıkta olduğu varsayılmıştır. Gerçekte her koli ayrı girilmelidir.</div></section>
    <section className="erp-panel"><PanelTitle icon={PackageCheck} title="Ağırlık Hesabı" detail="Demo formülü" /><div className="fedex-weight-cards"><div><span>Toplam brüt</span><strong>{formatNumber(grossWeight)} kg</strong></div><div><span>Hacimsel</span><strong>{formatNumber(volumetricWeight)} kg</strong></div><div className="accent"><span>Faturalama ağırlığı</span><strong>{formatNumber(chargeableWeight)} kg</strong></div></div><p className="fedex-formula">Demo: koli adedi × boy × en × yükseklik / 5000. Gerçek FedEx hesabındaki bölen ve hizmet koşulu esas alınacaktır.</p></section></div>;
}

function DocumentsStep({ onPrint }) {
  /** @type {Array<[string, string, string, boolean]>} */
  const documents = [
    ['E-arşiv / e-fatura', 'Eksik', 'Resmî mali sistemden alınmalı', false],
    ['Commercial Invoice', 'Demo taslak', 'İngilizce ürün açıklamaları ve GTİP doğrulanacak', true],
    ['Packing List', 'Demo taslak', 'Gerçek koli dağılımı ve net/brüt kg girilecek', true],
    ['ETGB veri seti', 'Ön kontrol', 'FedEx’e gönderilmedi', true],
    ['Menşe bilgisi', 'Taslak', 'Türkiye — tedarikçi/etiket kanıtı gerekir', true],
    ['FedEx taşıma etiketi', 'Bekliyor', 'Canlı gönderi numarası olmadan üretilemez', false],
  ];
  return <section className="erp-panel"><PanelTitle icon={FileCheck2} title="Belge Paketi" detail="Resmî belge üretimi değildir" /><div className="fedex-document-list">{documents.map(([name, status, detail, demoReady]) => <article key={name}><span className={demoReady ? 'ready' : 'blocked'}>{demoReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{name}</strong><small>{detail}</small></div><em>{status}</em></article>)}</div><div className="fedex-document-actions"><button type="button" onClick={onPrint}><Printer size={15} /> Demo Dosyayı Yazdır / PDF</button><span>Yazdırma çıktısında her sayfada “DEMO — GÜMRÜĞE SUNULAMAZ” ibaresi bulunur.</span></div></section>;
}

function FedexStep({
  packagePlan, chargeableWeight, integration, busy, error, shippingQuote, rates, selectedRateId,
  customerQuote, customerPrice, finalizeConfirmed, onRefresh, onCreateDraft, onLoadRates, onSelectRate,
  onCustomerPrice, onCreateCustomerQuote, onFinalizeConfirmed, onFinalize, onDownloadPdf,
}) {
  const gates = integration?.gates || {};
  const selectedRate = rates.find((rate) => rate.id === selectedRateId);
  const roadRates = rates.filter((rate) => getRateTransport(rate).className === 'road');
  const cheapestRoadRate = roadRates.reduce((cheapest, rate) => (
    !cheapest || Number(rate.totalNetCharge) < Number(cheapest.totalNetCharge) ? rate : cheapest
  ), null);
  return <div className="fedex-live-layout">
    <section className="erp-panel"><PanelTitle icon={Plane} title="Nakliyat → FedEx Bağlantısı" detail="FedEx anahtarları ERP tarayıcısına verilmez" />
      <div className="fedex-connection-card">
        <div className={integration?.connected ? 'ok' : 'blocked'}><span className="status-dot online" /><strong>{integration?.connected ? 'Nakliyat servisi hazır' : 'Servis bağlantısı yok'}</strong></div>
        <dl><div><dt>Veritabanı</dt><dd>{integration?.service?.database || '-'}</dd></div><div><dt>FedEx modu</dt><dd>{integration?.fedex?.mode || '-'}</dd></div><div><dt>Yapılandırma</dt><dd>{integration?.fedex?.configuration || '-'}</dd></div><div><dt>Bağlantı testi</dt><dd>{integration?.fedex?.connection || '-'}</dd></div><div><dt>Servis hesabı</dt><dd>{integration?.authenticated ? 'Tanımlı' : 'Eksik'}</dd></div></dl>
        <button disabled={busy === 'status'} onClick={onRefresh} type="button"><RefreshCw size={14} /> Bağlantıyı yenile</button>
      </div>
      <dl className="fedex-shipment-dl"><div><dt>ERP referansı</dt><dd>{fedexMicroExportDemo.reference}</dd></div><div><dt>Rota</dt><dd>Türkiye → Ireland</dd></div><div><dt>Incoterm</dt><dd>{packagePlan.incoterm}</dd></div><div><dt>Koli / ağırlık</dt><dd>{packagePlan.packageCount} koli · {formatNumber(chargeableWeight)} kg <em>ölçüm doğrulanmalı</em></dd></div></dl>
    </section>
    <section className="erp-panel fedex-live-actions"><PanelTitle icon={Truck} title="Canlı Teklif Akışı" detail="Her aşama ayrı yetki kapısındadır" />
      {error && <div className="fedex-api-error"><AlertTriangle size={15} />{error}</div>}
      <div className="fedex-gate-list">
        <LiveGate number="1" title="Nakliyat taslağı" enabled={gates.draftCreate} complete={Boolean(shippingQuote)} detail={shippingQuote?.quoteNumber || 'ERP fişini Nakliyat taslağına aktarır.'}>
          <button disabled={!integration?.connected || !integration?.authenticated || !gates.draftCreate || Boolean(busy)} onClick={onCreateDraft} type="button">{busy === 'draft' ? 'Oluşturuluyor…' : 'Taslak oluştur'}</button>
        </LiveGate>
        <LiveGate number="2" title="FedEx hesap fiyatları" enabled={gates.productionRates} complete={rates.length > 0} detail="Sadece PRODUCTION + ACCOUNT + güncel + EUR fiyatlar kabul edilir.">
          <button disabled={!shippingQuote || !gates.productionRates || Boolean(busy)} onClick={onLoadRates} type="button">{busy === 'rates' ? 'Sorgulanıyor…' : 'Canlı fiyatları getir'}</button>
        </LiveGate>
        {rates.length > 0 && <div className={`fedex-road-summary ${cheapestRoadRate ? 'available' : 'unavailable'}`}>
          <Truck size={16} />
          <span><strong>{cheapestRoadRate ? 'Ekonomik karayolu seçeneği bulundu' : 'Ekonomik karayolu bu sorguda dönmedi'}</strong><small>{cheapestRoadRate ? `${cheapestRoadRate.serviceName} · ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cheapestRoadRate.currency }).format(cheapestRoadRate.totalNetCharge)}` : 'Rota, ölçü, ağırlık ve hesap yetkisine göre FedEx tarafından sunulur.'}</small></span>
        </div>}
        {rates.length > 0 && <div className="fedex-rate-list">{rates.map((rate) => {
          const transport = getRateTransport(rate);
          return <label className={`${selectedRateId === rate.id ? 'selected ' : ''}${transport.className}`} key={rate.id}><input checked={selectedRateId === rate.id} name="fedexRate" onChange={() => onSelectRate(rate.id)} type="radio" /><span><span className={`fedex-transport-badge ${transport.className}`}>{transport.label}</span><strong>{rate.serviceName}</strong><small>{transport.detail} · {rate.serviceCode || 'servis kodu yok'} · {rate.deliveryDate || 'tarih yok'}</small></span><b>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: rate.currency }).format(rate.totalNetCharge)}</b></label>;
        })}</div>}
        <LiveGate number="3" title="Müşteri nakliye teklifi" enabled={gates.customerQuoteCreate} complete={Boolean(customerQuote)} detail={customerQuote?.quoteNumber || 'Seçilen FedEx fiyatından müşteri PDF teklifi üretir.'}>
          <input aria-label="Müşteri nakliye fiyatı" min="0" onChange={(event) => onCustomerPrice(event.target.value)} placeholder={selectedRate ? String(selectedRate.totalNetCharge) : 'Müşteri fiyatı'} step="0.01" type="number" value={customerPrice} />
          <button disabled={!selectedRateId || !gates.customerQuoteCreate || Boolean(busy)} onClick={onCreateCustomerQuote} type="button">{busy === 'customer' ? 'Üretiliyor…' : 'Teklif üret'}</button>
        </LiveGate>
        <LiveGate number="4" title="Kesinleştirme" enabled={gates.finalize} complete={customerQuote?.effectiveStatus === 'FINAL'} detail="Bu işlem gönderi etiketi oluşturmaz; müşteri teklifini kesinleştirir.">
          <label className="fedex-final-confirm"><input checked={finalizeConfirmed} onChange={(event) => onFinalizeConfirmed(event.target.checked)} type="checkbox" /> Fiyatı ve alıcıyı kontrol ettim</label>
          <button disabled={!customerQuote || !finalizeConfirmed || !gates.finalize || Boolean(busy)} onClick={onFinalize} type="button">{busy === 'finalize' ? 'Kesinleştiriliyor…' : 'Teklifi kesinleştir'}</button>
          <button disabled={!customerQuote || Boolean(busy)} onClick={onDownloadPdf} type="button">PDF indir</button>
        </LiveGate>
      </div>
    </section>
  </div>;
}

function LiveGate({ number, title, enabled, complete, detail, children }) {
  return <article className={`fedex-live-gate ${complete ? 'complete' : enabled ? 'enabled' : 'locked'}`}><span>{complete ? <CheckCircle2 size={16} /> : number}</span><div><strong>{title}</strong><small>{detail}</small></div><em>{complete ? 'Tamam' : enabled ? 'Açık' : 'Kilitli'}</em><div className="fedex-live-gate-actions">{children}</div></article>;
}

function ApprovalStep({ checks, completedAt, isReady, onComplete, onReset, onToggle }) {
  return <div className="fedex-approval-layout"><section className="erp-panel"><PanelTitle icon={ShieldCheck} title="Son Onay Kapısı" detail="Demo kontrol listesi" /><div className="fedex-approval-checks">{requiredChecks.map((item) => <label className={checks[item.id] ? 'checked' : ''} key={item.id}><input checked={Boolean(checks[item.id])} onChange={() => onToggle(item.id)} type="checkbox" /><span>{checks[item.id] ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span><strong>{item.label}</strong></label>)}</div></section>
    <aside className={`erp-panel fedex-final-gate ${isReady ? 'ready' : 'blocked'}`}><LockKeyhole size={32} /><strong>{completedAt ? 'Demo senaryosu tamamlandı' : isReady ? 'Demo onaya hazır' : 'Gönderim kapısı kilitli'}</strong><p>{completedAt ? `Tamamlama zamanı: ${new Date(completedAt).toLocaleString('tr-TR')}` : isReady ? 'Bütün demo kontrolleri işaretlendi. Bu işlem yine de gerçek gönderi oluşturmaz.' : 'Eksik kontroller tamamlanmadan gerçek gönderi aşamasına geçilmemelidir.'}</p><button className="primary" disabled={!isReady} onClick={onComplete} type="button">Demo Senaryosunu Tamamla</button><button disabled type="button">Gerçek FedEx Gönderisini Oluştur</button><button onClick={onReset} type="button">Demo Verilerini Sıfırla</button><small>Gerçek gönderi butonu bilinçli olarak kapalıdır.</small></aside></div>;
}

function StatusRow({ label, value, ok, warning = false }) {
  return <div className={ok ? 'ok' : warning ? 'warning' : 'blocked'}><span>{ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{label}</span><strong>{value}</strong></div>;
}
