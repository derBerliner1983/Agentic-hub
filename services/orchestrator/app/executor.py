"""Echte Code-Ausführung in isolierten Wegwerf-Docker-Containern.

Der Orchestrator hat den docker.sock gemountet und kann damit Geschwister-
Container starten. Code wird per `docker cp` hineinkopiert (kein geteiltes
Dateisystem nötig – funktioniert auch aus dem Container heraus) und mit
Ressourcen-Limits + Timeout ausgeführt.

Sicherheit: standardmäßig OHNE Netzwerk, mit Speicher-/CPU-/PID-Limits und
schreibbarem /work, sonst read-only. Netzwerk kann pro Lauf erlaubt werden
(z. B. um Abhängigkeiten zu installieren oder Web-APIs zu testen).
"""
from __future__ import annotations
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

DEFAULT_TIMEOUT = int(os.environ.get("EXEC_TIMEOUT", "40"))

# Runner-Profile: Sprache → (Image, Startbefehl, Hauptdateiname)
PROFILES: dict[str, dict] = {
    "python": {"image": "python:3.12-slim", "cmd": "python main.py", "file": "main.py"},
    "node":   {"image": "node:20-slim",     "cmd": "node main.js",   "file": "main.js"},
    "javascript": {"image": "node:20-slim", "cmd": "node main.js",   "file": "main.js"},
    "bash":   {"image": "debian:stable-slim", "cmd": "bash main.sh", "file": "main.sh"},
}


def available() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        subprocess.run(["docker", "info"], capture_output=True, timeout=8, check=True)
        return True
    except Exception:  # noqa: BLE001
        return False


def supported_langs() -> list[str]:
    return sorted(PROFILES.keys())


def run(lang: str, code: str, *, network: bool = False,
        timeout: int = DEFAULT_TIMEOUT, files: dict | None = None) -> dict:
    """Führt Code aus. Liefert {ok, exit_code, stdout, stderr, skipped, reason}."""
    prof = PROFILES.get(lang)
    if not prof:
        return {"ok": True, "skipped": True, "reason": f"kein Runner für '{lang}'",
                "exit_code": 0, "stdout": "", "stderr": ""}
    if not available():
        return {"ok": True, "skipped": True, "reason": "Docker nicht verfügbar",
                "exit_code": 0, "stdout": "", "stderr": ""}

    tmp = Path(tempfile.mkdtemp(prefix="vault-exec-"))
    name = f"vault-run-{uuid.uuid4().hex[:10]}"
    try:
        (tmp / prof["file"]).write_text(code, encoding="utf-8")
        for fn, content in (files or {}).items():
            safe = (tmp / fn).resolve()
            if str(safe).startswith(str(tmp.resolve())):
                safe.parent.mkdir(parents=True, exist_ok=True)
                safe.write_text(content, encoding="utf-8")

        create = ["docker", "create", "--name", name, "-w", "/work",
                  "--memory=512m", "--cpus=1", "--pids-limit=256"]
        if not network:
            create += ["--network", "none"]
        create += [prof["image"], "sh", "-lc", f"timeout {timeout} {prof['cmd']}"]
        c = subprocess.run(create, capture_output=True, text=True, timeout=60)
        if c.returncode != 0:
            return {"ok": False, "skipped": False, "exit_code": c.returncode,
                    "stdout": "", "stderr": f"docker create: {c.stderr.strip()}",
                    "reason": "create fehlgeschlagen (Image nicht ladbar?)"}

        subprocess.run(["docker", "cp", f"{tmp}/.", f"{name}:/work"],
                       capture_output=True, text=True, timeout=60)
        proc = subprocess.run(["docker", "start", "-a", name],
                              capture_output=True, text=True, timeout=timeout + 25)
        exit_code = proc.returncode
        artifacts = _collect_artifacts(name, prof["file"])
        return {"ok": exit_code == 0, "skipped": False, "exit_code": exit_code,
                "stdout": proc.stdout[-8000:], "stderr": proc.stderr[-8000:],
                "artifacts": artifacts, "reason": "timeout" if exit_code == 124 else ""}
    except subprocess.TimeoutExpired:
        return {"ok": False, "skipped": False, "exit_code": 124,
                "stdout": "", "stderr": f"Zeitüberschreitung nach {timeout}s", "reason": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "skipped": False, "exit_code": -1,
                "stdout": "", "stderr": str(exc), "reason": "executor-error"}
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)


def _collect_artifacts(name: str, entry_file: str, max_bytes: int = 200_000) -> dict:
    """Vom Container in /work erzeugte Text-Dateien einsammeln (echte Deliverables)."""
    out: dict[str, str] = {}
    dst = Path(tempfile.mkdtemp(prefix="vault-art-"))
    try:
        subprocess.run(["docker", "cp", f"{name}:/work/.", str(dst)],
                       capture_output=True, timeout=60)
        for f in sorted(dst.rglob("*")):
            if not f.is_file():
                continue
            rel = str(f.relative_to(dst))
            if rel == entry_file or f.stat().st_size > max_bytes:
                continue
            try:
                out[rel] = f.read_text(encoding="utf-8")
            except Exception:  # noqa: BLE001 – Binärdatei überspringen
                continue
            if len(out) >= 25:
                break
    except Exception:  # noqa: BLE001
        pass
    finally:
        shutil.rmtree(dst, ignore_errors=True)
    return out
