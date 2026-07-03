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
  document.getElementById("modal-close").addEventListener("click", close);
  root.addEventListener("click", (e) => { if (e.target === root) close(); });

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- BUILDER (Tasks aus Skills bauen + Skills anlegen) -------------------
  async function openBuilder() {
    const [skills, tasks] = await Promise.all([
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ]);
    const skillOpts = skills.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
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
      await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, domain: document.getElementById("t-domain").value, steps }),
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
      <div class="hint2">Keys werden lokal in instance/settings.json gespeichert (nicht in Git).</div>`);

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
