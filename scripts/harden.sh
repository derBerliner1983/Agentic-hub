#!/usr/bin/env bash
#
# V.A.U.L.T. Server-Härtung (Ubuntu) – idempotent, mehrfach ausführbar.
#
#   1) System komplett updaten/patchen + automatische Sicherheitsupdates
#   2) Firewall (ufw): ALLES dicht, erlaubt nur LAN (RFC1918) auf SSH/HUD-Ports
#   3) Docker-Ports absichern (DOCKER-USER-Kette – Docker umgeht sonst ufw!)
#   4) SSH härten + fail2ban (Brute-Force-Schutz)
#   5) Kernel-/Netzwerk-Härtung (sysctl)
#   6) Ollama: für Docker-Container erreichbar, Port aber nur intern erlaubt
#
# ⚠ ACHTUNG: Sperrt Zugriff aus dem Internet komplett aus (nur LAN).
#   NICHT auf einem Cloud-/VPS-Server ausführen, den du übers Internet
#   erreichst – du sperrst dich sonst selbst aus!
#
set -euo pipefail

# Als root laufen (sonst per sudo neu starten)
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info() { printf '  • %s\n'  "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }

LAN_NETS=(10.0.0.0/8 172.16.0.0/12 192.168.0.0/16)
DOCKER_NET=172.16.0.0/12
HTTP_PORT="${HTTP_PORT:-3000}"
HTTPS_PORT="${HTTPS_PORT:-3443}"
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# 1) System-Updates + unattended-upgrades
# ---------------------------------------------------------------------------
say "System-Updates"
apt-get update -y
apt-get full-upgrade -y
apt-get autoremove -y
ok "System auf aktuellem Stand"

apt-get install -y unattended-upgrades >/dev/null
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
ok "Automatische Sicherheitsupdates aktiv"

# ---------------------------------------------------------------------------
# 2) Firewall: default deny, nur LAN auf SSH + HUD
# ---------------------------------------------------------------------------
say "Firewall (ufw)"
apt-get install -y ufw >/dev/null
ufw --force default deny incoming  >/dev/null
ufw --force default allow outgoing >/dev/null
for net in "${LAN_NETS[@]}"; do
  ufw allow from "$net" to any port 22 proto tcp           >/dev/null  # SSH
  ufw allow from "$net" to any port "$HTTP_PORT"  proto tcp >/dev/null # HUD http
  ufw allow from "$net" to any port "$HTTPS_PORT" proto tcp >/dev/null # HUD https
done
# Ollama (11434) nur aus Docker-Netzen, nicht aus dem restlichen LAN
ufw allow from "$DOCKER_NET" to any port 11434 proto tcp >/dev/null
ufw --force enable >/dev/null
ok "ufw aktiv: eingehend gesperrt, LAN → 22/${HTTP_PORT}/${HTTPS_PORT}, Docker → 11434"

# ---------------------------------------------------------------------------
# 3) Docker-Published-Ports absichern (Docker umgeht ufw via iptables!)
# ---------------------------------------------------------------------------
say "Docker-Firewall (DOCKER-USER)"
if command -v iptables >/dev/null 2>&1; then
  iptables -N DOCKER-USER 2>/dev/null || true
  # Reihenfolge: established zuerst, dann LAN erlauben, Rest DROP
  iptables -C DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN 2>/dev/null \
    || iptables -I DOCKER-USER 1 -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  for net in "${LAN_NETS[@]}"; do
    iptables -C DOCKER-USER -s "$net" -j RETURN 2>/dev/null \
      || iptables -I DOCKER-USER 2 -s "$net" -j RETURN
  done
  iptables -C DOCKER-USER -j DROP 2>/dev/null || iptables -A DOCKER-USER -j DROP
  # Regeln persistent machen
  apt-get install -y iptables-persistent >/dev/null 2>&1 || true
  command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1 || true
  ok "Docker-Ports nur noch aus LAN erreichbar (Internet → DROP)"
else
  warn "iptables nicht gefunden – Docker-Ports nicht zusätzlich gefiltert."
fi

# ---------------------------------------------------------------------------
# 4) SSH härten + fail2ban
# ---------------------------------------------------------------------------
say "SSH-Härtung"
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-vault-hardening.conf <<'EOF'
# V.A.U.L.T. SSH-Härtung
PermitRootLogin prohibit-password
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
# AllowTcpForwarding bleibt an: wird für den empfohlenen SSH-Tunnel zum HUD genutzt
AllowTcpForwarding yes
EOF

# Passwort-Login nur abschalten, wenn SSH-Keys hinterlegt sind (sonst Aussperr-Gefahr)
REAL_USER="${SUDO_USER:-root}"
REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
if [[ -s "$REAL_HOME/.ssh/authorized_keys" ]]; then
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config.d/99-vault-hardening.conf
  ok "SSH-Passwort-Login deaktiviert (Keys für $REAL_USER vorhanden)"
else
  warn "Keine SSH-Keys für $REAL_USER gefunden – Passwort-Login bleibt AN."
  warn "Empfehlung: Key hinterlegen (ssh-copy-id), dann harden.sh erneut ausführen."
fi

if sshd -t 2>/dev/null; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  ok "SSH-Konfiguration aktiv"
else
  warn "sshd -t meldet Fehler – Härtungsdatei wird entfernt."
  rm -f /etc/ssh/sshd_config.d/99-vault-hardening.conf
fi

apt-get install -y fail2ban >/dev/null
systemctl enable --now fail2ban >/dev/null 2>&1 || true
ok "fail2ban aktiv (SSH-Brute-Force-Schutz)"

# HUD-Login zusätzlich mit fail2ban schützen
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTHLOG="$REPO_DIR/instance/auth.log"
if [[ -f "$REPO_DIR/services/fail2ban/vault-login.conf" ]]; then
  cp "$REPO_DIR/services/fail2ban/vault-login.conf" /etc/fail2ban/filter.d/vault-login.conf
  touch "$AUTHLOG"
  cat > /etc/fail2ban/jail.d/vault.conf <<EOF
[vault-login]
enabled  = true
filter   = vault-login
logpath  = $AUTHLOG
maxretry = 5
findtime = 600
bantime  = 3600
action   = iptables-allports[name=vault]
EOF
  systemctl restart fail2ban >/dev/null 2>&1 || true
  ok "HUD-Login durch fail2ban geschützt (5 Fehlversuche → Bann)"
fi

# ---------------------------------------------------------------------------
# 5) Kernel-/Netzwerk-Härtung
# ---------------------------------------------------------------------------
say "sysctl-Härtung"
cat > /etc/sysctl.d/99-vault-hardening.conf <<'EOF'
# V.A.U.L.T. Netzwerk-Härtung
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
kernel.dmesg_restrict = 1
EOF
sysctl --system >/dev/null 2>&1 || true
ok "sysctl-Härtung aktiv"

# ---------------------------------------------------------------------------
# 6) Ollama für Docker erreichbar machen (bindet sonst nur an 127.0.0.1)
# ---------------------------------------------------------------------------
say "Ollama-Anbindung"
if systemctl list-unit-files 2>/dev/null | grep -q '^ollama.service'; then
  mkdir -p /etc/systemd/system/ollama.service.d
  cat > /etc/systemd/system/ollama.service.d/10-vault.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF
  systemctl daemon-reload
  systemctl restart ollama 2>/dev/null || true
  ok "Ollama lauscht auf 0.0.0.0:11434 – Firewall erlaubt nur Docker-Netze"
else
  info "Kein ollama.service gefunden – Schritt übersprungen."
fi

say "Härtung abgeschlossen"
ok "System gepatcht · Firewall LAN-only · SSH gehärtet · fail2ban · Auto-Updates"
info "Prüfen:  ufw status verbose   |   fail2ban-client status sshd"
