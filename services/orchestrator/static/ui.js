/* V.A.U.L.T. UI – Builder (Tasks/Skills), Settings (Provider), Projekt-Launcher, Update. */
(function () {
  const root = document.getElementById("modal-root");
  const modal = document.getElementById("modal");
  const titleEl = document.getElementById("modal-title");
  const bodyEl = document.getElementById("modal-body");

  function open(title, html) {
    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    root.hidden = false;
  }
  function close() { root.hidden = true; }
  window.VaultModal = open;   // von board.js für Detail-Ansicht genutzt
  document.getElementById("modal-close").addEventListener("click", close);
  root.addEventListener("click", (e) => { if (e.target === root) close(); });

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- BUILDER (Tasks aus Skills bauen + Skills anlegen) -------------------
  async function openBuilder() {
    const [skills, tasks, models] = await Promise.all([
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()).catch(() => ({ available: [] })),
    ]);
    const skillOpts = skills.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    const modelOpts = '<option value="">Standard</option>' +
      (models.available || []).map((m) => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join("");
    open("Builder", `
      <div class="b-cols">
        <section>
          <h4>Neuen Task bauen</h4>
          <label>Titel <input id="t-title" placeholder="z. B. Konkurrenz-Report"/></label>
          <label>Domäne
            <select id="t-domain">
              <option>inbox</option><option>research</option>
              <option>content</option><option selected>ops</option>
            </select>
          </label>
          <label>Modell (optional) <select id="t-model">${modelOpts}</select></label>
          <label>Zeitplan (Cadence)</label>
          <div class="row">
            <select id="t-sched">
              <option value="off">on-demand</option>
              <option value="interval">alle N Minuten</option>
              <option value="daily">täglich um HH:MM</option>
            </select>
            <input id="t-schedval" style="max-width:120px" placeholder="60 · 07:00" />
          </div>
          <label>Schritte (Skills, Reihenfolge = Ausführung)</label>
          <div id="t-steps" class="steps"></div>
          <div class="row">
            <select id="t-skillpick">${skillOpts || '<option value="">— keine Skills —</option>'}</select>
            <button class="btn" id="t-addskill">+ Skill</button>
            <button class="btn" id="t-addprompt">+ freier Prompt</button>
          </div>
          <button class="btn primary" id="t-save">Task speichern</button>
          <div class="hint2">Vorhandene Tasks: ${tasks.map((t) => esc(t.title)).join(" · ") || "—"}</div>
        </section>
        <section>
          <h4>Neuen Skill anlegen</h4>
          <label>Name <input id="s-name" placeholder="z. B. competitor-scan"/></label>
          <label>Beschreibung (wann nutzen?) <input id="s-desc" placeholder="Kurz…"/></label>
          <label>Anweisung (Schritt-für-Schritt)
            <textarea id="s-body" rows="8" placeholder="1. …&#10;2. …"></textarea></label>
          <button class="btn primary" id="s-save">Skill speichern</button>
          <div class="hint2">Vorhandene Skills: ${skills.map((s) => esc(s.name)).join(" · ") || "—"}</div>
        </section>
      </div>`);

    const steps = [];
    const stepsEl = document.getElementById("t-steps");
    const renderSteps = () => {
      stepsEl.innerHTML = steps.map((s, i) =>
        `<div class="step-chip">${i + 1}. ${s.type === "skill" ? "🧩 " + esc(s.skill) : "✎ Prompt"}
         <button data-i="${i}" class="x">✕</button></div>`).join("") || '<div class="hint2">noch leer</div>';
      stepsEl.querySelectorAll(".x").forEach((b) =>
        b.addEventListener("click", () => { steps.splice(+b.dataset.i, 1); renderSteps(); }));
    };
    renderSteps();
    document.getElementById("t-addskill").onclick = () => {
      const v = document.getElementById("t-skillpick").value;
      if (v) { steps.push({ type: "skill", skill: v }); renderSteps(); }
    };
    document.getElementById("t-addprompt").onclick = () => {
      const p = prompt("Freier Prompt für diesen Schritt:");
      if (p) { steps.push({ type: "prompt", prompt: p }); renderSteps(); }
    };
    document.getElementById("t-save").onclick = async () => {
      const title = document.getElementById("t-title").value.trim();
      if (!title) return alert("Titel fehlt");
      const st = document.getElementById("t-sched").value;
      const sv = document.getElementById("t-schedval").value.trim();
      let schedule = null, cadence = "on-demand";
      if (st === "interval" && sv) { schedule = { type: "interval", minutes: parseInt(sv, 10) || 60 }; cadence = "scheduled"; }
      if (st === "daily" && sv) { schedule = { type: "daily", time: sv }; cadence = "scheduled"; }
      await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, domain: document.getElementById("t-domain").value, steps,
          model: document.getElementById("t-model").value || null, schedule, cadence }),
      });
      close();
    };
    document.getElementById("s-save").onclick = async () => {
      const name = document.getElementById("s-name").value.trim();
      if (!name) return alert("Name fehlt");
      await fetch("/api/skills", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description: document.getElementById("s-desc").value,
          body: document.getElementById("s-body").value,
        }),
      });
      openBuilder();
    };
  }

  // ---- SETTINGS (Provider umschalten) -------------------------------------
  async function openSettings() {
    const s = await fetch("/api/settings").then((r) => r.json());
    const sel = (v) => (s.active_provider === v ? "selected" : "");
    open("Provider-Einstellungen", `
      <label>Aktiver Provider
        <select id="p-active">
          <option value="ollama" ${sel("ollama")}>Ollama (lokal)</option>
          <option value="anthropic" ${sel("anthropic")}>Claude (Anthropic)</option>
          <option value="openai" ${sel("openai")}>OpenAI (ChatGPT)</option>
        </select></label>
      <label>Ollama-URL <input id="p-ollama" value="${esc(s.ollama_url)}"/></label>
      <hr/>
      <label>Anthropic API-Key ${s.anthropic_key_set ? "✓ gesetzt" : ""}
        <input id="p-akey" type="password" placeholder="${s.anthropic_key_set ? "•••• (leer = behalten)" : "sk-ant-…"}"/></label>
      <label>Claude-Modell <input id="p-amodel" value="${esc(s.anthropic_model)}"/></label>
      <hr/>
      <label>OpenAI API-Key ${s.openai_key_set ? "✓ gesetzt" : ""}
        <input id="p-okey" type="password" placeholder="${s.openai_key_set ? "•••• (leer = behalten)" : "sk-…"}"/></label>
      <label>OpenAI-Modell <input id="p-omodel" value="${esc(s.openai_model)}"/></label>
      <button class="btn primary" id="p-save">Speichern</button>
      <div class="hint2">Keys werden lokal in instance/settings.json gespeichert (nicht in Git).</div>
      <hr/>
      <h4>Datensicherung</h4>
      <div class="hint2">Sichert vault/ (Memory), instance/ (Config/Board) und Skills.</div>
      <div class="b-cols" style="margin-top:8px">
        <a class="btn" href="/api/backup" download>⤓ Backup herunterladen</a>
        <label class="btn" style="text-align:center;cursor:pointer">⤒ Restore…
          <input id="restore-file" type="file" accept=".gz,.tgz,application/gzip" hidden/></label>
      </div>
      <div class="hint2" id="restore-msg"></div>
      <label class="switch" style="margin-top:12px">
        <input type="checkbox" id="bk-enabled" ${s.backup_enabled ? "checked" : ""}/>
        <span>Automatisches Backup</span></label>
      <div class="row" style="margin-top:6px;align-items:center">
        <input id="bk-interval" type="number" value="${s.backup_interval_hours}" style="max-width:70px"/>
        <span class="hint2">Std.</span>
        <input id="bk-keep" type="number" value="${s.backup_keep}" style="max-width:70px"/>
        <span class="hint2">behalten</span>
        <button class="btn" id="bk-save">Speichern</button>
      </div>
      <label>Offsite-Push (Git-Remote) ${s.backup_git_set ? "✓ gesetzt" : ""}
        <input id="bk-git" type="password" placeholder="https://user:token@host/repo.git (leer = behalten)"/></label>`);

    document.getElementById("bk-save").onclick = async () => {
      const patch = { backup_enabled: document.getElementById("bk-enabled").checked,
        backup_interval_hours: parseInt(document.getElementById("bk-interval").value, 10) || 24,
        backup_keep: parseInt(document.getElementById("bk-keep").value, 10) || 7 };
      const git = document.getElementById("bk-git").value.trim();
      if (git) patch.backup_git_remote = git;
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch) });
      document.getElementById("restore-msg").textContent = "Backup-Einstellungen gespeichert.";
    };

    const rf = document.getElementById("restore-file");
    if (rf) rf.onchange = async () => {
      if (!rf.files[0]) return;
      if (!confirm("Backup einspielen? Vorhandene Dateien werden überschrieben.")) return;
      const fd = new FormData(); fd.append("file", rf.files[0]);
      const j = await fetch("/api/restore", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
      document.getElementById("restore-msg").textContent =
        j.ok ? ("Wiederhergestellt: " + JSON.stringify(j.restored)) : ("Fehler: " + (j.error || "?"));
    };

    document.getElementById("p-save").onclick = async () => {
      const patch = {
        active_provider: document.getElementById("p-active").value,
        ollama_url: document.getElementById("p-ollama").value,
        anthropic_model: document.getElementById("p-amodel").value,
        openai_model: document.getElementById("p-omodel").value,
      };
      const ak = document.getElementById("p-akey").value;
      const ok = document.getElementById("p-okey").value;
      if (ak) patch.anthropic_key = ak;
      if (ok) patch.openai_key = ok;
      await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      close();
    };

    await appendModelsAndUsers();
  }

  async function appendModelsAndUsers() {
    const [me, models, agents] = await Promise.all([
      fetch("/api/me").then((r) => r.json()).catch(() => ({})),
      fetch("/api/models").then((r) => r.json()).catch(() => ({ available: [], running: [] })),
      fetch("/api/agents").then((r) => r.json()).catch(() => []),
    ]);
    const gb = (n) => (n / 1e9).toFixed(1) + " GB";
    const avail = (models.available || []).map((m) => `${esc(m.name)} (${gb(m.size)})`).join(" · ") || "—";
    const running = (models.running || []).map((m) =>
      `${esc(m.name)} · VRAM ${gb(m.size_vram || 0)}`).join(" · ") || "keine geladen";

    let html = `<hr/><h4>Ollama-Modelle</h4>
      <div class="hint2"><b>Verfügbar:</b> ${avail}</div>
      <div class="hint2"><b>Geladen (RAM/VRAM):</b> ${running}</div>
      <hr/><h4>Agenten-Modelle</h4>`;
    const modelOpts = '<option value="">—</option>' +
      (models.available || []).map((m) => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join("");
    agents.forEach((a) => {
      html += `<label>${esc(a.role)}
        <input list="modellist" data-agent="${esc(a.role)}" class="ag-model" value="${esc(a.model)}"/></label>`;
    });
    html += `<datalist id="modellist">${modelOpts}</datalist>
      <button class="btn" id="ag-save">Agenten-Modelle speichern</button>`;

    if (me.role === "admin") {
      html += `<hr/><h4>Benutzer</h4><div id="userlist" class="hint2">…</div>
        <div class="row" style="margin-top:8px">
          <input id="u-name" placeholder="benutzername" style="max-width:130px"/>
          <input id="u-pw" type="password" placeholder="passwort (min.8)" style="max-width:150px"/>
          <select id="u-role"><option value="user">user</option><option value="admin">admin</option></select>
          <button class="btn" id="u-add">+ anlegen</button>
        </div><div class="hint2" id="u-msg"></div>
        <hr/><h4>Audit-Log <button class="btn" id="audit-reload" style="padding:2px 8px">↻</button></h4>
        <div id="auditlist" class="audit"></div>`;
    }
    bodyEl.insertAdjacentHTML("beforeend", html);

    document.getElementById("ag-save").onclick = async () => {
      for (const inp of bodyEl.querySelectorAll(".ag-model")) {
        const a = agents.find((x) => x.role === inp.dataset.agent);
        if (a && inp.value !== a.model) {
          await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...a, model: inp.value }) });
        }
      }
      alert("Agenten-Modelle gespeichert.");
    };

    if (me.role === "admin") {
      const renderUsers = async () => {
        const users = await fetch("/api/users").then((r) => r.json()).catch(() => []);
        document.getElementById("userlist").innerHTML = users.map((u) =>
          `${esc(u.username)} <span style="opacity:.6">(${u.role})</span>
           <button class="lnk" data-del="${esc(u.username)}">entfernen</button>`).join("<br>");
        document.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
          if (!confirm(`Benutzer ${b.dataset.del} löschen?`)) return;
          await fetch(`/api/users/${b.dataset.del}`, { method: "DELETE" });
          renderUsers();
        });
      };
      renderUsers();
      const renderAudit = async () => {
        const rows = await fetch("/api/audit").then((r) => r.json()).catch(() => []);
        document.getElementById("auditlist").innerHTML = rows.map((r) =>
          `<div><span>${esc(r.t)}</span> <b>${esc(r.user)}</b> ${esc(r.action)}
           <span style="opacity:.6">${esc(r.detail || "")}</span></div>`).join("") ||
          '<div class="hint2">noch keine Einträge</div>';
      };
      renderAudit();
      document.getElementById("audit-reload").onclick = renderAudit;
      document.getElementById("u-add").onclick = async () => {
        const j = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: document.getElementById("u-name").value,
            password: document.getElementById("u-pw").value, role: document.getElementById("u-role").value }) })
          .then((r) => r.json()).catch(() => ({}));
        const msg = document.getElementById("u-msg");
        if (j.ok) {
          msg.innerHTML = `Angelegt. <b>${esc(j.username)}</b> muss diesen QR/Secret in die Authenticator-App: ` +
            `<code>${esc(j.secret)}</code>`;
          if (window.VaultModal && j.qr_svg) { /* optional */ }
          renderUsers();
        } else { msg.textContent = "Fehler: " + (j.error || "?"); }
      };
    }
  }

  // ---- UPDATE -------------------------------------------------------------
  async function doUpdate() {
    if (!confirm("V.A.U.L.T. aus Git aktualisieren und Container neu bauen?")) return;
    const r = await fetch("/api/system/update", { method: "POST" }).then((x) => x.json()).catch(() => ({}));
    alert(r.ok ? "Update gestartet – der Server startet gleich neu." : ("Update nicht möglich: " + (r.error || "?")));
  }

  // ---- Projekt-Launcher ---------------------------------------------------
  function initProject() {
    const input = document.getElementById("project-input");
    const go = document.getElementById("project-go");
    const run = async () => {
      const goal = input.value.trim();
      if (!goal) return;
      go.disabled = true;
      await fetch("/api/projects/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      }).catch(() => {});
      input.value = "";
      setTimeout(() => (go.disabled = false), 1500);
    };
    go.addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  }

  document.getElementById("btn-build").addEventListener("click", openBuilder);
  document.getElementById("btn-settings").addEventListener("click", openSettings);
  document.getElementById("btn-update").addEventListener("click", doUpdate);
  initProject();
})();
