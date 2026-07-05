"""MCP-Registry: eingebundene MCP-Server (Model Context Protocol).

Reine Registry in instance/mcp.json – erlaubt dem Nutzer, MCP-Server im HUD
einzutragen (Name, Transport, URL/Command). Zählt zum „Wissen" des Gehirns.
"""
from __future__ import annotations
import re
from . import store

_slug = re.compile(r"[^a-z0-9-]+")


def _sid(name: str) -> str:
    s = (name or "mcp").strip().lower().replace(" ", "-")
    return _slug.sub("", s) or "mcp"


def list_mcp() -> list[dict]:
    return store.load("mcp.json", []) or []


def save_mcp(entry: dict) -> dict:
    items = list_mcp()
    entry = {
        "id": entry.get("id") or _sid(entry.get("name", "")),
        "name": entry.get("name", "MCP"),
        "transport": entry.get("transport", "stdio"),   # stdio | sse | http
        "target": entry.get("target", ""),              # command oder URL
        "enabled": bool(entry.get("enabled", True)),
    }
    idx = next((i for i, m in enumerate(items) if m["id"] == entry["id"]), None)
    if idx is None:
        items.append(entry)
    else:
        items[idx] = entry
    store.save("mcp.json", items)
    return entry


def delete_mcp(mcp_id: str) -> bool:
    items = list_mcp()
    new = [m for m in items if m["id"] != mcp_id]
    if len(new) == len(items):
        return False
    store.save("mcp.json", new)
    return True
