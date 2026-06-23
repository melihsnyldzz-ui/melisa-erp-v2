const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('melisaDesktop', {
  platform: process.platform,
  version: process.versions.electron,
});
