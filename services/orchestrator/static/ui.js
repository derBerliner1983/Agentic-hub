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

  // Sicherheits-Bericht (vom Host geschrieben) als Badges rendern
  const secDot = (ok) => `<span style="color:${ok ? "var(--accent)" : "#ef4444"}">${ok ? "✓" : "✗"}</span>`;
  function secHtml(s) {
    if (!s || !s.available) {
      return `<div class="hint2">${esc((s && s.note) || "Kein Sicherheits-Bericht vorhanden.")}<br>
        Vollständige Härtung + Kernel/App-Updates laufen auf dem <b>Host</b> über
        <code>./update.sh</code> bzw. <code>scripts/harden.sh</code>.</div>`;
    }
    const upd = s.updates_total || 0, su = s.updates_security || 0;
    const overall = s.secure ? "🟢 abgesichert" : "🟠 Handlungsbedarf";
    return `<div class="hint2">Gesamtstatus: <b>${overall}</b> · Stand ${esc((s.ts || "").replace("T", " ").slice(0, 16))}</div>
      <div class="mgmt-row"><div class="m-title">${secDot(s.hardened === "yes")} Härtung aktiv</div>
        <span class="board-spacer"></span>
        <div class="m-sub">${secDot(s.ufw_active)} Firewall · ${secDot(s.ssh_hardened)} SSH · ${secDot(s.fail2ban_active)} fail2ban · ${secDot(s.docker_firewall)} Docker-FW</div></div>
      <div class="mgmt-row"><div><div class="m-title">Aktualität</div>
        <div class="m-sub">Kernel ${esc(s.kernel || "?")} · ${upd} Update(s) offen${su ? ` (${su} sicherheitsrelevant)` : ""} · Auto-Updates ${s.unattended ? "an" : "aus"}${s.full_updates === "yes" ? " (Kernel+Apps)" : ""}</div></div>
        <span class="board-spacer"></span>
        <div class="m-sub">${s.reboot_required ? "⚠ Neustart nötig" : "kein Neustart nötig"}</div></div>`;
  }

  // ---- BUILDER (Tasks aus Skills bauen + Skills anlegen) -------------------
  async function openBuilder(editId) {
    const [skills, tasks, models, editTask] = await Promise.all([
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()).catch(() => ({ available: [] })),
      editId ? fetch(`/api/tasks/${editId}`).then((r) => r.json()).catch(() => null) : null,
    ]);
    const skillOpts = skills.filter((s) => s.enabled !== false)
      .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    const modelOpts = '<option value="">Standard</option>' +
      (models.available || []).map((m) => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join("");
    open("Builder", `
      <div class="b-cols">
        <section>
          <h4>${editTask ? "Kurzbefehl bearbeiten" : "Neuen Kurzbefehl bauen"}</h4>
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

    const steps = (editTask && Array.isArray(editTask.steps)) ? editTask.steps.map((s) => ({ ...s })) : [];
    if (editTask) {
      document.getElementById("t-title").value = editTask.title || "";
      if (editTask.domain) document.getElementById("t-domain").value = editTask.domain;
      if (editTask.model) document.getElementById("t-model").value = editTask.model;
      const sc = editTask.schedule;
      if (sc && sc.type === "interval") { document.getElementById("t-sched").value = "interval"; document.getElementById("t-schedval").value = sc.minutes || ""; }
      if (sc && sc.type === "daily") { document.getElementById("t-sched").value = "daily"; document.getElementById("t-schedval").value = sc.time || ""; }
    }
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
      const payload = { title, domain: document.getElementById("t-domain").value, steps,
        model: document.getElementById("t-model").value || null, schedule, cadence };
      if (editId) payload.id = editId;
      await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      close();
      if (document.body.dataset.view === "settings") openSettings();
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

  // ---- Skill-Editor (Modal): neu anlegen oder bestehenden bearbeiten ------
  async function openSkillEditor(skillId) {
    const s = skillId ? await fetch(`/api/skills/${skillId}`).then((r) => r.json()).catch(() => null) : null;
    open(skillId ? "Skill bearbeiten" : "Neuer Skill", `
      <label>Name <input id="sk-name" value="${esc(s ? s.name : "")}" placeholder="z. B. competitor-scan"/></label>
      <label>Kurzbeschreibung (wann nutzen?) <input id="sk-desc" value="${esc(s ? s.description : "")}" placeholder="Kurz…"/></label>
      <label>Anweisung (Schritt-für-Schritt)
        <textarea id="sk-body" rows="10" placeholder="1. …&#10;2. …">${esc(s ? s.body : "")}</textarea></label>
      <label class="switch" style="margin-top:12px">
        <input type="checkbox" id="sk-enabled" ${!s || s.enabled !== false ? "checked" : ""}/>
        <span>aktiv</span></label>
      <button class="btn primary" id="sk-save">Speichern</button>`);
    document.getElementById("sk-save").onclick = async () => {
      const name = document.getElementById("sk-name").value.trim();
      if (!name) return alert("Name fehlt");
      const payload = { name, description: document.getElementById("sk-desc").value,
        body: document.getElementById("sk-body").value,
        enabled: document.getElementById("sk-enabled").checked };
      if (skillId) payload.id = skillId;
      await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) }).catch(() => {});
      close();
      if (document.body.dataset.view === "settings") openSettings();
    };
  }

  // ---- EINSTELLUNGEN (eigene Seite, EINSTELLUNGEN-Tab) --------------------
  const settingsBody = document.getElementById("settings-body");
  async function openSettings() {
    const s = await fetch("/api/settings").then((r) => r.json());
    const sel = (v) => (s.active_provider === v ? "selected" : "");
    settingsBody.innerHTML = `
      <h3 class="set-h">Provider</h3>
      <label>Aktiver Provider
        <select id="p-active">
          <option value="ollama" ${sel("ollama")}>Ollama (lokal)</option>
          <option value="anthropic" ${sel("anthropic")}>Claude (Anthropic)</option>
          <option value="openai" ${sel("openai")}>OpenAI (ChatGPT)</option>
        </select></label>
      <div class="prov" data-prov="ollama">
        <label>Ollama-URL</label>
        <div class="row" style="align-items:center">
          <input id="p-ollama" value="${esc(s.ollama_url)}" style="flex:1"/>
          <button class="btn" id="p-test" type="button">Testen</button>
        </div>
        <div class="hint2" id="p-test-msg"></div>
      </div>
      <div class="prov" data-prov="anthropic">
        <label>Anthropic API-Key ${s.anthropic_key_set ? "✓ gesetzt" : ""}
          <input id="p-akey" type="password" placeholder="${s.anthropic_key_set ? "•••• (leer = behalten)" : "sk-ant-…"}"/></label>
        <label>Claude-Modell <input id="p-amodel" value="${esc(s.anthropic_model)}"/></label>
      </div>
      <div class="prov" data-prov="openai">
        <label>OpenAI API-Key ${s.openai_key_set ? "✓ gesetzt" : ""}
          <input id="p-okey" type="password" placeholder="${s.openai_key_set ? "•••• (leer = behalten)" : "sk-…"}"/></label>
        <label>OpenAI-Modell <input id="p-omodel" value="${esc(s.openai_model)}"/></label>
      </div>
      <button class="btn primary" id="p-save">Speichern</button>
      <div class="hint2">Keys werden lokal in instance/settings.json gespeichert (nicht in Git).</div>
      <hr/>
      <h3 class="set-h">Datensicherung</h3>
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
        <input id="bk-git" type="password" placeholder="https://user:token@host/repo.git (leer = behalten)"/></label>`;

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
      openSettings();   // Seite mit frischen Daten neu aufbauen
    };

    // Nur den aktiven Provider zeigen; Ollama-Modelle nur bei Ollama
    const applyProvVis = () => {
      const act = document.getElementById("p-active").value;
      settingsBody.querySelectorAll(".prov").forEach((el) =>
        (el.style.display = el.dataset.prov === act ? "block" : "none"));
      settingsBody.querySelectorAll(".ollama-only").forEach((el) =>
        (el.style.display = act === "ollama" ? "" : "none"));
    };
    window._vaultApplyProvVis = applyProvVis;
    document.getElementById("p-active").addEventListener("change", applyProvVis);
    applyProvVis();

    document.getElementById("p-test").onclick = async () => {
      const msg = document.getElementById("p-test-msg");
      msg.textContent = "teste …";
      const j = await fetch("/api/ollama/test", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: document.getElementById("p-ollama").value }) })
        .then((r) => r.json()).catch(() => ({}));
      msg.textContent = j.reachable
        ? `✓ erreichbar · ${(j.models || []).length} Modell(e)`
        : `✗ nicht erreichbar${j.error ? " – " + j.error : ""}`;
    };

    await appendModelsAndUsers();
  }

  async function appendModelsAndUsers() {
    const [me, models, agents, tasks, skills, mcps, settings, voice, tts, sched2, rag] = await Promise.all([
      fetch("/api/me").then((r) => r.json()).catch(() => ({})),
      fetch("/api/models").then((r) => r.json()).catch(() => ({ available: [], running: [] })),
      fetch("/api/agents").then((r) => r.json()).catch(() => []),
      fetch("/api/tasks").then((r) => r.json()).catch(() => []),
      fetch("/api/skills").then((r) => r.json()).catch(() => []),
      fetch("/api/mcp").then((r) => r.json()).catch(() => []),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
      fetch("/api/voice/models").then((r) => r.json()).catch(() => ({ current: "", options: [] })),
      fetch("/api/voice/tts_voices").then((r) => r.json()).catch(() => ({ current: "", options: [] })),
      fetch("/api/schedule").then((r) => r.json()).catch(() => []),
      fetch("/api/rag/info").then((r) => r.json()).catch(() => ({ chunks: 0, enabled: false })),
    ]);
    const fmtTime = (iso) => { if (!iso) return "—"; const d = new Date(iso);
      return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
    const schedRows = (sched2 || []).map((t) => `<div class="mgmt-row">
        <div><div class="m-title">${esc(t.title)}</div>
          <div class="m-sub">${esc(t.label)} · nächster: ${fmtTime(t.next)} · zuletzt: ${fmtTime(t.last)}</div></div>
        <span class="board-spacer"></span>
        <button class="lnk" data-schedrun="${esc(t.id)}">jetzt</button>
        <button class="lnk" data-taskedit="${esc(t.id)}">bearbeiten</button></div>`).join("")
      || '<div class="hint2">keine geplanten Automationen · Zeitplan beim Bearbeiten eines Kurzbefehls setzen</div>';
    const voiceOpts = (voice.options || []).map((m) =>
      `<option value="${esc(m)}" ${m === voice.current ? "selected" : ""}>${esc(m)}</option>`).join("");
    const ttsOpts = (tts.options || []).map((v) =>
      `<option value="${esc(v.id)}" ${v.id === tts.current ? "selected" : ""}>${esc(v.label)}${v.installed ? "" : " (lädt bei 1. Nutzung)"}</option>`).join("");
    const sec = me.role === "admin"
      ? await fetch("/api/system/security").then((r) => r.json()).catch(() => ({})) : {};
    const gb = (n) => (n / 1e9).toFixed(1) + " GB";
    const reach = models.reachable;
    const running = (models.running || []).map((m) =>
      `${esc(m.name)} · VRAM ${gb(m.size_vram || 0)}`).join(" · ") || "keine geladen";
    const availList = (models.available || []).map((m) =>
      `<div class="mrow"><span>${esc(m.name)} <span style="opacity:.5">(${gb(m.size)})</span></span>
       <button class="lnk" data-delmodel="${esc(m.name)}">löschen</button></div>`).join("")
      || '<div class="hint2">noch keine Modelle geladen</div>';

    const SUGGEST = ["llama3.1:8b", "qwen2.5-coder:7b", "qwen2.5:7b", "llama3.2:3b",
                     "mistral", "phi3", "gemma2:9b"];
    const names = (models.available || []).map((m) => m.name);
    const noModels = !names.length;
    const uniq = (a) => [...new Set(a.filter(Boolean))];
    const active = settings.ollama_model || "";
    const activeOpts = ['<option value="">— erstes verfügbares —</option>']
      .concat(names.map((n) => `<option value="${esc(n)}" ${n === active ? "selected" : ""}>${esc(n)}</option>`)).join("");
    const pullOpts = uniq([...SUGGEST, ...names]).map((m) => `<option value="${esc(m)}">`).join("");
    const agOpts = (cur) => uniq([cur, ...names, ...SUGGEST])
      .map((m) => `<option value="${esc(m)}" ${m === cur ? "selected" : ""}>${esc(m)}</option>`).join("");
    const taskRows = tasks.map((t) => `<div class="mgmt-row">
        <div><div class="m-title">${esc(t.title)}</div>
          <div class="m-sub">${esc(t.id)} · ${esc(t.domain || "ops")} · ${esc(t.cadence || "on-demand")}</div></div>
        <span class="board-spacer"></span>
        <button class="lnk" data-taskedit="${esc(t.id)}">bearbeiten</button>
        <button class="lnk" data-taskdel="${esc(t.id)}">löschen</button></div>`).join("")
      || '<div class="hint2">keine Kurzbefehle</div>';
    const skillRows = skills.map((s2) => `<div class="skill-tile ${s2.enabled === false ? "off" : ""}" data-skill="${esc(s2.id)}">
        <div class="skill-top">
          <div class="skill-name">${esc(s2.name)}</div>
          <label class="mini-switch" title="aktiv/aus"><input type="checkbox" data-skilltoggle="${esc(s2.id)}" ${s2.enabled === false ? "" : "checked"}/><span></span></label>
        </div>
        <div class="skill-desc">${esc(s2.description || "—")}</div>
        <button class="lnk skill-edit" data-skilledit="${esc(s2.id)}">bearbeiten</button>
      </div>`).join("")
      || '<div class="hint2">keine Skills</div>';
    const mcpRows = mcps.map((m) => `<div class="mgmt-row">
        <div><div class="m-title">${esc(m.name)} ${m.enabled ? "" : "· <i>aus</i>"}
          ${m.tools ? `<span style="color:var(--accent)">· ${m.tools} Tool(s)</span>` : '<span style="opacity:.5">· keine Tools erkannt</span>'}</div>
          <div class="m-sub">${esc(m.transport)} · ${esc(m.target || "")}</div></div>
        <span class="board-spacer"></span>
        <button class="lnk" data-mcpdel="${esc(m.id)}">entfernen</button></div>`).join("")
      || '<div class="hint2">noch keine MCP-Server</div>';

    let html = `<div class="ollama-only">
      <hr/><h3 class="set-h">Aktives Modell <span class="exec-badge ${reach ? "on" : ""}" style="margin-left:6px">${reach ? "ERREICHBAR" : "OFFLINE"}</span></h3>
      ${reach ? "" : '<div class="hint2">Ollama läuft nicht auf dem Host – siehe docs/INBETRIEBNAHME.md.</div>'}
      <div class="hint2">Dieses Modell nutzen Tasks & Projekte. <b>Geladen (RAM/VRAM):</b> ${running}</div>
      <div class="row" style="align-items:center;margin-top:6px">
        <select id="active-model" style="flex:1">${activeOpts}</select>
        <button class="btn" id="active-save">Als aktiv setzen</button>
      </div>
      <hr/><h4>Modell laden</h4>
      <label>ab 3 Buchstaben sucht er lokal + auf HuggingFace</label>
      <div class="row"><input id="pull-name" list="pullmodels" autocomplete="off" placeholder="z. B. gemma · llama3.1:8b · hf.co/…-GGUF" style="flex:1"/>
        <button class="btn" id="pull-go">⤓ Laden</button></div>
      <datalist id="pullmodels">${pullOpts}</datalist>
      <div class="chips">${SUGGEST.map((m) => `<button class="chip" data-model="${m}">${m}</button>`).join("")}</div>
      <div class="progress" id="pull-progress" hidden><i></i></div>
      <div class="hint2" id="pull-msg">${noModels ? "Noch kein Modell geladen." : ""}</div>
      <div class="hint2">Auch <b>HuggingFace</b>: <code>hf.co/&lt;user&gt;/&lt;repo&gt;-GGUF</code></div>
      <div class="v-head" style="margin-top:12px">INSTALLIERTE MODELLE</div>
      <div id="model-list">${availList}</div>
      <hr/><h4>Agenten-Modelle</h4>
      <div class="hint2">Welches Modell jede Rolle nutzt (wird bei Bedarf automatisch geladen).</div>
      ${agents.map((a) => `<label>${esc(a.role)}
        <select class="ag-model" data-agent="${esc(a.role)}">${agOpts(a.model)}</select></label>`).join("")}
      <button class="btn" id="ag-save">Agenten-Modelle speichern</button>
      </div>
      <hr/><h3 class="set-h">Command Deck · Kurzbefehle</h3>
      <div class="hint2">Vordefinierte Kurzbefehle ändern, löschen oder neue anlegen.</div>
      <div id="task-list">${taskRows}</div>
      <button class="btn primary" id="task-new" style="margin-top:8px">＋ Neuer Kurzbefehl</button>
      <hr/><h3 class="set-h">Zeitplan · Automationen</h3>
      <div class="hint2">Geplante Kurzbefehle (Cadence). Zeitplan legst du beim Bearbeiten eines Kurzbefehls fest.</div>
      <div id="sched-list">${schedRows}</div>
      <hr/><h3 class="set-h">Skills</h3>
      <div class="hint2">Wiederverwendbare Prompt-Bausteine für Tasks.</div>
      <div id="skill-list" class="skill-grid">${skillRows}</div>
      <button class="btn" id="skill-new" style="margin-top:8px">＋ Neuer Skill</button>
      <hr/><h3 class="set-h">Vault-Wissen (RAG)</h3>
      <div class="hint2">Bezieht relevante Notizen automatisch als Kontext in Antworten ein
        (Embeddings mit <code>nomic-embed-text</code>). Nach neuen Notizen Index neu bauen.</div>
      <label class="switch" style="margin-top:8px">
        <input type="checkbox" id="rag-enabled" ${rag.enabled ? "checked" : ""}/>
        <span>RAG aktiv</span></label>
      <div class="row" style="align-items:center;margin-top:6px">
        <button class="btn" id="rag-reindex">Index neu bauen</button>
        <span class="hint2" id="rag-info">${rag.chunks || 0} Abschnitte im Index${rag.model ? " · " + esc(rag.model) : ""}</span>
      </div>
      <hr/><h3 class="set-h">MCP-Server</h3>
      <div class="hint2">Model-Context-Protocol-Server einbinden (Tools/Datenquellen). Zählt zum Wissen des Gehirns.</div>
      <div id="mcp-list">${mcpRows}</div>
      <div class="row" style="margin-top:8px">
        <input id="mcp-name" placeholder="Name" style="max-width:140px"/>
        <select id="mcp-transport" style="max-width:100px"><option value="stdio">stdio</option><option value="sse">sse</option><option value="http">http</option></select>
        <input id="mcp-target" placeholder="Command oder URL" style="flex:1"/>
        <button class="btn" id="mcp-add">＋ MCP</button>
      </div>
      <hr/><h3 class="set-h">Sprache · Spracherkennung (STT-Modell)</h3>
      <div class="hint2">Welches Whisper-Modell die Sprache erkennt. Größer = genauer, aber langsamer/mehr RAM. Wird beim nächsten Sprachbefehl automatisch geladen (großes Modell = einmaliger Download).</div>
      <div class="row" style="align-items:center;margin-top:6px">
        <select id="stt-model" style="flex:1">${voiceOpts}</select>
        <button class="btn" id="stt-save">Sprach-Modell setzen</button>
      </div>
      <div class="hint2" style="margin-top:10px">Stimme der Sprachausgabe (Piper). Erst vorhören, dann setzen. Neue Stimme wird beim Vorhören einmalig geladen.</div>
      <div class="row" style="align-items:center;margin-top:6px">
        <select id="tts-voice" style="flex:1">${ttsOpts}</select>
        <button class="btn" id="tts-preview">▶ Vorhören</button>
        <button class="btn" id="tts-save">Stimme setzen</button>
      </div>
      <div class="hint2" id="tts-msg"></div>
      <hr/><h3 class="set-h">Sicherheit &amp; System</h3>
      ${secHtml(sec)}
      <div class="hint2" style="margin-top:8px">App-Update: holt die neueste Version aus Git und baut die Container neu (rollend, ohne Datenverlust).</div>
      <div class="row" style="align-items:center;margin-top:6px">
        <button class="btn" id="upd-check">Nach Updates suchen</button>
        <button class="btn primary" id="upd-run">Jetzt aktualisieren</button>
        <span class="hint2" id="upd-msg"></span>
      </div>
      <hr/><h3 class="set-h">Sicherheit (Zwei-Faktor / MFA)</h3>
      <div class="hint2">Status: <b>${me.mfa ? "aktiv ✓" : "aus"}</b> ·
        ${me.mfa ? "MFA wird beim Login auf neuen Geräten abgefragt." : "Ohne MFA reicht Benutzername + Passwort."}</div>
      <div id="mfa-area" style="margin-top:8px">
        ${me.mfa ? '<button class="btn" id="mfa-off">MFA deaktivieren</button>'
                 : '<button class="btn" id="mfa-on">MFA aktivieren</button>'}</div>`;

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
    settingsBody.insertAdjacentHTML("beforeend", html);
    if (window._vaultApplyProvVis) window._vaultApplyProvVis();   // Ollama-Only ggf. ausblenden

    // Lade-Fortschritt live im Fenster zeigen (Balken + Text)
    if (window._vaultModelLog) window.removeEventListener("vault-log", window._vaultModelLog);
    window._vaultModelLog = (e) => {
      const m = e.detail || {};
      if (m.type !== "model") return;
      const msg = document.getElementById("pull-msg");
      const bar = document.getElementById("pull-progress");
      const barI = bar ? bar.querySelector("i") : null;
      if (!msg) return;
      if (m.state === "pulling") {
        if (bar) bar.hidden = false;
        if (barI) barI.style.width = (m.pct != null ? m.pct : 0) + "%";
        msg.textContent = `Lädt ${m.model} … ${m.pct != null ? m.pct + "%" : ""} ${m.status || ""}`.trim();
      } else if (m.state === "ready") {
        if (bar) bar.hidden = false;
        if (barI) barI.style.width = "100%";
        msg.textContent = `✓ ${m.model} geladen – Gehirn baut sich auf.`;
        // Installierte-Modelle-Liste nachladen, wenn die Seite offen ist
        if (document.body.dataset.view === "settings") setTimeout(openSettings, 1500);
      } else if (m.state === "error") {
        if (bar) bar.hidden = true;
        msg.textContent = `✗ ${m.error || "Fehler"}`;
      }
    };
    window.addEventListener("vault-log", window._vaultModelLog);

    // Live-Suche auf HuggingFace, sobald ≥3 Zeichen getippt werden
    const pullName = document.getElementById("pull-name");
    const dl = document.getElementById("pullmodels");
    const baseOpts = () => uniq([...SUGGEST, ...names]).map((m) => `<option value="${esc(m)}">`).join("");
    if (pullName && dl) {
      let searchTimer = null;
      pullName.addEventListener("input", () => {
        const q = pullName.value.trim();
        if (q.length < 3 || q.startsWith("hf.co/")) { dl.innerHTML = baseOpts(); return; }
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
          const j = await fetch("/api/models/search?q=" + encodeURIComponent(q))
            .then((r) => r.json()).catch(() => ({ results: [] }));
          const hits = (j.results || []).map((r) =>
            `<option value="${esc(r.pull)}">${esc(r.id)}${r.downloads != null ? " · " + r.downloads.toLocaleString("de-DE") + " Downloads" : " · Ollama"}</option>`).join("");
          dl.innerHTML = baseOpts() + hits;
        }, 300);
      });
    }

    const pullGo = document.getElementById("pull-go");
    if (pullGo) pullGo.onclick = async () => {
      const name = document.getElementById("pull-name").value.trim();
      if (!name) return;
      const bar = document.getElementById("pull-progress");
      const barI = bar ? bar.querySelector("i") : null;
      if (bar) { bar.hidden = false; if (barI) barI.style.width = "0%"; }
      const j = await fetch("/api/models/pull", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }) }).then((r) => r.json()).catch(() => ({}));
      document.getElementById("pull-msg").textContent = j.ok
        ? `Lade „${name}" … Fortschritt läuft gleich hier.`
        : ("Fehler: " + (j.error || "?"));
      if (!j.ok && bar) bar.hidden = true;
    };
    settingsBody.querySelectorAll("[data-model]").forEach((c) => { c.onclick = () => {
      document.getElementById("pull-name").value = c.dataset.model;
    }; });

    // Aktives Modell setzen (Tasks/Projekte nutzen es)
    const activeSave = document.getElementById("active-save");
    if (activeSave) activeSave.onclick = async () => {
      const name = document.getElementById("active-model").value;
      await fetch("/api/models/active", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }) });
      activeSave.textContent = "✓ gesetzt";
      setTimeout(() => (activeSave.textContent = "Als aktiv setzen"), 1500);
    };

    // Kurzbefehle (Tasks): bearbeiten / löschen / neu
    settingsBody.querySelectorAll("[data-taskedit]").forEach((b) => { b.onclick = () => openBuilder(b.dataset.taskedit); });
    settingsBody.querySelectorAll("[data-taskdel]").forEach((b) => { b.onclick = async () => {
      if (!confirm(`Kurzbefehl „${b.dataset.taskdel}" löschen?`)) return;
      await fetch(`/api/tasks/${b.dataset.taskdel}`, { method: "DELETE" });
      openSettings();
    }; });
    const taskNew = document.getElementById("task-new");
    if (taskNew) taskNew.onclick = () => openBuilder();

    // Automation jetzt ausführen
    settingsBody.querySelectorAll("[data-schedrun]").forEach((b) => { b.onclick = async () => {
      await fetch(`/api/tasks/${b.dataset.schedrun}/run`, { method: "POST" }).catch(() => {});
      b.textContent = "läuft…";
      setTimeout(() => (b.textContent = "jetzt"), 1500);
    }; });

    // Skills: als Kacheln – ein/aus schalten, bearbeiten, neu anlegen
    settingsBody.querySelectorAll("[data-skilltoggle]").forEach((cb) => { cb.onchange = async () => {
      await fetch(`/api/skills/${cb.dataset.skilltoggle}/enabled`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: cb.checked }) }).catch(() => {});
      const tile = cb.closest(".skill-tile");
      if (tile) tile.classList.toggle("off", !cb.checked);
    }; });
    settingsBody.querySelectorAll("[data-skilledit]").forEach((b) => {
      b.onclick = () => openSkillEditor(b.dataset.skilledit);
    });
    const skillNew = document.getElementById("skill-new");
    if (skillNew) skillNew.onclick = () => openSkillEditor(null);

    // RAG: ein/aus + Index neu bauen
    const ragEnabled = document.getElementById("rag-enabled");
    if (ragEnabled) ragEnabled.onchange = async () => {
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rag_enabled: ragEnabled.checked }) }).catch(() => {});
    };
    const ragReindex = document.getElementById("rag-reindex");
    if (ragReindex) ragReindex.onclick = async () => {
      ragReindex.disabled = true; ragReindex.textContent = "baut …";
      await fetch("/api/rag/reindex", { method: "POST" }).catch(() => {});
      document.getElementById("rag-info").textContent = "Index wird gebaut – siehe Board-Live-Log …";
      setTimeout(() => { ragReindex.disabled = false; ragReindex.textContent = "Index neu bauen"; }, 2000);
    };

    // MCP hinzufügen / entfernen
    const mcpAdd = document.getElementById("mcp-add");
    if (mcpAdd) mcpAdd.onclick = async () => {
      const name = document.getElementById("mcp-name").value.trim();
      if (!name) return alert("Name fehlt");
      await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, transport: document.getElementById("mcp-transport").value,
          target: document.getElementById("mcp-target").value.trim() }) });
      openSettings();
    };
    settingsBody.querySelectorAll("[data-mcpdel]").forEach((b) => { b.onclick = async () => {
      if (!confirm("MCP-Server entfernen?")) return;
      await fetch(`/api/mcp/${b.dataset.mcpdel}`, { method: "DELETE" });
      openSettings();
    }; });

    // Sprach-Modell (STT) wechseln
    const sttSave = document.getElementById("stt-save");
    if (sttSave) sttSave.onclick = async () => {
      const name = document.getElementById("stt-model").value;
      const j = await fetch("/api/voice/model", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }) }).then((r) => r.json()).catch(() => ({}));
      sttSave.textContent = j.ok ? "✓ gesetzt" : "Fehler";
      setTimeout(() => (sttSave.textContent = "Sprach-Modell setzen"), 1500);
    };

    // TTS-Stimme vorhören (ohne sie zu setzen)
    const ttsPrev = document.getElementById("tts-preview");
    let _previewAudio = null;
    if (ttsPrev) ttsPrev.onclick = () => {
      const voiceId = document.getElementById("tts-voice").value;
      const msg = document.getElementById("tts-msg");
      msg.textContent = "lädt & spielt … (neue Stimme wird einmalig geladen)";
      ttsPrev.disabled = true;
      const sample = "Hallo, ich bin deine V.A.U.L.T. Stimme. So klinge ich.";
      if (_previewAudio) { try { _previewAudio.pause(); } catch (_) {} }
      _previewAudio = new Audio(`/api/voice/tts?voice_id=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(sample)}`);
      _previewAudio.onended = () => { ttsPrev.disabled = false; msg.textContent = "So klingt „" + voiceId + "“."; };
      _previewAudio.onerror = () => { ttsPrev.disabled = false; msg.textContent = "Vorhören fehlgeschlagen (Piper/Netz?)."; };
      _previewAudio.play().catch(() => { ttsPrev.disabled = false; msg.textContent = "Wiedergabe blockiert – erneut tippen."; });
    };

    // TTS-Stimme setzen (nach dem Vorhören bestätigen)
    const ttsSave = document.getElementById("tts-save");
    if (ttsSave) ttsSave.onclick = async () => {
      const voiceId = document.getElementById("tts-voice").value;
      const j = await fetch("/api/voice/tts_voice", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: voiceId }) }).then((r) => r.json()).catch(() => ({}));
      ttsSave.textContent = j.ok ? "✓ gesetzt" : "Fehler";
      setTimeout(() => (ttsSave.textContent = "Stimme setzen"), 1500);
    };

    // System-Update: prüfen + auslösen. Update nur anbieten, wenn es eins gibt.
    const updCheck = document.getElementById("upd-check");
    const updMsg = document.getElementById("upd-msg");
    const updRun = document.getElementById("upd-run");
    const setUpdState = (behind, current) => {
      if (behind > 0) {
        updRun.disabled = false;
        updRun.textContent = `Jetzt aktualisieren (${behind})`;
        updMsg.textContent = `${behind} Update(s) verfügbar (Stand ${current}).`;
      } else {
        updRun.disabled = true;
        updRun.textContent = "Aktuell";
        updMsg.textContent = `Aktuell (${current || "?"}) – kein Update nötig.`;
      }
    };
    const runCheck = async () => {
      updMsg.textContent = "prüfe …";
      const j = await fetch("/api/system/update/check").then((r) => r.json()).catch(() => ({}));
      if (j.error) { updMsg.textContent = "Prüfung fehlgeschlagen: " + j.error; return; }
      setUpdState(j.behind || 0, j.current);
    };
    if (updCheck) updCheck.onclick = runCheck;
    if (updRun) updRun.onclick = () => { if (!updRun.disabled) doUpdate(); };
    runCheck();   // beim Öffnen automatisch prüfen

    // MFA aktivieren/deaktivieren
    const mfaOn = document.getElementById("mfa-on");
    if (mfaOn) mfaOn.onclick = async () => {
      const j = await fetch("/api/mfa/enable", { method: "POST" }).then((r) => r.json()).catch(() => ({}));
      if (!j.qr_svg && !j.secret) return alert("MFA-Setup nicht möglich.");
      document.getElementById("mfa-area").innerHTML =
        `<div class="qrbox">${j.qr_svg || ""}</div>
         <div class="hint2">Secret: <code>${esc(j.secret)}</code></div>
         <div class="row" style="margin-top:6px">
           <input id="mfa-code" inputmode="numeric" maxlength="6" placeholder="Code aus der App" style="max-width:160px"/>
           <button class="btn primary" id="mfa-confirm" style="margin-top:0">Bestätigen</button></div>`;
      document.getElementById("mfa-confirm").onclick = async () => {
        const v = await fetch("/api/mfa/enable/verify", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: document.getElementById("mfa-code").value }) })
          .then((r) => r.json()).catch(() => ({}));
        if (v.ok) openSettings(); else alert("Code falsch.");
      };
    };
    const mfaOff = document.getElementById("mfa-off");
    if (mfaOff) mfaOff.onclick = async () => {
      if (!confirm("MFA wirklich deaktivieren?")) return;
      await fetch("/api/mfa/disable", { method: "POST" });
      openSettings();
    };

    settingsBody.querySelectorAll("[data-delmodel]").forEach((b) => { b.onclick = async () => {
      if (!confirm(`Modell ${b.dataset.delmodel} löschen?`)) return;
      await fetch("/api/models/delete", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: b.dataset.delmodel }) });
      openSettings();
    }; });

    document.getElementById("ag-save").onclick = async () => {
      for (const inp of settingsBody.querySelectorAll(".ag-model")) {
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

  // ---- Eingabe: Einzelaufgabe ODER Projekt --------------------------------
  function initProject() {
    const input = document.getElementById("project-input");
    const go = document.getElementById("project-go");
    const toggle = document.getElementById("mode-toggle");
    let mode = "task";   // "task" = eine Antwort · "project" = Agent plant & delegiert

    const applyMode = () => {
      toggle.querySelectorAll("button").forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === mode));
      input.placeholder = mode === "task"
        ? "Aufgabe eingeben (eine Antwort)…"
        : "Projekt-Ziel (Agent plant, holt Spezial-Agenten, prüft)…";
    };
    toggle.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-mode]");
      if (!b) return;
      mode = b.dataset.mode; applyMode();
    });
    applyMode();

    const run = async () => {
      const text = input.value.trim();
      if (!text) return;
      go.disabled = true;
      const url = mode === "project" ? "/api/projects/run" : "/api/tasks/ask";
      const payload = mode === "project" ? { goal: text } : { prompt: text };
      await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
      input.value = "";
      setTimeout(() => (go.disabled = false), 1200);
    };
    go.addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  }

  document.getElementById("btn-build").addEventListener("click", () => openBuilder());
  document.getElementById("btn-update").addEventListener("click", doUpdate);
  const buTop = document.getElementById("btn-update-top");
  if (buTop) buTop.addEventListener("click", doUpdate);
  initProject();

  // Einstellungen als Seite: beim Aktivieren des EINSTELLUNGEN-Tabs rendern
  window.addEventListener("vault-view", (e) => {
    if (e.detail === "settings") openSettings();
  });

  // Hell/Dunkel-Umschalter
  const tt = document.getElementById("theme-toggle");
  if (tt) {
    const upd = () => (tt.textContent = document.documentElement.dataset.theme === "light" ? "☾" : "☀");
    upd();
    tt.onclick = () => {
      const nx = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = nx;
      localStorage.setItem("vault-theme", nx);
      upd();
    };
  }
})();
