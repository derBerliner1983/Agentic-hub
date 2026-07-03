#!/usr/bin/env python3
"""Kleine Brücke, damit die Dashboard-Buttons wirklich `claude -p` ausführen.

Nutzung:
    python3 dashboard/server.py
    # dann http://localhost:8080 öffnen

Serviert die statischen Dateien in dashboard/ und nimmt POST /run { "skill": "<name>" }
entgegen, um automations/run-skill.sh im Hintergrund zu starten.

Sicherheitshinweis: Nur lokal (localhost) betreiben. Der Server führt Claude Code aus.
"""
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent          # dashboard/
REPO = ROOT.parent                              # Repo-Wurzel
SKILLS_DIR = REPO / ".claude" / "skills"
PORT = 8080


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/run":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_error(400, "invalid json")
            return

        skill = str(payload.get("skill", "")).strip()
        # Whitelist: nur existierende Skill-Ordner zulassen (kein Command-Injection).
        if not skill or not (SKILLS_DIR / skill / "SKILL.md").is_file():
            self.send_error(400, "unknown skill")
            return

        runner = REPO / "automations" / "run-skill.sh"
        # Im Hintergrund starten, damit der Klick sofort zurückkommt.
        subprocess.Popen(["bash", str(runner), skill], cwd=str(REPO))

        body = json.dumps({"ok": True, "skill": skill}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Agentic Hub Dashboard läuft auf http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
