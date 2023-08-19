const {app, BrowserWindow, ipcMain} = require("electron");
const path = require("path");
const {offerCallback, iceCandidateCallback} = require("./server.js");

function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 200,
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
        console.log("passing answer to browser: %o", answer);
        offerCallback.passAnswer(answer);
    });

    offerCallback.offerCb = offer => {
        console.log("sending offer to frontend: %o", offer);
        win.webContents.send("rtc-offer", offer);
    };

    ipcMain.on("ice-candidates", (_event, candidates) => {
        console.log("passing candidates to browser");
        iceCandidateCallback.passCandidates(candidates);
    });

    iceCandidateCallback.sendCandidatesCallback = candidates => {
        console.log("sending candidates to frontend")
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