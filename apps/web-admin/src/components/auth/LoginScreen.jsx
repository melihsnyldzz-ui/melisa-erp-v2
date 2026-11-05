import React, { useState } from 'react';
import {apiConfig} from '../../config/apiConfig.js';
import {EMPTY_LOCAL_TITLE} from '../../config/emptyLocalInstallation.mjs';

export function LoginScreen({
  errorMessage,
  isLoading,
  localPasswordlessEnabled = false,
  onLocalPasswordlessLogin,
  onLogin,
}) {
  const [username, setUsername] = useState(apiConfig.emptyLocalInstallation ? 'kurulum' : 'admin');
  const [password, setPassword] = useState('');

  function submitLogin(event) {
    event.preventDefault();
    onLogin(username, password);
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submitLogin}>
        <div className="login-title">
          <strong>{apiConfig.emptyLocalInstallation ? EMPTY_LOCAL_TITLE : 'Melisa ERP v2'}</strong>
          <span>{apiConfig.emptyLocalInstallation ? 'Salt okunur aşama · Stok, müşteri ve tedarikçi listelerini kontrol edin.' : 'Güvenli yönetim girişi'}</span>
        </div>
        <label>
          Kullanıcı adı
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Şifre
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {errorMessage && <div className="login-error">{errorMessage}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Giriş kontrol ediliyor' : 'Giriş yap'}
        </button>
        <small className="login-session-note">{apiConfig.emptyLocalInstallation ? 'Bu kurulumun oturumu ayrı saklanır. Oturum süresi dolduğunda yeniden giriş yapın.' : 'Bu cihazda girişiniz hatırlanır. Çıkış yapmadığınız sürece yeniden şifre istenmez.'}</small>
        {localPasswordlessEnabled && (
          <button type="button" disabled={isLoading} onClick={onLocalPasswordlessLogin}>
            Yerel yönetici olarak şifresiz gir
          </button>
        )}
      </form>
    </main>
  );
}
