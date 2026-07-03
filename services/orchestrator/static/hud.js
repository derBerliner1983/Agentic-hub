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

  function handleTask(msg) {
    taskcard.hidden = false;
    taskTitle.textContent = (msg.title || msg.id || "").toUpperCase();
    const labels = { queued: "eingereiht", thinking: "denkt …", writing: "schreibt …",
                     done: "fertig ✓", error: "Fehler: " + (msg.error || "") };
    taskState.textContent = labels[msg.state] || msg.state;

    const btn = deck.querySelector(`.deck-btn[data-id="${msg.id}"]`);
    if (["queued", "thinking", "writing"].includes(msg.state)) {
      activeTasks = Math.max(activeTasks, 1);
      if (msg.domain) brain.setActiveDomain(msg.domain);   // Hirn-Segment aktivieren
    }
    if (msg.state === "done" || msg.state === "error") {
      activeTasks = Math.max(0, activeTasks - 1);
      if (btn) btn.classList.remove("running");
      if (activeTasks === 0) brain.setActiveDomain(null);
      if (msg.state === "done") loadVitals();                // Vault hat sich geändert
      setTimeout(() => { if (activeTasks === 0) taskcard.hidden = true; }, 3500);
    }
    applyState();
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
    };
    ws.onclose = () => {
      connected = false; applyState(); setDeckEnabled();
      setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
  }

  applyState();
  connect();
  loadVitals();
  setInterval(loadVitals, 12000);
})();
