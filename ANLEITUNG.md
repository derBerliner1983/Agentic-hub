# Agentic OS für Claude Code – Komplette Anleitung

> Nachbau des Setups aus dem Video **„The Agentic OS Setup That Will 10x Claude Code"** von Chase AI
> (https://www.youtube.com/watch?v=HRw-vP0j8OM)

Diese Anleitung erklärt Schritt für Schritt, **wie** und **was** du machen musst, um genau dieses
„Agentic OS" nachzubauen – inklusive Ordnerstruktur, Skills, Automationen und dem Dashboard-Design.

---

## Was ist das „OS" überhaupt?

Es ist **kein** Betriebssystem wie Windows oder Linux. „OS" steht hier für ein **Agentic Operating
System** – ein strukturiertes System auf Basis von **Claude Code**, das aus **4 Schichten** besteht:

| Schicht | Zweck | In diesem Repo |
|---------|-------|----------------|
| 🧠 **Memory** | Dauerhaftes Gedächtnis. Jede Session baut auf der letzten auf. | `vault/` (Obsidian) |
| ⚡ **Skills** | Wiederkehrende Workflows als wiederverwendbare Prompts. | `.claude/skills/` |
| 🤖 **Automations** | Skills, die von allein laufen (zeitgesteuert). | `automations/` |
| 📊 **Dashboard** | Klickbare Oberfläche + Observability für alles. | `dashboard/index.html` |

**Leitprinzip aus dem Video:** *„Wenn du etwas mehr als einmal machst, sollte es ein Skill sein.
Jeder Skill, der von allein laufen sollte, wird zur Automation."*

---

## Voraussetzungen

1. **Claude Code** installiert und eingeloggt
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude   # zum Anmelden
   ```
2. **Obsidian** (kostenlos) – https://obsidian.md — nur nötig, wenn du die Notizen hübsch ansehen
   willst. Claude Code kann den `vault/`-Ordner auch ohne Obsidian lesen/schreiben (es sind nur
   Markdown-Dateien).
3. **Node.js** (für Claude Code) und ein Terminal.
4. Optional: **Python 3** (nur um das Dashboard lokal per `python3 -m http.server` zu servieren).

---

## Schritt 1 – Memory-Layer (der Vault)

Der Vault ist Claudes Langzeitgedächtnis. Es sind einfach Ordner mit Markdown-Dateien.

### 1.1 Die Ordnerstruktur (Karpathy-Template)

```
vault/
├── raw/        # Rohmaterial: Transkripte, erste Notizen, Claude-Entwürfe
├── wiki/       # Aufbereitete, indexierte Referenz-Artikel
├── output/     # Fertige Deliverables (Reports, Posts, Decks)
├── projects/   # Projektbezogene Notizen
└── ops/        # Betrieb: Ideen, Logs, Metriken
```

**Prinzip:** `raw` → `wiki` → `output`. Rohes rein, aufbereitet in die Mitte, Fertiges raus.

### 1.2 Die wichtigste Datei: `vault/CLAUDE.md`

Diese Datei wird bei **jedem** Prompt in diesem Ordner automatisch mitgeschickt. Sie sagt Claude,
wie dein Gedächtnis aufgebaut ist und welche Konventionen gelten. Ohne sie „rät" Claude jedes Mal
neu. Sie liegt schon fertig in `vault/CLAUDE.md` – passe sie an deine Themen an.

---

## Schritt 2 – Skills-Layer

Ein **Skill** ist ein wiederverwendbarer Workflow als Prompt. In Claude Code liegt jeder Skill in
`.claude/skills/<name>/SKILL.md` mit einem YAML-Header (`name`, `description`).

### 2.1 Deine Domänen definieren

Teile deine Arbeit in **5–10 Domänen** ein, z. B.:
`Research · Content · Ops · Sales · Community · Personal`

Liste je Domäne die wiederkehrenden Aufgaben auf. Jede wird zum Skill-Kandidaten.

### 2.2 Mitgelieferte Beispiel-Skills

| Skill | Was er tut |
|-------|-----------|
| `youtube-summary` | Fasst ein YouTube-Video strukturiert zusammen und legt es in `vault/raw/` ab. |
| `deep-research`   | Recherchiert eine Frage aus mehreren Quellen und schreibt einen Wiki-Artikel. |
| `morning-scan`    | Täglicher Trend-Scan → Kurzreport in `vault/raw/`. |
| `skill-creator`   | Meta-Skill: erstellt aus einer Beschreibung neue Skills im richtigen Format. |

### 2.3 Einen neuen Skill anlegen

Am einfachsten per Claude Code selbst:
```
Nutze den skill-creator Skill und erstelle einen Skill "competitor-scan",
der die letzten Posts eines Konkurrenten zusammenfasst und in vault/raw/ ablegt.
```

---

## Schritt 3 – Automations-Layer

Sobald ein Skill existiert, entscheidest du: **manuell** oder **automatisch**?

- **Lokal (cron):** Läuft auf deinem Rechner. Ideal, wenn Dateien in den Vault geschrieben werden.
- **Remote (Claude Scheduler / Server):** Läuft auch, wenn dein Rechner aus ist.

Claude Code headless ausführen (das Herzstück jeder Automation):
```bash
claude -p "$(cat .claude/skills/morning-scan/SKILL.md)"
```

### Cron-Beispiel (täglich 7:00 Uhr)
```bash
crontab -e
# Zeile einfügen:
0 7 * * * cd /pfad/zu/Agentic-hub && ./automations/morning-scan.sh >> automations/morning-scan.log 2>&1
```
Das fertige Skript liegt in `automations/morning-scan.sh`.

---

## Schritt 4 – Dashboard-Layer (das Design)

Das Dashboard ist eine Web-Oberfläche, die deine Skills als **klickbare Buttons** darstellt und
Observability-Widgets zeigt (Nutzungslimits, letzte Vault-Änderungen, geplante Routinen).

- Jeder Button startet im Hintergrund `claude -p "<Skill-Prompt>"`.
- So können auch **nicht-technische** Personen (VAs, Team, Kunden) deine Agenten nutzen – ohne Terminal.

Das fertige Dashboard liegt in `dashboard/index.html` (dunkel/hell, responsive, ohne externe
Abhängigkeiten). Lokal ansehen:
```bash
cd dashboard && python3 -m http.server 8080
# dann http://localhost:8080 öffnen
```

> **Hinweis zum „echten" Ausführen:** Ein reines HTML-File im Browser darf aus Sicherheitsgründen
> keine Terminal-Befehle starten. Damit die Buttons wirklich `claude -p` ausführen, brauchst du einen
> kleinen lokalen Server als Brücke. Ein minimales Beispiel liegt in `dashboard/server.py` –
> starte es mit `python3 dashboard/server.py` und öffne http://localhost:8080.

---

## Der schnellste Weg: Claude Code baut es mit dir

Laut Video wird das ganze System im Gespräch mit Claude Code selbst gebaut. Öffne das Terminal in
diesem Repo und sag z. B.:

```
Lies ANLEITUNG.md und CLAUDE.md. Ich möchte mein Agentic OS einrichten.
Meine Domänen sind: <deine Domänen>. Hilf mir, dafür passende Skills anzulegen
und das Dashboard mit den passenden Buttons zu erweitern.
```

---

## Reihenfolge / Checkliste

- [ ] Claude Code installiert & eingeloggt
- [ ] `vault/`-Struktur angepasst, `vault/CLAUDE.md` mit deinen Themen gefüllt
- [ ] 3–5 eigene Skills in `.claude/skills/` angelegt
- [ ] Mind. 1 Automation via cron eingerichtet
- [ ] Dashboard geöffnet, Buttons auf deine Skills gemappt
- [ ] Repo committed & gepusht

---

## Design-Prinzipien (aus dem Video)

1. **Skills zuerst, Dashboard danach** – der Wert steckt in den Skills, das Dashboard ist nur die Auslieferung.
2. **Markdown-first Memory** – keine Vektor-DB / kein RAG nötig, nur Ordner mit `.md`.
3. **Kontinuierlich verfeinern** – behandle es als OS, nicht als fertiges Projekt.
4. **Portabel** – gut strukturierte Skills kannst du weitergeben oder als Service verkaufen.

---

## Quellen

- Video: „The Agentic OS Setup That Will 10x Claude Code" – Chase AI — https://www.youtube.com/watch?v=HRw-vP0j8OM
- Chase AI Blog: „How to Build a Claude Code Agentic OS (3 Steps)" — https://www.chaseai.io/blog/build-claude-code-agentic-os-3-steps
- Chase AI Workshop — https://www.chaseai.io/workshop
