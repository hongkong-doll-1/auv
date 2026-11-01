const api = window.auv ?? {};

document.querySelector("#min").addEventListener("click", () => api.minimize?.());
document.querySelector("#close").addEventListener("click", () => api.close?.());

const orbWrap = document.querySelector("#orb");
const stage = document.querySelector("#stage");
const card = document.querySelector("#card");
const msg = document.querySelector("#msg");
const form = document.querySelector("#ask-form");
const input = document.querySelector("#ask-input");
const askBtn = document.querySelector("#ask-btn");
const micBtn = document.querySelector("#mic-btn");
const hint = document.querySelector("#hint");

const sheet = document.querySelector("#sheet");
const settingsBtn = document.querySelector("#settings-btn");
const closeSheetBtn = document.querySelector("#close-sheet");
const keyInput = document.querySelector("#key-input");
const saveKeyBtn = document.querySelector("#save-key");
const testKeyBtn = document.querySelector("#test-key");
const keyStatus = document.querySelector("#key-status");

const ttsProviderSelect = document.querySelector("#tts-provider");
const qwenApiKeyInput = document.querySelector("#qwen-apikey");
const saveTtsBtn = document.querySelector("#save-tts");
const testTtsBtn = document.querySelector("#test-tts");
const ttsStatus = document.querySelector("#tts-status");

const playBtn = document.querySelector("#play-btn");
const playSlowBtn = document.querySelector("#play-slow");

const chatView = document.querySelector("#chat-view");
const courseView = document.querySelector("#course-view");
const courseList = document.querySelector("#course-list");
const lessonView = document.querySelector("#lesson-view");
const lessonBackBtn = document.querySelector("#lesson-back");
const lessonProgress = document.querySelector("#lesson-progress");
const lessonBeijing = document.querySelector("#lesson-beijing");
const lessonPinyin = document.querySelector("#lesson-pinyin");
const lessonStandard = document.querySelector("#lesson-standard");
const lessonExplain = document.querySelector("#lesson-explain");
const lessonExample = document.querySelector("#lesson-example");
const lessonPrevBtn = document.querySelector("#lesson-prev");
const lessonPlayBtn = document.querySelector("#lesson-play");
const lessonNextBtn = document.querySelector("#lesson-next");
const lessonDoneBtn = document.querySelector("#lesson-done");
const composer = document.querySelector("#ask-form");
const composerRow = document.querySelector(".composer-row");
const tabChat = document.querySelector("#tab-chat");
const tabCourse = document.querySelector("#tab-course");
const tabIndicator = document.querySelector("#tab-indicator");

const sheetBack = document.querySelector("#sheet-back");
const replayTourBtn = document.querySelector("#replay-tour");

const tour = document.querySelector("#tour");
const tourHole = document.querySelector("#tour-hole");
const tourCard = document.querySelector("#tour-card");
const tourStepEl = document.querySelector("#tour-step");
const tourTitle = document.querySelector("#tour-title");
const tourText = document.querySelector("#tour-text");
const tourDots = document.querySelector("#tour-dots");
const tourPrev = document.querySelector("#tour-prev");
const tourNext = document.querySelector("#tour-next");
const tourSkip = document.querySelector("#tour-skip");

let hasKey = false;
let configState = {};
let busy = false;
let currentData = null;
let currentAudio = null;
let currentUrl = null;
let lessons = [];
let currentLessonId = null;
let currentIndex = 0;

function showMsg(value, isError = false) {
  if (!value) {
    msg.hidden = true;
    msg.textContent = "";
    return;
  }
  msg.textContent = value;
  msg.classList.toggle("error", isError);
  msg.hidden = false;
}

async function refreshConfig() {
  try {
    const state = await api.getConfig?.();
    configState = state || {};
    hasKey = Boolean(state?.hasKey);
    if (hasKey) {
      hint.textContent = "输入一句话，学地道北京话";
      showMsg("");
    } else {
      hint.textContent = "先点右上角 ⚙ 填 DeepSeek Key";
      showMsg("还没有配置 DeepSeek API Key，点右上角 ⚙ 填一下。", true);
    }
  } catch {
    showMsg("读取配置失败，请重启软件再试。", true);
  }
}

