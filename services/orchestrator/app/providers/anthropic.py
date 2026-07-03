"""Claude-Adapter (Anthropic API). Optional zuschaltbar via Settings-Panel."""
from __future__ import annotations
import httpx
from .base import Provider, Health

API = "https://api.anthropic.com/v1"


class AnthropicProvider(Provider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str = "claude-sonnet-5"):
        self.api_key = api_key
        self.model = model

    def _headers(self) -> dict:
        return {"x-api-key": self.api_key, "anthropic-version": "2023-06-01",
                "content-type": "application/json"}

    async def health(self) -> Health:
        if not self.api_key:
            return {"name": self.name, "reachable": False, "connected": False,
                    "models": [], "error": "Kein Anthropic API-Key gesetzt."}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{API}/models", headers=self._headers())
                resp.raise_for_status()
                models = [m.get("id") for m in resp.json().get("data", [])]
            return {"name": self.name, "reachable": True, "connected": True,
                    "models": models or [self.model], "error": None}
        except Exception as exc:  # noqa: BLE001
            return {"name": self.name, "reachable": False, "connected": False,
                    "models": [], "error": f"Anthropic nicht erreichbar: {exc}"}

    async def generate(self, prompt: str, model: str | None = None,
                       system: str | None = None) -> str:
        payload = {"model": model or self.model, "max_tokens": 2048,
                   "messages": [{"role": "user", "content": prompt}]}
        if system:
            payload["system"] = system
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{API}/messages", headers=self._headers(), json=payload)
            resp.raise_for_status()
            parts = resp.json().get("content", [])
            return "".join(p.get("text", "") for p in parts)
