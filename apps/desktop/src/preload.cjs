const { contextBridge, ipcRenderer } = require('electron');

const apiBaseUrlArgument = process.argv.find((item) => item.startsWith('--melisa-api-base-url='));
const apiBaseUrl = apiBaseUrlArgument
  ? decodeURIComponent(apiBaseUrlArgument.slice('--melisa-api-base-url='.length))
  : 'http://localhost:4100';

contextBridge.exposeInMainWorld('melisaDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  apiBaseUrl,
  saveApiBaseUrl: (value) => ipcRenderer.invoke('desktop:save-api-base-url', value),
});
