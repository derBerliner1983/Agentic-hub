#!/usr/bin/env bash
#
# V.A.U.L.T. Agentic OS – Update aus Git
#
# Holt die neueste Version aus dem Git-Remote und baut die App neu.
# Fragt NICHTS – der Betriebsmodus kommt aus instance/config.env (Erstinstallation).
#
# Nutzung:
#   ./update.sh             # Code + Container + Ollama aktualisieren
#   ./update.sh --no-build  # nur Code ziehen, Container nicht neu bauen
#   ./update.sh --no-ollama # Ollama-Update überspringen
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTANCE_DIR="$REPO_DIR/instance"
CONFIG="$INSTANCE_DIR/config.env"
COMPOSE="$REPO_DIR/docker-compose.yml"

if [[ ! -f "$CONFIG" ]]; then
  echo "✗ Nicht installiert (keine instance/config.env)." >&2
  echo "  Bitte zuerst  ./install.sh  ausführen." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG"

NO_BUILD=0; NO_OLLAMA=0
for a in "$@"; do
  [[ "$a" == "--no-build" ]] && NO_BUILD=1
  [[ "$a" == "--no-ollama" ]] && NO_OLLAMA=1
done

echo "== Git-Update (Modus: ${MODE:-headless}) =="

BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
echo "  Branch: $BRANCH"

# Neueste Refs holen
git -C "$REPO_DIR" fetch --all --prune

# Appliance-Update: exakt auf Remote-Stand bringen.
# instance/ ist gitignored und bleibt dabei unangetastet (Config überlebt).
if ! git -C "$REPO_DIR" diff --quiet || ! git -C "$REPO_DIR" diff --cached --quiet; then
  echo "  ⚠ Lokale, nicht committete Änderungen an versionierten Dateien gefunden."
  echo "    Sie werden zurückgesetzt (instance/ bleibt erhalten)."
fi
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"

echo "  ✓ Code auf origin/$BRANCH aktualisiert."

# App neu bauen/starten
if [[ "$NO_BUILD" -eq 0 ]]; then
  if [[ -f "$COMPOSE" ]] && command -v docker >/dev/null 2>&1; then
    ( cd "$REPO_DIR" && HTTP_PORT="${HTTP_PORT:-3000}" HTTPS_PORT="${HTTPS_PORT:-3443}" \
        BIND_ADDR="${BIND_ADDR:-0.0.0.0}" docker compose up -d --build )
    echo "  ✓ Container neu gebaut & rollend neu gestartet (Live-Update)."
  else
    echo "  • Kein docker-compose.yml / Docker – App-Neustart übersprungen."
  fi
fi

# Ollama aktualisieren (nur wenn schon installiert), Bindung/Override bleiben erhalten
if [[ "$NO_OLLAMA" -eq 0 ]]; then
  echo "== Ollama-Update =="
  bash "$REPO_DIR/scripts/setup-ollama.sh" --update-only || echo "  • Ollama-Update übersprungen."
fi

# Kiosk-Unit bei Bedarf aktualisieren (ohne Rückfrage, Modus ist bekannt)
if [[ "${MODE:-}" == "both" || "${MODE:-}" == "kiosk" ]]; then
  bash "$REPO_DIR/scripts/setup-kiosk.sh" "http://localhost:${HTTP_PORT:-3000}" --refresh || true
fi

echo "Update abgeschlossen."
