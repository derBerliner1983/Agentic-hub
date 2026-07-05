"""RAG über den Vault: Notizen einbetten (Ollama-Embeddings) und bei Fragen
die relevantesten Abschnitte als Kontext liefern.

Index (Vektoren) in instance/rag_index.json. Braucht das Embedding-Modell
`nomic-embed-text` (wird bei Bedarf nachgeladen).
"""
from __future__ import annotations
import math
import os
from pathlib import Path

from . import store, settings as settings_mod

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))
EMBED_MODEL = "nomic-embed-text"
INDEX_FILE = "rag_index.json"
CHUNK = 800


def _chunks() -> list[dict]:
    out: list[dict] = []
    if not VAULT_DIR.exists():
        return out
    for p in VAULT_DIR.rglob("*.md"):
        if ".obsidian" in p.parts:
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except Exception:  # noqa: BLE001
            continue
        rel = str(p.relative_to(VAULT_DIR))
        for i in range(0, len(txt), CHUNK):
            chunk = txt[i:i + CHUNK].strip()
            if len(chunk) > 40:
                out.append({"file": rel, "text": chunk})
    return out


def _cos(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


async def reindex(bus=None) -> int:
    """Baut den Vektor-Index neu auf. Gibt die Anzahl Chunks zurück."""
    prov = settings_mod.ollama_provider()
    await prov.ensure_model(EMBED_MODEL, bus)   # Embedding-Modell sicherstellen
    chunks = _chunks()
    idx = []
    for c in chunks:
        vec = await prov.embed(c["text"], EMBED_MODEL)
        if vec:
            idx.append({"file": c["file"], "text": c["text"], "vec": vec})
    store.save(INDEX_FILE, {"model": EMBED_MODEL, "chunks": idx})
    if bus:
        await bus.publish({"type": "rag", "state": "indexed", "chunks": len(idx)})
    return len(idx)


async def search(query: str, k: int = 4) -> list[dict]:
    """Top-k relevante Vault-Abschnitte zur Frage (leer, wenn kein Index)."""
    data = store.load(INDEX_FILE, None)
    if not data or not data.get("chunks"):
        return []
    prov = settings_mod.ollama_provider()
    qv = await prov.embed(query, data.get("model", EMBED_MODEL))
    if not qv:
        return []
    scored = sorted(data["chunks"], key=lambda c: _cos(qv, c.get("vec", [])), reverse=True)
    return [{"file": c["file"], "text": c["text"]} for c in scored[:k]]


def info() -> dict:
    data = store.load(INDEX_FILE, None) or {}
    return {"chunks": len(data.get("chunks", [])), "model": data.get("model", EMBED_MODEL)}


async def context_block(query: str, k: int = 4) -> str:
    """Fertiger Kontexttext für den System-Prompt (leer, wenn nichts passt)."""
    hits = await search(query, k)
    if not hits:
        return ""
    joined = "\n\n".join(f"[{h['file']}]\n{h['text']}" for h in hits)
    return ("\n\nRelevantes Wissen aus deinem Vault (nutze es, wenn es zur Frage passt):\n"
            + joined)
