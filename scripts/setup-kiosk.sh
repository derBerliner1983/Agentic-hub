#!/usr/bin/env bash
#
# Kiosk-Modus für V.A.U.L.T. (nur MODE=both|kiosk).
# Richtet auf einem Ubuntu-Host mit Monitor einen Chromium-Vollbild-Kiosk ein,
# der beim Boot das HUD anzeigt. Host-nah (kein Docker), da ein Display nötig ist.
#
# Nutzung:
#   scripts/setup-kiosk.sh <url> [--refresh]
#
set -euo pipefail

URL="${1:-http://localhost:3000}"
REFRESH="${2:-}"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "  • Kiosk-Setup nur auf Ubuntu/Debian automatisiert. URL wäre: $URL"
  exit 0
fi

echo "  Kiosk-Ziel: $URL"

# 'cage' = minimaler Wayland-Kiosk-Compositor; startet eine einzige Vollbild-App.
if [[ "$REFRESH" != "--refresh" ]]; then
  echo "  Installiere Kiosk-Pakete (cage, chromium)…  (benötigt sudo)"
  sudo apt-get update -y
  sudo apt-get install -y cage chromium-browser || sudo apt-get install -y cage chromium
fi

UNIT=/etc/systemd/system/vault-kiosk.service
echo "  Schreibe systemd-Unit $UNIT (benötigt sudo)…"
sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. Kiosk (Chromium Vollbild-HUD)
After=network-online.target
Wants=network-online.target

[Service]
# Wartet, bis das HUD antwortet, dann Vollbild-Kiosk ohne Fensterrahmen.
ExecStartPre=/bin/sh -c 'until curl -sf $URL >/dev/null; do sleep 2; done'
ExecStart=/usr/bin/cage -- chromium --kiosk --noerrdialogs --disable-infobars --incognito $URL
Restart=always
User=%i

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vault-kiosk.service >/dev/null 2>&1 || true
echo "  ✓ Kiosk-Unit eingerichtet. Start:  sudo systemctl start vault-kiosk"
