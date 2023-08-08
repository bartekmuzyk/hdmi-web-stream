const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("desktopAppApi", {
    openDevTools: () => ipcRenderer.send("opendevtools")
});