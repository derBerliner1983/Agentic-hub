#!/usr/bin/env bash
#
# V.A.U.L.T. Host-Updater: systemd-Dienst, der update.sh am HOST ausführt, sobald
# das HUD (im Container) eine Datei instance/update.request schreibt.
#
# Nötig, weil `docker compose` NICHT sinnvoll aus dem Container laufen kann
# (Bind-Mount-Pfade + fehlendes Compose). Der Host-Updater baut mit den richtigen
# Host-Pfaden und schreibt den Fortschritt nach instance/update.log (fürs HUD).
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
have() { command -v "$1" >/dev/null 2>&1; }
have systemctl || { echo "  • Kein systemd – Host-Updater übersprungen."; exit 0; }
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

$SUDO tee /etc/systemd/system/vault-update.service >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. Update (aus HUD angestoßen)
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/env bash $REPO_DIR/update.sh
EOF

$SUDO tee /etc/systemd/system/vault-update.path >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. – auf Update-Anforderung aus dem HUD warten

[Path]
PathExists=$REPO_DIR/instance/update.request
Unit=vault-update.service

[Install]
WantedBy=multi-user.target
EOF

# Härtung aus dem HUD anstoßbar ('Jetzt beheben' bei Handlungsbedarf)
$SUDO tee /etc/systemd/system/vault-harden.service >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. Härtung (aus HUD angestoßen)

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/env bash -c 'rm -f "$REPO_DIR/instance/harden.request"; source "$REPO_DIR/instance/config.env" 2>/dev/null || true; HTTP_PORT="\${HTTP_PORT:-80}" HTTPS_PORT="\${HTTPS_PORT:-443}" FULL_UPDATES="\${FULL_UPDATES:-no}" bash "$REPO_DIR/scripts/harden.sh"'
EOF

$SUDO tee /etc/systemd/system/vault-harden.path >/dev/null <<EOF
[Unit]
Description=V.A.U.L.T. – auf Härtungs-Anforderung aus dem HUD warten

[Path]
PathExists=$REPO_DIR/instance/harden.request
Unit=vault-harden.service

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now vault-update.path >/dev/null 2>&1 || true
$SUDO systemctl enable --now vault-harden.path >/dev/null 2>&1 || true
# Marker fürs HUD: Host-Updater ist eingerichtet
date -Iseconds | $SUDO tee "$REPO_DIR/instance/updater_ok" >/dev/null 2>&1 || true
echo "  ✓ Host-Updater aktiv (Update-Button + 'Beheben' im HUD laufen am Host)."
