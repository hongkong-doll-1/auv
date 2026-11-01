const path = require("node:path");
const fs = require("node:fs");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

(async () => {
  const outDir = path.join(__dirname, "..", "tmp", "tts-smoke");
  fs.mkdirSync(outDir, { recursive: true });

  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 15000,
    synthesisTimeoutMs: 60000,
  });

  await tts.setMetadata(
    "zh-CN-XiaoxiaoNeural",
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );

  const result = await tts.toFile(
    outDir,
    "西红柿怎么说？今儿天儿不错，出去遛弯儿吧。"
  );

  const file = path.join(outDir, "audio.mp3");
  const size = fs.statSync(file).size;
  console.log("OK", JSON.stringify(result), "size=", size);
})().catch((error) => {
  console.error("FAIL", error?.name, error?.message);
  process.exitCode = 1;
});
