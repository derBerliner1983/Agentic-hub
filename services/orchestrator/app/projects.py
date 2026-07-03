"""Projekt-Runner: autonomes Plan → Ausführen → Prüfen → Nachbessern.

Ablauf für ein Projektziel:
  1) Planner-Agent zerlegt das Ziel in Schritte (mit Rolle je Schritt).
  2) Für jeden Schritt: passenden Rollen-Agenten wählen, dessen Ollama-Modell
     automatisch laden, Schritt ausführen.
  3) Verifier-Agent prüft das Ergebnis; bei Mängeln bis zu N Nachbesserungen.
  4) Alles nach vault/projects/<slug>/ schreiben.

Hinweis: Das ist das funktionierende Fundament des Agent-Mesh. Qualität hängt
am lokalen Modell; die Selbstprüfung reduziert Ausrutscher, ersetzt aber keine
menschliche Endkontrolle bei komplexen Aufgaben.
"""
from __future__ import annotations
import json
import os
import re
import datetime as dt
from pathlib import Path

from .events import EventBus
from .providers.ollama import OllamaProvider
from . import agents, skills

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))
MAX_FIX_ROUNDS = 2


def _extract_json(text: str):
    """Bester-Versuch, ein JSON-Array/-Objekt aus Modell-Output zu ziehen."""
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:  # noqa: BLE001
        return None


async def _run_agent(role: str, instruction: str, ollama: OllamaProvider, bus: EventBus,
                     context: str = "") -> str:
    agent = agents.get_agent(role)
    model = agent["model"]
    await bus.publish({"type": "project", "state": "hire", "role": role, "model": model})
    await ollama.ensure_model(model, bus)   # autonom passendes Modell laden
    prompt = instruction if not context else f"{instruction}\n\n--- Kontext ---\n{context}"
    return await ollama.generate(prompt, model=model, system=agent["system"])


async def _verify(instruction: str, result: str, ollama: OllamaProvider, bus: EventBus) -> tuple[bool, str]:
    agent = agents.get_agent("verifier")
    await ollama.ensure_model(agent["model"], bus)
    check = await ollama.generate(
        f"Aufgabe:\n{instruction}\n\nErgebnis:\n{result}\n\n"
        f"Erfüllt das Ergebnis die Aufgabe? Antworte mit 'OK' oder 'FEHLER: <Hinweis>'.",
        model=agent["model"], system=agent["system"])
    ok = check.strip().upper().startswith("OK")
    return ok, check.strip()


async def run_project(goal: str, ollama: OllamaProvider, bus: EventBus) -> None:
    async def emit(state: str, **extra):
        await bus.publish({"type": "project", "state": state, "goal": goal[:80], **extra})

    await emit("queued")
    health = await ollama.health()
    if not health["reachable"]:
        await emit("error", error=health.get("error") or "Ollama nicht erreichbar")
        return

    # 1) Planen
    await emit("planning")
    planner = agents.get_agent("planner")
    await ollama.ensure_model(planner["model"], bus)
    roles = ", ".join(sorted({a["role"] for a in agents.list_agents()}))
    plan_raw = await ollama.generate(
        f"Ziel: {goal}\n\nZerlege das Ziel in 2-5 Schritte. Gib NUR ein JSON-Array zurück, "
        f"jedes Element: {{\"role\": <eine von: {roles}>, \"instruction\": <konkrete Anweisung>}}.",
        model=planner["model"], system=planner["system"])
    steps = _extract_json(plan_raw) or [{"role": "writer", "instruction": goal}]
    if not isinstance(steps, list):
        steps = [{"role": "writer", "instruction": goal}]
    await emit("planned", steps=[{"role": s.get("role", "writer"),
                                  "instruction": str(s.get("instruction", ""))[:120]} for s in steps])

    # 2) + 3) Ausführen & prüfen
    outputs: list[dict] = []
    context = ""
    for i, step in enumerate(steps):
        role = step.get("role", "writer")
        instruction = str(step.get("instruction", "")).strip() or goal
        await emit("step", index=i + 1, total=len(steps), role=role)

        result = await _run_agent(role, instruction, ollama, bus, context)
        ok, feedback = await _verify(instruction, result, ollama, bus)
        rounds = 0
        while not ok and rounds < MAX_FIX_ROUNDS:
            rounds += 1
            await emit("fixing", index=i + 1, round=rounds, note=feedback[:120])
            result = await _run_agent(
                role, f"{instruction}\n\nVerbessere gemäß Prüfhinweis: {feedback}",
                ollama, bus, context)
            ok, feedback = await _verify(instruction, result, ollama, bus)

        outputs.append({"role": role, "instruction": instruction, "result": result,
                        "verified": ok})
        context = result

    # 4) Schreiben
    await emit("writing")
    slug = skills.slugify(goal)[:40]
    stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    proj_dir = VAULT_DIR / "projects" / f"{stamp}-{slug}"
    proj_dir.mkdir(parents=True, exist_ok=True)
    md = [f"# Projekt: {goal}", "", f"_{dt.datetime.now().isoformat(timespec='seconds')}_", ""]
    for i, o in enumerate(outputs):
        md += [f"## Schritt {i+1} · {o['role']} · {'✓ geprüft' if o['verified'] else '⚠ ungeprüft'}",
               f"**Anweisung:** {o['instruction']}", "", o["result"], ""]
    (proj_dir / "projekt.md").write_text("\n".join(md), encoding="utf-8")
    rel = str(proj_dir).replace(str(VAULT_DIR), "vault")
    await emit("done", output_path=rel, steps_done=len(outputs))
