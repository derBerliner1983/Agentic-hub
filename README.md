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
  Beim Coder werden Code-Blöcke zusätzlich **real syntax-geprüft** (Sandbox), Fehler
  fließen automatisch in die Nachbesserung.

## Board & Autonom-Modus

Oben im HUD schaltest du zwischen **GEHIRN** (Assistent) und **BOARD** (Kanban) um.

- **Projekte** anlegen (Typ *code* = mit echtem Test), Ziel per **⚙ Plan** automatisch
  in Karten zerlegen, Karten hinzufügen.
- Karten wandern `To-Do → Doing → Review → Done`, du **bewertest** mit Sternen.
- **Autonom-Modus** an → ein Hintergrund-Worker arbeitet To-Do-Karten selbstständig
  ab („wenn er Zeit hat") und legt Ergebnisse in *Review*.
- **Echte Code-Ausführung:** Bei Code-Karten schreibt der Agent Code, **führt ihn in
  einem Wegwerf-Container aus**, und fixt sich bei Fehlern **selbst** in einer
  Schleife (schreiben → testen → Fehler → fixen → erneut), bis es läuft. Python/Node/
  Bash out-of-the-box; Android/Windows-GUI folgt über erweiterbare Runner-Profile.

## Sicherheit

- **Anmeldung mit MFA:** Beim ersten Aufruf richtest du unter `/setup` ein Passwort +
  **TOTP (QR-Code für die Authenticator-App)** ein. Danach schützt Login + MFA das
  gesamte HUD, die API und den WebSocket.
  Reset: `instance/auth.json` auf dem Server löschen. Not-Aus: `AUTH_DISABLED=1`.
- **Server-Härtung (Install-Option):** `install.sh` fragt beim Erststart, ob der Server
  abgesichert werden soll — System-Updates + automatische Sicherheitsupdates, Firewall
  **nur LAN / kein Internet** (inkl. Docker-Ports via DOCKER-USER), SSH-Härtung,
  fail2ban. Manuell: `sudo scripts/harden.sh`.
  ⚠ Nicht auf Internet-VPS aktivieren (LAN-only sperrt dich sonst aus).
- **Empfehlung:** HUD über **HTTPS** (`https://<server-ip>:3443`) nutzen — nötig fürs
  Mikrofon und verschlüsselt den Login im LAN.

## Zustände des „Gehirns"

| Zustand | Bedeutung | Farbe |
|---------|-----------|-------|
| `OFFLINE` | kein Provider verbunden → Netz leer/dunkel | grau |
| `IDLE` | verbunden, untätig → Netz atmet | Gold |
| `WORKING` | Task läuft → Puls entlang der Kanten, Domäne leuchtet | Magenta |

Solange kein Modell verbunden ist, bleibt das Gehirn **leer** — erst bei der ersten
Verbindung „bootet" es herein.

## Appliance-Modus (eigenes „OS-Gefühl")

Wählst du bei `./install.sh` den Modus **`both`** oder **`kiosk`** (Server mit Monitor),
bootet der Rechner direkt ins Vollbild-HUD:
- **Chromium-Kiosk** (Wayland/cage) als systemd-Dienst `vault-kiosk.service`
- **V.A.U.L.T.-Boot-Splash** (Plymouth) statt Kernel-Logs
- Kiosk zeigt `http://localhost:3000` (localhost → Mikro/Voice funktionieren)

Fühlt sich an wie ein eigenes OS – ist aber wartbares Ubuntu darunter.

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
│   ├── caddy/                    # 🔒 HTTPS-Reverse-Proxy
│   └── plymouth/vault/           # 🖥 Boot-Splash-Theme (Kiosk)
├── vault/                        # 🧠 Memory (Obsidian)
│   └── raw/ wiki/ output/ projects/ ops/ runs/
├── .claude/skills/               # ⚡ Skill-Bibliothek
└── docs/OS-PLAN.md               # Architektur- & Bauplan
```

## Doku

- Architektur & Bauplan: [`docs/OS-PLAN.md`](docs/OS-PLAN.md)
- Video-Transkript (DE): [`vault/raw/2026-07-03-agentic-os-transkript-de.md`](vault/raw/2026-07-03-agentic-os-transkript-de.md)
