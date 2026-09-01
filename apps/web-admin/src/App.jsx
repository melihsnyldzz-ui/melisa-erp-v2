import React, { useEffect, useMemo, useState } from 'react';
import { LoginScreen } from './components/auth/LoginScreen.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import {
  fetchMe,
  localPasswordlessAdminLogin,
  login as loginRequest,
  logout as logoutRequest,
} from './services/authApi.js';
import { apiConfig } from './config/apiConfig.js';
import { clearWhatsappCrmUnlockToken } from './services/whatsappCrmApi.js';

export function App() {
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const permissions = useMemo(() => user?.permissions || [], [user]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const response = await fetchMe();
        if (isMounted) {
          setUser(response.data);
        }
      } catch (error) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsBooting(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function expireSession() {
      clearWhatsappCrmUnlockToken();
      setUser(null);
      setAuthError('Oturum süresi doldu, tekrar giriş yapın.');
    }

    window.addEventListener('melisa-auth-expired', expireSession);
    return () => window.removeEventListener('melisa-auth-expired', expireSession);
  }, []);

  async function handleLogin(username, password) {
    clearWhatsappCrmUnlockToken();
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const response = await loginRequest(username, password);
      setUser(response.data.user);
    } catch (error) {
      setAuthError(`${error.message || 'Giriş başarısız.'} (${error.code || 'AUTH_ERROR'})`);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLocalPasswordlessLogin() {
    clearWhatsappCrmUnlockToken();
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const response = await localPasswordlessAdminLogin();
      setUser(response.data.user);
    } catch (error) {
      setAuthError(`${error.message || 'Şifresiz yerel giriş başarısız.'} (${error.code || 'AUTH_ERROR'})`);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutRequest();
    } finally {
      clearWhatsappCrmUnlockToken();
      setUser(null);
    }
  }

  if (isBooting) {
    return <div className="login-shell"><div className="login-panel">Oturum kontrol ediliyor...</div></div>;
  }

  if (!user) {
    return (
      <LoginScreen
        errorMessage={authError}
        isLoading={isLoggingIn}
        localPasswordlessEnabled={apiConfig.localPasswordlessLogin}
        onLocalPasswordlessLogin={handleLocalPasswordlessLogin}
        onLogin={handleLogin}
      />
    );
  }

  return <AppShell user={user} permissions={permissions} isDemoMode={apiConfig.demoMode} onLogout={handleLogout} />;
}
