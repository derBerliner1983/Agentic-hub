/* V.A.U.L.T. Notizen – Vault-Memory im Browser ansehen & bearbeiten. */
(function () {
  const listEl = document.getElementById("notes-list");
  const countEl = document.getElementById("notes-count");
  const searchEl = document.getElementById("notes-search");
  const emptyEl = document.getElementById("notes-empty");
  const wrapEl = document.getElementById("notes-edit-wrap");
  const pathEl = document.getElementById("notes-path");
  const bodyEl = document.getElementById("note-body");
  if (!listEl) return;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let all = [];
  let current = null;   // aktueller Pfad
  let loaded = false;

  async function load() {
    try { all = await fetch("/api/notes").then((r) => r.json()); }
    catch (_) { all = []; }
    countEl.textContent = all.length ? `· ${all.length}` : "";
    renderList();
  }

  function renderList() {
    const q = (searchEl.value || "").trim().toLowerCase();
    const items = q ? all.filter((n) => (n.name + " " + n.path).toLowerCase().includes(q)) : all;
    listEl.innerHTML = items.map((n) =>
      `<div class="note-item ${n.path === current ? "active" : ""}" data-path="${esc(n.path)}">
        <div class="n-name">${esc(n.name)}</div>
        <div class="n-meta">${esc(n.folder || "/")} · ${esc(n.ago)}</div></div>`).join("")
      || '<div class="hint2" style="padding:14px">keine Notizen gefunden</div>';
    listEl.querySelectorAll("[data-path]").forEach((el) =>
      (el.onclick = () => openNote(el.dataset.path)));
  }

  async function openNote(path) {
    const j = await fetch("/api/notes/read?path=" + encodeURIComponent(path))
      .then((r) => r.json()).catch(() => null);
    if (!j || j.error) return;
    current = path;
    emptyEl.hidden = true;
    wrapEl.hidden = false;
    pathEl.textContent = path;
    bodyEl.value = j.content;
    renderList();
  }

  document.getElementById("note-save").onclick = async () => {
    if (!current) return;
    const btn = document.getElementById("note-save");
    const j = await fetch("/api/notes/save", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: current, content: bodyEl.value }) })
      .then((r) => r.json()).catch(() => ({}));
    btn.textContent = j.ok ? "✓ gespeichert" : "Fehler";
    setTimeout(() => (btn.textContent = "Speichern"), 1500);
    load();
  };

  document.getElementById("note-del").onclick = async () => {
    if (!current || !confirm(`Notiz „${current}" löschen?`)) return;
    await fetch("/api/notes?path=" + encodeURIComponent(current), { method: "DELETE" });
    current = null; wrapEl.hidden = true; emptyEl.hidden = false; load();
  };

  document.getElementById("note-new").onclick = () => {
    let name = prompt("Dateiname (z. B. raw/2026-07-05-idee.md):");
    if (!name) return;
    if (!name.endsWith(".md")) name += ".md";
    current = name;
    emptyEl.hidden = true; wrapEl.hidden = false;
    pathEl.textContent = name;
    bodyEl.value = "# " + name.split("/").pop().replace(/\.md$/, "").replace(/-/g, " ") + "\n\n";
    bodyEl.focus();
  };

  searchEl.addEventListener("input", renderList);
  window.addEventListener("vault-view", (e) => {
    if (e.detail === "notes") { load(); loaded = true; }
  });
})();
