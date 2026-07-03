---
name: skill-creator
description: Meta-Skill, der aus einer Beschreibung einen neuen, korrekt formatierten Skill in .claude/skills/ anlegt. Verwenden, wenn ein neuer Skill erstellt werden soll.
---

# Skill Creator

Ziel: Neue Skills konsistent und im richtigen Format erzeugen.

## Schritte

1. Frage (falls nicht gegeben) nach: Name (kebab-case), Zweck, Auslöser, gewünschtes Ergebnis/Output-Ort.
2. Lege den Ordner `.claude/skills/<name>/` an.
3. Erstelle darin `SKILL.md` mit:
   - YAML-Frontmatter:
     ```yaml
     ---
     name: <name>
     description: <Wann dieser Skill verwendet werden soll – klar und suchbar>
     ---
     ```
   - Überschrift, Ziel, nummerierte Schritt-für-Schritt-Anweisung.
   - Falls Output in den Vault geht: Zielordner und Dateinamens-Konvention nennen.
4. Bestätige mit dem Pfad der neuen Datei und einem Beispiel-Aufruf.

## Qualitätsregeln

- Ein Skill = eine klar umrissene Aufgabe.
- `description` beschreibt **wann** man ihn nutzt (Trigger), nicht nur was er tut.
- Schritte konkret und ausführbar halten.
