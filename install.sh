#!/usr/bin/env bash
#
# V.A.U.L.T. Agentic OS – One-Click-Installer
#
# Lädt/prüft alle Abhängigkeiten und richtet alles automatisch ein:
#   • Basis-Tools (curl, git, ca-certificates)
#   • Docker Engine + docker compose        (falls nicht vorhanden)
#   • Ollama (lokales Modell, ROCm für AMD) (falls nicht vorhanden)
#   • fragt EINMALIG den Betriebsmodus ab und speichert ihn
#   • startet die App-Container (sobald docker-compose.yml existiert)
#
# Nutzung:
#   ./install.sh                 # alles automatisch (interaktive Modus-Auswahl)
#   ./install.sh --reconfigure   # Betriebsmodus neu wählen
#   ./install.sh --mode headless # nicht-interaktiv (headless|both|kiosk)
#   ./install.sh --no-ollama     # Ollama-Installation überspringen
#   ./install.sh --no-docker     # Docker-Installation überspringen
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
RECONFIGURE=0; MODE_ARG=""; WANT_OLLAMA=1; WANT_DOCKER=1; HARDEN_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reconfigure) RECONFIGURE=1; shift ;;
    --mode) MODE_ARG="${2:-}"; shift 2 ;;
    --harden) HARDEN_ARG="yes"; shift ;;
    --no-harden) HARDEN_ARG="no"; shift ;;
    --no-ollama) WANT_OLLAMA=0; shift ;;
    --no-docker) WANT_DOCKER=0; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unbekanntes Argument: $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------
say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info() { printf '  • %s\n'  "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# sudo nur wenn nötig / vorhanden
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then SUDO=""; else
  if have sudo; then SUDO="sudo"; else
    warn "Kein root und kein sudo – System-Installationen könnten fehlschlagen."; SUDO=""
  fi
fi

# Paketmanager erkennen
PKG=""
if have apt-get; then PKG="apt"; fi

APT_UPDATED=0
apt_update_once() { [[ "$APT_UPDATED" -eq 1 ]] && return 0; $SUDO apt-get update -y && APT_UPDATED=1; }
ensure_pkg() { # ensure_pkg <cmd> <apt-paketname>
  local cmd="$1" pkg="$2"
  have "$cmd" && { ok "$cmd vorhanden"; return 0; }
  [[ "$PKG" == "apt" ]] || { warn "$cmd fehlt – bitte manuell installieren (kein apt gefunden)."; return 1; }
  info "installiere $pkg…"; apt_update_once; $SUDO apt-get install -y "$pkg" && ok "$pkg installiert"
}

# docker evtl. nur mit sudo nutzbar (User noch nicht in docker-Gruppe aktiv)
dockercmd() {
  if docker info >/dev/null 2>&1; then docker "$@";
  elif $SUDO docker info >/dev/null 2>&1; then $SUDO docker "$@";
  else return 1; fi
}

# ---------------------------------------------------------------------------
# 1) Basis-Tools
# ---------------------------------------------------------------------------
say "Basis-Tools"
ensure_pkg curl curl || true
ensure_pkg git git || true
[[ "$PKG" == "apt" ]] && { $SUDO apt-get install -y ca-certificates >/dev/null 2>&1 && ok "ca-certificates ok" || true; }

# ---------------------------------------------------------------------------
# 2) Docker Engine + Compose-Plugin
# ---------------------------------------------------------------------------
if [[ "$WANT_DOCKER" -eq 1 ]]; then
  say "Docker"
  if have docker; then
    ok "Docker vorhanden ($(docker --version 2>/dev/null | cut -d, -f1))"
  else
    info "Docker nicht gefunden – installiere via offiziellem Skript…"
    if have curl; then
      curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && $SUDO sh /tmp/get-docker.sh \
        && ok "Docker installiert" || warn "Docker-Installation fehlgeschlagen (Netzwerk/Proxy?)."
    else
      warn "curl fehlt – kann Docker nicht automatisch installieren."
    fi
  fi

  # Dienst aktivieren
  if have systemctl; then $SUDO systemctl enable --now docker >/dev/null 2>&1 && ok "Docker-Dienst aktiv" || true; fi

  # User in docker-Gruppe (damit später ohne sudo)
  if have docker && ! groups "${USER:-$(id -un)}" 2>/dev/null | grep -q docker; then
    $SUDO usermod -aG docker "${USER:-$(id -un)}" 2>/dev/null \
      && warn "Zur docker-Gruppe hinzugefügt – einmal ab-/anmelden, damit 'docker' ohne sudo geht." || true
  fi

  # Compose-Plugin sicherstellen
  if have docker; then
    if dockercmd compose version >/dev/null 2>&1; then
      ok "docker compose vorhanden"
    else
      info "installiere docker-compose-plugin…"
      [[ "$PKG" == "apt" ]] && { apt_update_once; $SUDO apt-get install -y docker-compose-plugin \
        && ok "compose-plugin installiert" || warn "compose-plugin-Installation fehlgeschlagen."; }
    fi
  fi
else
  info "Docker-Installation übersprungen (--no-docker)."
fi

# ---------------------------------------------------------------------------
# 3) Ollama (lokales Modell, AMD/ROCm wird vom Installer erkannt)
# ---------------------------------------------------------------------------
if [[ "$WANT_OLLAMA" -eq 1 ]]; then
  say "Ollama (lokales KI-Modell)"
  bash "$REPO_DIR/scripts/setup-ollama.sh" || warn "Ollama-Setup übersprungen."
  info "Modell laden, z. B.:  ollama pull llama3.1   (oder im HUD unter ⚙)"
else
  info "Ollama-Installation übersprungen (--no-ollama)."
fi

# ---------------------------------------------------------------------------
# 4) Betriebsmodus – NUR beim Erststart abfragen
# ---------------------------------------------------------------------------
say "Betriebsmodus"
choose_mode() {
  [[ -n "$MODE_ARG" ]] && { echo "$MODE_ARG"; return; }
  echo "  1) headless   – nur Netzwerk, Zugriff per Browser (empfohlen)" >&2
  echo "  2) both       – headless + Kiosk-Vollbild am Server-Monitor"   >&2
  echo "  3) kiosk      – nur Kiosk-Vollbild am Server-Monitor"          >&2
  local c; read -rp "  Auswahl [1/2/3] (Default 1): " c </dev/tty || true
  case "${c:-1}" in 2) echo both ;; 3) echo kiosk ;; *) echo headless ;; esac
}

