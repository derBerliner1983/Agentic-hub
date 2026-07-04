"""Audit-Log: wer hat wann was ausgelöst.

Schreibt JSON-Zeilen nach instance/audit.log (gitignored, überlebt Updates).
Zusätzlich werden fehlgeschlagene Logins in instance/auth.log in einem für
fail2ban parsbaren Format protokolliert.
"""
from __future__ import annotations
import datetime as dt
import json
import os
from pathlib import Path

STORE_DIR = Path(os.environ.get("STORE_DIR", "/instance"))
AUDIT_FILE = STORE_DIR / "audit.log"
AUTH_FAIL_FILE = STORE_DIR / "auth.log"


def log(user: str | None, action: str, detail: str = "") -> None:
    try:
        STORE_DIR.mkdir(parents=True, exist_ok=True)
        line = json.dumps({"t": dt.datetime.now().isoformat(timespec="seconds"),
                           "user": user or "-", "action": action, "detail": detail},
                          ensure_ascii=False)
        with open(AUDIT_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:  # noqa: BLE001
        pass


def auth_fail(ip: str, user: str) -> None:
    """Fehlgeschlagenen Login für fail2ban protokollieren."""
    log(None, "login_fail", f"user={user} ip={ip}")
    try:
        STORE_DIR.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(AUTH_FAIL_FILE, "a", encoding="utf-8") as f:
            f.write(f"{stamp} VAULT_AUTH_FAIL ip={ip} user={user}\n")
    except Exception:  # noqa: BLE001
        pass


def recent(n: int = 100) -> list[dict]:
    if not AUDIT_FILE.exists():
        return []
    try:
        lines = AUDIT_FILE.read_text(encoding="utf-8").splitlines()[-n:]
        out = []
        for ln in reversed(lines):
            try:
                out.append(json.loads(ln))
            except Exception:  # noqa: BLE001
                continue
        return out
    except Exception:  # noqa: BLE001
        return []
