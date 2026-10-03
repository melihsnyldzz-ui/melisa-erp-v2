/// <reference types="vite/client" />

interface Window {
  melisaDesktop?: {
    platform: string;
    version: string;
    apiBaseUrl: string;
    saveApiBaseUrl(value: string): Promise<{ok: true; apiBaseUrl: string} | {ok: false; error: string}>;
  };
}