settingsBtn?.addEventListener("click", () => {
  keyStatus.textContent = hasKey ? "当前已配置 Key" : "当前未配置 Key";
  keyInput.value = "";

  const settings = configState.settings || {};
  ttsProviderSelect.value =
    settings.ttsProvider === "edge" ? "edge" : "qwen";
  qwenApiKeyInput.value = "";
  ttsStatus.textContent = configState.hasQwen
    ? "千问语音已配置"
    : "千问语音未配置";

  sheet.hidden = false;
  setTimeout(() => keyInput.focus(), 50);
});

function closeSheet() {
  sheet.hidden = true;
  keyInput.value = "";
}

closeSheetBtn?.addEventListener("click", closeSheet);
sheetBack?.addEventListener("click", closeSheet);

document.querySelectorAll(".sheet-link").forEach((button) => {
  button.addEventListener("click", () => {
    api.openExternal?.(button.dataset.url);
  });
});

sheet?.addEventListener("click", (event) => {
  if (event.target === sheet) closeSheet();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !sheet.hidden) closeSheet();
});

testKeyBtn?.addEventListener("click", async () => {
  const value = keyInput.value.trim();
  if (!value) {
    keyStatus.textContent = "请先粘贴 Key";
    return;
  }

  keyStatus.textContent = "正在连接 DeepSeek…";
  const result = await api.testApiKey?.(value);
  if (result?.ok) {
    keyStatus.textContent = "Key 有效 ✓ 可以保存了";
  } else {
    const lines = [result?.error || "测试失败"];
    if (result?.meta) {
      lines.push(
        `识别到：长度 ${result.meta.length}，开头 ${result.meta.prefix}，结尾 ${result.meta.suffix}`
      );
    }
    if (result?.detail) lines.push(`原始返回：${result.detail}`);
    keyStatus.textContent = lines.join("\n");
  }
});

saveTtsBtn?.addEventListener("click", async () => {
  const provider = ttsProviderSelect.value;
  const apiKey = qwenApiKeyInput.value.trim();

  if (provider === "qwen" && !apiKey && !configState.hasQwen) {
    ttsStatus.textContent = "请填写阿里云百炼 API Key";
    return;
  }

  ttsStatus.textContent = "保存中…";

  if (apiKey) {
    const result = await api.setQwen?.({ apiKey });
    if (!result?.ok) {
      ttsStatus.textContent = result?.error || "保存失败";
      return;
    }
    configState.hasQwen = Boolean(result.hasQwen);
  }

  const result = await api.setSettings?.({
    ttsProvider: provider,
  });

  if (result?.ok) {
    configState.settings = result.settings;
    qwenApiKeyInput.value = "";
    ttsStatus.textContent =
      provider === "qwen"
        ? "已保存 · 朗读将使用千问北京话音色"
        : "已保存 · 朗读将使用微软标准普通话";
  } else {
    ttsStatus.textContent = "保存失败";
  }
});

testTtsBtn?.addEventListener("click", async () => {
  const apiKey = qwenApiKeyInput.value.trim();

  if (apiKey) {
    const saved = await api.setQwen?.({ apiKey });
    if (!saved?.ok) {
      ttsStatus.textContent = saved?.error || "保存 API Key 失败";
      return;
    }
    configState.hasQwen = Boolean(saved.hasQwen);
    qwenApiKeyInput.value = "";
  }

  if (!configState.hasQwen) {
    ttsStatus.textContent = "请先填写阿里云百炼 API Key";
    return;
  }

  ttsStatus.textContent = "正在生成京腔语音…";
  const result = await api.speak?.("您吃了吗您呐？今儿天儿不错。", {
    provider: "qwen",
  });

  if (!result?.ok) {
    ttsStatus.textContent = result?.error || "测试失败";
    return;
  }

  ttsStatus.textContent = result.warning || "成功，正在播放北京-晓东";

  const blob = new Blob([result.audio], {
    type: result.mime || "audio/mpeg",
  });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener(
    "ended",
    () => URL.revokeObjectURL(url),
    { once: true }
  );
  audio.play().catch(() => {});
});

