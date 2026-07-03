# V.A.U.L.T. – Bauplan für dein eigenes Agentic OS

> Ziel: Ein „Jarvis-artiges" Agentic OS auf Basis von Ubuntu, mit neuronalem
> Netz / „Gehirn" in der Mitte, Command-Deck (Task-Buttons) rechts, Memory über
> Obsidian, umschaltbaren KI-Providern (Ollama / Claude / OpenAI / opencode …)
> und der Regel: **kein Provider verbunden → Gehirn bleibt leer/dunkel.**

---

## 1. Die Kernfrage: Eigenes OS, Ubuntu, oder Docker?

**Kurz: Baue KEIN eigenes Betriebssystem. Nimm Ubuntu Server LTS als Basis und
bau das Agentic OS als Anwendungs-Schicht (Appliance) darauf. Die App-Dienste
laufen in Docker, lokale Modelle (Ollama) laufen mit GPU-Zugriff.**

### Warum kein „echtes" eigenes OS?
Ein echtes OS von Grund auf (eigener Kernel, Treiber, Init-System, Paket­verwaltung)
ist ein Mehr-Jahres-Projekt und bringt dir **null** Mehrwert für dein Ziel. Du
würdest GPU-Treiber, CUDA, Sicherheits­updates und das ganze Linux-Ökosystem
verlieren. Alles, was du willst – das HUD, die Tasks, das Gehirn, die Provider –
ist eine **Software-Schicht über einem Linux**, kein neues Betriebssystem.

Was den „Das ist MEIN OS"-Effekt erzeugt, ist nicht ein eigener Kernel, sondern:
- **Auto-Login + Chromium-Kiosk** → der Rechner bootet direkt in dein Vollbild-HUD.
- **Eigener Boot-Splash** (Plymouth-Theme mit V.A.U.L.T.-Branding).
- **systemd-Dienste**, die alles beim Start hochfahren.

Das fühlt sich an wie ein eigenes OS, ist aber wartbar, sicher und in Tagen statt
Jahren baubar.

### Warum nicht „alles nur Docker"?
Docker ist perfekt für die **App-Dienste** (Backend, Frontend, Datenbank). Aber
Docker ist **kein OS** – es braucht darunter ein echtes Linux. Vor allem:
- **GPU + Ollama** brauchen Treiber auf dem Host (Docker greift nur durch).
- **Kiosk-Modus, Boot-Splash, Autostart** leben auf Host-Ebene.

### Empfehlung (Hybrid)
| Schicht | Technik |
|--------|---------|
| **Host** | Ubuntu Server **24.04 LTS** (bare metal auf dem KI-Server) |
| **GPU / lokale Modelle** | NVIDIA-Treiber + CUDA + **Ollama** (nativ oder Container mit GPU) |
| **App-Dienste** | **Docker Compose** (Backend, Frontend, evtl. DB) |
| **Memory** | **Obsidian-Vault** (Markdown-Ordner auf dem Host, in Container gemountet) |
| **„OS-Gefühl"** | Auto-Login → Chromium-Kiosk → Vollbild-HUD + Plymouth-Splash |

> **Ubuntu LTS vs. „LTSC":** Es gibt kein „Ubuntu LTSC" (das ist Windows-Sprech).
> Bei Ubuntu heißt es **LTS** (Long Term Support). Nimm **24.04 LTS** (Support bis
> 2029, mit ESM länger). Als Basis empfehle ich **Ubuntu Server** (schlank, kein
> Desktop-Ballast) + minimaler X-/Wayland-Stack nur für den Kiosk-Browser.

---

## 2. Architektur im Überblick

```
┌───────────────────────────────────────────────────────────────┐
│  HOST: Ubuntu Server 24.04 LTS  (128 GB RAM, GPU, KI-Server)   │
│                                                                │
│  ┌─────────────┐   ┌──────────────────── Docker Compose ─────┐ │
│  │  Ollama     │   │                                          │ │
│  │ (GPU/CUDA)  │◄──┤  orchestrator  (FastAPI + WebSocket)     │ │
│  └─────────────┘   │   • Provider-Registry (ollama/claude/…)  │ │
│         ▲          │   • Verbindungsstatus  ("leer bis link") │ │
│         │          │   • Skill-/Task-Engine + Runner          │ │
│         │          │   • liest/schreibt Vault (Memory)        │ │
│  ┌──────┴──────┐   │                                          │ │
│  │  Cloud-APIs │   │  frontend  (Next.js HUD)                 │ │
│  │ Claude/OpenAI│  │   • Neuronales Netz (three.js/canvas)    │ │
│  │  opencode   │   │   • Command Deck (Task-Buttons)          │ │
│  └─────────────┘   │   • System Vitals · Directives · Docs    │ │
│                    └──────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────── Obsidian-Vault (Markdown = Gehirn) ───────┐ │
│  │   raw/  wiki/  output/  projects/  ops/  runs/            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Kiosk: Chromium --kiosk http://localhost:3000  (Autostart)    │
└───────────────────────────────────────────────────────────────┘
```

