# Vault – Memory Layer

Dieser Ordner ist das **Langzeitgedächtnis** des Agentic OS. Es sind nur Markdown-Dateien, die
Claude Code lesen und schreiben kann – kompatibel mit Obsidian.

## Zweck

Jede Claude-Session soll auf der vorigen aufbauen, statt bei null anzufangen. Alles Wissenswerte
wird hier als Notiz abgelegt und mit der Zeit von „roh" zu „aufbereitet" veredelt.

## Ordner

| Ordner | Inhalt |
|--------|--------|
| `raw/` | Erste Captures: Transkripte, Brainstorms, Claude-Entwürfe, Scan-Ergebnisse. |
| `wiki/` | Aufbereitete, dauerhafte Referenz-Artikel. Eine Sache = eine Datei. |
| `output/` | Fertige Ergebnisse: Reports, Posts, Slide-Decks, Kundenmaterial. |
| `projects/` | Notizen je Projekt. |
| `ops/` | Betrieb: Ideen-Backlog, Logs, Metriken. |

## Konventionen

- **Dateinamen:** `YYYY-MM-DD-kurzer-titel.md` in `raw/`; in `wiki/` sprechende Titel `thema.md`.
- **Verlinkung:** Obsidian-Wiki-Links `[[andere-notiz]]`.
- **Frontmatter (optional):** `tags:`, `datum:`, `quelle:`.

## Neues Rohmaterial verarbeiten

1. Rohnotiz in `raw/` ablegen.
2. Kernaussagen extrahieren, in einen `wiki/`-Artikel überführen und mit bestehenden Notizen verlinken.
3. Wenn ein Deliverable entsteht, es in `output/` speichern.
