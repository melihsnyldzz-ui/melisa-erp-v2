import React, { useState } from 'react';

export function LoginScreen({
  connectionLabel,
  errorMessage,
  isLoading,
  localPasswordlessEnabled = false,
  onLocalPasswordlessLogin,
  onLogin,
  onRetrySession,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function submitLogin(event) {
    event.preventDefault();
    onLogin(username, password);
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submitLogin}>
        <div className="login-title">
          <strong>Melisa ERP v2</strong>
          <span>{connectionLabel || 'Güvenli yönetim girişi'}</span>
        </div>
        <label>
          Kullanıcı adı
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required autoCapitalize="none" spellCheck={false} />
        </label>
        <label>
          Şifre
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {errorMessage && <div className="login-error" role="alert">{errorMessage}</div>}
        {onRetrySession && <button type="button" disabled={isLoading} onClick={onRetrySession}>Kayıtlı oturumla tekrar bağlan</button>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Giriş kontrol ediliyor' : 'Giriş yap'}
        </button>
        <small className="login-session-note">Mevcut ERP kullanıcı adınız ve şifrenizle giriş yapın. Oturumunuz geçerli olduğu sürece bu cihazda hatırlanır.</small>
        {localPasswordlessEnabled && (
          <button type="button" disabled={isLoading} onClick={onLocalPasswordlessLogin}>
            Yerel yönetici olarak şifresiz gir
          </button>
        )}
      </form>
    </main>
  );
}
