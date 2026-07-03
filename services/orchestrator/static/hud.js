/* V.A.U.L.T. HUD – verbindet sich per WebSocket mit dem Orchestrator,
 * steuert Gehirn-Zustand, Command Deck und Statuszeile.
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
    const core = coreState.toUpperCase();
    statusline.querySelector('[data-k="core"]').innerHTML = `● CORE · <b>${core}</b>`;
    statusline.querySelector('[data-k="link"]').innerHTML =
      `LINK · <b>${connected ? "ONLINE" : "OFFLINE"}</b>`;
    statusline.querySelector('[data-k="runner"]').innerHTML =
      `RUNNER · <b>${activeTasks > 0 ? "WORKING" : "IDLE"}</b>`;
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
    if (deck.childElementCount === tasks.length) return; // nur einmal bauen
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
    // Karte oben anzeigen
    taskcard.hidden = false;
    taskTitle.textContent = (msg.title || msg.id || "").toUpperCase();
    const labels = { queued: "eingereiht", thinking: "denkt …", writing: "schreibt …",
                     done: "fertig ✓", error: "Fehler: " + (msg.error || "") };
    taskState.textContent = labels[msg.state] || msg.state;

    const btn = deck.querySelector(`.deck-btn[data-id="${msg.id}"]`);
    if (msg.state === "queued" || msg.state === "thinking" || msg.state === "writing") {
      activeTasks = Math.max(activeTasks, 1);
    }
    if (msg.state === "done" || msg.state === "error") {
      activeTasks = Math.max(0, activeTasks - 1);
      if (btn) btn.classList.remove("running");
      setTimeout(() => { if (activeTasks === 0) taskcard.hidden = true; }, 3500);
    }
    applyState();
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
      setTimeout(connect, 2000); // reconnect
    };
    ws.onerror = () => ws.close();
  }

  applyState();
  connect();
})();
