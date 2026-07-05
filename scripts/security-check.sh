#!/usr/bin/env bash
#
# V.A.U.L.T. Sicherheits-Check (Host) – prüft Härtung & Aktualität und schreibt
# einen Bericht nach instance/security.json (das HUD liest ihn und zeigt ihn an).
#
# Rein lesend – ändert nichts. Läuft am Host (nicht im Container), weil nur dort
# ufw/fail2ban/Kernel/apt sichtbar sind.
#
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_DIR/instance/security.json"
mkdir -p "$REPO_DIR/instance"

have() { command -v "$1" >/dev/null 2>&1; }
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

# Config (FULL_UPDATES/HARDEN) mitlesen, falls vorhanden
FULL_UPDATES="no"; HARDEN="no"
[[ -f "$REPO_DIR/instance/config.env" ]] && source "$REPO_DIR/instance/config.env" || true

KERNEL="$(uname -r 2>/dev/null || echo '?')"
REBOOT=false; [[ -f /var/run/reboot-required ]] && REBOOT=true

UPD_TOTAL=0; UPD_SEC=0
if have apt-get; then
  $SUDO apt-get update -qq >/dev/null 2>&1 || true
  SIM="$(LANG=C $SUDO apt-get -s upgrade 2>/dev/null | grep -E '^Inst ' || true)"
  UPD_TOTAL="$(printf '%s\n' "$SIM" | grep -c '^Inst ' || true)"
  UPD_SEC="$(printf '%s\n' "$SIM" | grep -ci 'security' || true)"
fi

ufw_active=false
if have ufw; then $SUDO ufw status 2>/dev/null | grep -qi 'Status: active' && ufw_active=true; fi

f2b_active=false
if have systemctl; then systemctl is-active --quiet fail2ban 2>/dev/null && f2b_active=true; fi

unattended=false
[[ -f /etc/apt/apt.conf.d/20auto-upgrades ]] && unattended=true

ssh_hardened=false
[[ -f /etc/ssh/sshd_config.d/99-vault-hardening.conf ]] && ssh_hardened=true

docker_fw=false
if have iptables; then $SUDO iptables -S DOCKER-USER 2>/dev/null | grep -q '\-j DROP' && docker_fw=true; fi

ollama_bound=false
curl -fsS --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1 && ollama_bound=true

# Gesamtbewertung
SECURE=true
[[ "$HARDEN" == "yes" ]] || SECURE=false
$ufw_active || SECURE=false
$ssh_hardened || SECURE=false
[[ "$UPD_SEC" -eq 0 ]] || SECURE=false

cat > "$OUT" <<EOF
{
  "ts": "$(date -Iseconds)",
  "kernel": "$KERNEL",
  "reboot_required": $REBOOT,
  "updates_total": ${UPD_TOTAL:-0},
  "updates_security": ${UPD_SEC:-0},
  "ufw_active": $ufw_active,
  "fail2ban_active": $f2b_active,
  "unattended": $unattended,
  "ssh_hardened": $ssh_hardened,
  "docker_firewall": $docker_fw,
  "ollama_bound": $ollama_bound,
  "full_updates": "$FULL_UPDATES",
  "hardened": "$HARDEN",
  "secure": $SECURE
}
EOF

echo "  ✓ Sicherheits-Check → $OUT"
echo "    Kernel $KERNEL · Updates: ${UPD_TOTAL:-0} (${UPD_SEC:-0} sicherheitsrelevant) · ufw:$ufw_active · fail2ban:$f2b_active · reboot:$REBOOT"
