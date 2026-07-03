---
name: youtube-summary
description: Fasst ein YouTube-Video strukturiert zusammen und legt die Notiz in vault/raw/ ab. Verwenden, wenn eine YouTube-URL zusammengefasst oder archiviert werden soll.
---

# YouTube-Zusammenfassung

Ziel: Aus einer YouTube-URL eine saubere, durchsuchbare Notiz erstellen.

## Schritte

1. Frage nach der YouTube-URL, falls keine gegeben wurde.
2. Hole Titel, Kanal und Inhalt (Transkript/Beschreibung) des Videos.
3. Erstelle eine Markdown-Notiz mit dieser Struktur:
   - `# <Titel>`
   - Metadaten: Kanal, URL, Datum
   - **TL;DR** (3–5 Sätze)
   - **Kernpunkte** (Bullet-Liste)
   - **Umsetzbare Schritte / To-dos**
   - **Zitate / wichtige Timestamps** (falls vorhanden)
4. Speichere sie als `vault/raw/YYYY-MM-DD-<slug-des-titels>.md`.
5. Verlinke passende bestehende `wiki/`-Notizen mit `[[...]]`, falls thematisch verwandt.

Antworte am Ende mit dem Dateipfad und dem TL;DR.
