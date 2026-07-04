/* V.A.U.L.T. Voice – Push-to-talk (Space halten), lokale STT/TTS über den Server.
 * Ablauf: Space halten → Mikro aufnehmen → loslassen → /api/voice/command →
 * erkannter Text + passender Task (läuft serverseitig, Events steuern das Gehirn) →
 * gesprochene Bestätigung via /api/voice/tts.
 */
(function () {
  const stateEl = document.getElementById("audio-state");
  const barsEl = document.getElementById("audio-bars");
  const textEl = document.getElementById("voice-text");
  const noteEl = document.getElementById("audio-note");

  let mediaRecorder = null;
  let chunks = [];
  let recording = false;
  let stream = null;
  let audioCtx = null, analyser = null, rafId = null;

  const secure = window.isSecureContext ||
    ["localhost", "127.0.0.1"].includes(location.hostname);

  function setState(s) { stateEl.textContent = s; }
  function setNote(s) { noteEl.textContent = s; }

  if (!secure || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setState("MIC.BLOCKED");
    setNote("Mikro braucht HTTPS oder localhost — siehe docs/OS-PLAN.md §12");
    return; // Voice deaktiviert, HUD läuft normal weiter
  }

  async function ensureStream() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Pegel-Analyse für die Balken
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    return stream;
  }

  function drawBars() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
    barsEl.style.opacity = String(0.4 + avg * 0.6);
    barsEl.style.transform = `scaleY(${1 + avg * 1.6})`;
    rafId = requestAnimationFrame(drawBars);
  }

  async function startRecording() {
    if (recording) return;
    try {
      await ensureStream();
    } catch (_) {
      setState("MIC.DENIED"); setNote("Mikrofon-Zugriff verweigert.");
      return;
    }
    recording = true;
    chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "audio/webm";
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = onStop;
    mediaRecorder.start();
    setState("MIC.LISTENING");
    textEl.textContent = "";
    drawBars();
  }

  function stopRecording(cancel) {
    if (!recording) return;
    recording = false;
    if (rafId) cancelAnimationFrame(rafId);
    barsEl.style.transform = ""; barsEl.style.opacity = "";
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder._cancel = !!cancel;
      mediaRecorder.stop();
    }
  }

  async function onStop() {
    if (mediaRecorder._cancel) { setState("TTS.STANDBY"); return; }
    setState("STT.THINKING");
    const blob = new Blob(chunks, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob, "audio.webm");
    try {
      const r = await fetch("/api/voice/command", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) { setState("STT.ERROR"); textEl.textContent = j.error || "Fehler"; return; }
      textEl.textContent = "„" + (j.text || "…") + "”" + (j.task ? "  → " + j.task : "  (kein Task erkannt)");
      setState("TTS.STANDBY");
      // Gesprochene Bestätigung
      const spoken = j.task ? `Starte ${j.task.replace("-", " ")}.` : "Kein Befehl erkannt.";
      speak(spoken);
    } catch (e) {
      setState("STT.ERROR"); textEl.textContent = String(e);
    }
  }

  function speak(text) {
    try {
      setState("TTS.LIVE");
      const audio = new Audio(`/api/voice/tts?text=${encodeURIComponent(text)}`);
      audio.onended = () => setState("TTS.STANDBY");
      audio.onerror = () => setState("TTS.STANDBY");
      audio.play().catch(() => setState("TTS.STANDBY"));
    } catch (_) { setState("TTS.STANDBY"); }
  }

  // Tasten: Space halten = sprechen, ESC = abbrechen
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && !isTyping(e)) { e.preventDefault(); startRecording(); }
    if (e.code === "Escape") { stopRecording(true); }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && !isTyping(e)) { e.preventDefault(); stopRecording(false); }
  });

  // Mikro-Button (Touch/Mobil): gedrückt halten zum Sprechen
  const micBtn = document.getElementById("mic-btn");
  if (micBtn) {
    micBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault(); micBtn.classList.add("rec"); startRecording();
    });
    const end = () => { micBtn.classList.remove("rec"); stopRecording(false); };
    micBtn.addEventListener("pointerup", end);
    micBtn.addEventListener("pointerleave", end);
    micBtn.addEventListener("pointercancel", end);
  }
  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  setState("TTS.STANDBY");
})();
