"""Ollama-Adapter (lokales Modell, AMD/ROCm auf dem Host)."""
from __future__ import annotations
import httpx
from .base import Provider, Health


class OllamaProvider(Provider):
    name = "ollama"

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def health(self) -> Health:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                models = [m["name"] for m in resp.json().get("models", [])]
            return {
                "name": self.name,
                "reachable": True,
                "connected": len(models) > 0,
                "models": models,
                "error": None if models else "Ollama erreichbar, aber kein Modell geladen (ollama pull ...)",
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "name": self.name,
                "reachable": False,
                "connected": False,
                "models": [],
                "error": f"Ollama nicht erreichbar: {exc}",
            }

    async def generate(self, prompt: str, model: str | None = None) -> str:
        if model is None:
            health = await self.health()
            if not health["models"]:
                raise RuntimeError("Kein Ollama-Modell verfügbar.")
            model = health["models"][0]
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            return resp.json().get("response", "")