saveKeyBtn?.addEventListener("click", async () => {
  const value = keyInput.value.trim();
  if (!value) {
    keyStatus.textContent = "请先粘贴 Key";
    return;
  }

  keyStatus.textContent = "保存中…";
  const result = await api.setApiKey?.(value);

  if (result?.ok) {
    hasKey = true;
    keyStatus.textContent = "已保存 ✓";
    keyInput.value = "";
    hint.textContent = "输入一句话，学地道北京话";
    showMsg("");
    setTimeout(closeSheet, 700);
  } else {
    keyStatus.textContent = result?.error || "保存失败，请重试";
  }
});

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  window.auvOrb?.stopAudio?.();
}

function fallbackSpeak(value, rate) {
  if (!("speechSynthesis" in window)) {
    showMsg("当前设备不支持语音朗读。", true);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = "zh-CN";
  utterance.rate = rate;

  const voice = window.speechSynthesis
    .getVoices()
    .find((item) => item.lang && item.lang.startsWith("zh"));
  if (voice) utterance.voice = voice;

  utterance.onend = () => window.auvOrb?.idle();
  utterance.onerror = () => window.auvOrb?.idle();

  window.speechSynthesis.speak(utterance);
  window.auvOrb?.speak(Math.max(2000, value.length * 260));
  showMsg("当前使用系统离线语音，音质一般。");
}

async function playCurrent(slow = false) {
  if (!currentData) return;
  const value = currentData.beijing || currentData.original || "";
  if (!value) return;

  stopAudio();
  showMsg(slow ? "正在生成慢速语音…" : "正在生成语音…");
  window.auvOrb?.think();

  const result = await api.speak?.(value, { rate: slow ? 0.8 : 1 });

  if (!result?.ok || !result.audio) {
    showMsg(result?.error || "语音合成失败，改用系统语音。", true);
    fallbackSpeak(value, slow ? 0.8 : 1);
    return;
  }

  const notice = result.warning || "";
  const blob = new Blob([result.audio], { type: result.mime || "audio/mpeg" });
  currentUrl = URL.createObjectURL(blob);
  const audio = new Audio(currentUrl);
  currentAudio = audio;

  if (result.provider === "qwen" && slow) {
    audio.playbackRate = 0.85;
    audio.preservesPitch = true;
  }

  audio.addEventListener("loadedmetadata", () => {
    const ms = Number.isFinite(audio.duration)
      ? Math.max(1200, audio.duration * 1000)
      : Math.max(2000, value.length * 260);
    window.auvOrb?.speak(ms);
  });

  audio.addEventListener("ended", () => window.auvOrb?.idle());
  audio.addEventListener("error", () => {
    showMsg("音频播放失败，改用系统语音。", true);
    fallbackSpeak(value, slow ? 0.8 : 1);
  });

  window.auvOrb?.attachAudio?.(audio);

  try {
    await audio.play();
    showMsg(notice, Boolean(notice));
  } catch {
    showMsg("播放被系统拦截，点「朗读」再试一次。", true);
    window.auvOrb?.idle();
  }
}

playBtn?.addEventListener("click", () => playCurrent(false));
playSlowBtn?.addEventListener("click", () => playCurrent(true));

function renderCard(data, cached) {
  currentData = data;
  document.querySelector("#r-beijing").textContent =
    data.beijing || data.original || "";
  document.querySelector("#r-pinyin").textContent = data.pinyin || "";
  document.querySelector("#r-explain").textContent = data.explanation || "";

  const changes = document.querySelector("#r-changes");
  changes.replaceChildren();
  for (const item of data.changes || []) {
    const row = document.createElement("div");
    row.className = "change";

    const from = document.createElement("span");
    from.textContent = item.from;

    const arrow = document.createElement("span");
    arrow.textContent = "→";

    const to = document.createElement("b");
    to.textContent = item.to;

    const reason = document.createElement("span");
    reason.textContent = item.reason ? `（${item.reason}）` : "";

    row.append(from, arrow, to, reason);
    changes.append(row);
  }

  const examples = document.querySelector("#r-examples");
  examples.replaceChildren();
  for (const item of data.examples || []) {
    const box = document.createElement("div");
    box.className = "example";

    const line = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = item.beijing || "";
    line.append(strong);

    if (item.pinyin) {
      line.append(document.createTextNode(`  ${item.pinyin}`));
    }

    const meaning = document.createElement("div");
    meaning.textContent = item.standard || "";

    box.append(line, meaning);
    examples.append(box);
  }

  card.hidden = false;
  stage.classList.add("has-result");
  hint.textContent = cached
    ? "来自缓存 · 输入新句子继续"
    : "输入一句话，学地道北京话";
}

async function ask(rawValue) {
  if (busy) return;
  const value = String(rawValue || "").trim();
  if (!value) return;

  busy = true;
  askBtn.disabled = true;
  input.disabled = true;
  card.hidden = true;
  stage.classList.remove("has-result");
  stopAudio();
  showMsg("正在琢磨…");
  window.auvOrb?.think();

  try {
    const result = await api.translate?.(value);
    if (result?.ok) {
      renderCard(result.data, result.cached);
      showMsg("");
      playCurrent(false);
    } else {
      showMsg(result?.error || "请求失败，请稍后再试。", true);
      window.auvOrb?.idle();
    }
  } catch {
    showMsg("请求失败，请检查网络后再试。", true);
    window.auvOrb?.idle();
  } finally {
    busy = false;
    askBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value;
  input.value = "";
  ask(value);
});

/* ---------- 按住说话 ---------- */

let mediaRecorder = null;
let micStream = null;
let micChunks = [];
let recording = false;

async function startRecording() {
  if (recording || busy) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    hint.textContent = "当前环境不支持麦克风";
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    hint.textContent = "无法使用麦克风，请检查系统权限";
    return;
  }

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  mediaRecorder = new MediaRecorder(micStream, { mimeType });
  micChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) micChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    micStream?.getTracks().forEach((track) => track.stop());
    micStream = null;
    window.auvOrb?.stopListening?.();

    const blob = new Blob(micChunks, { type: "audio/webm" });
    micChunks = [];

    if (blob.size < 1200) {
      hint.textContent = "说话时间太短，再按住说一次";
      return;
    }

    hint.textContent = "正在识别…";
    window.auvOrb?.think();

    try {
      const result = await api.transcribe?.(
        await blob.arrayBuffer(),
        mimeType
      );

      if (result?.ok && result.text) {
        hint.textContent = "输入一句话，学地道北京话";
        await ask(result.text);
      } else {
        hint.textContent = result?.error || "没听清，请再说一遍";
        window.auvOrb?.idle();
      }
    } catch {
      hint.textContent = "识别失败，请稍后再试";
      window.auvOrb?.idle();
    }
  };

  mediaRecorder.start();
  recording = true;
  micBtn.classList.add("recording");
  hint.textContent = "正在听…松开发送";
  window.auvOrb?.listen?.(micStream);
}

