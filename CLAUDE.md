# Agentic Hub – Projekt-Kontext für Claude Code

Dies ist ein **Agentic OS** nach dem Chase-AI-Muster (4 Schichten: Memory, Skills, Automations,
Dashboard). Diese Datei wird bei jedem Prompt in diesem Repo mitgeschickt.

## Struktur

- `vault/` – Memory-Layer (Obsidian-kompatibel, reines Markdown). Siehe `vault/CLAUDE.md`.
- `.claude/skills/` – wiederverwendbare Skills (je ein Ordner mit `SKILL.md`).
- `automations/` – zeitgesteuerte Ausführung von Skills (cron-Skripte).
- `dashboard/` – klickbares Web-Dashboard + Observability.
- `ANLEITUNG.md` – Schritt-für-Schritt-Aufbauanleitung (Deutsch).

## Arbeitskonventionen

- Neue Rohnotizen kommen nach `vault/raw/` mit Dateinamen im Format `YYYY-MM-DD-thema.md`.
- Aufbereitete Referenz-Artikel kommen nach `vault/wiki/`.
- Fertige Deliverables kommen nach `vault/output/`.
- Interne Verlinkung im Obsidian-Stil: `[[dateiname]]`.
- Antworten und Notizen standardmäßig auf Deutsch.

## Wenn ich einen Skill anlege

Format: `.claude/skills/<name>/SKILL.md` mit YAML-Frontmatter (`name`, `description`) und einer
klaren Schritt-für-Schritt-Anweisung. Nutze dafür den `skill-creator` Skill.
