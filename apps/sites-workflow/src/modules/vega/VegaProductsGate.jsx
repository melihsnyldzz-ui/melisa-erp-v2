import React, { useEffect, useState } from 'react';
import { vegaProductAccess } from '../../services/vegaProductAccess.js';
import { VegaReadWorkspace } from './VegaReadWorkspace.jsx';
import { WorkspaceHeading } from '../demo/WorkspaceChrome.jsx';
import './vega-products.css';

export function VegaProductsGate({ screenId, payload, onOpenScreen }) {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(''); setHealth('Ürün bağlantısı açılıyor…');
    async function restore() {
      try {
        if (vegaProductAccess.hasSession()) {
          const session = await vegaProductAccess.get('/api/auth/me', {}, { signal: controller.signal });
          if (!controller.signal.aborted) setUser(session.data);
        } else {
          setHealth('Bu tarayıcıda kayıtlı ürün bağlantısı bulunamadı.');
        }
      } catch (cause) {
        if (!controller.signal.aborted) { setError(cause.message); setHealth(''); }
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    restore();
    function expired() { setUser(null); setError('Kayıtlı bağlantı sunucu tarafından kabul edilmedi. Bağlantıyı yenileyin.'); }
    window.addEventListener('melisa-vega-products-expired', expired);
    return () => { controller.abort(); window.removeEventListener('melisa-vega-products-expired', expired); };
  }, [revision]);
  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError('');
    try {
      const response = await vegaProductAccess.login(String(values.get('username')).trim(), String(values.get('password')));
      form.reset(); setUser(response.data);
    } catch (cause) { setError(cause.status === 401 ? 'ERP kullanıcı adı veya şifresi doğrulanamadı.' : cause.message); }
    finally { setBusy(false); }
  }
  if (user) return <div className="vega-products"><VegaReadWorkspace screenId={screenId} payload={payload} permissions={user.permissions || []} onOpenScreen={onOpenScreen} embedded /></div>;
  if (busy) return <main className="work-area operations-workspace vega-products"><WorkspaceHeading screen="stock-list" title="Ürün & Stok" /><section className="erp-panel" role="status">Ürün bağlantısı açılıyor…</section></main>;
  return <main className="work-area operations-workspace vega-products"><WorkspaceHeading screen="stock-list" title="Ürün & Stok" description="Vega ürünleri · Salt okunur" /><section className="erp-panel vega-product-login">
    <h2>Ürün bağlantısını yenile</h2><p>Geçerli bağlantı bu tarayıcıda hatırlanır ve sayfayı yeniden açtığınızda otomatik kullanılır.</p>
    {health && <p role="status">{health}</p>}{error && <p role="alert" className="vega-product-error">{error}</p>}
    <form onSubmit={login}><label>ERP kullanıcı adı<input name="username" autoComplete="username" required disabled={busy} /></label><label>ERP şifresi<input type="password" name="password" autoComplete="current-password" required disabled={busy} /></label><div><button type="submit" className="primary-action" disabled={busy}>{busy ? 'Bağlantı bekleniyor…' : 'ERP’ye bağlan'}</button><button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Bağlantıyı tekrar dene</button></div></form>
  </section></main>;
}