function stopRecording() {
  if (!recording) return;
  recording = false;
  micBtn.classList.remove("recording");
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

micBtn?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startRecording();
});

micBtn?.addEventListener("pointerup", stopRecording);
micBtn?.addEventListener("pointerleave", stopRecording);
micBtn?.addEventListener("pointercancel", stopRecording);

// 点击光球：输入框为空时，只预览动效
orbWrap?.addEventListener("click", () => {
  if (!window.auvOrb || busy) return;
  if (input.value.trim()) return;
  window.auvOrb.think();
  setTimeout(() => window.auvOrb?.speak(2600), 650);
});

/* ---------- 课程 ---------- */

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem("auv.progress") || "{}");
  } catch {
    return {};
  }
}

function learnedSet(lessonId) {
  return new Set(readProgress()[lessonId] || []);
}

function markLearned(lessonId, index) {
  const progress = readProgress();
  const set = new Set(progress[lessonId] || []);
  set.add(index);
  progress[lessonId] = [...set].sort((a, b) => a - b);
  localStorage.setItem("auv.progress", JSON.stringify(progress));
}

function renderCourseList() {
  if (!courseList) return;
  courseList.replaceChildren();

  if (!lessons.length) {
    const empty = document.createElement("p");
    empty.className = "msg";
    empty.textContent = "课程加载失败，请重启软件。";
    courseList.append(empty);
    return;
  }

  for (const lesson of lessons) {
    const learned = learnedSet(lesson.id).size;
    const total = lesson.items.length;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "course-item";

    const title = document.createElement("h3");
    title.textContent = lesson.title;

    const subtitle = document.createElement("p");
    subtitle.textContent = lesson.subtitle;

    const bar = document.createElement("div");
    bar.className = "course-progress";
    const fill = document.createElement("i");
    fill.style.width = `${total ? (learned / total) * 100 : 0}%`;
    bar.append(fill);

    const meta = document.createElement("div");
    meta.className = "course-meta";
    meta.textContent = `已学 ${learned} / ${total}`;

    card.append(title, subtitle, bar, meta);
    card.addEventListener("click", () => openLesson(lesson.id));
    courseList.append(card);
  }
}

