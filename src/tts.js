const { randomUUID } = require("node:crypto");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const { getSettings, getVolcano, getQwen } = require("./config");

const VOLCANO_ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts";
const QWEN_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const QWEN_MODEL = "qwen3-tts-flash";
const QWEN_VOICE = "Dylan";
const DEFAULT_EDGE_VOICE = "zh-CN-XiaoxiaoNeural";
const DEFAULT_VOLCANO_VOICE = "zh_male_beijingxiaoye_moon_bigtts";
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
const MAX_CACHE = 80;

const EDGE_VOICES = new Set([
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-XiaoyiNeural",
  "zh-CN-YunxiNeural",
  "zh-CN-YunjianNeural",
  "zh-CN-YunyangNeural",
]);

const VOLCANO_VOICES = new Set([
  "zh_male_beijingxiaoye_moon_bigtts",
  "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
  "zh_male_jingqiangkanye_moon_bigtts",
  "zh_male_jingqiangkanye_emo_mars_bigtts",
]);

const VOLCANO_ERRORS = {
  3001: "请求参数有误",
  3003: "并发超限，稍后再试",
  3005: "服务繁忙，稍后再试",
  3006: "请求重复",
  3010: "文本太长",
  3011: "文本无效",
  3030: "处理超时",
  3031: "合成失败",
  3032: "音频等待超时",
  3040: "链接错误",
  3050: "音色不存在或未开通",
};

const cache = new Map();

function clampRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.5, Math.max(0.6, rate));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function splitByBytes(text, maxBytes = 900) {
  const parts = [];
  let current = "";

  for (const char of Array.from(text)) {
    if (Buffer.byteLength(current + char, "utf8") > maxBytes) {
      if (current) parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts.length ? parts : [text];
}

function resolveProvider(options = {}) {
  const settings = getSettings();
  const rate = clampRate(options.rate ?? settings.rate ?? 1);
  const requested = options.provider || settings.ttsProvider || "qwen";

  if (requested === "qwen") {
    const credentials = getQwen();
    if (credentials.apiKey) {
      return {
        provider: "qwen",
        voice: QWEN_VOICE,
        rate,
        apiKey: credentials.apiKey,
      };
    }

    return {
      provider: "edge",
      voice: DEFAULT_EDGE_VOICE,
      rate,
      warning: "千问还没配置，先用微软语音",
    };
  }

  if (requested === "volcano") {
    const credentials = getVolcano();
    const voice = VOLCANO_VOICES.has(options.voice)
      ? options.voice
      : VOLCANO_VOICES.has(credentials.voice)
        ? credentials.voice
        : DEFAULT_VOLCANO_VOICE;

    if (credentials.apiKey) {
      return {
        provider: "volcano",
        mode: "v3",
        apiKey: credentials.apiKey,
        voice,
        rate,
      };
    }

    if (credentials.appid && credentials.token) {
      return {
        provider: "volcano",
        mode: "v1",
        voice,
        rate,
        appid: credentials.appid,
        token: credentials.token,
      };
    }

    return {
      provider: "edge",
      voice: DEFAULT_EDGE_VOICE,
      rate,
      warning: "火山引擎还没配置，先用微软语音",
    };
  }

  const voice = EDGE_VOICES.has(options.voice)
    ? options.voice
    : EDGE_VOICES.has(settings.voice)
      ? settings.voice
      : DEFAULT_EDGE_VOICE;

  return { provider: "edge", voice, rate };
}

async function synthesizeEdge(input, { voice, rate }) {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 15000,
    synthesisTimeoutMs: 45000,
  });

  await tts.setMetadata(voice, FORMAT);

  const { audioStream } = tts.toStream(escapeXml(input), { rate });

  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(
      () => finish(reject, new Error("语音合成超时")),
      50000
    );

    audioStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    audioStream.on("end", () => finish(resolve, Buffer.concat(chunks)));
    audioStream.on("close", () => finish(resolve, Buffer.concat(chunks)));
    audioStream.on("error", (error) => finish(reject, error));
  });

  if (!buffer.length) throw new Error("语音合成返回了空内容");
  return buffer;
}

