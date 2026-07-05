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

  // Pegel-Balken aufbauen (echte Anzeige: klein bei Stille, groß bei lauter Stimme)
  const BAR_COUNT = 30;
  const bars = [];
  if (barsEl) {
    barsEl.innerHTML = "";
    for (let i = 0; i < BAR_COUNT; i++) {
      const b = document.createElement("i");
      barsEl.appendChild(b);
      bars.push(b);
    }
  }
  function meterLoop() {
    if (analyser && recording) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const bins = data.length;
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = (data[Math.floor((i / BAR_COUNT) * bins)] || 0) / 255;   // 0..1
        bars[i].style.height = (5 + v * 95) + "%";
      }
    } else {
      for (let i = 0; i < BAR_COUNT; i++) bars[i].style.height = "5%";
    }
    requestAnimationFrame(meterLoop);
  }
  if (bars.length) meterLoop();

  async function ensureStream() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;      // 64 Frequenz-Bins → feine Balken
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    return stream;
  }

  async function startRecording() {
    if (recording) return;
    if (window._vaultPauseHF) window._vaultPauseHF();   // Freihand kurz pausieren (Mikro frei)
    try {
      await ensureStream();
    } catch (_) {
      setState("MIC.DENIED"); setNote("Mikrofon-Zugriff verweigert.");
      if (window._vaultResumeHF) window._vaultResumeHF();
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
  }

  function stopRecording(cancel) {
    if (!recording) return;
    recording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder._cancel = !!cancel;
      mediaRecorder.stop();
    }
  }

  async function onStop() {
    if (window._vaultResumeHF) setTimeout(window._vaultResumeHF, 400);   // Freihand wieder an
    if (mediaRecorder._cancel) { setState("TTS.STANDBY"); return; }
    setState("STT.THINKING");
    const blob = new Blob(chunks, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob, "audio.webm");
    try {
      const r = await fetch("/api/voice/command", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) { setState("STT.ERROR"); textEl.textContent = j.error || "Fehler"; return; }
      textEl.textContent = "„" + (j.text || "…") + "”";
      setState("TTS.STANDBY");
      // Antwort vorlesen (bei Frage) bzw. Kurzbestätigung (bei Kommando)
      if (j.task) speak(`Starte ${j.task.replace("-", " ")}.`);
      else if (j.answer) speak(j.answer);
      else if (j.answered) speak("Ich habe leider keine Antwort gefunden.");
      else speak("Ich habe nichts verstanden.");
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

  // ---- Freihand-Modus mit Weckwort (Browser-Spracherkennung) --------------
  // Hört durchgehend; sobald das Weckwort fällt, wird der Rest als Befehl gesendet.
  // Nutzt die Web-Speech-API (Chrome/Edge). Push-to-talk (oben) bleibt lokal via Whisper.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null, handsFree = false, wakeWord = "";

  async function loadWake() {
    try {
      const s = await fetch("/api/settings").then((r) => r.json());
      wakeWord = (s.wake_word || "").trim().toLowerCase();
    } catch (_) { wakeWord = ""; }
  }

  function sendText(text) {
    setState("STT.THINKING");
    textEl.textContent = "„" + text + "”";
    fetch("/api/voice/text", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }) }).then((r) => r.json()).then((j) => {
      setState("TTS.STANDBY");
      if (j.task) speak("Erledigt.");
      else if (j.answer) speak(j.answer);           // Antwort vorlesen
      else speak("Ich habe keine Antwort gefunden.");
    }).catch(() => setState("TTS.STANDBY"));
  }

  function startHandsFree() {
    if (!SR || !wakeWord) return false;
    recog = new SR();
    recog.lang = "de-DE"; recog.continuous = true; recog.interimResults = false;
    recog.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = (e.results[i][0].transcript || "").toLowerCase().trim();
        const at = t.indexOf(wakeWord);
        if (at !== -1) {
          const cmd = t.slice(at + wakeWord.length).replace(/^[\s,\.:]+/, "").trim();
          if (cmd) sendText(cmd);
        }
      }
    };
    recog.onerror = (e) => {
      // Ohne Mikro-Erlaubnis/Nutzer-Geste → nicht endlos neu starten, Button anbieten
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) {
        handsFree = false;
        if (hfBtn) hfBtn.classList.remove("on");
        setNote("Freihand: bitte Mikro erlauben und 👂 antippen.");
      }
    };
    recog.onend = () => { if (handsFree) { try { recog.start(); } catch (_) {} } };
    try { recog.start(); return true; } catch (_) { return false; }
  }
  function stopHandsFree() { handsFree = false; if (recog) { try { recog.stop(); } catch (_) {} } }

  // Freihand während Push-to-talk pausieren (Mikro nicht doppelt belegen)
  let _hfPaused = false;
  window._vaultPauseHF = () => { if (handsFree) { _hfPaused = true; handsFree = false; if (recog) { try { recog.stop(); } catch (_) {} } } };
  window._vaultResumeHF = () => { if (_hfPaused) { _hfPaused = false; enableHandsFree(); } };

  const hfBtn = document.getElementById("handsfree-btn");
  function enableHandsFree() {
    if (!SR) { setNote("Freihand braucht Chrome/Edge (Web-Speech)."); return false; }
    if (!wakeWord) { setNote("Erst ein Weckwort in den Einstellungen setzen."); return false; }
    handsFree = true;
    if (startHandsFree()) {
      if (hfBtn) hfBtn.classList.add("on");
      setNote(`Freihand an – sag „${wakeWord} …“`);
      return true;
    }
    handsFree = false;
    setNote("Freihand: Mikro erlauben und 👂 antippen.");
    return false;
  }
  if (hfBtn) {
    hfBtn.addEventListener("click", async () => {
      if (handsFree) { stopHandsFree(); hfBtn.classList.remove("on"); setNote("Freihand aus."); return; }
      await loadWake();
      enableHandsFree();
    });
  }

  // Ist ein Weckwort gesetzt → Freihand automatisch starten (kein Space/Klick nötig).
  // Klappt der Autostart nicht (Mikro-Erlaubnis fehlt), reicht ein Tipp auf 👂.
  (async function autoHandsFree() {
    await loadWake();
    if (SR && wakeWord) enableHandsFree();
  })();

  setState("TTS.STANDBY");
})();