function openLesson(id) {
  currentLessonId = id;
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) return;

  const learned = learnedSet(id);
  const firstUnlearned = lesson.items.findIndex(
    (_, index) => !learned.has(index)
  );
  currentIndex = firstUnlearned === -1 ? 0 : firstUnlearned;

  courseList.hidden = true;
  lessonView.hidden = false;
  renderLessonItem();
}

function renderLessonItem() {
  const lesson = lessons.find((item) => item.id === currentLessonId);
  if (!lesson) return;

  const item = lesson.items[currentIndex];
  if (!item) return;

  lessonProgress.textContent = `${lesson.title} · 第 ${currentIndex + 1} / ${lesson.items.length} 句`;
  lessonBeijing.textContent = item.beijing;
  lessonPinyin.textContent = item.pinyin || "";
  lessonStandard.textContent = item.standard
    ? `普通话：${item.standard}`
    : "";
  lessonExplain.textContent = item.explain || "";
  lessonExample.textContent = item.example ? `例句：${item.example}` : "";

  lessonPrevBtn.disabled = currentIndex === 0;
  lessonNextBtn.disabled = currentIndex === lesson.items.length - 1;

  const learned = learnedSet(lesson.id).has(currentIndex);
  lessonDoneBtn.textContent = learned ? "✓ 已学" : "标记已学";
  lessonDoneBtn.classList.toggle("done", learned);
}

async function playLessonItem() {
  const lesson = lessons.find((item) => item.id === currentLessonId);
  const item = lesson?.items?.[currentIndex];
  if (!item) return;

  hint.textContent = "正在生成语音…";
  const result = await api.speak?.(item.beijing, { rate: 1 });

  if (!result?.ok) {
    hint.textContent = result?.error || "朗读失败";
    return;
  }

  stopAudio();

  const blob = new Blob([result.audio], {
    type: result.mime || "audio/mpeg",
  });
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;

  audio.addEventListener(
    "ended",
    () => {
      URL.revokeObjectURL(url);
      if (currentUrl === url) currentUrl = null;
      window.auvOrb?.idle();
    },
    { once: true }
  );

  window.auvOrb?.attachAudio?.(audio);
  audio.play().catch(() => {
    hint.textContent = "播放失败，请再试一次";
    window.auvOrb?.idle();
  });
}

function setTab(tab) {
  const isChat = tab === "chat";
  chatView.hidden = !isChat;
  courseView.hidden = isChat;
  composerRow.hidden = !isChat;
  tabChat.classList.toggle("active", isChat);
  tabCourse.classList.toggle("active", !isChat);

  if (tabIndicator) {
    tabIndicator.style.transform = isChat
      ? "translateX(0)"
      : "translateX(100%)";
  }

  if (!isChat) {
    lessonView.hidden = true;
    courseList.hidden = false;
    renderCourseList();
  }

  stopAudio();
}

tabChat?.addEventListener("click", () => setTab("chat"));
tabCourse?.addEventListener("click", () => setTab("course"));

lessonBackBtn?.addEventListener("click", () => {
  lessonView.hidden = true;
  courseList.hidden = false;
  currentLessonId = null;
  renderCourseList();
});

