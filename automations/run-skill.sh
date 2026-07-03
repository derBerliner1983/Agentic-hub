#!/usr/bin/env bash
# Generischer Runner: führt einen beliebigen Skill headless aus.
# Nutzung:  ./automations/run-skill.sh <skill-name> ["zusätzlicher Kontext"]
# Beispiel: ./automations/run-skill.sh deep-research "Wie funktionieren MCP-Server?"
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

SKILL_NAME="${1:-}"
EXTRA="${2:-}"

if [[ -z "$SKILL_NAME" ]]; then
  echo "Fehler: kein Skill-Name angegeben." >&2
  echo "Nutzung: $0 <skill-name> [\"Kontext\"]" >&2
  exit 1
fi

SKILL_FILE=".claude/skills/${SKILL_NAME}/SKILL.md"
if [[ ! -f "$SKILL_FILE" ]]; then
  echo "Fehler: Skill '$SKILL_NAME' nicht gefunden ($SKILL_FILE)." >&2
  exit 1
fi

claude -p "Führe den folgenden Skill aus.
${EXTRA:+Zusätzlicher Kontext: $EXTRA}

$(cat "$SKILL_FILE")"
