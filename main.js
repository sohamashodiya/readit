// Modules to control application life and create native browser window
const electron = require('electron');
const path = require('path');

const {
  app,
  BrowserWindow,
  ipcMain
} = electron;

const {
  isFirstAppLaunch
} = require('electron-util');

try {
  require('electron-reloader')(module);
} catch (_) {}

const {
  download
} = require("electron-dl");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    titleBarStyle: 'hidden-inset',
    backgroundColor: '#FFF',
    webPreferences: {
      nodeIntegration: true
    },
    icon: path.join(__dirname, 'assets/icon.ico')
  });

  mainWindow.setMenu(null);

  let bounds = electron.screen.getPrimaryDisplay().bounds;
  let x = Math.ceil(bounds.x + ((bounds.width - 810) / 2));
  let y = Math.ceil(bounds.y + ((bounds.height - 710) / 2));

  splash = new BrowserWindow({
    width: 810,
    height: 710,
    transparent: true,
    x: x,
    y: y,
    frame: false,
    center: true,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'assets/icon.ico')
  });

  splash.setIgnoreMouseEvents(true);

  splash.loadFile('splash.html');
  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    setTimeout(function () {
      splash.destroy();
      mainWindow.show();
      mainWindow.maximize();
      //mainWindow.webContents.openDevTools();
      if (isFirstAppLaunch() == true) {
        console.log("First Launch");
        mainWindow.webContents.send('firstAppLaunch', 'true');
      }
    }, 1500);

    ipcMain.on("downloadJSON", (event, info) => {
      download(mainWindow, info.url)
        .then(dl => mainWindow.webContents.send("downloadJSONComplete", dl.getSavePath()));
    });
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit();
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.