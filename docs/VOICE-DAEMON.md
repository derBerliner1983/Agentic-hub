# Freihand am Server – lokales Weckwort (openWakeWord)

Der Sprach-Daemon macht aus V.A.U.L.T. einen **lokalen Sprachassistenten** wie
Alexa – nur komplett offline. Der Server hört über sein **eigenes Mikrofon** auf
ein Weckwort, beantwortet lokal (Whisper + Modell) und spricht über die
**Server-Lautsprecher** (Piper). Kein Browser, keine Cloud.

## Voraussetzung
Der Server hat **Mikrofon und Lautsprecher** angeschlossen (z. B. im Kiosk-Betrieb).

## Einrichten
```bash
sudo scripts/setup-voice-daemon.sh
```
Das Skript
- installiert Audio-Pakete (portaudio, alsa-utils) + ein eigenes Python-venv
  mit `openwakeword`, `sounddevice`, `numpy`, `requests`,
- lädt die vortrainierten Weckwort-Modelle (u. a. `hey_jarvis`),
- erzeugt einen lokalen Token (`instance/voice_token`) und startet den
  Orchestrator neu (damit er den Token liest),
- richtet den systemd-Dienst **`vault-voice`** ein und startet ihn.

## Benutzen
Sag **„Hey Jarvis"** und direkt danach deinen Befehl/deine Frage, z. B.
„Hey Jarvis, welches Datum haben wir heute?". Die Antwort kommt aus den
Server-Lautsprechern.

## Einstellen (HUD → Einstellungen → „Freihand am Server")
- **Weckwort-Modell**: `hey_jarvis`, `alexa`, `hey_mycroft`, `hey_rhasspy`
- **Empfindlichkeit** (0,1–0,95): höher = löst seltener/genauer aus

Änderungen greifen automatisch – der Daemon liest `instance/settings.json` live.

## Diagnose
```bash
systemctl status vault-voice      # läuft der Dienst?
journalctl -u vault-voice -f      # Live-Log (Weckwort erkannt, Befehl, Antwort)
```
Kein Ton/Mikro? Prüfe `arecord -l` (Mikro) und `aplay -l` (Lautsprecher) und
ggf. das Default-Audiogerät (ALSA/PulseAudio) des Dienst-Benutzers.

## Eigenes Weckwort
Vortrainierte Wörter funktionieren sofort. Ein **eigenes** Wort (z. B. „Vault")
lässt sich mit der openWakeWord-Trainings-Pipeline erzeugen – separater Schritt.

## Entfernen
```bash
scripts/setup-voice-daemon.sh --uninstall
```
