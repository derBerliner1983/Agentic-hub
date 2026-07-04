#!/usr/bin/env bash
#
# Erzeugt EIN selbst-signiertes TLS-Zertifikat mit passenden Namen (SAN), damit
# Caddy es für Hostname (*.local), localhost UND die LAN-IP(s) ausliefern kann.
# Ohne Namens-Mismatch → die Browser-Warnung ist wegklickbar (statt Hard-Fail).
#
# Nutzung:  scripts/gen-cert.sh [--force]
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/services/caddy/certs"
CERT="$DIR/cert.pem"; KEY="$DIR/key.pem"
mkdir -p "$DIR"

if [[ "${1:-}" != "--force" && -f "$CERT" && -f "$KEY" ]]; then
  echo "  • TLS-Zertifikat vorhanden ($CERT)"
  exit 0
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "  ⚠ openssl fehlt – installiere: sudo apt-get install -y openssl"
  exit 0
fi

HN="$(hostname)"
SAN="DNS:localhost,DNS:${HN},DNS:${HN}.local,DNS:*.local,IP:127.0.0.1"
for ip in $(hostname -I 2>/dev/null || true); do SAN="${SAN},IP:${ip}"; done

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$KEY" -out "$CERT" \
  -subj "/CN=${HN}.local" \
  -addext "subjectAltName=${SAN}" >/dev/null 2>&1 \
  && echo "  ✓ TLS-Zertifikat erstellt  (SAN: ${SAN})" \
  || { echo "  ⚠ Zertifikatserstellung fehlgeschlagen."; exit 0; }
chmod 644 "$CERT"; chmod 600 "$KEY" 2>/dev/null || true
