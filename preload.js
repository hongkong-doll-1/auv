const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("auv", {
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  getConfig: () => ipcRenderer.invoke("config:status"),
  setApiKey: (key) => ipcRenderer.invoke("config:set-key", key),
  setSettings: (patch) => ipcRenderer.invoke("config:set-settings", patch),
  testApiKey: (key) => ipcRenderer.invoke("config:test-key", key),
  setVolcano: (data) => ipcRenderer.invoke("config:set-volcano", data),
  setQwen: (data) => ipcRenderer.invoke("config:set-qwen", data),
  translate: (input) => ipcRenderer.invoke("ai:translate", input),
  speak: (text, options) => ipcRenderer.invoke("tts:speak", text, options),
  getLessons: () => ipcRenderer.invoke("lesson:list"),
  transcribe: (audio, mimeType) =>
    ipcRenderer.invoke("asr:transcribe", audio, mimeType),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  electronVersion: process.versions.electron,
});