**Datenfluss bei einem Klick auf „INBOX BRIEF":**
1. Frontend schickt `POST /tasks/inbox-brief` an den Orchestrator.
2. Orchestrator prüft: Ist ein Provider verbunden? Wenn nein → Task blockiert, Gehirn bleibt leer.
3. Wenn ja: Runner startet den Task, ruft die nötigen Skills über den aktiven Provider auf.
4. Während der Ausführung sendet der Orchestrator **Live-Events** per WebSocket
   (`queued → thinking → writing → done`) + welche „Hirn-Segmente" aktiv sind.
5. Frontend färbt Knoten/Segmente (Denken simulieren), Ergebnis landet im Vault
   (`vault/output/…`) und taucht in „Documents" auf.

---

## 3. Das „Gehirn" – Zustände & Visualisierung

Aus den Screenshots ergeben sich klare Zustände. Das Netz ist ein
force-directed Graph aus Partikeln (Knoten + Kanten), gerendert mit **three.js /
react-three-fiber** (WebGL) oder als leichtere 2D-Canvas-Variante.

| Zustand | Statuszeile | Farbe | Verhalten |
|---------|-------------|-------|-----------|
| **Kein Provider** | `LINK · OFFLINE` | fast schwarz | Netz **leer/dormant**, nur ein paar schwache Punkte |
| **Verbunden, untätig** | `CORE · IDLE` | Gold/Amber | Netz „atmet" langsam, leichte Bewegung |
| **Task läuft** | `CORE · WORKING` | Magenta/Pink | Aktive Pfade leuchten auf, Puls entlang der Kanten |
| **Spezialmodus** (z. B. Research) | `CORE · SCAN` | Teal | eigenes Farbthema pro Domäne |

**„Hirn-Segmente" = Skill-Domänen:** Wir clustern die Knoten in Bereiche
(z. B. *Inbox*, *Research*, *Content*, *Ops*). Läuft ein Task aus einer Domäne,
leuchtet das zugehörige Segment auf → wirkt wie „dieser Hirnbereich rechnet".

**„Leer bis verbunden" (dein Wunsch):** Das Frontend abonniert
`GET /providers/status` bzw. den WebSocket. Solange `connected == false`, wird
nur ein leeres, dunkles Feld gezeigt. Bei der **ersten** erfolgreichen Verbindung
spielt eine „Boot-up"-Animation: Knoten erscheinen, Kanten wachsen, das Gehirn
„erwacht".

---

## 4. Das Provider-System (dein Multi-KI-Wunsch)

Kern-Idee: **ein Adapter-Interface, viele Backends.** In den Einstellungen fügst
du einen Provider hinzu; erst wenn dessen Health-Check grün ist, gilt das System
als „verbunden" und das Gehirn erscheint.

```
providers/
  ollama.py      → lokal, GPU, kostenlos   (Health: GET /api/tags)
  anthropic.py   → Claude API              (Health: Modell-Ping)
  openai.py      → ChatGPT/OpenAI API      (Health: Modell-Ping)
  opencode.py    → opencode                (Health: je nach Setup)
  claude_code.py → Claude Code headless (claude -p)  (optional als Provider)
```

Jeder Adapter implementiert dieselben Methoden: `health()`, `chat()`,
`stream()`. Der aktive Provider ist umschaltbar (Dropdown im Settings-Panel).
API-Keys werden verschlüsselt/lokal gespeichert (z. B. `.env` + Docker-Secret,
nie ins Git).

> Auf deiner Hardware (128 GB RAM + GPU) ist **Ollama lokal** der Default:
> kostenlos, privat, schnell. Cloud-Provider (Claude/OpenAI) sind optional
> zuschaltbar für die stärksten Modelle.

---

## 5. Skills, Tasks & Automations

Wir bauen auf dem vorhandenen `Agentic-hub`-Gerüst auf:
- **Skills** (`.claude/skills/…`) bleiben die Bausteine (ein Skill = eine Aufgabe).
- **Tasks** = benannte Jobs im Command Deck (z. B. `INBOX BRIEF`, `TREND SCAN`),
  die **einen oder mehrere Skills** über den aktiven Provider verketten.
