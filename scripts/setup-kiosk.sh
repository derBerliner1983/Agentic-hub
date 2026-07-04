#!/usr/bin/env bash
#
# Kiosk-Modus für V.A.U.L.T. (nur MODE=both|kiosk).
# Bootet auf einem Ubuntu-Host mit Monitor direkt ins Vollbild-HUD – ohne
# Desktop. Host-nah (kein Docker), da ein Display/Seat nötig ist.
#
# Nutzung:
#   sudo scripts/setup-kiosk.sh <url> [--refresh] [kiosk-user]
#
# Standard-URL ist http://localhost:3000 (localhost = „secure context" →
# Mikro/Voice funktionieren, kein Zertifikatsthema).
#
set -euo pipefail

URL="${1:-http://localhost:3000}"
REFRESH="${2:-}"
KIOSK_USER="${3:-${SUDO_USER:-$(id -un)}}"

# Als root laufen
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "  • Kiosk-Setup nur auf Ubuntu/Debian automatisiert. URL wäre: $URL"
  exit 0
fi

echo "  Kiosk-Ziel: $URL   ·   Kiosk-User: $KIOSK_USER"

# cage = minimaler Wayland-Kiosk-Compositor; seatd stellt den Seat bereit.
if [[ "$REFRESH" != "--refresh" ]]; then
  echo "  Installiere Kiosk-Pakete (cage, seatd, chromium)…"
  apt-get update -y
  apt-get install -y cage seatd curl || true
  apt-get install -y chromium-browser || apt-get install -y chromium || true
  systemctl enable --now seatd >/dev/null 2>&1 || true
  # Seat-/GPU-Zugriff für den Kiosk-User
  for grp in video render input seat; do
    getent group "$grp" >/dev/null 2>&1 && usermod -aG "$grp" "$KIOSK_USER" || true
  done
fi

# Chromium-Binary bestimmen
CHROME="$(command -v chromium-browser || command -v chromium || echo /usr/bin/chromium)"
KUID="$(id -u "$KIOSK_USER")"

UNIT=/etc/systemd/system/vault-kiosk.service
echo "  Schreibe systemd-Unit $UNIT …"
cat > "$UNIT" <<EOF
[Unit]
Description=V.A.U.L.T. Kiosk (Chromium Vollbild-HUD)
After=network-online.target seatd.service systemd-user-sessions.service
Wants=network-online.target

[Service]
User=$KIOSK_USER
PAMName=login
TTYPath=/dev/tty1
Environment=XDG_RUNTIME_DIR=/run/user/$KUID
Environment=WLR_LIBINPUT_NO_DEVICES=1
# Warten, bis das HUD antwortet (-k: selbst-signiertes HTTPS erlauben)
ExecStartPre=/bin/sh -c 'until curl -ksf $URL >/dev/null; do sleep 2; done'
ExecStart=/usr/bin/cage -s -- $CHROME \\
  --kiosk --incognito --noerrdialogs --disable-infobars \\
  --disable-session-crashed-bubble --check-for-update-interval=31536000 \\
  --ignore-certificate-errors --test-type \\
  --autoplay-policy=no-user-gesture-required --app=$URL
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Grafisches Ziel ist nicht nötig – Kiosk läuft auf multi-user.target + tty1.
systemctl set-default multi-user.target >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl enable vault-kiosk.service >/dev/null 2>&1 || true

if [[ "$REFRESH" == "--refresh" ]]; then
  systemctl restart vault-kiosk.service >/dev/null 2>&1 || true
  echo "  ✓ Kiosk aktualisiert & neu gestartet."
else
  echo "  ✓ Kiosk eingerichtet. Startet beim nächsten Boot automatisch."
  echo "    Sofort testen:  sudo systemctl start vault-kiosk"
fi
