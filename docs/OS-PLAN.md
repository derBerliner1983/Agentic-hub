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
| **GPU / lokale Modelle** | AMD-Treiber + **ROCm** + **Ollama** (ROCm-Container oder nativ) |
| **App-Dienste** | **Docker Compose** (Backend, Frontend, evtl. DB) |
| **Memory** | **Obsidian-Vault** (Markdown-Ordner auf dem Host, in Container gemountet) |
| **„OS-Gefühl"** | v1: headless, Zugriff per Browser · später optional Kiosk + Plymouth-Splash |

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
| Lokale Modelle | Ollama (+ **ROCm** für AMD) | GPU, kostenlos, privat |
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

**Phase 3 – Das HUD (Frontend)**  ✅ (Grundausbau)
- Layout: links Vitals, Mitte Gehirn + Primary Directive, rechts Command Deck, unten Audio I/O
- Neuronales Netz mit den 4 Zuständen + Segment-Leuchten (pro Domäne)
- „Boot-up"-Animation bei erster Verbindung
- Linke Spalte (System Vitals · Directives · Documents) aus echten Vault-Daten (`/api/vitals`)

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

## 9. Offene Punkte – ENTSCHIEDEN ✅
1. **GPU:** **AMD** → ROCm-Stack (nicht CUDA).
2. **Anzeige:** **Browser-Zugriff vom anderen Gerät** → Server headless, kein Kiosk in v1.
3. **v1-Umfang:** **HUD + Tasks + Voice** von Anfang an.
4. **Provider für v1:** **nur Ollama (lokal)**; Adapter-Interface bleibt offen für Claude/OpenAI/opencode später.

---

## 10. v1 – Festgelegte Spezifikation

### 10.1 Hardware/GPU (AMD + ROCm)
- Ubuntu 24.04 LTS, offizielles **ROCm** installieren (`amdgpu-install`), User in Gruppen `render` + `video`.
- **Ollama mit AMD:** entweder nativ (ROCm erkannt) oder Container `ollama/ollama:rocm`
  mit Zugriff auf `/dev/kfd` und `/dev/dri`.
- Ältere/nicht offiziell unterstützte Karten brauchen evtl. `HSA_OVERRIDE_GFX_VERSION`.
  → **Dafür ist Frage 1 im nächsten Schritt: das genaue GPU-Modell** (`lspci | grep -i vga`
  oder `rocminfo`), damit wir Modellgröße und Override korrekt setzen.
- Bei 128 GB RAM laufen zur Not auch große Modelle auf CPU – GPU beschleunigt.

### 10.2 Headless + Netzwerk-Zugriff
- Kein X/Wayland/Kiosk nötig. Frontend + Backend hören im LAN.
- Zugriff via `http://<server-ip>:3000` vom Laptop/Tablet.
- **Leichter Schutz:** simples Token/Passwort vor dem HUD (da im Netzwerk erreichbar),
  Bind bevorzugt aufs LAN-Interface, nicht öffentlich exponieren.

### 10.3 Voice-Architektur (Browser ↔ Server, alles lokal)
```
Browser (Laptop/Tablet)                 Server (Ubuntu, AMD)
──────────────────────                  ─────────────────────
Mikro (Hold Space) ──audio──►  STT: whisper.cpp  ──text──►  Task/Skill
                                                              │
Lautsprecher ◄──audio──  TTS: Piper  ◄──antwort-text──────────┘
```
- **STT:** `whisper.cpp` (klein/mittleres Modell) auf dem Server, nimmt Browser-Audio entgegen.
- **TTS:** **Piper** auf dem Server (lokal, kostenlos, deutsche Stimme verfügbar),
  Audio wird an den Browser zurückgestreamt.
- Steuerung wie im Video: **Space halten = sprechen, ESC = stopp.** Status `TTS.STANDBY / TTS.LIVE`.
- Sprachbefehle mappen auf Tasks (z. B. „Inbox Brief" → Task `inbox-brief`).

### 10.4 „Leer bis verbunden" mit nur Ollama
- Verbindung = Ollama-Health `GET /api/tags` erfolgreich **und** mindestens ein Modell geladen.
- Kein Modell/kein Ollama → HUD zeigt `LINK · OFFLINE`, Gehirn leer.
- Erste erfolgreiche Verbindung → „Boot-up"-Animation, Gehirn erwacht (IDLE/Gold).

### 10.5 Konkreter Ziel-Stack v1
| Komponente | Technik |
|-----------|---------|
| Host | Ubuntu Server 24.04 LTS + ROCm |
| Lokales Modell | Ollama (ROCm), z. B. `llama3.1` / `qwen2.5` |
| Backend | FastAPI + WebSocket, Provider-Adapter (nur `ollama` aktiv) |
| Runner | Task-Engine + `vault/runs/`-Logging |
| Frontend | Next.js HUD + react-three-fiber Gehirn |
| Voice | whisper.cpp (STT) + Piper (TTS) |
| Memory | Obsidian-Vault (Markdown) |
| Orchestrierung | Docker Compose (+ Ollama nativ oder als ROCm-Container) |

## 11. Installer & Update-Strategie

### 11.1 Ubuntu-nativ oder Docker? → Hybrid, Docker-zentriert
- **App-Dienste (Frontend, Backend, Voice) in Docker.** Vorteil: git-Updates sind
  sauber und reproduzierbar (`git pull && docker compose up -d --build`), rollender
  Neustart = „Live-Update".
- **Ollama** mit ROCm nativ auf dem Host oder als ROCm-Container.
- **Kiosk** ist der einzige host-nahe Teil (braucht ein Display), deshalb außerhalb
  von Docker als systemd-Unit (`scripts/setup-kiosk.sh`).

### 11.2 Betriebsmodus – Auswahl NUR beim Erststart
`install.sh` fragt beim ersten Lauf den Modus ab und speichert ihn:

| Modus | Bedeutung |
|-------|-----------|
| `headless` | nur im Netzwerk, Zugriff per Browser (empfohlen, dein Setup) |
| `both` | headless **und** Kiosk-Vollbild am Server-Monitor |
| `kiosk` | nur Kiosk-Vollbild am Server-Monitor |

- Antwort landet in **`instance/config.env`** (gitignored → **Git-Update überschreibt sie nicht**).
- Bei erneutem `install.sh` oder bei `update.sh` wird **nicht mehr gefragt**.
- Neu wählen: `./install.sh --reconfigure` · nicht-interaktiv: `./install.sh --mode headless`.

### 11.3 Update aus Git (auch „live")
`./update.sh`:
1. `git fetch` + `git reset --hard origin/<branch>` → exakt auf Remote-Stand
   (deine `instance/config.env` bleibt, weil gitignored).
2. `docker compose up -d --build` → Container rollend neu (Live-Update).
3. Kiosk-Unit bei Bedarf auffrischen – **ohne Rückfrage**, Modus ist bekannt.

So kannst du später sogar einen **„UPDATE"-Button** ins HUD legen, der `update.sh`
auslöst und sich das Repo selbst zieht.

### 10.6 Nächster Bau-Schritt (Vorschlag)
**Phase 1-Gerüst erzeugen:** `docker-compose.yml`, FastAPI-Orchestrator mit
Ollama-Adapter + Health-Check + WebSocket, und ein minimales Next.js-HUD, das den
Verbindungsstatus anzeigt (leer ↔ Gehirn). Danach Schritt für Schritt Tasks,
Gehirn-Zustände und Voice ergänzen.