async function synthesizeVolcano(input, { appid, token, voice, rate }) {
  const parts = splitByBytes(input, 900);
  const buffers = [];

  for (const part of parts) {
    const response = await fetch(VOLCANO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer;${token}`,
      },
      body: JSON.stringify({
        app: {
          appid,
          token,
          cluster: "volcano_tts",
        },
        user: { uid: "bjhua-electron" },
        audio: {
          voice_type: voice,
          encoding: "mp3",
          speed_ratio: rate,
          rate: 24000,
        },
        request: {
          reqid: randomUUID(),
          text: part,
          operation: "query",
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    const raw = await response.text();
    let payload;

    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`火山返回了非 JSON 内容（HTTP ${response.status}）`);
    }

    if (payload.code !== 3000 || !payload.data) {
      const reason =
        VOLCANO_ERRORS[payload.code] ||
        payload.message ||
        "未知错误";
      const logid = response.headers.get("x-tt-logid");
      throw new Error(
        `${reason}（代码 ${payload.code}${logid ? `，logid ${logid}` : ""}）`
      );
    }

    buffers.push(Buffer.from(payload.data, "base64"));
  }

  return Buffer.concat(buffers);
}

const VOLCANO_V3_SSE =
  "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse";

function volcanoV3Error(payload) {
  const messages = {
    45000001: "请求无效：模型未开通、音色不存在或参数错误",
    45002000: "音色无效",
    45002001: "没有可朗读的文本",
    45000000: "请求失败（文本过长或参数错误）",
    55000000: "服务端错误",
  };
  const reason =
    messages[payload.code] || payload.message || "未知错误";
  return `${reason}（代码 ${payload.code}）`;
}

async function requestVolcanoV3Part(
  text,
  { apiKey, voice, rate, resourceId }
) {
  const speechRate = Math.max(
    -50,
    Math.min(100, Math.round((rate - 1) * 100))
  );

  const response = await fetch(VOLCANO_V3_SSE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "X-Api-Resource-Id": resourceId,
      "X-Api-Request-Id": randomUUID(),
    },
    body: JSON.stringify({
      user: { uid: "bjhua-electron" },
      req_params: {
        text,
        speaker: voice,
        audio_params: {
          format: "mp3",
          sample_rate: 24000,
          speech_rate: speechRate,
          loudness_rate: 0,
        },
        additions: JSON.stringify({ disable_markdown_filter: true }),
      },
    }),
    signal: AbortSignal.timeout(45000),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `火山 V3 HTTP ${response.status}：${raw.slice(0, 180)}`
    );
  }

  const dataLines = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"));

  const candidates = dataLines.length
    ? dataLines.map((line) => line.slice(5).trim())
    : raw.split(/\r?\n/).map((line) => line.trim());

  const chunks = [];

  for (const candidate of candidates) {
    if (!candidate || candidate === "[DONE]") continue;

    let payload;
    try {
      payload = JSON.parse(candidate);
    } catch {
      continue;
    }

    if (
      payload.code &&
      payload.code !== 0 &&
      payload.code !== 20000000
    ) {
      throw new Error(volcanoV3Error(payload));
    }

    if (payload.data) {
      chunks.push(Buffer.from(payload.data, "base64"));
    }
  }

  if (!chunks.length) throw new Error("火山返回了空音频");

  return Buffer.concat(chunks);
}

async function synthesizeVolcanoV3(input, { apiKey, voice, rate }) {
  const parts = splitByBytes(input, 900);
  const buffers = [];
  let lastError;

  for (const part of parts) {
    let done = false;

    for (const resourceId of [
      "seed-tts-1.0",
      "seed-tts-1.0-concurr",
    ]) {
      try {
        const buffer = await requestVolcanoV3Part(part, {
          apiKey,
          voice,
          rate,
          resourceId,
        });
        buffers.push(buffer);
        done = true;
        break;
      } catch (error) {
        lastError = error;
        const retryable = /模型|model|45000001|Resource/i.test(
          error.message
        );
        if (!retryable) throw error;
      }
    }

    if (!done) throw lastError;
  }

  return Buffer.concat(buffers);
}

async function synthesizeQwen(input, { apiKey }) {
  const parts = splitByBytes(input, 900);
  const buffers = [];

  for (const part of parts) {
    const response = await fetch(QWEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        input: {
          text: part,
          voice: QWEN_VOICE,
          language_type: "Chinese",
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    const raw = await response.text();
    let payload;

    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(
        `千问返回了非 JSON 内容（HTTP ${response.status}）`
      );
    }

    if (!response.ok) {
      const reason =
        payload?.message || payload?.code || raw.slice(0, 160);
      throw new Error(`千问 HTTP ${response.status}：${reason}`);
    }

    const audio = payload?.output?.audio || {};
    let buffer;

    if (audio.url) {
      const audioResponse = await fetch(audio.url, {
        signal: AbortSignal.timeout(60000),
      });
      if (!audioResponse.ok) {
        throw new Error(
          `下载语音失败（HTTP ${audioResponse.status}）`
        );
      }
      buffer = Buffer.from(await audioResponse.arrayBuffer());
    } else if (audio.data) {
      buffer = Buffer.from(audio.data, "base64");
    } else {
      throw new Error(`千问没有返回音频：${raw.slice(0, 180)}`);
    }

    if (buffer.length) buffers.push(buffer);
  }

  if (!buffers.length) throw new Error("千问返回了空音频");
  return Buffer.concat(buffers);
}

function remember(key, buffer) {
  if (cache.size >= MAX_CACHE) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, buffer);
}

async function synthesize(text, options = {}) {
  const input = String(text || "").trim();
  if (!input) throw new Error("没有要朗读的内容");

  const resolved = resolveProvider(options);
  const key = `${resolved.provider}|${resolved.voice}|${resolved.rate}|${input}`;
  const mime =
    resolved.provider === "qwen" ? "audio/wav" : "audio/mpeg";

  if (cache.has(key)) {
    return {
      buffer: cache.get(key),
      cached: true,
      provider: resolved.provider,
      mime,
      warning: resolved.warning,
    };
  }

  try {
    let buffer;

    if (resolved.provider === "qwen") {
      buffer = await synthesizeQwen(input, resolved);
    } else if (resolved.provider === "volcano") {
      buffer =
        resolved.mode === "v3"
          ? await synthesizeVolcanoV3(input, resolved)
          : await synthesizeVolcano(input, resolved);
    } else {
      buffer = await synthesizeEdge(input, resolved);
    }

    remember(key, buffer);
    return {
      buffer,
      cached: false,
      provider: resolved.provider,
      mime,
      warning: resolved.warning,
    };
  } catch (error) {
    if (resolved.provider === "edge") throw error;

    // 京腔引擎失败时退回微软语音，保证还能出声
    const edge = {
      provider: "edge",
      voice: DEFAULT_EDGE_VOICE,
      rate: resolved.rate,
    };
    const buffer = await synthesizeEdge(input, edge);
    remember(`edge|${edge.voice}|${edge.rate}|${input}`, buffer);

    const name = resolved.provider === "qwen" ? "千问" : "火山";
    return {
      buffer,
      cached: false,
      provider: "edge",
      mime: "audio/mpeg",
      warning: `${name}语音失败：${error.message}；已改用微软语音`,
    };
  }
}

async function speak(text, options = {}) {
  try {
    const result = await synthesize(text, options);
    return {
      ok: true,
      audio: result.buffer,
      mime: result.mime,
      cached: result.cached,
      provider: result.provider,
      warning: result.warning || "",
    };
  } catch (error) {
    return {
      ok: false,
      error: `语音合成失败：${error?.message || "未知错误"}`,
    };
  }
}

module.exports = {
  speak,
  synthesize,
  DEFAULT_EDGE_VOICE,
  DEFAULT_VOLCANO_VOICE,
};