choose_harden() {
  [[ -n "$HARDEN_ARG" ]] && { echo "$HARDEN_ARG"; return; }
  echo "" >&2
  echo "  Server-Härtung aktivieren? Updates/Patches, Firewall (nur LAN, KEIN" >&2
  echo "  Internet), SSH-Härtung, fail2ban, Auto-Sicherheitsupdates." >&2
  echo "  ⚠ NICHT aktivieren auf Cloud-/VPS-Servern, die du übers Internet" >&2
  echo "    erreichst – sonst sperrst du dich aus!" >&2
  local c; read -rp "  Härtung aktivieren? [j/N]: " c </dev/tty || true
  case "${c:-n}" in j|J|y|Y|ja|Ja) echo yes ;; *) echo no ;; esac
}

if [[ -f "$CONFIG" && "$RECONFIGURE" -eq 0 && -z "$MODE_ARG" && -z "$HARDEN_ARG" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG"; ok "Bestehende Konfiguration: MODE=${MODE:-headless}, HARDEN=${HARDEN:-no} (Update: ./update.sh)"
else
  MODE="$(choose_mode)"
  HARDEN="$(choose_harden)"
  cat > "$CONFIG" <<EOF
# V.A.U.L.T. Instanz-Konfiguration – wird von Git-Updates NICHT überschrieben.
MODE=$MODE
HTTP_PORT=3000
HTTPS_PORT=3443
BIND_ADDR=0.0.0.0
HARDEN=$HARDEN
INSTALLED_AT=$(date -Iseconds)
EOF
  ok "Modus '$MODE', Härtung '$HARDEN' gespeichert in $CONFIG"
fi
# shellcheck disable=SC1090
source "$CONFIG"
HTTPS_PORT="${HTTPS_PORT:-3443}"

# ---------------------------------------------------------------------------
# 5) App-Container starten (sobald docker-compose.yml existiert)
# ---------------------------------------------------------------------------
say "App-Dienste"
if [[ -f "$COMPOSE" ]] && have docker; then
  info "Baue Image (inkl. Voice: faster-whisper + Piper – erster Build lädt Modelle, dauert etwas)…"
  ( cd "$REPO_DIR" && HTTP_PORT="$HTTP_PORT" HTTPS_PORT="$HTTPS_PORT" BIND_ADDR="$BIND_ADDR" \
      dockercmd compose up -d --build ) \
    && ok "Container gebaut & gestartet" || warn "Container-Start fehlgeschlagen."
else
  info "docker-compose.yml noch nicht vorhanden – der App-Stack folgt in Phase 1."
  info "install.sh bringt ihn dann automatisch hoch."
fi

# ---------------------------------------------------------------------------
# 6) Obsidian (Memory) – Vault initialisieren, GUI nur bei Kiosk/Monitor
# ---------------------------------------------------------------------------
say "Obsidian (Memory)"
bash "$REPO_DIR/scripts/setup-obsidian.sh" "$MODE" "$REPO_DIR/vault" || warn "Obsidian-Setup übersprungen."

# ---------------------------------------------------------------------------
# 7) Kiosk (nur MODE=both|kiosk)
# ---------------------------------------------------------------------------
if [[ "$MODE" == "both" || "$MODE" == "kiosk" ]]; then
  say "Kiosk"
  bash "$REPO_DIR/scripts/setup-kiosk.sh" "http://localhost:${HTTP_PORT}" || warn "Kiosk-Setup übersprungen."
  say "Boot-Splash"
  bash "$REPO_DIR/scripts/setup-splash.sh" || warn "Splash-Setup übersprungen."
fi

# ---------------------------------------------------------------------------
# 8) Server-Härtung (nur wenn beim Erststart gewählt)
# ---------------------------------------------------------------------------
if [[ "${HARDEN:-no}" == "yes" ]]; then
  say "Server-Härtung"
  HTTP_PORT="$HTTP_PORT" HTTPS_PORT="$HTTPS_PORT" bash "$REPO_DIR/scripts/harden.sh" \
    && ok "Härtung abgeschlossen" || warn "Härtung fehlgeschlagen/übersprungen."
fi

# ---------------------------------------------------------------------------
# Fertig
# ---------------------------------------------------------------------------
say "Fertig"
ok "Modus: $MODE"
info "HUD (sobald App läuft):  http://<server-ip>:${HTTP_PORT}"
info "Aktualisieren jederzeit mit:  ./update.sh"
if have docker && ! groups "${USER:-$(id -un)}" 2>/dev/null | grep -q docker; then
  warn "Hinweis: einmal ab-/anmelden, damit 'docker' ohne sudo funktioniert."
fi
