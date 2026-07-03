"""Sandbox-Checks für generierten Code – Härtung des Verifiers.

Extrahiert Code-Blöcke aus Agent-Output und prüft sie REAL (nicht nur per LLM):
  • python → py_compile (Syntax/Imports auf Modulebene)
  • bash   → bash -n
  • javascript → node --check (falls node vorhanden, sonst übersprungen)

Echte AUSFÜHRUNG ist standardmäßig AUS (SANDBOX_EXEC=1 aktiviert sie), weil der
Container privilegierte Mounts hat (docker.sock für Updates). Syntax-Checks +
Fehler-Rückkopplung fangen die häufigsten „Verhaspler" ab, ohne Risiko.
"""
from __future__ import annotations
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

EXEC_ENABLED = os.environ.get("SANDBOX_EXEC", "0") == "1"
TIMEOUT = int(os.environ.get("SANDBOX_TIMEOUT", "10"))

_BLOCK_RE = re.compile(r"```([A-Za-z0-9_+.-]*)[ \t]*\r?\n(.*?)```", re.DOTALL)
_ALIASES = {"py": "python", "python3": "python", "sh": "bash", "shell": "bash",
            "zsh": "bash", "js": "javascript", "node": "javascript", "": "unknown"}


def extract_blocks(text: str) -> list[dict]:
    out = []
    for m in _BLOCK_RE.finditer(text or ""):
        lang = _ALIASES.get(m.group(1).strip().lower(), m.group(1).strip().lower())
        code = m.group(2)
        if code.strip():
            out.append({"lang": lang, "code": code})
    return out


def _run(cmd: list[str], **kw) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT, **kw)
        msg = (p.stderr or p.stdout or "").strip()
        return p.returncode == 0, msg
    except subprocess.TimeoutExpired:
        return False, f"Timeout nach {TIMEOUT}s"
    except FileNotFoundError as exc:
        return True, f"übersprungen ({exc.filename} fehlt)"


def check_block(lang: str, code: str) -> tuple[bool, str]:
    """Syntax-Check eines Blocks. (ok, meldung)"""
    with tempfile.TemporaryDirectory() as tmp:
        if lang == "python":
            f = Path(tmp) / "snippet.py"
            f.write_text(code, encoding="utf-8")
            return _run([sys.executable, "-m", "py_compile", str(f)])
        if lang == "bash":
            f = Path(tmp) / "snippet.sh"
            f.write_text(code, encoding="utf-8")
            return _run(["bash", "-n", str(f)])
        if lang == "javascript":
            if not shutil.which("node"):
                return True, "übersprungen (node fehlt)"
            f = Path(tmp) / "snippet.js"
            f.write_text(code, encoding="utf-8")
            return _run(["node", "--check", str(f)])
    return True, f"kein Checker für '{lang}'"


def execute_block(lang: str, code: str) -> tuple[bool, str]:
    """Optionale echte Ausführung (nur mit SANDBOX_EXEC=1)."""
    if not EXEC_ENABLED:
        return True, "Ausführung deaktiviert (SANDBOX_EXEC=0)"
    with tempfile.TemporaryDirectory() as tmp:
        if lang == "python":
            f = Path(tmp) / "run.py"
            f.write_text(code, encoding="utf-8")
            return _run([sys.executable, str(f)], cwd=tmp)
        if lang == "bash":
            f = Path(tmp) / "run.sh"
            f.write_text(code, encoding="utf-8")
            return _run(["bash", str(f)], cwd=tmp)
    return True, "keine Ausführung für diese Sprache"


def review(text: str) -> dict:
    """Alle Blöcke prüfen. Liefert {'blocks': n, 'errors': [...], 'notes': [...]}"""
    blocks = extract_blocks(text)
    errors: list[str] = []
    notes: list[str] = []
    for i, b in enumerate(blocks):
        ok, msg = check_block(b["lang"], b["code"])
        if not ok:
            errors.append(f"Block {i+1} ({b['lang']}): {msg[:400]}")
        elif msg:
            notes.append(f"Block {i+1} ({b['lang']}): {msg}")
        if ok and EXEC_ENABLED and b["lang"] in ("python", "bash"):
            ran_ok, out = execute_block(b["lang"], b["code"])
            if not ran_ok:
                errors.append(f"Block {i+1} ({b['lang']}) Laufzeitfehler: {out[:400]}")
    return {"blocks": len(blocks), "errors": errors, "notes": notes}


def format_report(report: dict) -> str:
    if not report or report["blocks"] == 0:
        return ""
    lines = [f"Code-Checks: {report['blocks']} Block/Blöcke geprüft."]
    lines += [f"FEHLER: {e}" for e in report["errors"]]
    lines += [f"Hinweis: {n}" for n in report["notes"]]
    return "\n".join(lines)
