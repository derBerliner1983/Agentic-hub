#!/usr/bin/env bash
# Führt den morning-scan Skill headless aus (für cron geeignet).
# Cron-Beispiel (täglich 07:00):
#   0 7 * * * cd /pfad/zu/Agentic-hub && ./automations/morning-scan.sh >> automations/morning-scan.log 2>&1
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

SKILL_FILE=".claude/skills/morning-scan/SKILL.md"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starte morning-scan…"

# Claude Code headless mit dem Skill-Prompt ausführen.
claude -p "Führe den folgenden Skill aus:

$(cat "$SKILL_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] morning-scan fertig."
