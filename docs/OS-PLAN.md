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

**Phase 4 – Provider-Panel · Builder · HTTPS · Update**  ✅
- Provider-Settings-Panel im HUD: Ollama/Claude/OpenAI umschaltbar (Keys lokal in instance/)
- Task/Skill-Builder im HUD: Tasks aus Skills zusammensetzen, neue Skills anlegen
- Caddy-Reverse-Proxy mit HTTPS (Browser-Mikro/Voice über LAN)
- UPDATE-Button → zieht Git-Stand + baut Container neu

**Phase 6 – Agent-Mesh & Projekte**  ✅ (Fundament)
- Rollen-Agenten (planner/researcher/coder/writer/verifier) mit je eigenem Ollama-Modell
- Projekt-Launcher: Ziel → Planner zerlegt → passende Agenten werden „eingestellt" →
  Modell wird **automatisch geladen** (ensure_model) → Verifier prüft → Nachbessern-Schleife
- Ergebnisse nach `vault/projects/`. Iteratives Ziel: robuste, autonome Ausführung.

**Phase 7 – Appliance / „OS-Gefühl"**  ✅
- Chromium-Kiosk (cage/Wayland) → bootet direkt ins Vollbild-HUD, systemd-Unit
  `vault-kiosk.service` (Seat via seatd, tty1, Auto-Restart)
- Plymouth-Boot-Splash mit V.A.U.L.T.-Branding (`scripts/setup-splash.sh`)
- Wird bei MODE=both|kiosk automatisch von `install.sh` eingerichtet
- Kiosk zeigt `http://localhost:3000` (localhost = secure context → Voice/Mikro ok)

**Phase 8 – Sicherheit & Härtung**  ✅
- Verifier-Härtung: echte Code-Checks (Sandbox) + Fehler-Rückkopplung
- `scripts/harden.sh`: System-Patches, LAN-only-Firewall (ufw + DOCKER-USER),
  SSH-Härtung, fail2ban, Auto-Updates – als Install-Option
- HUD-Anmeldung mit Passwort + **MFA (TOTP/QR)**, geschützte API + WebSocket
  (Details: §13)
- Security-Review-Fixes: Login-Brute-Force-Schutz, TOTP-Replay-Schutz,
  Secure-Cookie, Security-Header, Path-Traversal-Schutz, SETUP_TOKEN (§13.4)

**Phase 9 – Board, Autonom-Modus, echte Code-Ausführung**  ✅ (§14)

**Phase 10 – Datensicherung & Deliverables**  ✅
- **Backup/Restore** von vault/ + instance/ + skills als tar.gz (Download/Upload
  im Settings-Panel, Restore mit Traversal-Schutz)
- **Datei-Artefakte**: der Executor sammelt im Container erzeugte Dateien ein →
  `vault/projects/<id>/artifacts/`
- **Netzwerk-Option pro Code-Projekt** (für pip/npm install, API-Tests)
- **`FORCE_HTTPS=1`**: leitet Browser-Zugriffe optional auf HTTPS um

---

## 15. Erweiterte Features

**Phase 11 – erledigt ✅**
- **Runner-Profile**: `web` (Playwright/Chromium, echtes Web-E2E) und `python-deps`
  (pip install, Netz an) neben python/node/bash. Netz-Default pro Profil.
- **Scheduler/Cadence** (`scheduler.py`): Tasks mit `schedule` laufen zeitgesteuert
  (`interval` alle N Min / `daily` HH:MM), Läufe gemerkt in instance/schedule.json.
- **Modell pro Task/Agent** im HUD wählbar; `/api/models` zeigt verfügbare +
  geladene Ollama-Modelle inkl. RAM/VRAM.
- **Streaming**: Task-Antworten tippen live im HUD (Ollama `stream`), Event
  `state=stream` mit Chunks.
- **Mehrbenutzer + Rollen**: erster Nutzer = Admin; Admin legt weitere an
  (admin/user). `user` darf Tasks/Projekte, nicht Settings/Update/Benutzer.
  Migration vom Single-User-Format automatisch. Pro-Nutzer TOTP + Replay-Schutz.

**Phase 12 – erledigt ✅**
- **Automatisches Backup**: Scheduler schreibt zeitgesteuert tar.gz nach `./backups`
  (Intervall + Aufbewahrung im Settings-Panel), unabhängig vom Provider.
- **Audit-Log** (`audit.py`): wer/wann/was → instance/audit.log; Admin-Ansicht im
  Settings-Panel, Endpoint `/api/audit`. Protokolliert Login, Task/Projekt-Run,
  Settings, Benutzer, Update.
