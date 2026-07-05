"""Vault-Notizen: auflisten, lesen, schreiben (Memory-Layer im Browser bearbeitbar).

Alle Pfade sind relativ zum VAULT_DIR und werden gegen Path-Traversal geschützt.
"""
from __future__ import annotations
import os
import datetime as dt
from pathlib import Path

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault")).resolve()


def _human_ago(ts: float) -> str:
    secs = int((dt.datetime.now() - dt.datetime.fromtimestamp(ts)).total_seconds())
    if secs < 60:
        return "jetzt"
    if secs < 3600:
        return f"{secs // 60}m"
    if secs < 86400:
        return f"{secs // 3600}h"
    return f"{secs // 86400}d"


def _safe(rel: str) -> Path | None:
    """Rel-Pfad → absoluter Pfad innerhalb VAULT_DIR (oder None bei Ausbruch)."""
    rel = (rel or "").strip().lstrip("/")
    if not rel or not rel.endswith(".md"):
        return None
    p = (VAULT_DIR / rel).resolve()
    try:
        p.relative_to(VAULT_DIR)
    except ValueError:
        return None
    return p


def list_notes() -> list[dict]:
    if not VAULT_DIR.exists():
        return []
    out = []
    for p in VAULT_DIR.rglob("*.md"):
        if ".obsidian" in p.parts:
            continue
        rel = str(p.relative_to(VAULT_DIR))
        st = p.stat()
        out.append({"path": rel, "name": p.stem.replace("-", " "),
                    "folder": str(p.parent.relative_to(VAULT_DIR)) if p.parent != VAULT_DIR else "",
                    "ago": _human_ago(st.st_mtime), "mtime": st.st_mtime,
                    "size": st.st_size})
    out.sort(key=lambda x: x["mtime"], reverse=True)
    return out


def read_note(rel: str) -> dict | None:
    p = _safe(rel)
    if not p or not p.is_file():
        return None
    return {"path": rel, "content": p.read_text(encoding="utf-8")}


def write_note(rel: str, content: str) -> dict | None:
    p = _safe(rel)
    if not p:
        return None
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return {"path": rel, "ok": True}


def delete_note(rel: str) -> bool:
    p = _safe(rel)
    if not p or not p.is_file():
        return False
    p.unlink()
    return True
