const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { getKey, cleanKey } = require("./config");

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-flash";
const TIMEOUT_MS = 60000;

const SYSTEM_PROMPT = `你是一位地道的北京话老师，任务是把普通话转换成北京话并教学。

只输出一个 json 对象，不要输出任何解释、markdown 或多余文字。json 结构如下：
{
  "original": "用户的原句",
  "beijing": "对应的北京话写法（汉字）",
  "pinyin": "北京话的带声调拼音，儿化用 r 标注，例如 xiōng shìr",
  "explanation": "一两句话说明为什么这么说（儿化、吞音、换词）",
  "changes": [
    { "from": "普通话原词", "to": "北京话", "reason": "变化原因" }
  ],
  "examples": [
    { "beijing": "北京话例句", "standard": "普通话意思", "pinyin": "拼音" }
  ]
}

规则：
1. 只做北京话转换与教学，不回答其他话题。
2. 儿化要准确，不要给所有名词乱加“儿”。女儿、孤儿、婴儿这类“儿”是独立音节的词，不加儿化。
3. 吞音只在口语中标注，例如：不知道→不儿道、老师→老儿、西红柿→胸是。
4. 不确定有没有对应的北京话说法时，beijing 填原句，并在 explanation 里说明“这句话没有明显的北京话特殊说法”，不要编造。
5. 区分北京话与东北话、网络梗，不要把“咋、整、老铁”等当成北京话。
6. 拼音使用带声调符号的规范拼音，儿化音用 r 表示。
7. changes 和 examples 可以是空数组，但字段必须存在。
8. 北京话不等于粗俗话，不使用冒犯性表达。`;

function cachePath() {
  return path.join(app.getPath("userData"), "ai-cache.json");
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    const entries = Object.entries(cache);
    if (entries.length > 300) {
      entries.sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      cache = Object.fromEntries(entries.slice(0, 300));
    }
    fs.mkdirSync(path.dirname(cachePath()), { recursive: true });
    fs.writeFileSync(cachePath(), JSON.stringify(cache), "utf8");
  } catch {
    // 缓存失败不影响主流程
  }
}

function cacheKey(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function sanitize(raw, original) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    original: text(source.original, original),
    beijing: text(source.beijing, original),
    pinyin: text(source.pinyin),
    explanation: text(source.explanation),
    changes: Array.isArray(source.changes)
      ? source.changes
          .filter((item) => item && typeof item === "object")
          .slice(0, 6)
          .map((item) => ({
            from: text(item.from),
            to: text(item.to),
            reason: text(item.reason),
          }))
      : [],
    examples: Array.isArray(source.examples)
      ? source.examples
          .filter((item) => item && typeof item === "object")
          .slice(0, 3)
          .map((item) => ({
            beijing: text(item.beijing),
            standard: text(item.standard),
            pinyin: text(item.pinyin),
          }))
      : [],
  };
}

function friendlyError(status, body) {
  if (status === 401) return "DeepSeek Key 无效，请检查后重试。";
  if (status === 402) return "DeepSeek 账户余额不足，请充值后重试。";
  if (status === 429) return "请求太频繁，稍等几秒再试。";
  if (status >= 500) return "DeepSeek 服务暂时不可用，稍后再试。";
  if (status === 400 || status === 422) {
    return `请求参数有问题：${body.slice(0, 120)}`;
  }
  return `DeepSeek 返回错误（${status}）：${body.slice(0, 120)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce(apiKey, input) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请把下面这句话转换成北京话，并只返回 json：\n${input}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200,
      stream: false,
      thinking: { type: "disabled" },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { retry: response.status === 429 || response.status >= 500, error: friendlyError(response.status, body) };
  }

  const payload = await response.json();
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content ?? "";

  if (choice?.finish_reason !== "stop" || !content.trim()) {
    return { retry: true, error: "AI 这次没有返回完整内容，正在重试…" };
  }

  try {
    return { retry: false, data: sanitize(JSON.parse(content), input) };
  } catch {
    return { retry: true, error: "AI 返回的内容格式不对，正在重试…" };
  }
}

async function translate(input) {
  const original = String(input || "").trim();
  if (!original) {
    return { ok: false, error: "先输入一句想问的话吧。" };
  }

  const apiKey = getKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "NO_KEY",
      error: "还没有配置 DeepSeek API Key，请点右上角 ⚙ 设置。",
    };
  }

  const cache = readCache();
  const key = cacheKey(original);
  if (cache[key]?.data) {
    return { ok: true, data: cache[key].data, cached: true };
  }

  let lastError = "请求失败，请稍后再试。";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let result;
    try {
      result = await requestOnce(apiKey, original);
    } catch (error) {
      const aborted = error?.name === "TimeoutError" || error?.name === "AbortError";
      lastError = aborted
        ? "请求超时了，请检查网络后再试。"
        : "网络连接失败，请检查网络后再试。";
      if (attempt < 2) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      break;
    }

    if (result.data) {
      cache[key] = { at: Date.now(), data: result.data };
      writeCache(cache);
      return { ok: true, data: result.data, cached: false };
    }

    lastError = result.error;
    if (!result.retry || attempt === 2) break;
    await sleep(800 * (attempt + 1));
  }

  return { ok: false, error: lastError };
}

async function testKey(key) {
  const value = cleanKey(key);
  if (!value) return { ok: false, error: "请先粘贴 Key" };

  const meta = {
    length: value.length,
    prefix: value.slice(0, 3),
    suffix: value.slice(-2),
  };

  try {
    const response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${value}` },
      signal: AbortSignal.timeout(20000),
    });

    if (response.ok) return { ok: true, meta };

    const body = await response.text().catch(() => "");
    if (response.status === 401) {
      return {
        ok: false,
        error: "Key 无效（401），请重新复制完整 Key",
        meta,
        detail: body.slice(0, 200),
      };
    }
    if (response.status === 402) {
      return { ok: false, error: "账户余额不足（402），请先充值", meta };
    }
    return {
      ok: false,
      error: `连接失败（${response.status}）`,
      meta,
      detail: body.slice(0, 200),
    };
  } catch {
    return { ok: false, error: "网络连接失败，请检查网络", meta };
  }
}

module.exports = { translate, testKey };
