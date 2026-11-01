const { getQwen } = require("./config");

const ASR_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const ASR_MODEL = "qwen3-asr-flash";
const MAX_BYTES = 7 * 1024 * 1024;

async function transcribe(audio, mimeType) {
  const apiKey = getQwen().apiKey;
  if (!apiKey) {
    return {
      ok: false,
      error: "请先在设置里填写阿里云百炼 API Key（识别和京腔朗读共用）",
    };
  }

  let buffer;
  try {
    buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
  } catch {
    return { ok: false, error: "录音数据无效" };
  }

  if (!buffer.length) {
    return { ok: false, error: "没有录到声音" };
  }

  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: "录音太长了，请说短一点" };
  }

  const mime =
    String(mimeType || "audio/webm").split(";")[0] || "audio/webm";
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

  try {
    const response = await fetch(ASR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ASR_MODEL,
        input: {
          messages: [
            {
              role: "user",
              content: [{ audio: dataUri }],
            },
          ],
        },
        parameters: {
          asr_options: {
            language: "zh",
            enable_itn: true,
          },
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    const raw = await response.text();
    let payload;

    try {
      payload = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        error: `识别服务返回异常（HTTP ${response.status}）`,
      };
    }

    if (!response.ok) {
      const reason =
        payload?.message || payload?.code || raw.slice(0, 160);
      if (response.status === 401) {
        return { ok: false, error: "百炼 API Key 无效" };
      }
      if (response.status === 402) {
        return { ok: false, error: "百炼账户余额不足" };
      }
      return { ok: false, error: `识别失败：${reason}` };
    }

    const content = payload?.output?.choices?.[0]?.message?.content;
    let text = "";

    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content.map((part) => part?.text || "").join("");
    }

    text = text.trim();

    if (!text) {
      return { ok: false, error: "没听清，请再说一遍" };
    }

    return { ok: true, text };
  } catch (error) {
    const aborted =
      error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "识别超时，请检查网络后再试"
        : "识别失败，请检查网络后再试",
    };
  }
}

module.exports = { transcribe };
