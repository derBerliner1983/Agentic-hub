"""Provider-Settings (Phase 4): aktiver Provider + Zugangsdaten.

Gespeichert in instance/settings.json (gitignored → API-Keys bleiben lokal).
"""
from __future__ import annotations
import os
from . import store
from .providers.base import Provider
from .providers.ollama import OllamaProvider
from .providers.anthropic import AnthropicProvider
from .providers.openai import OpenAIProvider

_DEFAULTS = {
    "active_provider": "ollama",
    "ollama_url": os.environ.get("OLLAMA_HOST", "http://host.docker.internal:11434"),
    "ollama_model": "",   # aktives Standard-Modell (leer = erstes verfügbares)
    "model_labels": {},   # eigene Anzeigenamen: {modellname: "Anzeigename"}
    "stt_model": os.environ.get("WHISPER_MODEL", "small"),   # Sprach-Modell (Whisper)
    "tts_voice": "de_DE-thorsten-medium",   # Sprachausgabe-Stimme (Piper)
    # Sprach-Engine: lokal (piper/whisper) oder ElevenLabs (Cloud, API-Key, sehr
    # natürlich + niedrige Latenz mit flash_v2_5). Fallback ist immer lokal.
    "tts_engine": "piper",        # piper | elevenlabs
    "stt_engine": "whisper",      # whisper | elevenlabs
    "elevenlabs_key": "",
    "elevenlabs_voice": "",       # ElevenLabs voice_id
    "elevenlabs_model": "eleven_flash_v2_5",
    "rag_enabled": False,   # RAG: Vault-Wissen als Kontext in Antworten einbeziehen
    "wake_word": "",   # Freihand-Weckwort (Browser, leer = aus); danach folgt der Befehl
    "owakeword_model": "hey_jarvis",   # Server-Weckwort (openWakeWord-Modell)
    "owakeword_threshold": 0.5,        # Empfindlichkeit (0..1)
    "anthropic_key": "",
    "anthropic_model": "claude-sonnet-5",
    "openai_key": "",
    "openai_model": "gpt-4o",
    # Automatisches Backup
    "backup_enabled": False,
    "backup_interval_hours": 24,
    "backup_keep": 7,
    "backup_dir": os.environ.get("BACKUP_DIR", "/backups"),
    "backup_git_remote": "",   # optional: offsite-Push (https://user:token@host/repo.git)
}


def get() -> dict:
    data = dict(_DEFAULTS)
    data.update(store.load("settings.json", {}) or {})
    return data


def update(patch: dict) -> dict:
    data = get()
    for k, v in patch.items():
        if k in _DEFAULTS:
            data[k] = v
    store.save("settings.json", data)
    return data


def public() -> dict:
    """Für die UI: Keys maskiert, nur ob gesetzt."""
    d = get()
    return {
        "active_provider": d["active_provider"],
        "ollama_url": d["ollama_url"],
        "ollama_model": d["ollama_model"],
        "model_labels": d["model_labels"],
        "stt_model": d["stt_model"],
        "tts_voice": d["tts_voice"],
        "tts_engine": d["tts_engine"],
        "stt_engine": d["stt_engine"],
        "elevenlabs_voice": d["elevenlabs_voice"],
        "elevenlabs_model": d["elevenlabs_model"],
        "elevenlabs_key_set": bool(d["elevenlabs_key"]),
        "rag_enabled": d["rag_enabled"],
        "wake_word": d["wake_word"],
        "owakeword_model": d["owakeword_model"],
        "owakeword_threshold": d["owakeword_threshold"],
        "anthropic_model": d["anthropic_model"],
        "openai_model": d["openai_model"],
        "anthropic_key_set": bool(d["anthropic_key"]),
        "openai_key_set": bool(d["openai_key"]),
        "backup_enabled": d["backup_enabled"],
        "backup_interval_hours": d["backup_interval_hours"],
        "backup_keep": d["backup_keep"],
        "backup_git_set": bool(d["backup_git_remote"]),
    }


def build_provider() -> Provider:
    d = get()
    ap = d["active_provider"]
    if ap == "anthropic" and d["anthropic_key"]:
        return AnthropicProvider(d["anthropic_key"], d["anthropic_model"])
    if ap == "openai" and d["openai_key"]:
        return OpenAIProvider(d["openai_key"], d["openai_model"])
    return OllamaProvider(d["ollama_url"], d.get("ollama_model") or "")


def ollama_provider() -> OllamaProvider:
    """Immer ein Ollama-Adapter (für das Agent-Mesh / Modell-Laden)."""
    d = get()
    return OllamaProvider(d["ollama_url"], d.get("ollama_model") or "")
