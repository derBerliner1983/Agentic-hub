"""Ollama-Adapter (lokales Modell, AMD/ROCm auf dem Host)."""
from __future__ import annotations
import json
import httpx
from .base import Provider, Health


class OllamaProvider(Provider):
    name = "ollama"

    def __init__(self, base_url: str, default_model: str = ""):
        self.base_url = base_url.rstrip("/")
        self.default_model = (default_model or "").strip()

    async def _models(self) -> list[str]:
        # Etwas großzügiger Timeout: der erste Request nach Container-Start
        # (host.docker.internal-Auflösung) darf nicht sofort als „offline" gelten.
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(f"{self.base_url}/api/tags")
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]

    async def models_detailed(self) -> list[dict]:
        """Verfügbare Modelle mit Größe (Bytes)."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                return [{"name": m["name"], "size": m.get("size", 0)}
                        for m in resp.json().get("models", [])]
        except Exception:  # noqa: BLE001
            return []

    async def running(self) -> list[dict]:
        """Aktuell geladene Modelle (RAM/VRAM) via /api/ps."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/ps")
                resp.raise_for_status()
                return [{"name": m["name"], "size": m.get("size", 0),
                         "size_vram": m.get("size_vram", 0)}
                        for m in resp.json().get("models", [])]
        except Exception:  # noqa: BLE001
            return []

    async def health(self) -> Health:
        try:
            models = await self._models()
            return {"name": self.name, "reachable": True, "connected": len(models) > 0,
                    "models": models,
                    "error": None if models else "Ollama erreichbar, aber kein Modell geladen (ollama pull ...)"}
        except Exception as exc:  # noqa: BLE001
            return {"name": self.name, "reachable": False, "connected": False,
                    "models": [], "error": f"Ollama nicht erreichbar: {exc}"}

    def _match(self, models: list[str], name: str) -> bool:
        # 'llama3.1' matcht auch 'llama3.1:latest'
        return any(m == name or m.split(":")[0] == name.split(":")[0] for m in models)

    async def ensure_model(self, model: str, bus=None) -> bool:
        """Stellt sicher, dass ein Modell lokal vorhanden ist – lädt es sonst
        automatisch via /api/pull nach (autonomes „passendes Modell holen")."""
        try:
            models = await self._models()
        except Exception:  # noqa: BLE001
            return False
        if self._match(models, model):
            return True
        if bus:
            await bus.publish({"type": "model", "state": "pulling", "model": model, "pct": 0})
        try:
            last_pct = -5
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{self.base_url}/api/pull",
                                         json={"name": model}) as resp:
                    async for line in resp.aiter_lines():
                        if not line.strip() or not bus:
                            continue
                        try:
                            d = json.loads(line)
                        except Exception:  # noqa: BLE001
                            continue
                        total, done = d.get("total"), d.get("completed")
                        pct = int(done / total * 100) if total else None
                        if pct is not None and pct >= last_pct + 5:
                            last_pct = pct
                            await bus.publish({"type": "model", "state": "pulling", "model": model,
                                               "pct": pct, "status": d.get("status", "")})
            if bus:
                await bus.publish({"type": "model", "state": "ready", "model": model, "pct": 100})
            return True
        except Exception as exc:  # noqa: BLE001
            if bus:
                await bus.publish({"type": "model", "state": "error", "model": model, "error": str(exc)})
            return False

    async def delete_model(self, name: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request("DELETE", f"{self.base_url}/api/delete",
                                            json={"name": name})
                return resp.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    async def generate(self, prompt: str, model: str | None = None,
                       system: str | None = None) -> str:
        if model is None:
            model = self.default_model or None
        if model is None:
            models = await self._models()
            if not models:
                raise RuntimeError("Kein Ollama-Modell verfügbar.")
            model = models[0]
        payload = {"model": model, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")

    async def embed(self, text: str, model: str = "nomic-embed-text") -> list[float]:
        """Einbettung (Vektor) für RAG. Leere Liste bei Fehler/keinem Modell."""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(f"{self.base_url}/api/embeddings",
                                         json={"model": model, "prompt": text})
                resp.raise_for_status()
                return resp.json().get("embedding", []) or []
        except Exception:  # noqa: BLE001
            return []

    async def chat_with_tools(self, prompt: str, tools: list[dict], execute,
                              model: str | None = None, system: str | None = None,
                              on_event=None, max_rounds: int = 5) -> str:
        """Werkzeug-fähiger Chat: das Modell darf Tools aufrufen (Ollama /api/chat).
        `execute(name, args) -> str` (async) führt ein Tool aus; `on_event(dict)`
        (async, optional) meldet Tool-Aufrufe ans HUD. Gibt die finale Antwort zurück."""
        if model is None:
            model = self.default_model or None
        if model is None:
            models = await self._models()
            if not models:
                raise RuntimeError("Kein Ollama-Modell verfügbar.")
            model = models[0]
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        async with httpx.AsyncClient(timeout=None) as client:
            for _ in range(max_rounds):
                resp = await client.post(f"{self.base_url}/api/chat", json={
                    "model": model, "messages": messages, "tools": tools, "stream": False})
                resp.raise_for_status()
                msg = resp.json().get("message", {}) or {}
                calls = msg.get("tool_calls") or []
                if not calls:
                    return msg.get("content", "")
                # Assistant-Turn mit Tool-Aufrufen anhängen
                messages.append({"role": "assistant", "content": msg.get("content", ""),
                                 "tool_calls": calls})
                for call in calls:
                    fn = call.get("function", {}) or {}
                    name = fn.get("name", "")
                    args = fn.get("arguments", {}) or {}
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except Exception:  # noqa: BLE001
                            args = {}
                    if on_event:
                        await on_event({"tool": name, "args": args})
                    result = await execute(name, args)
                    messages.append({"role": "tool", "content": str(result)[:6000]})
            # Nach max. Runden: eine finale Antwort ohne Tools erzwingen
            resp = await client.post(f"{self.base_url}/api/chat", json={
                "model": model, "messages": messages, "stream": False})
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")

    async def generate_stream(self, prompt: str, model: str | None = None,
                              system: str | None = None):
        if model is None:
            model = self.default_model or None
        if model is None:
            models = await self._models()
            if not models:
                raise RuntimeError("Kein Ollama-Modell verfügbar.")
            model = models[0]
        payload = {"model": model, "prompt": prompt, "stream": True}
        if system:
            payload["system"] = system
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{self.base_url}/api/generate",
                                     json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line).get("response", "")
                    except Exception:  # noqa: BLE001
                        continue
                    if chunk:
                        yield chunk
