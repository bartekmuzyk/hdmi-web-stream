const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("desktopAppApi", {
    openDevTools: () => ipcRenderer.send("opendevtools"),
    onGotRtcOffer: callback => void ipcRenderer.on("rtc-offer", callback),
    onGotIceCandidates: callback => void ipcRenderer.on("ice-candidates", callback)
});