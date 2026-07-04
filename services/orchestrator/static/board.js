/* V.A.U.L.T. Kanban-Board – autonome Projekte, Karten, Bewertung. */
(function () {
  const COLS = [
    { id: "todo", label: "TO-DO" },
    { id: "doing", label: "DOING" },
    { id: "review", label: "REVIEW" },
    { id: "done", label: "DONE" },
    { id: "failed", label: "FAILED" },
  ];
  const FLOW = ["backlog", "todo", "doing", "review", "done"];

  const view = document.getElementById("board-view");
  const cols = document.getElementById("board-cols");
  const sel = document.getElementById("proj-select");
  const autoT = document.getElementById("auto-toggle");
  const execBadge = document.getElementById("exec-badge");
  let data = { projects: [] };
  let active = null;      // projekt-id
  let visible = false;
  let poll = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- View-Umschalter ----
  document.getElementById("viewswitch").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (!b) return;
    document.querySelectorAll("#viewswitch button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const board = b.dataset.view === "board";
    document.body.classList.toggle("view-board", board);
    visible = board;
    if (board) { load(); startPoll(); } else { stopPoll(); }
  });

  function startPoll() { stopPoll(); poll = setInterval(() => visible && load(), 4000); }
  function stopPoll() { if (poll) clearInterval(poll); poll = null; }
  window.addEventListener("vault-board", () => visible && load());

  // Live-Log: relevante Events unten im Board mitschreiben
  const logEl = document.getElementById("board-log");
  window.addEventListener("vault-log", (e) => {
    const m = e.detail || {};
    const t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const label = m.type === "coder" ? "coder" : m.type === "backup" ? "backup"
      : m.type === "model" ? "modell" : m.type;
    const extra = m.role ? ` ${m.role}` : m.attempt ? ` #${m.attempt}` : m.model ? ` ${m.model}` : "";
    const line = `[${t}] ${label} · ${m.state || ""}${extra}${m.error ? " – " + m.error : ""}`;
    const div = document.createElement("div");
    div.textContent = line;
    logEl.appendChild(div);
    while (logEl.childElementCount > 60) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  });

  async function load() {
    try {
      data = await fetch("/api/board").then((r) => r.json());
    } catch (_) { return; }
    autoT.checked = !!data.autonomous;
    execBadge.textContent = "EXECUTOR · " + (data.executor ? "BEREIT" : "AUS");
    execBadge.classList.toggle("on", !!data.executor);
    if (!active || !data.projects.find((p) => p.id === active)) {
      active = data.projects[0] ? data.projects[0].id : null;
    }
    sel.innerHTML = data.projects.map((p) =>
      `<option value="${p.id}" ${p.id === active ? "selected" : ""}>${esc(p.title)}</option>`).join("")
      || '<option value="">— kein Projekt —</option>';
    render();
  }

  function project() { return data.projects.find((p) => p.id === active); }

  function render() {
    const p = project();
    const cards = p ? p.cards : [];
    cols.innerHTML = COLS.map((col) => {
      const inCol = cards.filter((c) => c.status === col.id);
      return `<div class="col"><div class="col-head">${col.label}
        <span>${inCol.length}</span></div>
        <div class="col-body">${inCol.map((c) => cardHtml(c)).join("") ||
          '<div class="empty">—</div>'}</div></div>`;
    }).join("");
    bind();
  }

  function stars(c) {
    let s = "";
    for (let i = 1; i <= 5; i++)
      s += `<span class="star ${i <= c.rating ? "on" : ""}" data-c="${c.id}" data-r="${i}">★</span>`;
    return `<div class="stars">${s}</div>`;
  }

  function cardHtml(c) {
    const idx = FLOW.indexOf(c.status);
    const left = idx > 0 ? `<button class="mv" data-c="${c.id}" data-s="${FLOW[idx - 1]}">◀</button>` : "";
    const right = idx >= 0 && idx < FLOW.length - 1
      ? `<button class="mv" data-c="${c.id}" data-s="${FLOW[idx + 1]}">▶</button>` : "";
    const rate = (c.status === "review" || c.status === "done") ? stars(c) : "";
    const res = c.result ? `<button class="lnk" data-detail="${c.id}">Ergebnis ansehen</button>` : "";
    const err = c.error ? `<div class="c-err">${esc(c.error).slice(0, 140)}</div>` : "";
    return `<div class="card2 ${c.status}">
      <div class="c-title">${esc(c.title)}</div>
      ${c.detail ? `<div class="c-detail">${esc(c.detail)}</div>` : ""}
      ${err}${rate}${res}
      <div class="c-actions">${left}${right}
        <button class="del" data-c="${c.id}" title="löschen">✕</button></div>
    </div>`;
  }

  function bind() {
    cols.querySelectorAll(".mv").forEach((b) => b.onclick = () =>
      patch(b.dataset.c, { status: b.dataset.s }));
    cols.querySelectorAll(".del").forEach((b) => b.onclick = () => delCard(b.dataset.c));
    cols.querySelectorAll(".star").forEach((s) => s.onclick = () =>
      patch(s.dataset.c, { rating: +s.dataset.r }));
    cols.querySelectorAll("[data-detail]").forEach((b) => b.onclick = () => showDetail(b.dataset.detail));
  }

  async function patch(cid, body) {
    await fetch(`/api/board/projects/${active}/cards/${cid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    load();
  }
  async function delCard(cid) {
    if (!confirm("Karte löschen?")) return;
    await fetch(`/api/board/projects/${active}/cards/${cid}`, { method: "DELETE" });
    load();
  }
  function showDetail(cid) {
    const c = project().cards.find((x) => x.id === cid);
    if (window.VaultModal) window.VaultModal(c.title, `<pre class="result">${esc(c.result)}</pre>`);
    else alert(c.result);
  }

  // ---- Steuerleiste ----
  sel.addEventListener("change", () => { active = sel.value; render(); });
  autoT.addEventListener("change", async () => {
    await fetch("/api/board/autonomous", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: autoT.checked }) });
  });
  document.getElementById("proj-add").onclick = async () => {
    const title = prompt("Projekt-Titel:"); if (!title) return;
    const goal = prompt("Ziel (was soll erreicht werden?):") || "";
    const isCode = confirm("Ist das ein CODE-Projekt? (dann testet der Agent den Code real)");
    let runner = null, network = false;
    if (isCode) {
      runner = (prompt("Runner: python / node / web / python-deps", "python") || "python").trim();
      network = ["web", "python-deps"].includes(runner) ||
        confirm("Netzwerk im Container erlauben? (für pip/npm install, API-Tests)");
    }
    const p = await fetch("/api/board/projects", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, goal, type: isCode ? "code" : "general", runner, network }) })
      .then((r) => r.json());
    active = p.id; load();
  };
  document.getElementById("proj-del").onclick = async () => {
    if (!active || !confirm("Ganzes Projekt löschen?")) return;
    await fetch(`/api/board/projects/${active}`, { method: "DELETE" });
    active = null; load();
  };
  document.getElementById("proj-plan").onclick = async () => {
    if (!active) return;
    await fetch(`/api/board/projects/${active}/plan`, { method: "POST" });
    setTimeout(load, 1500);
  };
  document.getElementById("card-add").onclick = async () => {
    if (!active) return alert("Erst ein Projekt anlegen.");
    const title = prompt("Karten-Titel (Aufgabe):"); if (!title) return;
    const detail = prompt("Details (optional):") || "";
    await fetch(`/api/board/projects/${active}/cards`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, detail }) });
    load();
  };
})();
