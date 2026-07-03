"""Kleiner JSON-Store für persistente Konfiguration (Tasks, Settings, Agents).

Liegt unter STORE_DIR (im Container /instance, gemountet vom Host) und überlebt
damit Git-Updates.
"""
from __future__ import annotations
import json
import os
from pathlib import Path

STORE_DIR = Path(os.environ.get("STORE_DIR", "/instance"))


def load(name: str, default):
    path = STORE_DIR / name
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return default
    return default


def save(name: str, data) -> None:
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    (STORE_DIR / name).write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
