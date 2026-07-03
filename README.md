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

HUD öffnen: **`http://<server-ip>:3000`** · mit Mikro/Voice: **`https://<server-ip>:3443`**
(HTTPS via Caddy, beim ersten Aufruf Zertifikatswarnung einmal akzeptieren).

Aktualisieren (zieht neuesten Git-Stand, baut rollend neu, ohne Rückfragen):

```bash
./update.sh          # oder im HUD: ↻-Button oben rechts
```

## Was du im HUD tun kannst

- **Command Deck** (rechts): Tasks per Klick starten.
- **＋ Builder**: eigene **Tasks aus Skills zusammensetzen** und neue **Skills** anlegen —
  so bringst du dein Wissen in wiederverwendbare Aufgaben.
- **⚙ Settings**: Provider umschalten (Ollama lokal · Claude · OpenAI), Keys bleiben lokal.
- **↻ Update**: aus Git aktualisieren.
- **Voice**: Space halten zum Sprechen → Befehl löst passenden Task aus (braucht HTTPS/localhost).
- **Projekt-Launcher** (unter dem Gehirn): Ziel eingeben → der Agent **plant**, **stellt
  spezialisierte Rollen-Agenten ein** (planner/coder/…), **lädt automatisch das passende
  Ollama-Modell**, ein **Verifier prüft** und lässt nachbessern. Ergebnis → `vault/projects/`.

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
├── services/
│   ├── orchestrator/             # 🤖 Backend + 📊 HUD
│   │   ├── app/  (main, providers/, tasks, skills, settings, agents, projects, voice, vitals)
│   │   └── static/  (index.html, brain.js, hud.js, ui.js, voice.js, styles.css)
│   └── caddy/                    # 🔒 HTTPS-Reverse-Proxy
├── vault/                        # 🧠 Memory (Obsidian)
│   └── raw/ wiki/ output/ projects/ ops/ runs/
├── .claude/skills/               # ⚡ Skill-Bibliothek
└── docs/OS-PLAN.md               # Architektur- & Bauplan
```

## Doku

- Architektur & Bauplan: [`docs/OS-PLAN.md`](docs/OS-PLAN.md)
- Video-Transkript (DE): [`vault/raw/2026-07-03-agentic-os-transkript-de.md`](vault/raw/2026-07-03-agentic-os-transkript-de.md)
