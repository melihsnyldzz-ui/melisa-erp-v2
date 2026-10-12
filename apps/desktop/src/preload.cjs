const { contextBridge, ipcRenderer } = require('electron');

const apiBaseUrlArgument = process.argv.find((item) => item.startsWith('--melisa-api-base-url='));
const apiBaseUrl = apiBaseUrlArgument
  ? decodeURIComponent(apiBaseUrlArgument.slice('--melisa-api-base-url='.length))
  : 'http://localhost:4100';

contextBridge.exposeInMainWorld('melisaDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  apiBaseUrl,
  ...(!process.argv.includes('--melisa-isolated-worktest=true') ? {saveApiBaseUrl: (value) => ipcRenderer.invoke('desktop:save-api-base-url', value)} : {}),
});

if(process.argv.includes('--melisa-isolated-worktest=true')) {
  contextBridge.exposeInMainWorld('MelisaWindowsProtectedSession',Object.freeze({
    get:()=>ipcRenderer.invoke('worktest:protected-session','get'),
    put:session=>ipcRenderer.invoke('worktest:protected-session','put',session),
    clear:()=>ipcRenderer.invoke('worktest:protected-session','clear'),
  }));
}
