"""Agent-Werkzeuge (Tool-Calling): Web-Suche, Web-Abruf, Vault-Suche.

Der Tool-Loop (ollama.chat_with_tools) reicht die hier definierten Schemas an das
Modell; ruft das Modell ein Tool auf, wird es hier ausgeführt und das Ergebnis
zurückgegeben. MCP-Tools kommen später dazu (siehe mcp.py / mcp_client.py).
"""
from __future__ import annotations
import html
import os
import re
from pathlib import Path
from urllib.parse import unquote

import httpx

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))
_UA = "Mozilla/5.0 (compatible; VAULT/1.0)"


def _strip_tags(s: str) -> str:
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", s)).strip()


def _ddg_clean(href: str) -> str:
    # DuckDuckGo verlinkt über /l/?uddg=<encoded>
    m = re.search(r"[?&]uddg=([^&]+)", href)
    if m:
        return unquote(m.group(1))
    if href.startswith("//"):
        return "https:" + href
    return href


async def web_search(query: str, max_results: int = 5) -> str:
    """Web-Suche via DuckDuckGo (ohne API-Key)."""
    query = (query or "").strip()
    if not query:
        return "Fehler: leere Suchanfrage."
    try:
        async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": _UA}) as c:
            r = await c.post("https://html.duckduckgo.com/html/", data={"q": query})
            r.raise_for_status()
            page = r.text
    except Exception as exc:  # noqa: BLE001
        return f"Web-Suche fehlgeschlagen: {exc}"
    out = []
    for m in re.finditer(r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S):
        url = _ddg_clean(m.group(1))
        title = _strip_tags(m.group(2))
        out.append(f"{len(out) + 1}. {title}\n   {url}")
        if len(out) >= max_results:
            break
    return "\n".join(out) if out else "Keine Treffer."


async def web_fetch(url: str, max_chars: int = 4000) -> str:
    """Ruft eine Webseite ab und gibt lesbaren Text zurück (gekürzt)."""
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        return "Fehler: URL muss mit http(s):// beginnen."
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True,
                                     headers={"User-Agent": _UA}) as c:
            r = await c.get(url)
            r.raise_for_status()
            text = _strip_tags(r.text)
    except Exception as exc:  # noqa: BLE001
        return f"Abruf fehlgeschlagen: {exc}"
    return text[:max_chars] + ("\n…(gekürzt)" if len(text) > max_chars else "")


def vault_search(query: str, max_results: int = 5) -> str:
    """Durchsucht die Vault-Notizen (Memory) nach einem Stichwort."""
    q = (query or "").strip().lower()
    if not q or not VAULT_DIR.exists():
        return "Keine Treffer."
    hits = []
    for p in VAULT_DIR.rglob("*.md"):
        if ".obsidian" in p.parts:
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except Exception:  # noqa: BLE001
            continue
        idx = txt.lower().find(q)
        if idx != -1:
            snippet = txt[max(0, idx - 120):idx + 200].replace("\n", " ").strip()
            rel = str(p.relative_to(VAULT_DIR))
            hits.append(f"• {rel}: …{snippet}…")
        if len(hits) >= max_results:
            break
    return "\n".join(hits) if hits else "Keine Treffer im Vault."


# ---- Tool-Schemas (für Ollama /api/chat) ----------------------------------
BUILTIN_SPECS = [
    {"type": "function", "function": {
        "name": "web_search",
        "description": "Sucht aktuelle Informationen im Internet (DuckDuckGo). "
                       "Nutze das für Fakten, News, Zahlen, die du nicht sicher weißt.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Suchbegriff"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "web_fetch",
        "description": "Öffnet eine URL und liefert den Textinhalt der Seite.",
        "parameters": {"type": "object", "properties": {
            "url": {"type": "string", "description": "Vollständige http(s)-URL"}}, "required": ["url"]}}},
    {"type": "function", "function": {
        "name": "vault_search",
        "description": "Durchsucht den eigenen Wissensspeicher (Vault-Notizen) nach einem Stichwort.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Stichwort"}}, "required": ["query"]}}},
]


async def execute_builtin(name: str, args: dict) -> str | None:
    """Führt ein eingebautes Tool aus. None = kein eingebautes Tool dieses Namens."""
    try:
        if name == "web_search":
            return await web_search(str(args.get("query", "")))
        if name == "web_fetch":
            return await web_fetch(str(args.get("url", "")))
        if name == "vault_search":
            return vault_search(str(args.get("query", "")))
    except Exception as exc:  # noqa: BLE001
        return f"Tool-Fehler ({name}): {exc}"
    return None


def toolset() -> list[dict]:
    """Alle verfügbaren Tool-Schemas (eingebaut + aktive MCP-Server)."""
    specs = list(BUILTIN_SPECS)
    try:
        from . import mcp_client
        specs += mcp_client.mcp_tool_specs()
    except Exception:  # noqa: BLE001
        pass
    return specs


async def execute(name: str, args: dict) -> str:
    """Dispatch: eingebaute Tools zuerst, sonst MCP."""
    r = await execute_builtin(name, args)
    if r is not None:
        return r
    try:
        from . import mcp_client
        r = await mcp_client.mcp_execute(name, args)
        if r is not None:
            return r
    except Exception as exc:  # noqa: BLE001
        return f"MCP-Fehler ({name}): {exc}"
    return f"Unbekanntes Tool: {name}"
