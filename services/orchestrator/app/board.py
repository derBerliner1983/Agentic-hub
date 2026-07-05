"""Kanban-Board für autonome Projekte.

Projekte enthalten Karten, die durch die Spalten wandern:
  backlog → todo → doing → review → done   (oder failed)

Der Autonom-Worker (worker.py) nimmt sich im Hintergrund To-Do-Karten,
arbeitet sie ab und legt das Ergebnis in 'review' zur Bewertung.
Persistiert in instance/board.json.
"""
from __future__ import annotations
import datetime as dt
import uuid

from . import store

COLUMNS = ["backlog", "todo", "doing", "review", "done", "failed"]


def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


def get_board() -> dict:
    b = store.load("board.json", None)
    if b is None:
        b = {"autonomous": False, "projects": []}
        store.save("board.json", b)
    return b


def _save(b: dict) -> None:
    store.save("board.json", b)


def set_autonomous(on: bool) -> dict:
    b = get_board()
    b["autonomous"] = bool(on)
    _save(b)
    return b


def add_project(title: str, goal: str = "", detail: str = "", ptype: str = "general",
                network: bool = False, runner: str | None = None) -> dict:
    b = get_board()
    proj = {"id": _new_id(), "title": title or "Projekt", "goal": goal, "detail": detail,
            "type": ptype, "network": bool(network), "runner": runner or None,
            "created": _now(), "cards": []}
    b["projects"].append(proj)
    _save(b)
    return proj


def get_project(pid: str) -> dict | None:
    return next((p for p in get_board()["projects"] if p["id"] == pid), None)


def ensure_inbox() -> str:
    """Standard-Projekt 'Eingang' für erfasste Aufgaben-Ergebnisse (legt es an)."""
    b = get_board()
    inbox = next((p for p in b["projects"] if p.get("type") == "inbox"), None)
    if inbox:
        return inbox["id"]
    proj = {"id": _new_id(), "title": "Eingang", "goal": "", "detail": "",
            "type": "inbox", "network": False, "runner": None,
            "created": _now(), "cards": []}
    b["projects"].append(proj)
    _save(b)
    return proj["id"]


def capture(title: str, result: str = "", detail: str = "", status: str = "review") -> dict | None:
    """Ein Ergebnis (Frage → Antwort) als Karte im Eingang ablegen."""
    pid = ensure_inbox()
    card = add_card(pid, title, detail, status)
    if card and result:
        update_card(pid, card["id"], {"result": result})
        card["result"] = result
    return card


def delete_project(pid: str) -> bool:
    b = get_board()
    n = len(b["projects"])
    b["projects"] = [p for p in b["projects"] if p["id"] != pid]
    _save(b)
    return len(b["projects"]) != n


def add_card(pid: str, title: str, detail: str = "", status: str = "todo") -> dict | None:
    b = get_board()
    proj = next((p for p in b["projects"] if p["id"] == pid), None)
    if not proj:
        return None
    card = {"id": _new_id(), "title": title or "Karte", "detail": detail,
            "status": status if status in COLUMNS else "todo", "rating": 0,
            "result": "", "error": "", "attempts": 0, "created": _now(), "updated": _now()}
    proj["cards"].append(card)
    _save(b)
    return card


def update_card(pid: str, cid: str, patch: dict) -> dict | None:
    b = get_board()
    proj = next((p for p in b["projects"] if p["id"] == pid), None)
    if not proj:
        return None
    card = next((c for c in proj["cards"] if c["id"] == cid), None)
    if not card:
        return None
    for k in ("title", "detail", "status", "rating", "result", "error", "attempts"):
        if k in patch:
            card[k] = patch[k]
    card["updated"] = _now()
    _save(b)
    return card


def delete_card(pid: str, cid: str) -> bool:
    b = get_board()
    proj = next((p for p in b["projects"] if p["id"] == pid), None)
    if not proj:
        return False
    n = len(proj["cards"])
    proj["cards"] = [c for c in proj["cards"] if c["id"] != cid]
    _save(b)
    return len(proj["cards"]) != n


def has_active() -> bool:
    """Läuft gerade eine Karte (doing)?"""
    return any(c["status"] == "doing"
               for p in get_board()["projects"] for c in p["cards"])


def next_todo() -> tuple[dict, dict] | None:
    """Erste To-Do-Karte (Projekt, Karte) für den Worker."""
    for p in get_board()["projects"]:
        for c in p["cards"]:
            if c["status"] == "todo":
                return p, c
    return None
