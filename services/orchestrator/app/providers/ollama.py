"""Ollama-Adapter (lokales Modell, AMD/ROCm auf dem Host)."""
from __future__ import annotations
import httpx
from .base import Provider, Health


class OllamaProvider(Provider):
    name = "ollama"

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def _models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{self.base_url}/api/tags")
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]

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
            await bus.publish({"type": "model", "state": "pulling", "model": model})
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{self.base_url}/api/pull",
                                         json={"name": model}) as resp:
                    async for _line in resp.aiter_lines():
                        pass  # Fortschritt konsumieren
            if bus:
                await bus.publish({"type": "model", "state": "ready", "model": model})
            return True
        except Exception as exc:  # noqa: BLE001
            if bus:
                await bus.publish({"type": "model", "state": "error", "model": model, "error": str(exc)})
            return False

    async def generate(self, prompt: str, model: str | None = None,
                       system: str | None = None) -> str:
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
