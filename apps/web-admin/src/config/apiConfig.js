export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4100').replace(/\/$/, '');

export const apiConfig = {
  baseUrl: API_BASE_URL,
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
};
