const { app, BrowserWindow, Menu, Notification, Tray, clipboard, desktopCapturer, globalShortcut, ipcMain, nativeImage, net, protocol, session, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_SCHEME = 'scamcheck';
const SCREEN_INTERVAL_MS = 60_000;
const CLIPBOARD_INTERVAL_MS = 4_000;
const MAX_CLIPBOARD_CHARS = 5_000;
const MAX_SCAN_LOG_ENTRIES = 80;

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
]);

let mainWindow;
let tray;
let isQuitting = false;
let watcherTimer;
let lastClipboard = '';
let lastScreenHash = '';
let lastScreenCheck = 0;

const defaultPreferences = {
  clipboardWatch: false,
  screenWatch: false,
  autoAnalyze: false,
  startOnLogin: false
};

function preferencesPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function scanLogPath() {
  return path.join(app.getPath('userData'), 'desktop-scan-log.json');
}

function getScanLog() {
  try {
    const entries = JSON.parse(fs.readFileSync(scanLogPath(), 'utf8'));
    return Array.isArray(entries) ? entries.slice(0, MAX_SCAN_LOG_ENTRIES) : [];
  } catch {
    return [];
  }
}

function recordScanEvent(event = {}) {
  // This log deliberately stores metadata only — never captured text or screenshots.
  const entry = {
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    source: String(event.source || 'desktop').slice(0, 40),
    severity: ['neutral', 'success', 'warning', 'error'].includes(event.severity) ? event.severity : 'neutral',
    detail: String(event.detail || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 280)
  };
  const next = [entry, ...getScanLog()].slice(0, MAX_SCAN_LOG_ENTRIES);
  fs.mkdirSync(path.dirname(scanLogPath()), { recursive: true });
  fs.writeFileSync(scanLogPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function clearScanLog() {
  try { fs.rmSync(scanLogPath(), { force: true }); } catch {}
  return [];
}

function getPreferences() {
  try {
    return { ...defaultPreferences, ...JSON.parse(fs.readFileSync(preferencesPath(), 'utf8')) };
  } catch {
    return { ...defaultPreferences };
  }
}

function savePreferences(next) {
  const clean = {
    clipboardWatch: Boolean(next.clipboardWatch),
    screenWatch: Boolean(next.screenWatch),
    autoAnalyze: Boolean(next.autoAnalyze),
    startOnLogin: Boolean(next.startOnLogin)
  };
  fs.mkdirSync(path.dirname(preferencesPath()), { recursive: true });
  fs.writeFileSync(preferencesPath(), JSON.stringify(clean, null, 2), 'utf8');
  app.setLoginItemSettings({ openAtLogin: clean.startOnLogin, openAsHidden: true });
  restartWatchers();
  return clean;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function safeClipboardText() {
  const value = String(clipboard.readText() || '').replace(/\0/g, '').trim();
  if (value.length < 10 || value.length > MAX_CLIPBOARD_CHARS) return '';
  return value;
}

async function captureScreens() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1280, height: 720 },
    fetchWindowIcons: false
  });
  return sources
    .filter(source => !source.thumbnail.isEmpty())
    .map(source => ({ id: source.id, name: source.name || 'Screen', dataUrl: source.thumbnail.toDataURL() }));
}

async function sendScreenCapture({ automatic = false } = {}) {
  const screens = await captureScreens();
  const hash = crypto.createHash('sha256').update(screens.map(item => item.dataUrl).join('|')).digest('hex');
  if (automatic && hash === lastScreenHash) return false;
  lastScreenHash = hash;
  sendToRenderer('desktop:screen-images', { screens, source: 'screen', automatic });
  return true;
}

function restartWatchers() {
  if (watcherTimer) clearInterval(watcherTimer);
  watcherTimer = undefined;
  const prefs = getPreferences();
  if (!prefs.clipboardWatch && !prefs.screenWatch) return;
  lastClipboard = safeClipboardText();
  watcherTimer = setInterval(runWatchTick, CLIPBOARD_INTERVAL_MS);
}

async function runWatchTick() {
  const prefs = getPreferences();
  if (prefs.clipboardWatch) {
    const text = safeClipboardText();
    if (text && text !== lastClipboard) {
      lastClipboard = text;
      sendToRenderer('desktop:clipboard-text', { text, source: 'clipboard', automatic: true });
    }
  }

  if (!prefs.screenWatch || Date.now() - lastScreenCheck < SCREEN_INTERVAL_MS) return;
  lastScreenCheck = Date.now();
  try {
    await sendScreenCapture({ automatic: true });
  } catch (error) {
    console.warn('Screen watch capture failed:', error.message);
  }
}

function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    show: false,
    title: 'ScamCheck - An toàn không gian số',
    backgroundColor: '#f3f4f6',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL(`${APP_SCHEME}://app/index.html`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    notify('ScamCheck vẫn đang chạy', 'Ứng dụng được thu nhỏ vào khay hệ thống để các chế độ theo dõi đã bật tiếp tục hoạt động.');
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_SCHEME}://`)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('ScamCheck - An toàn không gian số');
  tray.on('click', showMainWindow);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở ScamCheck', click: showMainWindow },
    { label: 'Quét clipboard ngay', click: () => sendToRenderer('desktop:clipboard-text', { text: safeClipboardText(), source: 'clipboard', automatic: false }) },
    { label: 'Quét màn hình ngay', click: async () => { try { await sendScreenCapture(); showMainWindow(); } catch (error) { notify('ScamCheck', `Không thể quét màn hình: ${error.message}`); } } },
    { type: 'separator' },
    { label: 'Thoát', click: () => { isQuitting = true; app.quit(); } }
  ]));
}

function registerIpc() {
  ipcMain.handle('desktop:get-preferences', () => getPreferences());
  ipcMain.handle('desktop:set-preferences', (_event, next) => savePreferences(next || {}));
  ipcMain.handle('desktop:read-clipboard', () => safeClipboardText());
  ipcMain.handle('desktop:capture-screens', async () => captureScreens());
  ipcMain.handle('desktop:get-scan-log', () => getScanLog());
  ipcMain.handle('desktop:record-scan-event', (_event, entry) => recordScanEvent(entry));
  ipcMain.handle('desktop:clear-scan-log', () => clearScanLog());
  ipcMain.on('desktop:notify', (_event, { title, body }) => notify(String(title || 'ScamCheck'), String(body || '')));
  ipcMain.on('desktop:show-window', showMainWindow);
}

app.whenReady().then(() => {
  const rendererRoot = path.join(__dirname, '..', 'renderer');
  protocol.handle(APP_SCHEME, async request => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname || '/index.html').replace(/^\/+/, '') || 'index.html';
    const resolved = path.resolve(rendererRoot, relativePath);
    if (!resolved.startsWith(rendererRoot)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(resolved).toString());
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'notifications', 'clipboard-sanitized-write'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => ['media', 'notifications', 'clipboard-sanitized-write'].includes(permission));

  registerIpc();
  createWindow();
  createTray();
  restartWatchers();
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    sendToRenderer('desktop:clipboard-text', { text: safeClipboardText(), source: 'clipboard', automatic: false });
    showMainWindow();
  });
  globalShortcut.register('CommandOrControl+Shift+M', async () => {
    try {
      await sendScreenCapture();
      showMainWindow();
    } catch (error) {
      notify('ScamCheck', `Không thể quét màn hình: ${error.message}`);
    }
  });

  app.on('activate', showMainWindow);
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => {
  if (watcherTimer) clearInterval(watcherTimer);
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', event => event.preventDefault());
