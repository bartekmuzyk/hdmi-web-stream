const {app, BrowserWindow, ipcMain} = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 142,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
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