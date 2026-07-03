# V.A.U.L.T. – Agentic OS · Projekt-Kontext für Claude Code

Dies ist **V.A.U.L.T.**, ein Agentic OS auf Basis von Ubuntu: ein FastAPI-Orchestrator
mit HUD („Gehirn"-Visualisierung), lokalem Modell (Ollama/ROCm) und einem
Obsidian-Vault als Memory-Layer. Diese Datei wird bei jedem Prompt mitgeschickt.

## Struktur

- `services/orchestrator/` – Backend (FastAPI) + HUD (`static/`). Provider-Adapter,
  WebSocket, Task-Runner. Siehe `services/orchestrator/app/`.
- `docker-compose.yml` – startet den Orchestrator; Ollama läuft auf dem Host.
- `install.sh` / `update.sh` – One-Click-Installer und git-basiertes Update.
- `scripts/` – Host-nahe Einrichtung (Kiosk, Obsidian).
- `vault/` – Memory-Layer (Obsidian-kompatibel, reines Markdown). Siehe `vault/CLAUDE.md`.
- `.claude/skills/` – Skill-Bibliothek (Prompt-Bausteine, wird an Tasks angebunden).
- `docs/OS-PLAN.md` – Architektur- und Bauplan (Deutsch).
- `instance/` – lokale Instanz-Konfiguration (gitignored, überlebt Updates).

## Arbeitskonventionen

- Neue Rohnotizen nach `vault/raw/` als `YYYY-MM-DD-thema.md`.
- Aufbereitete Referenz-Artikel nach `vault/wiki/`.
- Fertige Deliverables nach `vault/output/`; Task-Runner-Ergebnisse nach `vault/runs/`.
- Interne Verlinkung im Obsidian-Stil: `[[dateiname]]`.
- Antworten und Notizen standardmäßig auf Deutsch.

## Neue Tasks / Skills

Tasks sind in `services/orchestrator/app/tasks.py` registriert (id, Titel, Domäne,
Prompt). Wiederverwendbare Prompt-Bausteine liegen als Skills in `.claude/skills/`.
