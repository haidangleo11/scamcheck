const { contextBridge, ipcRenderer } = require('electron');

function listen(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('scamcheckDesktop', {
  isDesktop: true,
  getPreferences: () => ipcRenderer.invoke('desktop:get-preferences'),
  setPreferences: preferences => ipcRenderer.invoke('desktop:set-preferences', preferences),
  readClipboard: () => ipcRenderer.invoke('desktop:read-clipboard'),
  captureScreens: () => ipcRenderer.invoke('desktop:capture-screens'),
  getScanLog: () => ipcRenderer.invoke('desktop:get-scan-log'),
  recordScanEvent: entry => ipcRenderer.invoke('desktop:record-scan-event', entry),
  clearScanLog: () => ipcRenderer.invoke('desktop:clear-scan-log'),
  notify: payload => ipcRenderer.send('desktop:notify', payload),
  showWindow: () => ipcRenderer.send('desktop:show-window'),
  onClipboardText: callback => listen('desktop:clipboard-text', callback),
  onScreenImages: callback => listen('desktop:screen-images', callback)
});
