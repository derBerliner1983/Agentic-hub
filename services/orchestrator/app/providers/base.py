"""Gemeinsames Adapter-Interface für alle KI-Provider.

Neue Provider (Claude, OpenAI, opencode) implementieren dieselben Methoden –
der Rest des Systems bleibt unverändert.
"""
from __future__ import annotations
from typing import TypedDict


class Health(TypedDict):
    name: str
    reachable: bool
    connected: bool          # reachable UND einsatzbereit (Modell/Key vorhanden)
    models: list[str]
    error: str | None


class Provider:
    name: str = "base"

    async def health(self) -> Health:
        raise NotImplementedError

    async def generate(self, prompt: str, model: str | None = None,
                       system: str | None = None) -> str:
        raise NotImplementedError

    async def generate_stream(self, prompt: str, model: str | None = None,
                              system: str | None = None):
        """Streaming-Standard: liefert die komplette Antwort in einem Stück.
        Provider mit echtem Streaming (Ollama) überschreiben das."""
        yield await self.generate(prompt, model, system)
