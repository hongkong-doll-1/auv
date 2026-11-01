const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_VOLCANO_VOICE = "zh_male_beijingxiaoye_moon_bigtts";

const DEFAULTS = {
  voice: "zh-CN-XiaoxiaoNeural",
  rate: 1,
  theme: "dark",
  ttsProvider: "qwen",
  volcanoVoice: DEFAULT_VOLCANO_VOICE,
};

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("写入配置失败:", error.message);
  }
}

function cleanKey(key) {
  return String(key || "")
    .replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/[​-‍﻿]/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\x21-\x7E]/g, "")
    .trim();
}

function hasKey() {
  return Boolean(readAll().apiKey);
}

function getKey() {
  const stored = readAll().apiKey;
  if (!stored) return "";
  try {
    if (!safeStorage.isEncryptionAvailable()) return "";
    return cleanKey(safeStorage.decryptString(Buffer.from(stored, "base64")));
  } catch {
    return "";
  }
}

function setKey(key) {
  const data = readAll();
  const value = cleanKey(key);

  if (!value) {
    delete data.apiKey;
    writeAll(data);
    return;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("当前系统不支持安全存储，无法保存 Key");
  }

  data.apiKey = safeStorage.encryptString(value).toString("base64");
  writeAll(data);
}

function decryptField(value) {
  if (!value) return "";
  try {
    if (!safeStorage.isEncryptionAvailable()) return "";
    return cleanKey(safeStorage.decryptString(Buffer.from(value, "base64")));
  } catch {
    return "";
  }
}

function hasVolcano() {
  const data = readAll();
  return Boolean(
    data.volcanoApiKey || (data.volcanoAppId && data.volcanoToken)
  );
}

function getVolcano() {
  const data = readAll();
  return {
    apiKey: decryptField(data.volcanoApiKey),
    appid: String(data.volcanoAppId || "").trim(),
    token: decryptField(data.volcanoToken),
    voice: data.settings?.volcanoVoice || DEFAULT_VOLCANO_VOICE,
  };
}

function setVolcano({ apiKey, appid, token } = {}) {
  const data = readAll();
  const nextApiKey = String(apiKey || "").trim();
  const nextAppId = String(appid || "").trim();
  const nextToken = String(token || "").trim();

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("当前系统不支持安全存储，无法保存凭证");
  }

  // 新版控制台：API Key
  if (nextApiKey) {
    data.volcanoApiKey = safeStorage
      .encryptString(nextApiKey)
      .toString("base64");
  }

  // 旧版控制台：AppID + Access Token（保留兼容）
  if (nextAppId) data.volcanoAppId = nextAppId;
  if (nextToken) {
    data.volcanoToken = safeStorage
      .encryptString(nextToken)
      .toString("base64");
  }

  // 全部清空
  if (!nextApiKey && !nextAppId && !nextToken) {
    delete data.volcanoApiKey;
    delete data.volcanoAppId;
    delete data.volcanoToken;
  }

  writeAll(data);
}

function hasQwen() {
  return Boolean(readAll().qwenApiKey);
}

function getQwen() {
  return { apiKey: decryptField(readAll().qwenApiKey) };
}

function setQwen({ apiKey } = {}) {
  const data = readAll();
  const value = String(apiKey || "").trim();

  if (!value) {
    delete data.qwenApiKey;
    writeAll(data);
    return;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("当前系统不支持安全存储，无法保存 Key");
  }

  data.qwenApiKey = safeStorage
    .encryptString(value)
    .toString("base64");
  writeAll(data);
}

function getSettings() {
  const data = readAll();
  const settings = { ...DEFAULTS, ...(data.settings || {}) };
  // 旧版本默认火山引擎；现在主推千问
  if (settings.ttsProvider === "volcano") {
    settings.ttsProvider = "qwen";
  }
  return settings;
}

function setSettings(patch) {
  const data = readAll();
  data.settings = { ...DEFAULTS, ...(data.settings || {}), ...(patch || {}) };
  writeAll(data);
  return data.settings;
}

module.exports = {
  hasKey,
  getKey,
  setKey,
  hasVolcano,
  getVolcano,
  setVolcano,
  hasQwen,
  getQwen,
  setQwen,
  getSettings,
  setSettings,
  cleanKey,
  DEFAULTS,
  DEFAULT_VOLCANO_VOICE,
};
