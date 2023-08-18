const {app, BrowserWindow, ipcMain} = require("electron");
const path = require("path");
const {offerCallback, iceCandidateCallback} = require("./server.js");

function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 142,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: true
        }
    });
    win.setMenu(null);
    win.removeMenu();
    win.menuBarVisible = false;

    ipcMain.on("opendevtools", () => {
        win.webContents.openDevTools({
            mode: "detach"
        });
    });

    ipcMain.on("rtc-answer", (_event, answer) => {
        offerCallback.passAnswer(answer);
    });

    offerCallback.offerCb = offer => {
        win.webContents.send("rtc-offer", offer);
    };

    ipcMain.on("ice-candidates", (_event, candidates) => {
        iceCandidateCallback.passCandidates(candidates);
    });

    iceCandidateCallback.sendCandidatesCallback = candidates => {
        win.webContents.send("ice-candidates", candidates);
    };

    win.loadFile("index.html");
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
       if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});