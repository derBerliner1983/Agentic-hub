/* V.A.U.L.T. HUD – WebSocket-Client: steuert Gehirn, Command Deck,
 * Statuszeile und die linke Vitals-Spalte.
 */
(function () {
  const brain = new Brain(document.getElementById("brain"));
  const body = document.body;
  const deck = document.getElementById("deck");
  const deckMeta = document.getElementById("deck-meta");
  const hint = document.getElementById("hint");
  const statusline = document.getElementById("statusline");
  const taskcard = document.getElementById("taskcard");
  const taskTitle = document.getElementById("taskcard-title");
  const taskState = document.getElementById("taskcard-state");

  let connected = false;
  let activeTasks = 0;

  // Uhr
  const clock = document.getElementById("clock");
  setInterval(() => {
    clock.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }, 1000);

  function setStatusline(coreState) {
    statusline.querySelector('[data-k="core"]').innerHTML = `● CORE · <b>${coreState.toUpperCase()}</b>`;
    statusline.querySelector('[data-k="link"]').innerHTML = `LINK · <b>${connected ? "ONLINE" : "OFFLINE"}</b>`;
    statusline.querySelector('[data-k="runner"]').innerHTML = `RUNNER · <b>${activeTasks > 0 ? "WORKING" : "IDLE"}</b>`;
  }

  function applyState() {
    if (!connected) {
      brain.setState("offline"); body.dataset.state = "offline"; setStatusline("offline");
      hint.style.opacity = "1";
    } else if (activeTasks > 0) {
      brain.setState("working"); body.dataset.state = "working"; setStatusline("working");
      hint.style.opacity = "0";
    } else {
      brain.setState("idle"); body.dataset.state = "idle"; setStatusline("idle");
      hint.style.opacity = "0";
    }
  }

  function renderDeck(tasks) {
    if (deck.childElementCount === tasks.length) return;
    deck.innerHTML = "";
    tasks.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "deck-btn";
      btn.textContent = t.title;
      btn.dataset.id = t.id;
      btn.disabled = !connected;
      btn.addEventListener("click", () => runTask(t.id, btn));
      deck.appendChild(btn);
    });
  }

  function setDeckEnabled() {
    deck.querySelectorAll(".deck-btn").forEach((b) => (b.disabled = !connected));
    deckMeta.textContent = connected ? "· online" : "· offline";
  }

  async function runTask(id, btn) {
    if (!connected) return;
    btn.classList.add("running");
    await fetch(`/api/tasks/${id}/run`, { method: "POST" }).catch(() => {});
  }

  function handleStatus(msg) {
    connected = !!msg.connected;
    renderDeck(msg.tasks || []);
    setDeckEnabled();
    applyState();
    if (!connected && msg.providers && msg.providers[0] && msg.providers[0].error) {
      hint.innerHTML = msg.providers[0].error;
    }
  }

  const _stream = {};   // task-id → akkumulierter Text (Live-Streaming)
  function handleTask(msg) {
    taskcard.hidden = false;
    taskTitle.textContent = (msg.title || msg.id || "").toUpperCase();
    if (msg.state === "stream") {
      _stream[msg.id] = (_stream[msg.id] || "") + (msg.chunk || "");
      taskState.textContent = "✎ " + _stream[msg.id].slice(-140).replace(/\s+/g, " ");
      activeTasks = Math.max(activeTasks, 1);
      if (msg.domain) brain.setActiveDomain(msg.domain);
      applyState();
      return;
    }
    const labels = { queued: "eingereiht", scheduled: "geplant · startet …",
                     thinking: "denkt …", writing: "schreibt …",
                     done: "fertig ✓", error: "Fehler: " + (msg.error || "") };
    taskState.textContent = labels[msg.state] || msg.state;

    const btn = deck.querySelector(`.deck-btn[data-id="${msg.id}"]`);
    if (["queued", "scheduled", "thinking", "writing"].includes(msg.state)) {
      activeTasks = Math.max(activeTasks, 1);
      if (msg.domain) brain.setActiveDomain(msg.domain);   // Hirn-Segment aktivieren
    }
    if (msg.state === "done" || msg.state === "error") {
      delete _stream[msg.id];
      activeTasks = Math.max(0, activeTasks - 1);
      if (btn) btn.classList.remove("running");
      if (activeTasks === 0) brain.setActiveDomain(null);
      if (msg.state === "done") loadVitals();                // Vault hat sich geändert
      setTimeout(() => { if (activeTasks === 0) taskcard.hidden = true; }, 3500);
    }
    applyState();
  }

  function handleProject(msg) {
    taskcard.hidden = false;
    taskTitle.textContent = "PROJEKT · " + (msg.goal || "");
    const map = {
      queued: "eingereiht", planning: "plant …", planned: `Plan: ${(msg.steps || []).length} Schritte`,
      step: `Schritt ${msg.index}/${msg.total} · ${msg.role}`, hire: `stellt ${msg.role} ein (${msg.model})`,
      fixing: `bessert nach (Runde ${msg.round})`, writing: "schreibt …",
      done: `fertig ✓ (${msg.steps_done} Schritte)`, error: "Fehler: " + (msg.error || ""),
    };
    taskState.textContent = map[msg.state] || msg.state;
    if (msg.role) brain.setActiveDomain(msg.role === "coder" ? "research" : "ops");
    if (["queued", "planning", "planned", "step", "hire", "fixing", "writing"].includes(msg.state)) {
      activeTasks = Math.max(activeTasks, 1);
    }
    if (msg.state === "done" || msg.state === "error") {
      activeTasks = 0; brain.setActiveDomain(null); loadVitals();
      setTimeout(() => { if (activeTasks === 0) taskcard.hidden = true; }, 5000);
    }
    applyState();
  }

  function handleModel(msg) {
    if (msg.state === "pulling") {
      taskcard.hidden = false;
      taskTitle.textContent = "MODELL LADEN";
      taskState.textContent = `lädt ${msg.model} …`;
    }
  }

  function handleBoard(msg) {
    if (msg.state === "doing") {
      taskcard.hidden = false;
      taskTitle.textContent = "AUTONOM · " + (msg.title || "");
      taskState.textContent = "arbeitet …";
      activeTasks = 1; brain.setActiveDomain("ops"); applyState();
    } else if (msg.state === "review" || msg.state === "done" || msg.state === "failed") {
      taskState.textContent = msg.state === "failed" ? "fehlgeschlagen" : "→ Review ✓";
      activeTasks = 0; brain.setActiveDomain(null); applyState();
      setTimeout(() => { if (activeTasks === 0) taskcard.hidden = true; }, 3500);
    }
  }

  function handleCoder(msg) {
    taskcard.hidden = false;
    taskTitle.textContent = "CODER · SELBSTTEST";
    const m = { starting: "schreibt Code …", running: `führt aus (Versuch ${msg.attempt}) …`,
      fixing: `fixt Fehler (Versuch ${msg.attempt}) …`, passed: "läuft ✓",
      failed: "Limit erreicht ✕", skipped: "Executor aus" };
    taskState.textContent = m[msg.state] || msg.state;
    if (["starting", "running", "fixing"].includes(msg.state)) {
      activeTasks = 1; brain.setActiveDomain("research"); applyState();
    }
  }

  // ---- linke Spalte: Vitals ----------------------------------------------
  async function loadVitals() {
    try {
      const r = await fetch("/api/vitals");
      const v = await r.json();
      document.getElementById("v-model").textContent = v.model || "—";
      document.getElementById("v-notes").textContent = v.notes;
      document.getElementById("v-runs").textContent = v.runs_today;

      const dir = document.getElementById("v-directives");
      dir.innerHTML = (v.directives && v.directives.length)
        ? v.directives.map((d) => `<li class="${d.done ? "done" : ""}">${escapeHtml(d.text)}</li>`).join("")
        : '<li class="muted">keine Directives</li>';

      const docs = document.getElementById("v-documents");
      docs.innerHTML = (v.recent_docs && v.recent_docs.length)
        ? v.recent_docs.map((d) =>
            `<li><span class="doc-name">${escapeHtml(d.name)}</span><span class="doc-ago">${d.ago}</span></li>`).join("")
        : '<li class="muted">noch keine Dokumente</li>';
    } catch (_) { /* Server evtl. noch nicht bereit */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "status") handleStatus(msg);
      else if (msg.type === "task") handleTask(msg);
      else if (msg.type === "project") handleProject(msg);
      else if (msg.type === "model") handleModel(msg);
      else if (msg.type === "board" || msg.type === "coder") {
        window.dispatchEvent(new CustomEvent("vault-board"));
        if (msg.type === "coder") handleCoder(msg);
        else handleBoard(msg);
      }
      // Live-Log fürs Board (alle relevanten Events)
      if (["board", "coder", "model", "project", "backup"].includes(msg.type)) {
        window.dispatchEvent(new CustomEvent("vault-log", { detail: msg }));
      }
    };
    ws.onclose = () => {
      connected = false; applyState(); setDeckEnabled();
      setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
  }

  applyState();
  // Deck sofort per HTTP befüllen – Buttons erscheinen auch, wenn der WebSocket lahmt
  fetch("/api/status").then((r) => r.json()).then(handleStatus).catch(() => {});
  connect();
  loadVitals();
  setInterval(loadVitals, 12000);
})();
