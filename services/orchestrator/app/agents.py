"""Agent-Mesh: spezialisierte Rollen-Agenten mit je eigenem (Ollama-)Modell.

Der Orchestrator „stellt" für einen Projekt-Schritt den passenden Agenten ein
(z. B. einen Coder, wenn programmiert werden muss) und lädt dessen Modell
automatisch nach. Konfiguration in instance/agents.json (editierbar).
"""
from __future__ import annotations
from . import store

DEFAULT_AGENTS: list[dict] = [
    {"role": "planner", "model": "llama3.1",
     "system": "Du bist ein präziser Projekt-Planer. Zerlege Ziele in klare, "
               "ausführbare Schritte. Antworte knapp und strukturiert."},
    {"role": "researcher", "model": "llama3.1",
     "system": "Du bist Rechercheur. Sammle relevante Fakten und fasse sie sachlich zusammen."},
    {"role": "coder", "model": "qwen2.5-coder",
     "system": "Du bist ein erfahrener Software-Entwickler. Schreibe korrekten, "
               "lauffähigen Code mit kurzer Erklärung. Halte dich exakt an die Aufgabe."},
    {"role": "writer", "model": "llama3.1",
     "system": "Du bist Autor. Formuliere klare, gut strukturierte Texte auf Deutsch."},
    {"role": "verifier", "model": "llama3.1",
     "system": "Du bist ein kritischer Prüfer. Prüfe, ob ein Ergebnis die Aufgabe "
               "wirklich erfüllt. Antworte mit 'OK' wenn es passt, sonst mit "
               "'FEHLER:' und einer kurzen, konkreten Verbesserungsanweisung."},
]


def list_agents() -> list[dict]:
    data = store.load("agents.json", None)
    if not data:
        store.save("agents.json", DEFAULT_AGENTS)
        return DEFAULT_AGENTS
    return data


def get_agent(role: str) -> dict:
    agents = list_agents()
    return next((a for a in agents if a["role"] == role),
                next(a for a in agents if a["role"] == "writer"))


def save_agent(agent: dict) -> dict:
    agents = list_agents()
    idx = next((i for i, a in enumerate(agents) if a["role"] == agent["role"]), None)
    if idx is None:
        agents.append(agent)
    else:
        agents[idx] = agent
    store.save("agents.json", agents)
    return agent
