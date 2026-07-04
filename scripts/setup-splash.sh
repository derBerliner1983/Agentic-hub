#!/usr/bin/env bash
#
# V.A.U.L.T. Boot-Splash (Plymouth). Zeigt beim Booten ein Marken-Logo statt
# der Kernel-Logs. Nur sinnvoll mit Monitor (Kiosk-Modus).
#
# Nutzung:  sudo scripts/setup-splash.sh
#
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi
if ! command -v apt-get >/dev/null 2>&1; then
  echo "  • Splash-Setup nur auf Ubuntu/Debian automatisiert."; exit 0
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/services/plymouth/vault"
DEST=/usr/share/plymouth/themes/vault

echo "  Installiere Plymouth…"
apt-get update -y
apt-get install -y plymouth plymouth-themes >/dev/null 2>&1 || apt-get install -y plymouth >/dev/null 2>&1 || true

echo "  Kopiere V.A.U.L.T.-Theme nach $DEST …"
mkdir -p "$DEST"
cp "$SRC/vault.plymouth" "$SRC/vault.script" "$DEST/"

# Theme als Standard setzen + initramfs neu bauen
if command -v plymouth-set-default-theme >/dev/null 2>&1; then
  plymouth-set-default-theme -R vault >/dev/null 2>&1 || plymouth-set-default-theme vault >/dev/null 2>&1 || true
else
  update-alternatives --install /usr/share/plymouth/themes/default.plymouth \
    default.plymouth "$DEST/vault.plymouth" 200 >/dev/null 2>&1 || true
  update-initramfs -u >/dev/null 2>&1 || true
fi

# GRUB: 'quiet splash' sicherstellen, damit der Splash erscheint
GRUB=/etc/default/grub
if [[ -f "$GRUB" ]] && ! grep -q 'splash' "$GRUB"; then
  echo "  Aktiviere Splash in GRUB…"
  sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\([^"]*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 quiet splash"/' "$GRUB"
  update-grub >/dev/null 2>&1 || true
fi

echo "  ✓ Boot-Splash eingerichtet (wird beim nächsten Neustart sichtbar)."
