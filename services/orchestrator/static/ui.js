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

  // Styled Toast statt nativem alert() für Hinweise
  function toast(msg, kind) {
    let host = document.getElementById("toast-host");
    if (!host) { host = document.createElement("div"); host.id = "toast-host"; document.body.appendChild(host); }
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 250); }, 2600);
  }
  window.toast = toast;

  // Einstellungs-Abschnitte einklappbar machen (jede .set-h + Inhalt bis zur nächsten)
  function collapsibleIn(container) {
    const kids = Array.from(container.children);
    let body = null;
    kids.forEach((el) => {
      const isH = el.classList && el.classList.contains("set-h");
      if (isH) {
        const sec = document.createElement("div");
        sec.className = "set-section";
        container.insertBefore(sec, el);
        body = document.createElement("div");
        body.className = "set-body";
        el.classList.add("set-toggle");
        sec.appendChild(el);
        sec.appendChild(body);
        const key = "vault-sec-" + el.textContent.trim().slice(0, 24);
        if (localStorage.getItem(key) === "1") sec.classList.add("collapsed");
        el.onclick = () => {
          sec.classList.toggle("collapsed");
          localStorage.setItem(key, sec.classList.contains("collapsed") ? "1" : "0");
        };
      } else if (body && !(el.classList && el.classList.contains("ollama-only"))) {
        body.appendChild(el);
      } else {
        body = null;   // .ollama-only bleibt an Ort und Stelle (eigener Container)
      }
    });
  }
  // Logische Reihenfolge der Abschnitte (flex order) + Streu-Elemente wegräumen
  const SECTION_ORDER = ["Provider", "Aktives Modell", "Command Deck", "Zeitplan",
    "Skills", "Vault-Wissen", "MCP-Server", "Sprache", "Freihand am Server",
    "Datensicherung", "Sicherheit & System", "Sicherheit (Zwei"];
  function orderSections(root) {
    Array.from(root.children).forEach((el) => {
      if (el.tagName === "HR") { el.remove(); return; }
      let label = "";
      if (el.classList && el.classList.contains("ollama-only")) label = "Aktives Modell";
      else if (el.querySelector) {
        const h = el.querySelector(".set-h");
        label = h ? h.textContent.trim() : "";
      }
      const i = SECTION_ORDER.findIndex((k) => label.startsWith(k));
      el.style.order = i === -1 ? 90 : i + 1;
    });
  }
  function makeCollapsible(root) {
    root.querySelectorAll(".ollama-only").forEach(collapsibleIn);  // Modell-Sektionen darin
    collapsibleIn(root);                                            // Top-Ebene
    orderSections(root);                                            // sortieren
  }

  // Einmalige Spracherkennung (gleiche Engine wie der Freihand-Modus) → Transkript
  function recognizeOnce() {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { reject(new Error("Braucht Chrome/Edge (Web-Speech).")); return; }
      const r = new SR();
      r.lang = "de-DE"; r.continuous = false; r.interimResults = false; r.maxAlternatives = 1;
      let done = false;
      r.onresult = (e) => { done = true; resolve((e.results[0][0].transcript || "").toLowerCase().trim()); };
      r.onerror = (e) => { if (!done) { done = true; reject(new Error(e.error || "Fehler")); } };
      r.onend = () => { if (!done) { done = true; reject(new Error("nichts gehört")); } };
      try { r.start(); } catch (e) { reject(e); }
    });
  }

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
    const fixBtn = s.secure ? "" :
      ' <button class="btn" id="sec-fix" style="margin:0 0 0 8px;padding:4px 12px">Jetzt beheben</button>';
    return `<div class="hint2" style="display:flex;align-items:center">Gesamtstatus: <b>&nbsp;${overall}</b> · Stand ${esc((s.ts || "").replace("T", " ").slice(0, 16))}${fixBtn}</div>
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
      if (!title) return toast("Titel fehlt", "warn");
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
      if (!name) return toast("Name fehlt", "warn");
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
      if (!name) return toast("Name fehlt", "warn");
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
    const mb = (n) => (n / 1e6).toFixed(0) + " MB";
    const ttsOpts = (tts.options || []).map((v) =>
      `<option value="${esc(v.id)}" ${v.id === tts.current ? "selected" : ""}>${esc(v.label)}${v.installed ? " ✓" : " (lädt bei 1. Nutzung)"}</option>`).join("");
    const ttsList = (tts.options || []).map((v) => `<div class="mgmt-row">
        <div><div class="m-title">${esc(v.label)} ${v.installed ? '<span style="color:var(--accent)">✓ geladen</span>' : '<span style="opacity:.5">nicht geladen</span>'}</div>
          <div class="m-sub">${esc(v.id)}${v.installed ? " · " + mb(v.size) : ""}</div></div>
        <span class="board-spacer"></span>
        ${v.installed
          ? `<button class="lnk" data-voicedel="${esc(v.id)}">löschen</button>`
          : `<button class="lnk" data-voicedl="${esc(v.id)}">herunterladen</button>`}</div>`).join("");
    const sec = me.role === "admin"
      ? await fetch("/api/system/security").then((r) => r.json()).catch(() => ({})) : {};
    const gb = (n) => (n / 1e9).toFixed(1) + " GB";
    const reach = models.reachable;
    const labels = settings.model_labels || {};
    const mlabel = (n) => labels[n] || n;                 // Anzeigename
    const runningNames = new Set((models.running || []).map((m) => m.name));
    const running = (models.running || []).map((m) => `${esc(mlabel(m.name))} (VRAM ${gb(m.size_vram || 0)})`).join(" · ") || "keine geladen";
    // Modelle als Kacheln (wie Skills): Anzeigename, Größe, geladen?, umbenennen/löschen
    const availList = (models.available || []).map((m) => `<div class="skill-tile" data-model2="${esc(m.name)}">
        <div class="skill-top">
          <div class="skill-name">${esc(mlabel(m.name))} ${runningNames.has(m.name) ? '<span style="color:var(--accent)">● geladen</span>' : ""}</div>
        </div>
        <div class="skill-desc">${esc(m.name)} · ${gb(m.size)}</div>
        <div class="chat-actions"><button class="lnk" data-modelrename="${esc(m.name)}">umbenennen</button>
          <button class="lnk" data-delmodel="${esc(m.name)}">löschen</button></div>
      </div>`).join("") || '<div class="hint2">noch keine Modelle geladen</div>';

    const SUGGEST = ["llama3.1:8b", "qwen2.5-coder:7b", "qwen2.5:7b", "llama3.2:3b",
                     "mistral", "phi3", "gemma2:9b"];
    const names = (models.available || []).map((m) => m.name);   // NUR installierte
    const noModels = !names.length;
    const uniq = (a) => [...new Set(a.filter(Boolean))];
    const active = settings.ollama_model || "";
    const activeOpts = ['<option value="">— erstes verfügbares —</option>']
      .concat(names.map((n) => `<option value="${esc(n)}" ${n === active ? "selected" : ""}>${esc(mlabel(n))}</option>`)).join("");
    const pullOpts = uniq([...SUGGEST, ...names]).map((m) => `<option value="${esc(m)}">`).join("");
    // Agenten-Dropdowns: NUR installierte Modelle (keine Vorschläge), mit Anzeigename
    const agOpts = (cur) => uniq([cur, ...names])
      .map((m) => `<option value="${esc(m)}" ${m === cur ? "selected" : ""}>${esc(mlabel(m))}</option>`).join("");
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
      <div class="row">
        <div class="ac-wrap" style="flex:1">
          <input id="pull-name" autocomplete="off" placeholder="z. B. gemma · llama3.1:8b · hf.co/…-GGUF" style="width:100%"/>
          <div class="ac-menu" id="pull-menu" hidden></div>
        </div>
        <button class="btn" id="pull-go">⤓ Laden</button>
      </div>
      <div class="chips">${SUGGEST.map((m) => `<button class="chip" data-model="${m}">${m}</button>`).join("")}</div>
      <div class="progress" id="pull-progress" hidden><i></i></div>
      <div class="hint2" id="pull-msg">${noModels ? "Noch kein Modell geladen." : ""}</div>
      <div class="hint2">Auch <b>HuggingFace</b>: <code>hf.co/&lt;user&gt;/&lt;repo&gt;-GGUF</code></div>
      <div class="v-head" style="margin-top:12px">UNSERE MODELLE (${(models.available || []).length})</div>
      <div id="model-list" class="skill-grid">${availList}</div>
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
      <div class="v-head" style="margin-top:12px">STIMMEN · HERUNTERGELADEN?</div>
      <div id="tts-list">${ttsList}</div>
      <div class="hint2" style="margin-top:6px">Eigene Piper-Stimme nachladen (Format <code>de_DE-name-quality</code>) – hunderte auf HuggingFace (rhasspy/piper-voices).</div>
      <div class="row" style="margin-top:6px">
        <input id="tts-custom" placeholder="z. B. de_DE-thorsten_emotional-medium" style="flex:1"/>
        <button class="btn" id="tts-custom-dl">⤓ Laden</button>
      </div>
      <div class="v-head" style="margin-top:14px">ENGINE · REALISTISCH &amp; SCHNELL (ELEVENLABS)</div>
      <div class="hint2">Optional statt Piper/Whisper: <b>ElevenLabs</b> (Cloud, API-Key nötig, kostet Guthaben) –
        sehr natürliche Stimme + sehr schnelle Erkennung (flash v2.5 / Scribe). Fällt bei Störung automatisch auf lokal zurück.</div>
      <div class="row" style="margin-top:6px">
        <span class="hint2">Sprechen</span>
        <select id="el-tts" style="max-width:170px">
          <option value="piper" ${settings.tts_engine !== "elevenlabs" ? "selected" : ""}>Piper (lokal)</option>
          <option value="elevenlabs" ${settings.tts_engine === "elevenlabs" ? "selected" : ""}>ElevenLabs</option>
        </select>
        <span class="hint2">Verstehen</span>
        <select id="el-stt" style="max-width:170px">
          <option value="whisper" ${settings.stt_engine !== "elevenlabs" ? "selected" : ""}>Whisper (lokal)</option>
          <option value="elevenlabs" ${settings.stt_engine === "elevenlabs" ? "selected" : ""}>ElevenLabs</option>
        </select>
      </div>
      <label>ElevenLabs API-Key ${settings.elevenlabs_key_set ? "✓ gesetzt" : ""}
        <input id="el-key" type="password" placeholder="${settings.elevenlabs_key_set ? "•••• (leer = behalten)" : "xi-…"}"/></label>
      <div class="row" style="margin-top:6px">
        <select id="el-voice" style="flex:1">
          ${settings.elevenlabs_voice ? `<option value="${esc(settings.elevenlabs_voice)}" selected>${esc(settings.elevenlabs_voice)}</option>` : '<option value="">— Stimme wählen (erst „Stimmen laden") —</option>'}
        </select>
        <button class="btn" id="el-voices">Stimmen laden</button>
        <button class="btn primary" id="el-save" style="margin-top:0">Engine speichern</button>
      </div>
      <div class="hint2" id="el-msg"></div>
      <label style="margin-top:12px">Freihand-Weckwort (leer = aus)</label>
      <div class="hint2">Im Freihand-Modus hört er zu; sagst du dieses Wort, wird alles danach als Befehl ausgeführt (z. B. „Computer, welches Datum ist heute?"). Braucht Chrome/Edge.</div>
      <div class="row" style="align-items:center;margin-top:6px">
        <input id="wake-word" value="${esc(settings.wake_word || "")}" placeholder="z. B. computer · vault · jarvis" style="flex:1"/>
        <button class="btn" id="wake-rec">🎤 Einsprechen</button>
        <button class="btn" id="wake-test">🔊 Testen</button>
        <button class="btn" id="wake-save">Weckwort setzen</button>
      </div>
      <div class="hint2" id="wake-msg"></div>
      <hr/><h3 class="set-h">Freihand am Server (Weckwort · 100 % lokal)</h3>
      <div class="hint2">Der Server hört über sein <b>eigenes Mikro</b> auf ein Weckwort (openWakeWord), beantwortet lokal und spricht über die <b>Server-Lautsprecher</b> – ohne Browser, ohne Cloud, auch iPhone-unabhängig. Einmal am Server einrichten:
        <code>sudo scripts/setup-voice-daemon.sh</code></div>
      <div class="row" style="align-items:center;margin-top:6px">
        <select id="oww-model" style="flex:1">
          ${["hey_jarvis", "alexa", "hey_mycroft", "hey_rhasspy"].map((m) => `<option value="${m}" ${settings.owakeword_model === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <span class="hint2">Empfindlichkeit</span>
        <input id="oww-th" type="number" step="0.05" min="0.1" max="0.95" value="${esc(settings.owakeword_threshold ?? 0.5)}" style="max-width:80px"/>
        <button class="btn" id="oww-save">Speichern</button>
      </div>
      <div class="hint2">Läuft der Dienst: <code>systemctl status vault-voice</code> · Log: <code>journalctl -u vault-voice -f</code>. Weckwort greift nach dem Speichern automatisch.</div>
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

    // Eigenes Autocomplete-Dropdown (styled, statt hässlichem Browser-Datalist)
    const pullName = document.getElementById("pull-name");
    const acMenu = document.getElementById("pull-menu");
    const localItems = (q) => uniq([...SUGGEST, ...names])
      .filter((m) => m.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8).map((m) => ({ val: m, name: m, sub: names.includes(m) ? "installiert" : "Ollama" }));
    const renderMenu = (items) => {
      if (!items.length) { acMenu.hidden = true; acMenu.innerHTML = ""; return; }
      acMenu.innerHTML = items.map((it) =>
        `<div class="ac-item" data-val="${esc(it.val)}"><div class="ac-name">${esc(it.name)}</div>${it.sub ? `<div class="ac-sub">${esc(it.sub)}</div>` : ""}</div>`).join("");
      acMenu.hidden = false;
      acMenu.querySelectorAll(".ac-item").forEach((el) => { el.onmousedown = (e) => {
        e.preventDefault(); pullName.value = el.dataset.val; acMenu.hidden = true;
      }; });
    };
    if (pullName && acMenu) {
      let searchTimer = null;
      pullName.addEventListener("input", () => {
        const q = pullName.value.trim();
        if (q.length < 3 || q.startsWith("hf.co/")) { renderMenu(localItems(q)); return; }
        clearTimeout(searchTimer);
        renderMenu([{ val: q, name: "suche …", sub: "" }]);
        searchTimer = setTimeout(async () => {
          const j = await fetch("/api/models/search?q=" + encodeURIComponent(q))
            .then((r) => r.json()).catch(() => ({ results: [] }));
          const items = (j.results || []).slice(0, 20).map((r) => ({
            val: r.pull, name: r.id || r.pull,
            sub: r.downloads != null ? r.downloads.toLocaleString("de-DE") + " Downloads" : "Ollama" }));
          renderMenu(items.length ? items : localItems(q));
        }, 300);
      });
      pullName.addEventListener("focus", () => { if (pullName.value.trim().length < 3) renderMenu(localItems("")); });
      pullName.addEventListener("blur", () => setTimeout(() => { acMenu.hidden = true; }, 150));
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
      if (!name) return toast("Name fehlt", "warn");
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

    // Stimmen herunterladen / löschen / eigene laden
    const voiceDl = async (vid, btn) => {
      if (btn) { btn.textContent = "lädt …"; btn.style.pointerEvents = "none"; }
      const j = await fetch("/api/voice/tts_download", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: vid }) }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) toast(`Stimme geladen (${((j.size || 0) / 1e6).toFixed(0)} MB).`, "ok");
      else toast("Laden fehlgeschlagen: " + (j.error || "?"), "warn");
      openSettings();
    };
    settingsBody.querySelectorAll("[data-voicedl]").forEach((b) => { b.onclick = () => voiceDl(b.dataset.voicedl, b); });
    settingsBody.querySelectorAll("[data-voicedel]").forEach((b) => { b.onclick = async () => {
      if (!confirm(`Stimme ${b.dataset.voicedel} löschen?`)) return;
      await fetch("/api/voice/tts_delete", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: b.dataset.voicedel }) }).catch(() => {});
      openSettings();
    }; });
    const ttsCustomDl = document.getElementById("tts-custom-dl");
    if (ttsCustomDl) ttsCustomDl.onclick = () => {
      const vid = document.getElementById("tts-custom").value.trim();
      if (!vid) return;
      voiceDl(vid, ttsCustomDl);
    };

    // ElevenLabs: Stimmen laden + Engine speichern
    const elVoices = document.getElementById("el-voices");
    if (elVoices) elVoices.onclick = async () => {
      const msg = document.getElementById("el-msg");
      msg.textContent = "lade Stimmen …";
      const j = await fetch("/api/voice/elevenlabs/voices", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: document.getElementById("el-key").value.trim() }) })
        .then((r) => r.json()).catch(() => ({}));
      if (!j.ok) { msg.textContent = "Fehler: " + (j.error || "Key fehlt/falsch?"); return; }
      const cur = settings.elevenlabs_voice || "";
      document.getElementById("el-voice").innerHTML = (j.voices || []).map((v) =>
        `<option value="${esc(v.id)}" ${v.id === cur ? "selected" : ""}>${esc(v.name)}</option>`).join("")
        || '<option value="">keine Stimmen im Konto</option>';
      msg.textContent = `${(j.voices || []).length} Stimme(n) geladen – wählen und „Engine speichern".`;
    };
    const elSave = document.getElementById("el-save");
    if (elSave) elSave.onclick = async () => {
      const patch = { tts_engine: document.getElementById("el-tts").value,
        stt_engine: document.getElementById("el-stt").value,
        elevenlabs_voice: document.getElementById("el-voice").value };
      const k = document.getElementById("el-key").value.trim();
      if (k) patch.elevenlabs_key = k;
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch) }).catch(() => {});
      toast("Sprach-Engine gespeichert.", "ok");
      openSettings();
    };

    // Weckwort einsprechen (er übernimmt, wie er dich versteht) + testen
    const wakeMsg = document.getElementById("wake-msg");
    const wakeRec = document.getElementById("wake-rec");
    if (wakeRec) wakeRec.onclick = async () => {
      wakeMsg.textContent = "🎤 höre zu – sag jetzt dein Weckwort …";
      try {
        const t = await recognizeOnce();
        document.getElementById("wake-word").value = t;
        wakeMsg.textContent = `Verstanden: „${t}". Jetzt „Weckwort setzen" klicken, dann „Testen".`;
      } catch (e) { wakeMsg.textContent = "Nicht erkannt: " + e.message; }
    };
    const wakeTest = document.getElementById("wake-test");
    if (wakeTest) wakeTest.onclick = async () => {
      const w = document.getElementById("wake-word").value.trim().toLowerCase();
      if (!w) { wakeMsg.textContent = "Erst ein Weckwort einsprechen/setzen."; return; }
      wakeMsg.textContent = "🔊 höre zu – sag dein Weckwort …";
      try {
        const t = await recognizeOnce();
        wakeMsg.textContent = t.includes(w)
          ? `✓ Erkannt! (gehört: „${t}")`
          : `✗ Nicht erkannt. Gehört: „${t}". Tipp: „Einsprechen" nutzen und übernehmen.`;
      } catch (e) { wakeMsg.textContent = "Fehler: " + e.message; }
    };

    // Freihand-Weckwort speichern
    const wakeSave = document.getElementById("wake-save");
    if (wakeSave) wakeSave.onclick = async () => {
      const wake_word = document.getElementById("wake-word").value.trim();
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wake_word }) }).catch(() => {});
      wakeSave.textContent = "✓ gesetzt";
      setTimeout(() => (wakeSave.textContent = "Weckwort setzen"), 1500);
    };

    // Server-Weckwort (openWakeWord) speichern
    const owwSave = document.getElementById("oww-save");
    if (owwSave) owwSave.onclick = async () => {
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owakeword_model: document.getElementById("oww-model").value,
          owakeword_threshold: parseFloat(document.getElementById("oww-th").value) || 0.5 }) }).catch(() => {});
      owwSave.textContent = "✓ gespeichert";
      setTimeout(() => (owwSave.textContent = "Speichern"), 1500);
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
      if (j.updater === false) {
        updMsg.innerHTML += ' <span style="color:#f59e0b">⚠ Host-Updater fehlt – einmal <code>./update.sh</code> im Terminal ausführen, dann funktioniert der Button.</span>';
      }
    };
    if (updCheck) updCheck.onclick = runCheck;
    if (updRun) updRun.onclick = () => { if (!updRun.disabled) doUpdate(); };
    runCheck();   // beim Öffnen automatisch prüfen

    // Sicherheit: 'Jetzt beheben' → Härtung am Host anstoßen
    const secFix = document.getElementById("sec-fix");
    if (secFix) secFix.onclick = async () => {
      if (!confirm("Härtung jetzt ausführen? (Firewall LAN-only, SSH, fail2ban, Updates – läuft am Host)")) return;
      secFix.disabled = true; secFix.textContent = "läuft …";
      const j = await fetch("/api/system/harden", { method: "POST" }).then((r) => r.json()).catch(() => ({}));
      toast(j.ok ? "Härtung läuft am Host – Bericht aktualisiert sich in 1-2 Minuten." : ("Fehler: " + (j.error || "?")), j.ok ? "ok" : "warn");
      setTimeout(openSettings, 90000);
    };

    // MFA aktivieren/deaktivieren
    const mfaOn = document.getElementById("mfa-on");
    if (mfaOn) mfaOn.onclick = async () => {
      const j = await fetch("/api/mfa/enable", { method: "POST" }).then((r) => r.json()).catch(() => ({}));
      if (!j.qr_svg && !j.secret) return toast("MFA-Setup nicht möglich.", "warn");
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
        if (v.ok) openSettings(); else toast("Code falsch.", "warn");
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

    // Modell umbenennen (nur Anzeigename)
    settingsBody.querySelectorAll("[data-modelrename]").forEach((b) => { b.onclick = async () => {
      const name = b.dataset.modelrename;
      const cur = (settings.model_labels || {})[name] || "";
      const nv = prompt(`Anzeigename für „${name}":`, cur);
      if (nv === null) return;
      const ml = { ...(settings.model_labels || {}) };
      if (nv.trim()) ml[name] = nv.trim(); else delete ml[name];
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_labels: ml }) }).catch(() => {});
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
      toast("Agenten-Modelle gespeichert.", "ok");
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

    makeCollapsible(settingsBody);   // Abschnitte ein-/ausklappbar (zuletzt, nach dem Verdrahten)
  }

  // ---- UPDATE (mit Fortschritt) -------------------------------------------
  async function doUpdate() {
    if (!confirm("V.A.U.L.T. aus Git aktualisieren und Container neu bauen?")) return;
    const before = await fetch("/api/version").then((r) => r.json()).then((j) => j.commit).catch(() => "?");
    const r = await fetch("/api/system/update", { method: "POST" }).then((x) => x.json()).catch(() => ({}));
    if (!r.ok) { toast("Update nicht möglich: " + (r.error || "?"), "warn"); return; }
    openUpdateProgress(before);
  }

  function openUpdateProgress(before) {
    open("System-Update läuft", `
      <div class="hint2" id="upd-elapsed">Schritt 1/3: Code holen …</div>
      <div class="upd-log" id="upd-log"></div>
      <div id="upd-final"></div>`);
    const start = Date.now();
    const logEl = document.getElementById("upd-log");
    const elEl = document.getElementById("upd-elapsed");
    const finEl = document.getElementById("upd-final");
    let sawDown = false, finished = false;
    const secs = () => Math.round((Date.now() - start) / 1000);
    const tick = setInterval(() => { if (!finished) elEl.dataset.t = secs(); }, 1000);
    const finish = (ver) => {
      finished = true; clearInterval(tick); clearInterval(pollTimer);
      elEl.textContent = `✓ fertig in ${secs()} s`;
      finEl.innerHTML = `<div class="hint2" style="margin-top:10px">Version: <b>${esc(ver || "?")}</b>${before && before !== "?" ? " (vorher " + esc(before) + ")" : ""}. Container läuft neu.</div>
        <button class="btn primary" id="upd-reload">Seite neu laden</button>`;
      document.getElementById("upd-reload").onclick = () => location.reload();
    };
    const poll = async () => {
      if (finished) return;
      let up = true, ver = null;
      try {
        const lg = await fetch("/api/system/update/log", { cache: "no-store" }).then((r) => r.json());
        if (lg.lines) { logEl.textContent = lg.lines.join("\n"); logEl.scrollTop = logEl.scrollHeight; }
      } catch (_) { up = false; }
      try { ver = await fetch("/api/version", { cache: "no-store" }).then((r) => r.json()).then((j) => j.commit); }
      catch (_) { up = false; }
      if (!up) { sawDown = true; elEl.textContent = `Container wird neu gebaut & gestartet … ${secs()} s`; }
      else if (!sawDown) { elEl.textContent = `Update läuft … ${secs()} s`; }
      // Host-Updater nicht aktiv? (Log bleibt beim Warte-Text, nichts passiert)
      const waiting = (logEl.textContent || "").includes("Warte auf den Host-Updater")
        && !(logEl.textContent || "").includes("Git-Update");
      if (secs() > 25 && !sawDown && waiting && !finEl.innerHTML) {
        finEl.innerHTML = `<div class="hint2" style="margin-top:8px;color:#f59e0b">Der Host-Updater ist noch nicht aktiv.
          Führe einmal im Terminal <code>./update.sh</code> aus (richtet ihn ein) – danach klappt der Button.</div>`;
      }
      if (sawDown && up && ver) finish(ver);        // war weg, ist wieder da → fertig
      if (secs() > 180 && !finished) finish(ver);   // Sicherheits-Fallback
    };
    const pollTimer = setInterval(poll, 2500);
    poll();
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
