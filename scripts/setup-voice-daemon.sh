#!/usr/bin/env bash
#
# V.A.U.L.T. Sprach-Daemon einrichten (openWakeWord am Server-Mikro).
#
# Installiert Audio-Abhängigkeiten + Python-Pakete in ein eigenes venv, lädt die
# Weckwort-Modelle, erzeugt einen lokalen Token und richtet einen systemd-Dienst
# ein, der durchgehend am Server-Mikro auf das Weckwort lauscht.
#
# Voraussetzung: der Server hat Mikrofon UND Lautsprecher angeschlossen.
#
#   Nutzung:  sudo scripts/setup-voice-daemon.sh
#             scripts/setup-voice-daemon.sh --uninstall
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCE="$REPO_DIR/instance"
VENV="$INSTANCE/voice-daemon-venv"
UNIT=/etc/systemd/system/vault-voice.service
SERVICE_USER="${SUDO_USER:-$(id -un)}"

have() { command -v "$1" >/dev/null 2>&1; }
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

if [[ "${1:-}" == "--uninstall" ]]; then
  $SUDO systemctl disable --now vault-voice 2>/dev/null || true
  $SUDO rm -f "$UNIT"; $SUDO systemctl daemon-reload 2>/dev/null || true
  echo "  ✓ Sprach-Daemon entfernt (venv/Token bleiben)."
  exit 0
fi

echo "== Sprach-Daemon (openWakeWord) einrichten =="

# 1) System-Audio-Abhängigkeiten
if have apt-get; then
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get install -y python3-venv libportaudio2 alsa-utils >/dev/null 2>&1 \
    && echo "  ✓ Audio-Pakete (portaudio, alsa-utils) installiert" \
    || echo "  ⚠ Audio-Pakete konnten nicht installiert werden – ggf. manuell nachziehen."
fi

# 2) venv + Python-Pakete
mkdir -p "$INSTANCE"
python3 -m venv "$VENV"
"$VENV/bin/pip" -q install --upgrade pip >/dev/null 2>&1 || true
echo "  • Installiere openwakeword + Audio-Pakete (kann etwas dauern)…"
if "$VENV/bin/pip" -q install openwakeword sounddevice numpy requests >/tmp/vault-voice-pip.log 2>&1; then
  echo "  ✓ Python-Pakete installiert"
else
  echo "  ⚠ pip fehlgeschlagen. Letzte Zeilen:"; tail -n 5 /tmp/vault-voice-pip.log | sed 's/^/      /'; exit 1
fi

# 3) Weckwort-Modelle vorab laden
"$VENV/bin/python" -c "import openwakeword; openwakeword.utils.download_models()" >/dev/null 2>&1 \
  && echo "  ✓ Weckwort-Modelle geladen (u. a. hey_jarvis)" \
  || echo "  ⚠ Modelle konnten nicht vorab geladen werden (werden beim ersten Start nachgeholt)."

# 4) Lokaler Token für die Voice-Endpoints
if [[ ! -s "$INSTANCE/voice_token" ]]; then
  head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$INSTANCE/voice_token"
  echo "  ✓ Token erzeugt ($INSTANCE/voice_token)"
fi
# Orchestrator neu starten, damit er den Token liest (Datei ist gemountet)
( cd "$REPO_DIR" && docker compose restart orchestrator >/dev/null 2>&1 ) || true

# 5) systemd-Dienst
$SUDO tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. Sprach-Daemon (openWakeWord)
After=network-online.target sound.target docker.service

[Service]
Type=simple
User=$SERVICE_USER
Environment=ORCH_URL=https://localhost
ExecStart=$VENV/bin/python $REPO_DIR/scripts/voice-daemon.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now vault-voice >/dev/null 2>&1 || true

echo ""
echo "  ✓ Sprach-Daemon läuft. Sag 'Hey Jarvis' + deinen Befehl."
echo "    Status:   systemctl status vault-voice"
echo "    Log:      journalctl -u vault-voice -f"
echo "    Weckwort: HUD → Einstellungen → 'Freihand am Server'"
