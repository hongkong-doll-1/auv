const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  screen,
} = require("electron");
const path = require("node:path");
const {
  hasKey,
  setKey,
  hasVolcano,
  getVolcano,
  setVolcano,
  hasQwen,
  setQwen,
  getSettings,
  setSettings,
} = require("./src/config");
const { translate, testKey } = require("./src/ai");
const { speak } = require("./src/tts");
const { transcribe } = require("./src/asr");

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const height = Math.min(900, Math.max(720, workArea.height - 60));

  const win = new BrowserWindow({
    width: 460,
    height,
    minWidth: 400,
    minHeight: 680,
    frame: false,
    backgroundColor: "#0b0b10",
    roundedCorners: true,
    show: false,
    title: "auv",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => {
    win.show();
    console.log("auv window ready");
  });
}

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("config:status", () => ({
  hasKey: hasKey(),
  hasVolcano: hasVolcano(),
  hasQwen: hasQwen(),
  volcanoAppId: getVolcano().appid,
  settings: getSettings(),
}));

ipcMain.handle("config:set-key", (_event, key) => {
  try {
    setKey(key);
    return { ok: true, hasKey: hasKey() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("config:set-settings", (_event, patch) => ({
  ok: true,
  settings: setSettings(patch),
}));

ipcMain.handle("config:test-key", (_event, key) => testKey(key));

ipcMain.handle("config:set-volcano", (_event, data) => {
  try {
    setVolcano(data || {});
    return { ok: true, hasVolcano: hasVolcano() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("config:set-qwen", (_event, data) => {
  try {
    setQwen(data || {});
    return { ok: true, hasQwen: hasQwen() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("ai:translate", (_event, input) => translate(input));

ipcMain.handle("tts:speak", (_event, text, options) => speak(text, options));

ipcMain.handle("lesson:list", () => require("./data/lessons.json"));

const ALLOWED_LINKS = new Set([
  "https://platform.deepseek.com/api_keys",
  "https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key",
]);

ipcMain.handle("open:external", (_event, url) => {
  if (!ALLOWED_LINKS.has(url)) return { ok: false };
  shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("asr:transcribe", (_event, audio, mimeType) =>
  transcribe(audio, mimeType)
);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "media");
    }
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
