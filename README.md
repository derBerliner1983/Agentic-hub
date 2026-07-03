# Agentic Hub 🧠⚡

Ein persönliches **Agentic OS** für **Claude Code** – nachgebaut nach dem Video
[„The Agentic OS Setup That Will 10x Claude Code"](https://www.youtube.com/watch?v=HRw-vP0j8OM)
von Chase AI.

Kein klassisches Betriebssystem, sondern ein 4-Schichten-System, das aus gelegentlichem Prompten
ein strukturiertes Arbeitssystem macht.

## Die 4 Schichten

| Schicht | Ordner | Zweck |
|---------|--------|-------|
| 🧠 Memory | `vault/` | Dauerhaftes Gedächtnis (Obsidian-kompatibles Markdown) |
| ⚡ Skills | `.claude/skills/` | Wiederverwendbare Workflows |
| 🤖 Automations | `automations/` | Skills, die zeitgesteuert laufen |
| 📊 Dashboard | `dashboard/` | Klickbare Oberfläche + Observability |

## One-Click-Installation (V.A.U.L.T. OS)

Repo herunterladen und **ein** Skript ausführen – es installiert alles Fehlende
automatisch (Docker, docker compose, Ollama) und richtet den Betriebsmodus ein:

```bash
git clone <repo-url> && cd Agentic-hub
./install.sh          # fragt EINMALIG den Modus (headless/both/kiosk), macht den Rest allein
```

Aktualisieren (zieht den neuesten Git-Stand, baut rollend neu, ohne Rückfragen):

```bash
./update.sh
```

Details: siehe [`docs/OS-PLAN.md`](docs/OS-PLAN.md) (§10 Spezifikation, §11 Installer & Updates).

## Schnellstart (Agentic-Hub-Skripte)

```bash
# 1. Dashboard ansehen
cd dashboard && python3 server.py      # http://localhost:8080

# 2. Einen Skill manuell ausführen
./automations/run-skill.sh deep-research "Wie funktionieren MCP-Server?"

# 3. Automation einrichten (cron, täglich 07:00)
crontab -e
# 0 7 * * * cd /pfad/zu/Agentic-hub && ./automations/morning-scan.sh >> automations/morning-scan.log 2>&1
```

## 📖 Volle Anleitung

Die komplette Schritt-für-Schritt-Anleitung (Deutsch) steht in **[ANLEITUNG.md](ANLEITUNG.md)**.

## Struktur

```
Agentic-hub/
├── CLAUDE.md              # Projekt-Kontext (wird bei jedem Prompt mitgeschickt)
├── ANLEITUNG.md           # Ausführliche Aufbauanleitung
├── vault/                 # 🧠 Memory
│   ├── CLAUDE.md          #   Kontext des Vaults
│   ├── raw/  wiki/  output/  projects/  ops/
├── .claude/skills/        # ⚡ Skills
│   ├── youtube-summary/  deep-research/  morning-scan/  skill-creator/
├── automations/           # 🤖 cron-Runner
│   ├── morning-scan.sh  run-skill.sh
└── dashboard/             # 📊 Web-Dashboard
    ├── index.html  server.py
```

## Quellen

- Video: <https://www.youtube.com/watch?v=HRw-vP0j8OM>
- Chase AI Blog: <https://www.chaseai.io/blog/build-claude-code-agentic-os-3-steps>
