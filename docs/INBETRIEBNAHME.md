# V.A.U.L.T. – Inbetriebnahme (Schritt für Schritt)

Für einen Ubuntu-Server mit **AMD-GPU**, Zugriff per Browser vom eigenen Gerät.
Ollama läuft **auf dem Host** (nicht im Container), damit die GPU genutzt wird.

---

## 0. Voraussetzungen
- Ubuntu Server 24.04 LTS, du bist als normaler User mit `sudo` (oder root) angemeldet.
- Internetzugang auf dem Server (für Docker/Ollama/Modelle).

---

## 1. Repo holen & Installer starten
```bash
git clone <repo-url> Agentic-hub
cd Agentic-hub
./install.sh
```
Der Installer fragt **einmalig**:
- **Modus:** `1` (headless – Zugriff per Browser). 
- **Härtung:** `j`, wenn es ein reiner LAN-Server ist (Firewall lässt dann nur LAN zu).
  ⚠ **Nicht** auf einem Server, den du übers Internet erreichst.

Er installiert automatisch Docker, **Ollama**, lädt die Voice-Modelle und startet alles.

---

## 2. Ollama prüfen (läuft auf dem Host)
```bash
# Läuft der Dienst?
systemctl status ollama --no-pager

# Erreichbar?
curl -s http://localhost:11434/api/tags
```
Falls **nicht** installiert/erreichbar:
```bash
curl -fsSL https://ollama.com/install.sh | sh
# Ollama für den Container erreichbar machen (0.0.0.0):
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\n' \
  | sudo tee /etc/systemd/system/ollama.service.d/10-vault.conf
sudo systemctl daemon-reload && sudo systemctl enable --now ollama
```

### AMD-GPU (ROCm)
Der Ollama-Installer erkennt AMD und richtet ROCm ein. Prüfen:
```bash
ollama ps            # zeigt geladene Modelle
journalctl -u ollama | grep -i rocm   # ROCm erkannt?
```
Falls die GPU nicht erkannt wird (ältere Karte), hilft oft ein Override – ersetze
`11.0.0` durch deine gfx-Version (siehe `rocminfo | grep gfx`):
```bash
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\nEnvironment="HSA_OVERRIDE_GFX_VERSION=11.0.0"\n' \
  | sudo tee /etc/systemd/system/ollama.service.d/10-vault.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```
> Auch ohne GPU läuft alles – dann rechnet Ollama auf der CPU (bei 128 GB RAM ok, nur langsamer).

---

## 3. Ein Modell laden
Entweder im Terminal …
```bash
ollama pull llama3.1          # Allrounder
ollama pull qwen2.5-coder     # für den Coder-Agenten / Code-Projekte
```
… **oder später bequem im HUD** unter **⚙ → Ollama-Modelle → „Modell laden"**.

---

## 4. HUD öffnen & Login einrichten
Im Browser vom Laptop/Tablet:
- **Mit Mikro/Voice:** `https://<server-ip>:3443`  (Zertifikatswarnung 1× akzeptieren)
- Ohne Voice:        `http://<server-ip>:3000`

Beim ersten Aufruf: **/setup** → Admin-Benutzername + Passwort + **MFA** (QR-Code mit
einer Authenticator-App scannen, z. B. Aegis/2FAS/Google Authenticator).

Danach einloggen. Sobald Ollama ein Modell hat, wechselt oben `LINK · OFFLINE` auf
**ONLINE** und das „Gehirn" erwacht.

---

## 5. Erste Schritte im HUD
- **Command Deck** (rechts): Task anklicken (z. B. `PLAN TODAY`).
- **⚙ Settings:** Modelle laden/löschen, Agenten-Modelle setzen, Benutzer anlegen,
  Backup einrichten.
- **＋ Builder:** eigene Tasks aus Skills bauen, Zeitplan setzen.
- **BOARD:** Projekte anlegen, Autonom-Modus an → Karten werden selbst abgearbeitet.
- **Voice:** Space halten und sprechen (nur über HTTPS/localhost).

---

## 6. Aktualisieren
```bash
./update.sh          # oder im HUD: ↻ oben rechts
```

---

## Fehlersuche
| Symptom | Prüfen |
|---------|--------|
| Alles `OFFLINE` | `curl localhost:11434/api/tags` – läuft Ollama? Modell geladen? |
| Container-Fehler | `docker compose logs orchestrator` |
| Ollama vom Container nicht erreichbar | Bindet Ollama auf `0.0.0.0`? (Schritt 2) · Firewall erlaubt Docker→11434 |
| `MIC.BLOCKED` | Über **HTTPS (3443)** statt HTTP öffnen |
| Kiosk startet nicht | `journalctl -u vault-kiosk` |
| Login gesperrt (429) | 5 Fehlversuche → 5 min warten (Brute-Force-Schutz) |

Reset der Anmeldung: `instance/auth.json` auf dem Server löschen → `/setup` neu.
