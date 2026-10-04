export default {
  build: { rollupOptions: { input: { main: 'index.html', workflow: 'is-akisi-taslagi.html', example: 'ornek-akis.html', legacy: 'legacy-admin.html', acceptance: 'responsive-acceptance.html' } } },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
};
