#!/usr/bin/env bash
#
# Ollama installieren ODER aktualisieren (offizielles Skript ist idempotent und
# aktualisiert eine vorhandene Installation) und für V.A.U.L.T. konfigurieren:
# Bindung auf 0.0.0.0 (damit der Container es über host.docker.internal erreicht).
#
# Nutzung:
#   scripts/setup-ollama.sh            # installieren/aktualisieren
#   scripts/setup-ollama.sh --update-only   # nur aktualisieren, wenn schon vorhanden
#
set -euo pipefail

UPDATE_ONLY=0
[[ "${1:-}" == "--update-only" ]] && UPDATE_ONLY=1

have() { command -v "$1" >/dev/null 2>&1; }
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

OVERRIDE_DIR=/etc/systemd/system/ollama.service.d
OVERRIDE=$OVERRIDE_DIR/10-vault.conf

if [[ "$UPDATE_ONLY" -eq 1 ]] && ! have ollama; then
  echo "  • Ollama nicht installiert – überspringe (--update-only)."
  exit 0
fi

if ! have curl; then
  echo "  ⚠ curl fehlt – Ollama kann nicht installiert/aktualisiert werden."
  exit 0
fi

if have ollama; then
  echo "  • Aktualisiere Ollama (offizielles Skript, kann etwas dauern)…"
else
  echo "  • Installiere Ollama (erkennt AMD/ROCm, lädt ROCm-Pakete – dauert etwas)…"
fi
# Ausgabe ins Log umleiten (der Installer druckt sonst zig Fortschrittszeilen).
LOG=/tmp/vault-ollama-install.log
if curl -fsSL https://ollama.com/install.sh | $SUDO sh >"$LOG" 2>&1; then
  echo "  ✓ Ollama installiert/aktualisiert   (Details: $LOG)"
else
  echo "  ⚠ Ollama-Setup fehlgeschlagen. Letzte Zeilen:"
  tail -n 5 "$LOG" | sed 's/^/      /'
  exit 0
fi

# 0.0.0.0-Bindung sicherstellen – vorhandene Override-Datei NICHT überschreiben
# (bewahrt z. B. deinen HSA_OVERRIDE_GFX_VERSION-Eintrag).
if have systemctl; then
  if [[ ! -f "$OVERRIDE" ]]; then
    $SUDO mkdir -p "$OVERRIDE_DIR"
    printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\n' | $SUDO tee "$OVERRIDE" >/dev/null
    echo "  ✓ Ollama-Bindung 0.0.0.0:11434 gesetzt"
  else
    echo "  • Vorhandene Ollama-Override-Datei beibehalten ($OVERRIDE)"
  fi
  $SUDO systemctl daemon-reload 2>/dev/null || true
  $SUDO systemctl enable --now ollama 2>/dev/null || true
  $SUDO systemctl restart ollama 2>/dev/null || true
  sleep 2
  if curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "  ✓ Ollama läuft auf 0.0.0.0:11434"
  else
    echo "  ⚠ Ollama noch nicht erreichbar – prüfe:  systemctl status ollama"
  fi
fi
