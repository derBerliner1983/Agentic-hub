#!/usr/bin/env bash
#
# V.A.U.L.T. XTTS einrichten – lokales TTS in ElevenLabs-Qualität (Coqui XTTS v2).
#
#   sudo scripts/setup-xtts.sh          # CPU (läuft überall, ~2-5 s pro Satz)
#   sudo scripts/setup-xtts.sh --rocm   # AMD-GPU via ROCm (deutlich schneller)
#   scripts/setup-xtts.sh --uninstall
#
# Danach im HUD: Einstellungen → Sprache → Engine „XTTS (lokal)" wählen.
# Eigene Stimme: 6-30s WAV als instance/xtts_speaker.wav ablegen (Klonen).
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$REPO_DIR/instance/xtts-venv"
UNIT=/etc/systemd/system/vault-xtts.service
SERVICE_USER="${SUDO_USER:-$(id -un)}"

have() { command -v "$1" >/dev/null 2>&1; }
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

if [[ "${1:-}" == "--uninstall" ]]; then
  $SUDO systemctl disable --now vault-xtts 2>/dev/null || true
  $SUDO rm -f "$UNIT"; $SUDO systemctl daemon-reload 2>/dev/null || true
  echo "  ✓ XTTS-Dienst entfernt (venv/Modell bleiben unter $VENV)."
  exit 0
fi

echo "== XTTS (lokales Natural-TTS) einrichten =="
echo "  ⚠ Download: PyTorch + XTTS-Modell (~4-6 GB) – dauert je nach Leitung."

python3 -m venv "$VENV"
"$VENV/bin/pip" -q install --upgrade pip >/dev/null 2>&1 || true

if [[ "${1:-}" == "--rocm" ]]; then
  echo "  • Installiere PyTorch (ROCm) …"
  "$VENV/bin/pip" install torch --index-url https://download.pytorch.org/whl/rocm6.2 \
    >/tmp/vault-xtts-pip.log 2>&1 || { echo "  ⚠ torch-rocm fehlgeschlagen (siehe /tmp/vault-xtts-pip.log)"; exit 1; }
else
  echo "  • Installiere PyTorch (CPU) …"
  "$VENV/bin/pip" install torch --index-url https://download.pytorch.org/whl/cpu \
    >/tmp/vault-xtts-pip.log 2>&1 || { echo "  ⚠ torch fehlgeschlagen (siehe /tmp/vault-xtts-pip.log)"; exit 1; }
fi
echo "  • Installiere Coqui-TTS …"
"$VENV/bin/pip" install coqui-tts >>/tmp/vault-xtts-pip.log 2>&1 \
  || { echo "  ⚠ coqui-tts fehlgeschlagen (siehe /tmp/vault-xtts-pip.log)"; exit 1; }
echo "  ✓ Pakete installiert"

echo "  • Lade XTTS-v2-Modell vor (~2 GB) …"
COQUI_TOS_AGREED=1 "$VENV/bin/python" -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')" \
  >>/tmp/vault-xtts-pip.log 2>&1 && echo "  ✓ Modell geladen" \
  || echo "  ⚠ Modell-Vorladen fehlgeschlagen – wird beim ersten Start nachgeholt."

# Firewall: Docker-Container muss Port 5002 am Host erreichen dürfen
if have ufw && $SUDO ufw status 2>/dev/null | grep -qi active; then
  $SUDO ufw allow from 172.16.0.0/12 to any port 5002 proto tcp >/dev/null 2>&1 || true
  echo "  ✓ Firewall: Docker-Netz → Port 5002 erlaubt"
fi

$SUDO tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. XTTS (lokales Natural-TTS)
After=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Environment=COQUI_TOS_AGREED=1
ExecStart=$VENV/bin/python $REPO_DIR/scripts/xtts-server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now vault-xtts >/dev/null 2>&1 || true

echo ""
echo "  ✓ XTTS läuft auf Port 5002.  Test:  curl -s 'http://localhost:5002/health'"
echo "    Im HUD: Einstellungen → Sprache → Sprechen = 'XTTS (lokal)'."
echo "    Eigene Stimme klonen: WAV (6-30s) nach instance/xtts_speaker.wav legen,"
echo "    dann:  sudo systemctl restart vault-xtts"
echo "    Log:  journalctl -u vault-xtts -f"
