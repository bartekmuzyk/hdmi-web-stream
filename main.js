const {app, BrowserWindow, ipcMain, shell} = require("electron");
const path = require("path");
const {interaction} = require("./server.js");

function createWindow() {
    const win = new BrowserWindow({
        width: 650,
        height: 330,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
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

    ipcMain.on("quit", () => {
        win.close();
    });

    ipcMain.on("openurl", (_event, url) => {
        shell.openExternal(url);
    });

    win.loadURL("http://localhost:7284/panel");
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