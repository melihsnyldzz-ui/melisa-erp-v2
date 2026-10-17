export default {
  build: { rollupOptions: { input: { main: 'index.html', workflow: 'is-akisi-taslagi.html', example: 'ornek-akis.html', terminal: 'terminal.html', legacy: 'legacy-admin.html', acceptance: 'responsive-acceptance.html', trainingGuide: 'kullanim-egitimi.html' } } },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
};