- **Automations** (`automations/…`) = Tasks mit Zeitplan (cron/systemd-timer).
- **Runner** = der Dienst, der Tasks ausführt, Events streamt und Ergebnisse in
  den Vault schreibt (inkl. `runs/`-Log für Loop-Engineering / Selbstverbesserung).

Command-Deck-Buttons aus dem Video/Screenshot (Startset):
`METRICS PULL · AM REPORT · INBOX BRIEF · GH TRENDING · TREND SCAN · YT WEEK ·
PLAN TODAY · PLAN TMRW · WK REVIEW · VAULT CLEAN`

---

## 6. Tech-Stack (Empfehlung)

| Bereich | Wahl | Warum |
|---------|------|-------|
| Host-OS | Ubuntu Server 24.04 LTS | stabil, GPU-Support, LTS bis 2029 |
| Container | Docker + Compose | saubere Trennung, teilbar (GitHub/Zip) |
| Lokale Modelle | Ollama (+ nvidia-container-toolkit) | GPU, kostenlos, privat |
| Backend | Python **FastAPI** + WebSockets | bestes LLM-Ökosystem, async, einfach |
| Frontend | **Next.js** + React + Tailwind | schnell, Kiosk-tauglich |
| Gehirn-Viz | **react-three-fiber / three.js** | echtes WebGL-Partikelnetz |
| Memory | Obsidian-Vault (Markdown) | „echtes Gehirn", verlinkbar, git-fähig |
| Voice (später) | Piper (TTS) + whisper.cpp (STT) | lokal, kostenlos, „hold space to talk" |

---

## 7. Roadmap in Phasen

**Phase 0 – Basis (Host)**
- Ubuntu Server 24.04 LTS installieren
- GPU-Treiber + CUDA + nvidia-container-toolkit
- Docker + Compose
- Repo klonen/erweitern

**Phase 1 – Memory + Provider (Backend, „leer bis verbunden")**
- Vault übernehmen (`vault/`)
- Orchestrator (FastAPI): Provider-Registry, Health-Checks, `/providers/status`
- Settings-API zum Hinzufügen/Umschalten von Providern
- WebSocket mit Verbindungs- und Task-Events

**Phase 2 – Skills + Task-Engine**
- Task-Definitionen (INBOX BRIEF etc.) → Skills verketten
- Runner + `runs/`-Logging
- Events `queued/thinking/writing/done`

**Phase 3 – Das HUD (Frontend)**
- Layout: links Vitals, Mitte Gehirn + Primary Directive, rechts Command Deck, unten Audio I/O
- Neuronales Netz mit den 4 Zuständen + Segment-Leuchten
- „Boot-up"-Animation bei erster Verbindung

**Phase 4 – Appliance / „OS-Gefühl"**
- Auto-Login + Chromium-Kiosk → Vollbild-HUD beim Boot
- Plymouth-Boot-Splash (V.A.U.L.T.-Branding)
- systemd-Units für orchestrator, runner, ollama

**Phase 5 – Voice (optional)**
- Lokales TTS/STT, „Hold Space to talk", Sprach-Trigger für Tasks

**Phase 6 – Distribution**
- `docker compose up` + Install-Skript → reproduzierbar & teilbar

---

## 8. Aufwand & Realismus
- **Phase 1–3 (funktionsfähiges HUD mit Tasks & lokalem Modell):** der Kern,
  in überschaubarer Zeit machbar – hier steckt 90 % des Nutzens.
- **Phase 4–5 (Kiosk, Splash, Voice):** Politur, macht es zum „echten OS-Erlebnis".
- Wir bauen iterativ: erst im Browser lauffähig, dann in den Kiosk-Boot heben.

---

## 9. Offene Punkte (bitte bestätigen)
1. **GPU-Hersteller?** NVIDIA (CUDA) oder AMD (ROCm) – ändert das lokale Modell-Setup deutlich.
2. **Anzeige:** Hat der KI-Server einen eigenen Monitor (Kiosk bootet direkt ins HUD)
   oder greifst du vom Laptop/anderen Gerät per Browser darauf zu?
3. **v1-Umfang:** Erst das visuelle HUD + Tasks (empfohlen) – oder Voice von Anfang an?
4. **Provider-Priorität für v1:** Nur Ollama lokal, oder gleich auch Claude/OpenAI-Umschaltung?