lessonPrevBtn?.addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderLessonItem();
  }
});

lessonNextBtn?.addEventListener("click", () => {
  const lesson = lessons.find((item) => item.id === currentLessonId);
  if (lesson && currentIndex < lesson.items.length - 1) {
    currentIndex += 1;
    renderLessonItem();
  }
});

lessonPlayBtn?.addEventListener("click", playLessonItem);

lessonDoneBtn?.addEventListener("click", () => {
  const lesson = lessons.find((item) => item.id === currentLessonId);
  if (!lesson) return;

  markLearned(lesson.id, currentIndex);

  if (currentIndex < lesson.items.length - 1) {
    currentIndex += 1;
    renderLessonItem();
  } else {
    renderLessonItem();
    hint.textContent = "这节学完了，回课程看看进度吧";
  }
});

async function loadLessons() {
  try {
    const data = await api.getLessons?.();
    lessons = data?.lessons || [];
  } catch {
    lessons = [];
  }
  renderCourseList();
}

/* ---------- 首次使用动态教程 ---------- */

let tourIndex = -1;
let tourDemoShown = false;

function showTourDemo() {
  if (!card.hidden) return;

  tourDemoShown = true;
  document.querySelector("#r-beijing").textContent = "胸是";
  document.querySelector("#r-pinyin").textContent = "xiōng shi";
  document.querySelector("#r-explain").textContent =
    "西红柿的吞音说法，老北京快说时常用。";
  document.querySelector("#r-changes").replaceChildren();

  const examples = document.querySelector("#r-examples");
  examples.replaceChildren();
  const example = document.createElement("div");
  example.className = "example";
  example.textContent = "这胸是倍儿好吃。";
  examples.append(example);

  card.hidden = false;
  stage.classList.add("has-result");
}

function hideTourDemo() {
  if (!tourDemoShown) return;
  tourDemoShown = false;
  card.hidden = true;
  stage.classList.remove("has-result");
}

const tourSteps = [
  {
    target: "#orb",
    placement: "bottom",
    radius: "50%",
    title: "这是 auv",
    text: "你的北京话助手。点一下光球，可以预览它思考、回答时的动效。",
  },
  {
    target: ".composer-row",
    placement: "top",
    radius: "24px",
    title: "怎么问",
    text: "打字问「西红柿怎么说」，也可以按住右边的麦克风说话，松开自动发送。",
  },
  {
    target: "#card",
    placement: "top",
    radius: "24px",
    title: "看回答",
    text: "这里会给出北京话写法、拼音、为什么这么说，还会自动用京腔读出来。",
    enter: showTourDemo,
    leave: hideTourDemo,
  },
  {
    target: "#tab-course",
    placement: "top",
    radius: "999px",
    title: "课程",
    text: "5 节循序渐进课程，从儿化音到胡同闲聊，可以逐句听、标记已学。",
  },
  {
    target: "#settings-btn",
    placement: "bottom",
    radius: "50%",
    title: "设置",
    text: "第一次使用，先在这里填两把 Key，才能对话和发声。点「下一步」我带你填。",
  },
  {
    target: "#key-input",
    placement: "bottom",
    radius: "16px",
    title: "填 DeepSeek Key",
    text: "对话靠它。打开 platform.deepseek.com → API keys → 创建。Key 只在创建时完整显示一次，列表里是打码的，必须当场复制。",
    enter: openSettingsForTour,
  },
  {
    target: "#test-key",
    placement: "top",
    radius: "999px",
    title: "先测试再保存",
    text: "粘贴后先点「测试连接」，显示 Key 有效，再点保存。Key 会加密存在本机。",
  },
  {
    target: "#qwen-apikey",
    placement: "bottom",
    radius: "16px",
    title: "填百炼 Key",
    text: "京腔朗读和语音识别靠它。打开 bailian.console.aliyun.com（选北京）→ API Key 管理 → 创建；需要实名认证。",
  },
  {
    target: "#test-tts",
    placement: "top",
    radius: "999px",
    title: "测试京腔",
    text: "粘贴后点「测试京腔」，会自动保存并播放一句北京话。听到北京-晓东的声音就成功了。",
  },
  {
    placement: "center",
    title: "可以开始了",
    text: "先问一句「西红柿怎么说」试试。以后想重看，可以在设置里打开教程。",
    enter: closeSettingsForTour,
  },
];

