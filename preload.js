const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("desktopAppApi", {
    openDevTools: () => ipcRenderer.send("opendevtools"),
    quit: () => ipcRenderer.send("quit"),
    openUrlInBrowser: url => ipcRenderer.send("openurl", url)
});