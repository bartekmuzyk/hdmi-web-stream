const {app, BrowserWindow, ipcMain} = require("electron");
const path = require("path");
const {interaction} = require("./server.js");

function createWindow() {
    const win = new BrowserWindow({
        width: 650,
        height: 300,
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


    const sessionData = interaction.createSession();
    win.loadURL(`http://localhost:7284/panel?${new URLSearchParams(sessionData)}`);
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