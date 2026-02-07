import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import { openDatabase } from '../data/Model';
import { createQueries } from '../data/Queries';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Main process: from app/main.js (prod) or dist/main (electron-webpack compile), __dirname is that output dir.
const preloadScript = path.join(__dirname, 'preload.js');

let dbQueries: ReturnType<typeof createQueries> | null = null;

function getDbPath(): string {
  const candidates = [
    path.join(process.cwd(), 'songs.sqlite3'),
    path.join(app.getAppPath(), 'songs.sqlite3'),
    path.resolve(__dirname, '..', '..', 'songs.sqlite3'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `songs.sqlite3 not found. Tried: ${candidates.join(', ')}`
  );
}

function getQueries() {
  if (!dbQueries) {
    const dbPath = getDbPath();
    const db = openDatabase(dbPath);
    dbQueries = createQueries(db);
  }
  return dbQueries;
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    webPreferences: {
      preload: preloadScript,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedUrl) => {
    console.error('Failed to load:', validatedUrl, code, description);
  });

  const isElectronWebpackDev = process.env.ELECTRON_WEBPACK_WDS_PORT != null;

  if (isElectronWebpackDev) {
    mainWindow.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).then(() => {
      mainWindow.show();
      mainWindow.focus();
    }).catch((err) => {
      console.error('loadURL failed:', err);
    });
  } else {
    const mainWindowHtml = path.join(__dirname, 'index.html');
    const fileUrl = pathToFileURL(mainWindowHtml).href;
    mainWindow.loadURL(fileUrl).then(() => {
      mainWindow.show();
      mainWindow.focus();
    }).catch((err) => {
      console.error('loadURL failed:', fileUrl, err);
    });
  }

  mainWindow.webContents.openDevTools();
};

ipcMain.handle('db:getSongData', (_event, sourceSkid: number, sourceSequenceNbr: number) => {
  return getQueries().getSongData(Number(sourceSkid), Number(sourceSequenceNbr));
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const mod = module as NodeModule & { hot?: { accept(): void } };
if (mod.hot) mod.hot.accept();
