#!/usr/bin/env bash
#
# Obsidian-Anbindung für V.A.U.L.T.
#
# Der Vault (Markdown) ist bereits das verbundene Gedächtnis (Orchestrator liest/
# schreibt vault/). Dieses Skript:
#   • stellt sicher, dass vault/ ein gültiger Obsidian-Vault ist (.obsidian-Config)
#   • installiert Obsidian NUR bei MODE=both|kiosk (Server mit Monitor), via snap
#   • erklärt bei headless, wie man den Vault vom eigenen Rechner aus verbindet
#
# Nutzung:  scripts/setup-obsidian.sh <MODE> [vault-pfad]
#
set -euo pipefail

MODE="${1:-headless}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="${2:-$REPO_DIR/vault}"
OBS_DIR="$VAULT/.obsidian"

# 1) Vault als Obsidian-Vault initialisieren (idempotent)
mkdir -p "$OBS_DIR"
[[ -f "$OBS_DIR/app.json" ]] || echo '{ "alwaysUpdateLinks": true }' > "$OBS_DIR/app.json"
[[ -f "$OBS_DIR/appearance.json" ]] || echo '{ "theme": "obsidian" }' > "$OBS_DIR/appearance.json"
echo "  ✓ Vault ist ein Obsidian-Vault: $VAULT"

# 2) Modusabhängig
case "$MODE" in
  both|kiosk)
    if command -v obsidian >/dev/null 2>&1; then
      echo "  ✓ Obsidian bereits installiert."
    elif command -v snap >/dev/null 2>&1; then
      echo "  • Installiere Obsidian (snap)…"
      sudo snap install obsidian --classic \
        && echo "  ✓ Obsidian installiert. Öffne den Vault: $VAULT" \
        || echo "  ⚠ snap-Installation fehlgeschlagen – manuell: https://obsidian.md/download"
    else
      echo "  • snap nicht verfügbar. Obsidian manuell installieren: https://obsidian.md/download"
      echo "    Dann in Obsidian 'Ordner als Vault öffnen' → $VAULT"
    fi
    ;;
  *)
    cat <<EOF
  • Headless-Modus: kein Obsidian-GUI auf dem Server nötig.
    So verbindest du Obsidian von deinem eigenen Rechner:
      1) Obsidian installieren:  https://obsidian.md/download
      2) Diesen Vault-Ordner auf deinen Rechner holen (git clone / sync)
      3) In Obsidian: 'Ordner als Vault öffnen' → der geklonte vault/-Ordner
      4) Änderungen per 'git pull/push' oder Sync-Tool aktuell halten.
    Der Orchestrator schreibt derweil weiter direkt in vault/ (Memory = verbunden).
EOF
    ;;
esac
