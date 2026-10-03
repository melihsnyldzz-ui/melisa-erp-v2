import React, { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import {
  getStoredWhatsappCrmUnlockToken,
  unlockWhatsappCrmAccess,
} from '../../services/whatsappCrmApi.js';
import './whatsapp-crm-v2.css';

export function WhatsappCrmAccessGate({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(() => Boolean(getStoredWhatsappCrmUnlockToken()));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lock = () => {
      setIsUnlocked(false);
      setPassword('');
      setError('CRM oturumunun suresi doldu. Sifreyi tekrar girin.');
    };
    window.addEventListener('melisa-crm-locked', lock);
    return () => window.removeEventListener('melisa-crm-locked', lock);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');
    try {
      await unlockWhatsappCrmAccess(password);
      setPassword('');
      setIsUnlocked(true);
    } catch (unlockError) {
      setError(unlockError.message || 'CRM sifresi dogrulanamadi.');
    } finally {
      setLoading(false);
    }
  }

  if (isUnlocked) return children;

  return (
    <main className="wcrm-access-shell">
      <form className="wcrm-access-card" onSubmit={handleSubmit}>
        <span className="wcrm-access-icon"><LockKeyhole size={28} /></span>
        <div>
          <h2>WhatsApp CRM Kilitli</h2>
          <p>ERP oturumuna ek olarak CRM sifresini girin.</p>
        </div>
        <label htmlFor="whatsapp-crm-password">CRM sifresi</label>
        <input
          autoComplete="current-password"
          autoFocus
          id="whatsapp-crm-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="CRM sifresini girin"
          type="password"
          value={password}
        />
        {error ? <div className="wcrm-access-error">{error}</div> : null}
        <button disabled={!password || loading} type="submit">
          {loading ? 'Kontrol ediliyor...' : 'CRM’ye Gir'}
        </button>
      </form>
    </main>
  );
}