function openSettingsForTour() {
  sheet.hidden = false;
}

function closeSettingsForTour() {
  sheet.hidden = true;
}

function positionTourAt(target, step) {
  const rect = target.getBoundingClientRect();
  const pad = 8;

  tourHole.style.left = `${rect.left - pad}px`;
  tourHole.style.top = `${rect.top - pad}px`;
  tourHole.style.width = `${rect.width + pad * 2}px`;
  tourHole.style.height = `${rect.height + pad * 2}px`;

  requestAnimationFrame(() => {
    const cardRect = tourCard.getBoundingClientRect();
    const gap = 14;
    let left = rect.left + rect.width / 2 - cardRect.width / 2;
    left = Math.max(
      12,
      Math.min(left, window.innerWidth - cardRect.width - 12)
    );

    let top =
      step.placement === "top"
        ? rect.top - cardRect.height - gap
        : rect.bottom + gap;

    top = Math.max(
      12,
      Math.min(top, window.innerHeight - cardRect.height - 12)
    );

    tourCard.style.left = `${left}px`;
    tourCard.style.top = `${top}px`;
  });
}

function showTourStep(index) {
  const step = tourSteps[index];
  if (!step) return;

  tourSteps[tourIndex]?.leave?.();
  tourIndex = index;
  step.enter?.();

  tourStepEl.textContent = `${index + 1} / ${tourSteps.length}`;
  tourTitle.textContent = step.title;
  tourText.textContent = step.text;

  tourDots.replaceChildren();
  tourSteps.forEach((_, dotIndex) => {
    const dot = document.createElement("span");
    dot.className = `tour-dot${dotIndex === index ? " active" : ""}`;
    tourDots.append(dot);
  });

  tourPrev.disabled = index === 0;
  tourNext.textContent =
    index === tourSteps.length - 1 ? "开始使用" : "下一步";

  const target = step.target
    ? document.querySelector(step.target)
    : null;

  if (!target) {
    tour.classList.add("tour-dim");
    tourHole.style.display = "none";
    tourCard.style.left = "50%";
    tourCard.style.top = "50%";
    tourCard.style.transform = "translate(-50%, -50%)";
    return;
  }

  tour.classList.remove("tour-dim");
  tourCard.style.transform = "none";
  tourHole.style.display = "block";
  tourHole.style.borderRadius = step.radius || "20px";

  if (target.closest(".sheet-panel")) {
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => positionTourAt(target, step), 380);
    return;
  }

  positionTourAt(target, step);
}

function startTour() {
  sheet.hidden = true;
  setTab("chat");
  hideTourDemo();

  tour.hidden = false;
  tour.classList.remove("tour-dim");
  tourHole.style.display = "none";
  tourIndex = -1;

  tourCard.style.left = "50%";
  tourCard.style.top = "50%";
  tourCard.style.transform = "translate(-50%, -50%)";

  requestAnimationFrame(() => showTourStep(0));
}

function endTour() {
  tourSteps[tourIndex]?.leave?.();
  hideTourDemo();
  tour.hidden = true;
  tour.classList.remove("tour-dim");
  tourIndex = -1;
  localStorage.setItem("auv.onboarded", "1");
}

tourNext?.addEventListener("click", () => {
  if (tourIndex >= tourSteps.length - 1) {
    endTour();
  } else {
    showTourStep(tourIndex + 1);
  }
});

tourPrev?.addEventListener("click", () => {
  if (tourIndex > 0) showTourStep(tourIndex - 1);
});

tourSkip?.addEventListener("click", endTour);

replayTourBtn?.addEventListener("click", () => {
  closeSheet();
  setTimeout(startTour, 300);
});

loadLessons();
refreshConfig();

if (localStorage.getItem("auv.onboarded") !== "1") {
  setTimeout(startTour, 900);
}

console.log("auv renderer ready · Electron", api.electronVersion ?? "unknown");
