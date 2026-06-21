const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  predict: (args) => ipcRenderer.invoke('predict', args)
});
