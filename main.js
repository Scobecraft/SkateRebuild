/* Concrete Flow – Windows-Desktop-App (Electron) */
const { app, BrowserWindow, protocol, net, Menu, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Grafikkarte: dedizierte GPU bevorzugen, keine GPU-Blockliste, flüssiges Rendering
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Eigenes Protokoll app:// – ES-Module, Texturen und Modelle laden wie von einem Webserver
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
const GAME_DIR = path.join(__dirname, 'game');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#0d1117', title: 'Concrete Flow', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // Externe Links im Standardbrowser öffnen
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL('app://game/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', request => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(GAME_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(GAME_DIR)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // Fotos aus dem Fotomodus landen automatisch unter Bilder\Concrete Flow
  session.defaultSession.on('will-download', (event, item) => {
    const dir = path.join(app.getPath('pictures'), 'Concrete Flow');
    fs.mkdirSync(dir, { recursive: true });
    item.setSavePath(path.join(dir, item.getFilename()));
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
