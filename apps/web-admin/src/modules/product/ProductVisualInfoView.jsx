import React from 'react';
import { visualFieldLabel, visualValueLabel, visualStatusLabel } from './productVisualLabels.js';

const messages = {
  LOADING: 'Görsel bilgileri yükleniyor…', UNAVAILABLE: 'Görsel bilgileri şu anda alınamıyor.',
  NO_IMAGE: 'Bu ürüne kayıtlı bir görsel yok.', PENDING: 'Bu fotoğrafın analizi henüz hazır değil.',
  INACTIVE: 'Bu ürünün görsel bilgileri kullanıma açık değil.',
};

export function ProductVisualInfoView({ profile, onRefresh }) {
  return (
    <section className="stock-visual-info" aria-label="Görsel bilgiler" aria-live="polite">
      <h3>Görsel bilgiler</h3>
      {onRefresh && <button type="button" disabled={profile.state === 'LOADING'} onClick={onRefresh}>Yenile</button>}
      {messages[profile.state] ? <p>{messages[profile.state]}</p> : <>
        {profile.state === 'STALE' && <p>Fotoğraf değişmiş. Önceki bilgiler yeniden inceleme bekliyor.</p>}
        <dl className="stock-360-facts">
          {(profile.fields || []).map((field) => <div key={field.key}>
            <dt>{visualFieldLabel(field.key)}</dt>
            <dd>
              <strong>{field.values?.length ? field.values.map(visualValueLabel).join(', ') : 'Bilinmiyor'}</strong>
              <small className={field.usable ? 'visual-field-usable' : 'visual-field-pending'}>{visualStatusLabel(field.status)}</small>
            </dd>
          </div>)}
        </dl>
        <details>
          <summary>Kaynak ve sürüm</summary>
          <p>Kaynak: ürün fotoğrafı ve varsa insan doğrulaması.</p>
          <p>Fotoğraf: {profile.imageHash?.slice(0, 12) || 'Bilinmiyor'} · Profil: {profile.versionId?.slice(0, 12) || 'Bilinmiyor'}</p>
          {profile.modelVersion && <p>Analiz sürümü: {profile.modelVersion}</p>}
          <p>Model puanı, ölçülmüş doğruluk oranı değildir.</p>
        </details>
      </>}
      <p className="stock-visual-note">Fotoğraftaki renkler, satışa açık renk seçeneklerini veya renk bazlı stoğu göstermez.</p>
    </section>
  );
}
