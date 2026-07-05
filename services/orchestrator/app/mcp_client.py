"""MCP-Client: bindet eingetragene MCP-Server als echte Werkzeuge ein.

Unterstützt zwei Transporte:
  • http  – JSON-RPC 2.0 über einen HTTP-Endpunkt (Streamable HTTP; Antwort JSON
            oder SSE). `target` = URL.
  • stdio – lokaler Prozess, JSON-RPC als zeilenweise JSON. `target` = Command.

Tools werden gecacht (refresh_mcp_tools) und unter dem Namen
`mcp_<serverid>_<toolname>` angeboten, damit es keine Namenskollisionen gibt.
"""
from __future__ import annotations
import asyncio
import json
import re
import shlex

import httpx

from . import mcp as mcp_registry

# name → {"server": id, "orig": toolname, "spec": {...}}
_TOOL_CACHE: dict[str, dict] = {}

_PROTOCOL = "2024-11-05"
_CLIENT_INFO = {"name": "VAULT", "version": "1.0"}


def _safe(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]", "_", s or "")


# ---- HTTP-Transport --------------------------------------------------------
def _parse_http(resp: httpx.Response) -> dict:
    ct = resp.headers.get("content-type", "")
    if "text/event-stream" in ct:
        # SSE: letzte data:-Zeile mit JSON nehmen
        payload = {}
        for line in resp.text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                try:
                    payload = json.loads(line[5:].strip())
                except Exception:  # noqa: BLE001
                    continue
        return payload
    try:
        return resp.json()
    except Exception:  # noqa: BLE001
        return {}


async def _http_rpc(url: str, method: str, params: dict | None,
                    request_id: int, sid: str | None, client: httpx.AsyncClient):
    body = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        body["params"] = params
    headers = {"Accept": "application/json, text/event-stream",
               "Content-Type": "application/json"}
    if sid:
        headers["Mcp-Session-Id"] = sid
    resp = await client.post(url, json=body, headers=headers)
    resp.raise_for_status()
    new_sid = resp.headers.get("mcp-session-id") or sid
    return _parse_http(resp), new_sid


async def _http_notify(url: str, method: str, sid: str | None, client: httpx.AsyncClient):
    headers = {"Accept": "application/json, text/event-stream",
               "Content-Type": "application/json"}
    if sid:
        headers["Mcp-Session-Id"] = sid
    try:
        await client.post(url, json={"jsonrpc": "2.0", "method": method}, headers=headers)
    except Exception:  # noqa: BLE001
        pass


async def _http_session(url: str, want: str, params: dict | None):
    """Handshake (initialize + initialized) und dann eine Anfrage (want)."""
    async with httpx.AsyncClient(timeout=25.0) as client:
        init, sid = await _http_rpc(url, "initialize", {
            "protocolVersion": _PROTOCOL, "capabilities": {},
            "clientInfo": _CLIENT_INFO}, 1, None, client)
        await _http_notify(url, "notifications/initialized", sid, client)
        res, _ = await _http_rpc(url, want, params, 2, sid, client)
        return res


# ---- stdio-Transport -------------------------------------------------------
async def _stdio_session(command: str, want: str, params: dict | None):
    argv = shlex.split(command)
    if not argv:
        raise RuntimeError("leeres Command")
    proc = await asyncio.create_subprocess_exec(
        *argv, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL)

    async def send(obj):
        proc.stdin.write((json.dumps(obj) + "\n").encode())
        await proc.stdin.drain()

    async def read_id(want_id):
        while True:
            line = await asyncio.wait_for(proc.stdout.readline(), timeout=25.0)
            if not line:
                return {}
            try:
                msg = json.loads(line.decode())
            except Exception:  # noqa: BLE001
                continue
            if msg.get("id") == want_id:
                return msg

    try:
        await send({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": _PROTOCOL, "capabilities": {},
                               "clientInfo": _CLIENT_INFO}})
        await read_id(1)
        await send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        await send({"jsonrpc": "2.0", "id": 2, "method": want, "params": params or {}})
        return await read_id(2)
    finally:
        try:
            proc.terminate()
        except Exception:  # noqa: BLE001
            pass


async def _session(server: dict, want: str, params: dict | None):
    transport = server.get("transport", "stdio")
    target = server.get("target", "")
    if transport in ("http", "sse"):
        return await _http_session(target, want, params)
    return await _stdio_session(target, want, params)


# ---- öffentliche API -------------------------------------------------------
async def refresh_mcp_tools() -> int:
    """Fragt alle aktiven MCP-Server nach ihren Tools und füllt den Cache."""
    cache: dict[str, dict] = {}
    for srv in mcp_registry.list_mcp():
        if not srv.get("enabled", True) or not srv.get("target"):
            continue
        try:
            res = await _session(srv, "tools/list", {})
            tools = (res.get("result") or {}).get("tools") or []
        except Exception:  # noqa: BLE001
            continue
        for t in tools:
            orig = t.get("name", "")
            if not orig:
                continue
            name = f"mcp_{_safe(srv['id'])}_{_safe(orig)}"[:60]
            cache[name] = {"server": srv["id"], "orig": orig, "spec": {
                "type": "function", "function": {
                    "name": name,
                    "description": (t.get("description") or f"MCP {srv['name']}: {orig}")[:400],
                    "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}}}}
    global _TOOL_CACHE
    _TOOL_CACHE = cache
    return len(cache)


def mcp_tool_specs() -> list[dict]:
    return [v["spec"] for v in _TOOL_CACHE.values()]


def server_tool_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for v in _TOOL_CACHE.values():
        counts[v["server"]] = counts.get(v["server"], 0) + 1
    return counts


async def mcp_execute(name: str, args: dict) -> str | None:
    """Führt einen MCP-Tool-Aufruf aus. None = kein MCP-Tool dieses Namens."""
    entry = _TOOL_CACHE.get(name)
    if not entry:
        return None
    srv = mcp_registry.get_mcp(entry["server"]) if hasattr(mcp_registry, "get_mcp") else \
        next((s for s in mcp_registry.list_mcp() if s["id"] == entry["server"]), None)
    if not srv:
        return f"MCP-Server '{entry['server']}' nicht gefunden."
    try:
        res = await _session(srv, "tools/call", {"name": entry["orig"], "arguments": args})
    except Exception as exc:  # noqa: BLE001
        return f"MCP-Aufruf fehlgeschlagen: {exc}"
    content = (res.get("result") or {}).get("content") or []
    parts = [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
    return "\n".join(p for p in parts if p) or json.dumps(res.get("result") or res)[:2000]
