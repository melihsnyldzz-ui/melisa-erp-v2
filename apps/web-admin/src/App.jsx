import React from 'react';

const modules = [
  'Ana Sayfa',
  'Stok',
  'Satış',
  'Alış',
  'Cari',
  'Katalog',
  'Raporlar',
  'Terminal',
  'Ayarlar',
  'Yetki / Audit',
];

const sidebarGroups = [
  {
    title: 'Stok İşlemleri',
    items: ['Stok Listesi', 'Ürün Kartı', 'Barkodlar', 'Stok Hareketleri', 'Pasif Ürünler'],
  },
  {
    title: 'Satış / Alış',
    items: ['Yeni Satış Fişi', 'Taslak Satışlar', 'Alış Fişleri', 'Terminalden Gelenler'],
  },
  {
    title: 'Hızlı Filtreler',
    items: ['Eksi Stok', 'Bugünkü Fişler', 'Hatalı Sync', 'Borç Riski'],
  },
];

const tabs = [
  { label: 'Dashboard', active: true },
  { label: 'Stok Listesi', active: false },
  { label: 'Satış Fişi: Taslak', active: false, dirty: true },
  { label: 'Cari Ekstre', active: false },
];

const kpis = [
  { label: 'Günlük Satış', value: '₺128.450', tone: 'good' },
  { label: 'Açık Fiş', value: '18', tone: 'warn' },
  { label: 'Eksi Stok', value: '7', tone: 'danger' },
  { label: 'Sync Hatası', value: '3', tone: 'danger' },
  { label: 'Stok Değeri', value: '₺4.82M', tone: 'info' },
  { label: 'Cari Risk', value: '12', tone: 'warn' },
];

const stockRows = [
  ['STK-000128', '8690001000128', 'Bebek Tulum 0-3 Ay Ekru', 'Ana Depo', '124', '₺245,00', 'Aktif'],
  ['STK-000244', '8690001000244', 'Pamuk Battaniye Mavi', 'Ana Depo', '-3', '₺390,00', 'Eksi'],
  ['STK-000311', '8690001000311', 'Zıbın Seti 5 Parça', 'Ana Depo', '58', '₺315,00', 'Aktif'],
  ['STK-000487', '8690001000487', 'Penye Şapka Seti', 'Ana Depo', '11', '₺74,00', 'Kritik'],
  ['STK-000522', '8690001000522', 'Kadife Uyku Tulumu', 'Ana Depo', '34', '₺520,00', 'Aktif'],
  ['STK-000618', '8690001000618', 'Yenidoğan Eldiven', 'Ana Depo', '210', '₺42,00', 'Aktif'],
];

const activityRows = [
  ['SF-2026-0042', 'Melisa Tekstil', 'Satış', '₺12.450', 'Kesinleşti'],
  ['TF-2026-0188', 'Terminal-03', 'Sync', '7 satır', 'Uyarı'],
  ['AF-2026-0027', 'Bursa Bebek', 'Alış', '₺48.900', 'Taslak'],
  ['CR-2026-0081', 'ABC Kids', 'Cari', '₺92.100', 'Risk'],
];

function TopMenu() {
  return (
    <header className="top-menu">
      <div className="brand-block">
        <strong>Melisa ERP v2</strong>
        <span>Desktop ERP Shell</span>
      </div>
      <nav className="module-menu" aria-label="Ana modüller">
        {modules.map((module) => (
          <button className={module === 'Ana Sayfa' ? 'module active' : 'module'} key={module}>
            {module}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <div className="search-box">Ctrl+K • ürün, cari, fiş ara</div>
        <button>Yeni Fiş</button>
        <button>Yazdır</button>
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <strong>İşlem Paneli</strong>
        <span>Stok / Satış bağlamı</span>
      </div>
      {sidebarGroups.map((group) => (
        <section className="side-group" key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map((item) => (
            <button key={item}>{item}</button>
          ))}
        </section>
      ))}
      <section className="side-group compact">
        <h3>Durum</h3>
        <p>API: mock</p>
        <p>SQL: bağlı değil</p>
        <p>Auth: dev mock</p>
      </section>
    </aside>
  );
}

function TabBar() {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button className={tab.active ? 'tab active' : 'tab'} key={tab.label}>
          <span>{tab.label}</span>
          {tab.dirty ? <b>*</b> : null}
          <em>×</em>
        </button>
      ))}
      <button className="tab more">+ Ekran</button>
    </div>
  );
}

function DataTable({ rows, columns }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className={cell === 'Eksi' || cell === 'Uyarı' || cell === 'Risk' ? 'hot' : ''}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard() {
  return (
    <main className="work-area">
      <section className="dashboard-grid">
        {kpis.map((kpi) => (
          <article className={`kpi ${kpi.tone}`} key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid">
        <article className="erp-panel large">
          <div className="panel-title">
            <strong>Stok Listesi Önizleme</strong>
            <span>Yoğun tablo / mock data</span>
          </div>
          <div className="filter-row">
            <span>Kod</span>
            <span>Barkod</span>
            <span>Ürün adı</span>
            <span>Durum</span>
          </div>
          <DataTable columns={['Kod', 'Barkod', 'Ürün Adı', 'Depo', 'Miktar', 'Fiyat', 'Durum']} rows={stockRows} />
        </article>

        <article className="erp-panel">
          <div className="panel-title">
            <strong>Kritik Uyarılar</strong>
            <span>Dashboard placeholder</span>
          </div>
          <ul className="warning-list">
            <li><b>7</b> ürün eksi stokta</li>
            <li><b>3</b> terminal sync hatası</li>
            <li><b>12</b> cari risk limit üstünde</li>
            <li><b>18</b> taslak satış fişi açık</li>
          </ul>
        </article>

        <article className="erp-panel">
          <div className="panel-title">
            <strong>Son İşlemler</strong>
            <span>Fiş / cari / sync</span>
          </div>
          <DataTable columns={['Belge', 'Kaynak', 'Tip', 'Tutar', 'Durum']} rows={activityRows} />
        </article>

        <article className="erp-panel form-preview">
          <div className="panel-title">
            <strong>Satış Fişi Taslak</strong>
            <span>Tek aktif işlem yüzeyi</span>
          </div>
          <div className="form-row">
            <label>Cari</label>
            <input value="MELISA TOPTAN ALICI" readOnly />
          </div>
          <div className="form-row">
            <label>Belge No</label>
            <input value="SF-TASLAK-0042" readOnly />
          </div>
          <div className="totals">
            <span>Ara Toplam</span><b>₺11.850</b>
            <span>Genel İskonto</span><b>%5</b>
            <span>Genel Toplam</span><strong>₺11.257,50</strong>
          </div>
        </article>
      </section>
    </main>
  );
}

function StatusBar() {
  return (
    <footer className="status-bar">
      <span>Firma: Melisa Bebe</span>
      <span>Dönem: 2026</span>
      <span>Kullanıcı: Dev Mock</span>
      <span>Bağlantı: API yok</span>
      <span>Seçili kayıt: Dashboard</span>
      <strong>Hazır</strong>
    </footer>
  );
}

export function App() {
  return (
    <div className="erp-shell">
      <TopMenu />
      <div className="main-layout">
        <Sidebar />
        <section className="content-shell">
          <TabBar />
          <Dashboard />
        </section>
      </div>
      <StatusBar />
    </div>
  );
}