- **fail2ban fürs HUD-Login**: Fehl-Logins → instance/auth.log
  (`VAULT_AUTH_FAIL ip=…`), Filter + Jail via `harden.sh` installiert (5 → Bann).
- **Live-Log** im Board: Coder-/Board-/Modell-/Backup-Events laufen live unten
  im Kanban durch.

**Backlog (noch offen)**
- Runner-Profile: **Android-Emulator** & **Windows-VM** (schwer, Emulatoren/VMs nötig)
- Backup-Ziel extern (Git/USB/NAS) statt nur lokalem Ordner

---

## Alt-Referenz (frühe Phasenskizze)

**Phase 5 – Voice**  ✅
- Lokales STT (faster-whisper) + TTS (Piper, deutsche Stimme), „Hold Space to talk",
  Sprach-Trigger für Tasks. Wird beim Image-Build mitinstalliert.
- Hinweis: Browser-Mikro braucht HTTPS/localhost (siehe §12).

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

## 12. Voice (Phase 3) – Wichtiger HTTPS-Hinweis

Voice ist gebaut: **STT = faster-whisper**, **TTS = Piper** (deutsche Stimme), beide
lokal im Orchestrator-Container (werden beim Image-Build via `install.sh`/`update.sh`
mitinstalliert). Bedienung: **Space halten zum Sprechen**, ESC bricht ab.
Erkannter Text → Keyword-Matcher → Task läuft → gesprochene Bestätigung.

**Browser-Mikrofon braucht einen „secure context":** `getUserMedia` funktioniert nur
über **HTTPS** oder **localhost**. Beim Zugriff über `http://<server-ip>:3000` im LAN
blockiert der Browser das Mikro (das HUD zeigt dann `MIC.BLOCKED`). Lösungen:

1. **Reverse-Proxy mit TLS** vor den Orchestrator (Caddy/nginx) – sauberste Variante,
   dann `https://vault.local` o. ä.
2. **SSH-Port-Forwarding** auf den Client: `ssh -L 3000:localhost:3000 server` →
   Zugriff über `http://localhost:3000` (gilt als secure).
3. **Kiosk am Server** (MODE=both/kiosk): läuft über localhost, Mikro erlaubt.

STT/TTS selbst laufen serverseitig und sind vom HTTPS-Thema unabhängig – nur die
**Aufnahme im Browser** braucht den secure context.

## 13. Sicherheit & Härtung (Phase 8)

### 13.1 Verifier-Härtung (Sandbox-Checks)
Code aus dem Coder-Agenten wird **real geprüft**, nicht nur per LLM:
`python → py_compile`, `bash → bash -n`, `javascript → node --check`.
Fehler erzwingen „nicht ok" und gehen als konkrete Nachbesserungs-Anweisung an den
Agenten zurück (Schleife). Echte **Ausführung** ist standardmäßig aus
(`SANDBOX_EXEC=1` aktiviert sie) – bewusst, weil der Container docker.sock für
Updates gemountet hat.

### 13.2 Server-Härtung (`scripts/harden.sh`)
Wird beim **Erststart** von `install.sh` als Option angeboten (`HARDEN=yes/no` in
`instance/config.env`, Updates fragen nie erneut). Inhalt – idempotent:
1. `apt full-upgrade` + **unattended-upgrades** (System patcht sich selbst weiter)
2. **ufw**: eingehend alles zu; nur **LAN (RFC1918)** → SSH/HUD-Ports; Internet zu
3. **DOCKER-USER-Kette**: Docker umgeht ufw – deshalb zusätzlich iptables-Regeln,
   die published Ports nur aus LAN erlauben (persistiert via iptables-persistent)
4. **SSH**: MaxAuthTries 3, Root nur mit Key, Passwort-Login wird NUR deaktiviert,
   wenn SSH-Keys vorhanden sind (Aussperr-Schutz) · **fail2ban** aktiv
5. **sysctl**-Netzwerk-Härtung (Redirects, Source-Routing, syncookies, …)
6. **Ollama**: lauscht auf 0.0.0.0, Firewall erlaubt Port 11434 aber nur aus
   Docker-Netzen (Container erreichen es, LAN/Internet nicht)

⚠ **Nicht auf Cloud-/VPS-Servern aktivieren**, die man übers Internet erreicht –
die LAN-only-Firewall sperrt einen sonst aus. Gedacht für den Heim-/LAN-Server.

### 13.3 Anmeldung mit MFA (TOTP)
Das HUD ist ab jetzt **standardmäßig geschützt**:
- **Ersteinrichtung** unter `/setup`: Passwort (min. 8 Zeichen, PBKDF2-gehasht)
  + TOTP-Secret per **QR-Code** in eine Authenticator-App (Google Authenticator,
  Aegis, 2FAS, …), Bestätigung mit erstem Code.
