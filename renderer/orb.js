(() => {
  const wrap = document.getElementById("orb");
  const motion = wrap?.querySelector(".orb-motion");
  if (!wrap || !motion) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const phase = () => Math.random() * Math.PI * 2;
  const seed = [phase(), phase(), phase(), phase()];

  let state = "idle";
  let amplitude = 0;
  let speakingUntil = 0;
  let audioAnalyser = null;
  let audioData = null;
  let audioContext = null;

  // 原地随机转动（每隔几秒换一个目标，平滑过渡）
  let wanderR = 0;
  let targetR = 0;
  let nextWander = 0;

  // 鼠标互动
  let hover = 0;
  let targetHover = 0;
  let tiltX = 0;
  let tiltY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let specX = 0;
  let specY = 0;
  let targetSpecX = 0;
  let targetSpecY = 0;

  const start = performance.now();
  let raf = 0;

  // 多层不同频率的正弦叠加 = 长时间不重复的平滑噪声
  function noise(t, s) {
    return (
      Math.sin(t * 0.00042 + s) * 0.6 +
      Math.sin(t * 0.00097 + s * 1.7) * 0.3 +
      Math.sin(t * 0.00181 + s * 2.3) * 0.12
    );
  }

  function setState(next) {
    state = next;
    wrap.dataset.state = next;
  }

  function onPointerMove(event) {
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (event.clientX - cx) / Math.max(rect.width, 1);
    const dy = (event.clientY - cy) / Math.max(rect.height, 1);
    const distance = Math.hypot(event.clientX - cx, event.clientY - cy);
    const near = Math.max(0, 1 - distance / 340);

    targetHover = near;
    targetTiltX = Math.max(-1, Math.min(1, -dy)) * 7 * near;
    targetTiltY = Math.max(-1, Math.min(1, dx)) * 9 * near;
    targetSpecX = Math.max(-1, Math.min(1, dx)) * 16 * near;
    targetSpecY = Math.max(-1, Math.min(1, dy)) * 12 * near;
  }

  function onPointerLeave() {
    targetHover = 0;
    targetTiltX = 0;
    targetTiltY = 0;
    targetSpecX = 0;
    targetSpecY = 0;
  }

  function frame(now) {
    const t = now - start;

    if (now > nextWander) {
      targetR = (Math.random() - 0.5) * 3;
      nextWander = now + 1800 + Math.random() * 4200;
    }
    wanderR += (targetR - wanderR) * 0.025;

    // 鼠标影响平滑过渡
    hover += (targetHover - hover) * 0.08;
    tiltX += (targetTiltX - tiltX) * 0.07;
    tiltY += (targetTiltY - tiltY) * 0.07;
    specX += (targetSpecX - specX) * 0.07;
    specY += (targetSpecY - specY) * 0.07;

    const rot = wanderR + noise(t, seed[2]) * 2.2;
    // 慢呼吸：约 6 秒一次
    const breath = Math.sin(t * 0.00105) * 0.035;
    let scale = 1 + noise(t, seed[3]) * 0.022 + breath + hover * 0.045;

    if (audioAnalyser) {
      // 用真实语音波形驱动球体起伏
      audioAnalyser.getByteTimeDomainData(audioData);
      let sum = 0;
      for (let i = 0; i < audioData.length; i += 1) {
        const sample = (audioData[i] - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / audioData.length);
      amplitude += (Math.min(1, rms * 2.4) - amplitude) * 0.25;
    } else if (state === "speaking") {
      // 没有音频时用模拟节奏包络
      const env =
        0.5 +
        0.3 * Math.sin(t * 0.013) +
        0.2 * Math.sin(t * 0.029 + 1.7);
      amplitude += (Math.max(0.12, env) - amplitude) * 0.22;
      if (now > speakingUntil) setState("idle");
    } else {
      amplitude += (0 - amplitude) * 0.15;
    }

    if (state === "thinking") {
      scale += Math.sin(t * 0.006) * 0.012;
    }

    scale += amplitude * 0.1;

    motion.style.setProperty("--mx", "0px");
    motion.style.setProperty("--my", "0px");
    motion.style.setProperty("--mr", rot.toFixed(2) + "deg");
    motion.style.setProperty("--ms", scale.toFixed(4));
    motion.style.setProperty("--rx", tiltX.toFixed(2) + "deg");
    motion.style.setProperty("--ry", tiltY.toFixed(2) + "deg");
    wrap.style.setProperty("--specX", specX.toFixed(2) + "px");
    wrap.style.setProperty("--specY", specY.toFixed(2) + "px");

    raf = requestAnimationFrame(frame);
  }

  // 供后续接入 AI / 语音使用
  window.auvOrb = {
    idle() {
      setState("idle");
    },
    think() {
      setState("thinking");
    },
    speak(ms = 2400) {
      setState("speaking");
      speakingUntil = performance.now() + ms;
    },
    attachAudio(element) {
      try {
        if (audioContext) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }

        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(element);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioContext = ctx;
        audioAnalyser = analyser;
        audioData = new Uint8Array(analyser.fftSize);
        setState("speaking");

        const release = () => {
          audioAnalyser = null;
          setState("idle");
          ctx.close().catch(() => {});
          if (audioContext === ctx) audioContext = null;
        };

        element.addEventListener("ended", release, { once: true });
        element.addEventListener("error", release, { once: true });

        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      } catch {
        audioAnalyser = null;
      }
    },
    listen(stream) {
      try {
        if (audioContext) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }

        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContext = ctx;
        audioAnalyser = analyser;
        audioData = new Uint8Array(analyser.fftSize);
        setState("listening");

        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      } catch {
        audioAnalyser = null;
      }
    },
    stopListening() {
      audioAnalyser = null;
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      setState("idle");
    },
    stopAudio() {
      audioAnalyser = null;
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      setState("idle");
    },
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });

  if (reduceMotion) {
    setState("idle");
    return;
  }

  raf = requestAnimationFrame(frame);
})();
