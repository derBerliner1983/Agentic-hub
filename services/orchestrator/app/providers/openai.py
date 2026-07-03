"""OpenAI-Adapter (ChatGPT-API). Optional zuschaltbar via Settings-Panel."""
from __future__ import annotations
import httpx
from .base import Provider, Health

API = "https://api.openai.com/v1"


class OpenAIProvider(Provider):
    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model

    def _headers(self) -> dict:
        return {"authorization": f"Bearer {self.api_key}", "content-type": "application/json"}

    async def health(self) -> Health:
        if not self.api_key:
            return {"name": self.name, "reachable": False, "connected": False,
                    "models": [], "error": "Kein OpenAI API-Key gesetzt."}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{API}/models", headers=self._headers())
                resp.raise_for_status()
                models = [m.get("id") for m in resp.json().get("data", [])]
            return {"name": self.name, "reachable": True, "connected": True,
                    "models": models or [self.model], "error": None}
        except Exception as exc:  # noqa: BLE001
            return {"name": self.name, "reachable": False, "connected": False,
                    "models": [], "error": f"OpenAI nicht erreichbar: {exc}"}

    async def generate(self, prompt: str, model: str | None = None,
                       system: str | None = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {"model": model or self.model, "messages": messages}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{API}/chat/completions", headers=self._headers(), json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
