import React from 'react';
import {
  activityColumns,
  activityRows,
  kpis,
  stockColumns,
  stockRows,
} from '../../data/mockDashboardData.js';
import { DataTable } from './DataTable.jsx';

export function Dashboard() {
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
          <DataTable columns={stockColumns} rows={stockRows} />
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
          <DataTable columns={activityColumns} rows={activityRows} />
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
