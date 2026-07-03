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
