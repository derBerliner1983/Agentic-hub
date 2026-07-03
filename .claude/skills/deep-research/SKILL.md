---
name: deep-research
description: Recherchiert eine Frage tiefgehend aus mehreren Quellen (Web, GitHub, YouTube, Vault) und schreibt einen strukturierten Wiki-Artikel. Verwenden für gründliche Recherche zu einem Thema.
---

# Deep Research

Ziel: Eine Frage aus mehreren Quellen beantworten und das Ergebnis dauerhaft im Vault ablegen.

## Schritte

1. Kläre die Recherchefrage präzise (eine Kernfrage + optionale Unterfragen).
2. Durchsuche mehrere Quellen:
   - Web (aktuelle, seriöse Quellen)
   - GitHub (falls technisch)
   - YouTube (falls relevant)
   - bestehenden `vault/`-Kontext (`wiki/`, `raw/`)
3. Synthetisiere die Ergebnisse zu einem strukturierten Artikel:
   - `# <Thema>`
   - **Zusammenfassung** (Antwort auf die Kernfrage)
   - **Details** (nach Unterthemen gegliedert)
   - **Offene Fragen / Risiken**
   - **Quellen** (mit Links)
4. Speichere als `vault/wiki/<thema-slug>.md` und verlinke verwandte Notizen mit `[[...]]`.

Nenne am Ende den Dateipfad und die Kern-Antwort.
