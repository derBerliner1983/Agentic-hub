"""System Vitals – echte Kennzahlen aus dem Vault (Memory-Layer).

Speist die linke HUD-Spalte: Modell, Notiz-Anzahl, heutige Runs,
zuletzt geänderte Dokumente und die Top-Directives.
"""
from __future__ import annotations
import os
import datetime as dt
from pathlib import Path

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))


def _md_files() -> list[Path]:
    if not VAULT_DIR.exists():
        return []
    return [p for p in VAULT_DIR.rglob("*.md") if ".obsidian" not in p.parts]


def _human_ago(ts: float) -> str:
    delta = dt.datetime.now() - dt.datetime.fromtimestamp(ts)
    secs = int(delta.total_seconds())
    if secs < 60:
        return "jetzt"
    if secs < 3600:
        return f"{secs // 60}m"
    if secs < 86400:
        return f"{secs // 3600}h"
    return f"{secs // 86400}d"


def _directives(limit: int = 3) -> list[dict]:
    path = VAULT_DIR / "ops" / "directives.md"
    if not path.exists():
        return []
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("- [ ]") or s.startswith("- [x]") or s.startswith("- [X]"):
            done = s[3].lower() == "x"
            out.append({"text": s[5:].strip(), "done": done})
        if len(out) >= limit:
            break
    return out


def build_vitals(model: str | None) -> dict:
    files = _md_files()
    today = dt.date.today()

    runs_today = 0
    runs_dir = VAULT_DIR / "runs"
    if runs_dir.exists():
        for p in runs_dir.glob("*.md"):
            if dt.date.fromtimestamp(p.stat().st_mtime) == today:
                runs_today += 1

    recent = sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)[:6]
    recent_docs = [
        {"name": p.stem.replace("-", " "), "ago": _human_ago(p.stat().st_mtime)}
        for p in recent
    ]

    return {
        "model": model or "—",
        "notes": len(files),
        "runs_today": runs_today,
        "recent_docs": recent_docs,
        "directives": _directives(),
    }
