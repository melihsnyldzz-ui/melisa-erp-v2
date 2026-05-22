import React, { useState } from 'react';

export function LoginScreen({ errorMessage, isLoading, onLogin }) {
  const [username, setUsername] = useState('admin');
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
          <span>Web-admin guvenli giris</span>
        </div>
        <label>
          Kullanici adi
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Sifre
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {errorMessage && <div className="login-error">{errorMessage}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Giris kontrol ediliyor' : 'Giris yap'}
        </button>
      </form>
    </main>
  );
}
