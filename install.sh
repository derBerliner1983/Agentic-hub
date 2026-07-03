#!/usr/bin/env bash
#
# V.A.U.L.T. Agentic OS – Erstinstallation
#
# Fragt beim ERSTEN Lauf den Betriebsmodus ab (headless / headless+kiosk / kiosk)
# und speichert ihn in instance/config.env. Bei erneutem Lauf oder beim Update
# wird NICHT mehr gefragt – die gespeicherte Antwort wird verwendet.
#
# Nutzung:
#   ./install.sh                # Erstinstallation (interaktiv, falls noch keine Config)
#   ./install.sh --reconfigure  # Modus neu wählen
#   ./install.sh --mode headless # nicht-interaktiv (headless|kiosk|both)
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTANCE_DIR="$REPO_DIR/instance"
CONFIG="$INSTANCE_DIR/config.env"
COMPOSE="$REPO_DIR/docker-compose.yml"

mkdir -p "$INSTANCE_DIR"

# ---------------------------------------------------------------------------
# Argumente
# ---------------------------------------------------------------------------
RECONFIGURE=0
MODE_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reconfigure) RECONFIGURE=1; shift ;;
    --mode) MODE_ARG="${2:-}"; shift 2 ;;
    *) echo "Unbekanntes Argument: $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Modus bestimmen: gespeicherte Config gewinnt, außer --reconfigure/--mode
# ---------------------------------------------------------------------------
choose_mode() {
  if [[ -n "$MODE_ARG" ]]; then
    echo "$MODE_ARG"; return
  fi
  echo ""
  echo "  In welchem Modus soll V.A.U.L.T. laufen?"
  echo "    1) headless        – nur im Netzwerk, Zugriff per Browser (empfohlen)"
  echo "    2) both            – headless + Kiosk (Vollbild-HUD am Server-Monitor)"
  echo "    3) kiosk           – nur Kiosk-Vollbild am Server-Monitor"
  echo ""
  local choice
  read -rp "  Auswahl [1/2/3] (Default 1): " choice || true
  case "${choice:-1}" in
    1|"") echo "headless" ;;
    2)    echo "both" ;;
    3)    echo "kiosk" ;;
    *)    echo "headless" ;;
  esac
}

if [[ -f "$CONFIG" && "$RECONFIGURE" -eq 0 && -z "$MODE_ARG" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG"
  echo "→ Bestehende Konfiguration gefunden: MODE=${MODE:-headless}"
  echo "  (Zum Ändern:  ./install.sh --reconfigure   |   Zum Aktualisieren:  ./update.sh)"
else
  MODE="$(choose_mode)"
  cat > "$CONFIG" <<EOF
# V.A.U.L.T. Instanz-Konfiguration – wird von Git-Updates NICHT überschrieben.
# Betriebsmodus: headless | both | kiosk
MODE=$MODE
# Netzwerk-Port des HUD
HTTP_PORT=3000
# LAN-Interface, an das gebunden wird (0.0.0.0 = alle; sicherer: konkrete IP)
BIND_ADDR=0.0.0.0
# Beim Erststart gesetzt:
INSTALLED_AT=$(date -Iseconds)
EOF
  echo "→ Modus '$MODE' gespeichert in $CONFIG"
fi

# shellcheck disable=SC1090
source "$CONFIG"

# ---------------------------------------------------------------------------
# Voraussetzungen prüfen
# ---------------------------------------------------------------------------
echo ""
echo "== Voraussetzungen =="
if command -v docker >/dev/null 2>&1; then
  echo "  ✓ Docker vorhanden"
else
  echo "  ✗ Docker fehlt. Installieren:  sudo apt-get install -y docker.io docker-compose-plugin"
fi
if command -v ollama >/dev/null 2>&1; then
  echo "  ✓ Ollama vorhanden"
else
  echo "  • Ollama noch nicht installiert (ROCm-Setup, siehe docs/OS-PLAN.md §10.1)"
fi

# ---------------------------------------------------------------------------
# App-Dienste starten (Docker) – sobald docker-compose.yml existiert
# ---------------------------------------------------------------------------
echo ""
echo "== App-Dienste =="
if [[ -f "$COMPOSE" ]] && command -v docker >/dev/null 2>&1; then
  ( cd "$REPO_DIR" && HTTP_PORT="$HTTP_PORT" BIND_ADDR="$BIND_ADDR" docker compose up -d --build )
  echo "  ✓ Container gebaut & gestartet"
else
  echo "  • docker-compose.yml noch nicht vorhanden – App-Stack folgt in Phase 1."
fi

# ---------------------------------------------------------------------------
# Kiosk einrichten (nur bei MODE=both|kiosk) – host-nah, braucht Monitor
# ---------------------------------------------------------------------------
if [[ "$MODE" == "both" || "$MODE" == "kiosk" ]]; then
  echo ""
  echo "== Kiosk =="
  bash "$REPO_DIR/scripts/setup-kiosk.sh" "http://localhost:${HTTP_PORT}" || \
    echo "  • Kiosk-Setup übersprungen (siehe scripts/setup-kiosk.sh)."
fi

echo ""
echo "Fertig. HUD (sobald App läuft):  http://<server-ip>:${HTTP_PORT}"
echo "Modus: $MODE   |   Update jederzeit mit:  ./update.sh"
