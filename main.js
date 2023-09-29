const {app, BrowserWindow, ipcMain, shell, Tray, Menu, desktopCapturer} = require("electron");
const path = require("path");
require("./server.js");

let allowWindowClose = false;

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 450,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        },
        icon: path.join(__dirname, "icon.png")
    });
    win.setMenu(null);
    win.removeMenu();
    win.menuBarVisible = false;

    win.on("close", event => {
        if (!allowWindowClose) {
            event.preventDefault();
            win.hide();
        }
    });

    ipcMain.on("opendevtools", () => {
        win.webContents.openDevTools({
            mode: "detach"
        });
    });

    ipcMain.on("quit", () => {
        allowWindowClose = true;
        app.quit();
    });

    ipcMain.on("openurl", (_event, url) => {
        shell.openExternal(url);
    });

    ipcMain.handle("desktopsources", async () => {
        const sources = await desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: {width: 0, height: 0}
        });

        const screens = {};
        for (const source of sources) screens[source.id] = source.name;

        return screens;
    });

    win.loadURL("http://localhost:7284/panel");

    return win;
}

app.whenReady().then(() => {
    const win = createWindow();

    const tray = new Tray(path.join(__dirname, "icon.png"));
    tray.setToolTip("Transmiter sygnału HDMI");
    tray.on("click", () => {
        win.show();
    });
    tray.setContextMenu(Menu.buildFromTemplate([
        {
            label: "Pokaż panel",
            click() {
                win.show();
            }
        },
        {
            label: "Zakończ",
            click() {
                allowWindowClose = true;
                app.quit();
            }
        }
    ]));

    app.on("activate", () => {
       if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});