- **Login** unter `/login`: Passwort + 6-stelliger MFA-Code (RFC 6238).
- **Session**: HMAC-signierter HttpOnly-Cookie, 12 h. WebSocket prüft ebenfalls.
- Alles in `instance/auth.json` (gitignored, überlebt Updates).
- **Notfall-Reset**: `instance/auth.json` auf dem Server löschen → Setup neu.
- **Escape-Hatch**: `AUTH_DISABLED=1` in der Container-Umgebung schaltet Login ab.
- Ehrlicher Hinweis: über HTTP (Port 3000) läuft der Cookie unverschlüsselt durchs
  LAN – für Login + Voice **HTTPS (Port 3443)** benutzen.

### 13.4 Zusätzliche Härtung (Security-Review)
- **Brute-Force-Schutz** am HUD-Login: 5 Fehlversuche / 5 min pro Client-IP →
  Sperre (HTTP 429). Gilt auch für die Setup-Code-Prüfung.
- **TOTP-Replay-Schutz**: ein einmal genutzter Code (oder älterer) wird abgelehnt
  (`totp_last`-Zähler in auth.json).
- **Secure-Cookie**: das Session-Cookie wird bei HTTPS mit `Secure` gesetzt
  (erkennt `X-Forwarded-Proto` von Caddy).
- **SETUP_TOKEN** (optional): schließt das „Trust-on-first-use"-Fenster – ist die
  Umgebungsvariable gesetzt, muss das Token bei der Ersteinrichtung mitgegeben werden.
- **Security-Header** (Orchestrator + Caddy): `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `HSTS` (auf 443).
- **Path-Traversal-Schutz** bei der Skill-Auflösung (nur Slug-IDs).

## 14. Kanban-Board, Autonom-Modus & echte Code-Ausführung (Phase 9)

### 14.1 Kanban-Board (eigene Ansicht)
Umschalter oben im HUD: **GEHIRN ↔ BOARD**. Das Board zeigt Projekte mit Karten
in Spalten `To-Do · Doing · Review · Done · Failed`. Du kannst:
- Projekte anlegen (Typ `code` = mit echtem Test), Ziel automatisch in Karten
  zerlegen (⚙ Plan → Planner-Agent), Karten manuell hinzufügen
- Karten per ◀▶ verschieben, mit ★ **bewerten**, Ergebnis ansehen, löschen
- Persistiert in `instance/board.json`.

### 14.2 Autonom-Modus („wenn er Zeit hat")
Ein Hintergrund-Worker (`worker.py`) nimmt sich – wenn der **Autonom-Schalter**
an ist und ein Modell verbunden – die nächste **To-Do**-Karte, arbeitet sie ab
(immer nur eine gleichzeitig) und legt das Ergebnis in **Review** zur Bewertung.
So läuft V.A.U.L.T. nicht nur im Assistenten-Modus, sondern erledigt Projekte
selbstständig im Hintergrund.

### 14.3 Echte Code-Ausführung + Selbsttest-Schleife
- `executor.py` startet über den docker.sock **Wegwerf-Container** und führt Code
  wirklich aus (Python/Node/Bash), mit Limits (512 MB, 1 CPU, PIDs), Timeout und
  standardmäßig **ohne Netzwerk**. Code kommt per `docker cp` rein (kein geteiltes FS nötig).
- `coder_loop.py`: **schreiben → ausführen → echten Fehler an den Coder → fixen →
  erneut ausführen**, bis es läuft oder das Limit erreicht ist. Genau das
  „er testet selbst und fixt sich, bis der Code geht".
- Docker-CLI ist im Orchestrator-Image (nur Client, kein Daemon).

**Ehrliche Grenzen / Sicherheit:**
- Real getestet werden **Python/Node/Bash/Web-Logik**. **Android/Windows-GUI** oder
  Browser-E2E brauchen Emulatoren/VMs → als „Runner-Profile" in `executor.py`
  erweiterbar, aber noch nicht enthalten.
- Der Executor nutzt den Host-Docker – Wegwerf-Container sind isoliert (kein Netz,
  Limits), aber der Zugriff auf den docker.sock ist mächtig. Für einen persönlichen
  LAN-Server okay; nicht ungeschützt ins Internet stellen.

### 10.6 Nächster Bau-Schritt (Vorschlag)
**Phase 1-Gerüst erzeugen:** `docker-compose.yml`, FastAPI-Orchestrator mit
Ollama-Adapter + Health-Check + WebSocket, und ein minimales Next.js-HUD, das den
Verbindungsstatus anzeigt (leer ↔ Gehirn). Danach Schritt für Schritt Tasks,
Gehirn-Zustände und Voice ergänzen.
