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
journalctl -u ollama | grep -i -E 'rocm|gfx|gpu'   # GPU erkannt?
```
Falls die GPU nicht erkannt wird, hilft oft ein Override – ersetze `11.0.0` durch
deine gfx-Version (siehe `rocminfo | grep gfx`):
```bash
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\nEnvironment="HSA_OVERRIDE_GFX_VERSION=11.0.0"\n' \
  | sudo tee /etc/systemd/system/ollama.service.d/10-vault.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```
> Auch ohne GPU läuft alles – dann rechnet Ollama auf der CPU (bei 128 GB RAM ok, nur langsamer).

### Speziell: ACEMAGIC M1A Pro+ (Ryzen AI Max+ 395 / Radeon 8060S, „Strix Halo")
Die iGPU ist **RDNA 3.5 = `gfx1151`**. Support ist neu – **aktuelles Ollama** verwenden
(Installer neu ausführen aktualisiert es). Wichtig:

1. **Unified Memory nutzen (VRAM/GTT).** GPU und CPU teilen sich die 128 GB.
   - Im **BIOS** die „UMA Frame Buffer / VGA Memory" möglichst groß setzen (z. B. 32–64 GB),
     falls verfügbar. Rest wird als GTT dynamisch zugeteilt.
   - So kann die GPU auch große Modelle (z. B. 70B quantisiert) laden.
2. **GPU-Erkennung** prüfen mit `ollama ps` (Spalte „PROCESSOR" sollte GPU zeigen) und
   `journalctl -u ollama | grep -i gfx`.
3. **Falls die GPU nicht genutzt wird**, den Override setzen (für gfx1151 gängig):
   ```bash
   printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\nEnvironment="HSA_OVERRIDE_GFX_VERSION=11.0.0"\n' \
     | sudo tee /etc/systemd/system/ollama.service.d/10-vault.conf
   sudo systemctl daemon-reload && sudo systemctl restart ollama
   ```
   Bringt das nichts, ist der **CPU-Modus** auf diesem 16-Kern-Zen5 mit 128 GB trotzdem
   sehr brauchbar – einfach ohne Override weiterlaufen lassen.
4. Der Chip hat zusätzlich eine **NPU (XDNA, ~126 TOPS)** – die nutzt Ollama (noch) nicht;
   Inferenz läuft über GPU (ROCm) oder CPU. Kein Problem, nur zur Einordnung.
5. **Gute Startmodelle** für diese Maschine:
   `llama3.1:8b` (schnell), `qwen2.5-coder:14b` (Code), bei Bedarf größere Q4-Modelle.

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
Im Browser vom Laptop/Tablet öffnen – **am besten über den Hostnamen** (mDNS,
umgeht IP-/HSTS-Probleme):
- **`http://<hostname>.local`**  (z. B. `http://ai-server.local`)
- oder per IP: `http://<server-ip>`
- Beides leitet **automatisch auf HTTPS** um. Beim ersten Mal zeigt der Browser
  eine **Zertifikatswarnung** (selbst-signiert): „Erweitert" → „trotzdem fortfahren".
- In einem **Fritz!Box**-Netz geht oft auch direkt `http://<hostname>.fritz.box`.

> **ERR_SSL_PROTOCOL_ERROR beim IP-Aufruf?** Der Browser hat einen alten HSTS-Eintrag
> gespeichert. Entweder den **Hostnamen** benutzen (sauber) oder HSTS löschen:
> `chrome://net-internals/#hsts` → unten bei „Delete domain security policies" die
> IP eingeben → „Delete". (Inkognito-Fenster umgeht es zum Testen.)

> Bei krummen Ports (falls 80/443 belegt sind) stehen sie in `instance/config.env`
> (`HTTP_PORT`/`HTTPS_PORT`). Nach dem Ändern: `./update.sh`.
> **Design nach Update nicht aktualisiert?** Einmal hart neu laden: `Strg+Shift+R`
> (bzw. auf dem Mac `Cmd+Shift+R`).

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
`update.sh` aktualisiert **Code + Container UND Ollama** (letzteres nur, wenn schon
installiert; deine `0.0.0.0`-Bindung/Override bleibt erhalten).
- Ollama-Update überspringen: `./update.sh --no-ollama`
- Ollama einzeln aktualisieren: `./scripts/setup-ollama.sh`

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
