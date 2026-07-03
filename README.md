# V.A.U.L.T. 🧠 — Agentic OS

**Voice-Activated Unified Logic Terminal** — ein Agentic OS auf Basis von Ubuntu:
ein „Jarvis-artiges" HUD mit neuronalem Netz („Gehirn"), Command Deck für Tasks,
lokalem KI-Modell (Ollama/ROCm) und einem Obsidian-Vault als Gedächtnis.

Inspiriert vom Konzept aus dem Video
[„The Agentic OS Setup That Will 10x Claude Code"](https://www.youtube.com/watch?v=HRw-vP0j8OM)
(Chase AI) — aber als eigenständiges, lokales OS neu gebaut.

## Die 4 Schichten

| Schicht | Ort | Zweck |
|---------|-----|-------|
| 🧠 Memory | `vault/` | Obsidian-Vault (Markdown) — das „echte Gehirn" |
| ⚡ Skills/Tasks | `services/orchestrator/app/tasks.py` · `.claude/skills/` | Wiederverwendbare Workflows |
| 🤖 Orchestrator | `services/orchestrator/` | FastAPI, Provider, WebSocket, Runner |
| 📊 HUD | `services/orchestrator/static/` | Command Deck + „Gehirn"-Visualisierung |

## One-Click-Installation

Repo herunterladen und **ein** Skript ausführen — es installiert alles Fehlende
automatisch (Docker, docker compose, Ollama), richtet den Obsidian-Vault ein und
startet den Stack:

```bash
git clone <repo-url> && cd Agentic-hub
./install.sh          # fragt EINMALIG den Modus (headless/both/kiosk), macht den Rest allein
ollama pull llama3.1  # ein Modell laden → das „Gehirn" erwacht
```

HUD öffnen: **`http://<server-ip>:3000`**

Aktualisieren (zieht neuesten Git-Stand, baut rollend neu, ohne Rückfragen):

```bash
./update.sh
```

## Zustände des „Gehirns"

| Zustand | Bedeutung | Farbe |
|---------|-----------|-------|
| `OFFLINE` | kein Provider verbunden → Netz leer/dunkel | grau |
| `IDLE` | verbunden, untätig → Netz atmet | Gold |
| `WORKING` | Task läuft → Puls entlang der Kanten, Domäne leuchtet | Magenta |

Solange kein Modell verbunden ist, bleibt das Gehirn **leer** — erst bei der ersten
Verbindung „bootet" es herein.

## Struktur

```
Agentic-hub/
├── CLAUDE.md                     # Projekt-Kontext
├── docker-compose.yml            # startet den Orchestrator
├── install.sh · update.sh        # One-Click-Install + git-Update
├── scripts/                      # setup-kiosk.sh · setup-obsidian.sh
├── services/orchestrator/        # 🤖 Backend + 📊 HUD
│   ├── app/  (main, providers/, tasks, events)
│   └── static/  (index.html, brain.js, hud.js, styles.css)
├── vault/                        # 🧠 Memory (Obsidian)
│   └── raw/ wiki/ output/ projects/ ops/ runs/
├── .claude/skills/               # ⚡ Skill-Bibliothek
└── docs/OS-PLAN.md               # Architektur- & Bauplan
```

## Doku

- Architektur & Bauplan: [`docs/OS-PLAN.md`](docs/OS-PLAN.md)
- Video-Transkript (DE): [`vault/raw/2026-07-03-agentic-os-transkript-de.md`](vault/raw/2026-07-03-agentic-os-transkript-de.md)
