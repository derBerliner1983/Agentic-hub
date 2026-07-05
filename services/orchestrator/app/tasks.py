"""Task-Registry + Runner (datengetrieben).

Ein Task ist ein benannter Job aus dem Command Deck. Er besteht aus SCHRITTEN,
die entweder einen vorhandenen Skill nutzen (`{"type":"skill","skill":"id"}`)
oder einen freien Prompt (`{"type":"prompt","prompt":"..."}`). Der Runner führt
die Schritte nacheinander aus (Ergebnis eines Schritts = Kontext für den nächsten),
streamt Events (queued → thinking → writing → done) und schreibt nach vault/runs/.

Tasks werden in STORE (instance/tasks.json) gespeichert und sind im HUD baubar.
"""
from __future__ import annotations
import os
import datetime as dt
from pathlib import Path

from .providers.base import Provider
from .events import EventBus
from . import store, skills

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))

# Standard-Tasks (Seed beim ersten Start, falls noch nichts gespeichert ist)
_DEFAULTS: list[dict] = [
    {"id": "metrics-pull", "title": "Metrics Pull", "domain": "ops", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Fasse die wichtigsten Kennzahlen des Tages stichpunktartig zusammen."}]},
    {"id": "am-report", "title": "AM Report", "domain": "ops", "cadence": "scheduled",
     "steps": [{"type": "prompt", "prompt": "Erstelle einen kurzen Morgen-Report mit Fokus und Prioritäten für heute."}]},
    {"id": "inbox-brief", "title": "Inbox Brief", "domain": "inbox", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Erstelle ein kurzes Inbox-Briefing: was ist dringend, was kann warten."}]},
    {"id": "gh-trending", "title": "GH Trending", "domain": "research", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Nenne 5 interessante Themen/Trends aus der Entwickler-Welt mit je einem Satz."}]},
    {"id": "trend-scan", "title": "Trend Scan", "domain": "research", "cadence": "scheduled",
     "steps": [{"type": "prompt", "prompt": "Führe einen kurzen Trend-Scan zu KI-Agenten durch (3-5 Punkte)."}]},
    {"id": "yt-week", "title": "YT Week", "domain": "content", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Schlage 3 YouTube-Video-Ideen für diese Woche vor, je mit Hook."}]},
    {"id": "plan-today", "title": "Plan Today", "domain": "ops", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Erstelle einen fokussierten Tagesplan mit 3 wichtigsten Aufgaben."}]},
    {"id": "plan-tmrw", "title": "Plan Tmrw", "domain": "ops", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Skizziere einen Plan für morgen mit den 3 wichtigsten Zielen."}]},
    {"id": "wk-review", "title": "Wk Review", "domain": "ops", "cadence": "scheduled",
     "steps": [{"type": "prompt", "prompt": "Erstelle ein kurzes Wochen-Review: Erfolge, Learnings, nächste Schritte."}]},
    {"id": "vault-clean", "title": "Vault Clean", "domain": "ops", "cadence": "on-demand",
     "steps": [{"type": "prompt", "prompt": "Schlage vor, wie der Vault aufgeräumt/strukturiert werden könnte."}]},
]

DOMAINS = ["inbox", "research", "content", "ops"]


def _tasks() -> list[dict]:
    data = store.load("tasks.json", None)
    if not data:
        store.save("tasks.json", _DEFAULTS)
        return _DEFAULTS
    return data


def task_list() -> list[dict]:
    return [{"id": t["id"], "title": t["title"], "domain": t.get("domain", "ops"),
             "cadence": t.get("cadence", "on-demand"),
             "schedule": t.get("schedule"), "model": t.get("model")} for t in _tasks()]


def all_tasks() -> list[dict]:
    return _tasks()


def get_task(task_id: str) -> dict | None:
    return next((t for t in _tasks() if t["id"] == task_id), None)


def save_task(task: dict) -> dict:
    tasks = _tasks()
    task.setdefault("domain", "ops")
    task.setdefault("cadence", "on-demand")
    task.setdefault("steps", [])
    if not task.get("id"):
        task["id"] = skills.slugify(task.get("title", "task"))
    idx = next((i for i, t in enumerate(tasks) if t["id"] == task["id"]), None)
    if idx is None:
        tasks.append(task)
    else:
        tasks[idx] = task
    store.save("tasks.json", tasks)
    return task


def delete_task(task_id: str) -> bool:
    tasks = _tasks()
    new = [t for t in tasks if t["id"] != task_id]
    if len(new) == len(tasks):
        return False
    store.save("tasks.json", new)
    return True


def _resolve_step_prompt(step: dict) -> str:
    if step.get("type") == "skill":
        body = skills.skill_prompt(step.get("skill", ""))
        return body or f"[Skill '{step.get('skill')}' nicht gefunden]"
    return step.get("prompt", "")


async def run_adhoc(prompt: str, provider: Provider, bus: EventBus,
                    domain: str = "inbox", channel: str = "text") -> None:
    """Einzelne Ad-hoc-Aufgabe: ein freier Prompt → eine Antwort (gestreamt) →
    Ergebnis in vault/runs. `channel="voice"` = nur sprechen, nicht in den Chat schreiben."""
    title = prompt.strip()[:48] + ("…" if len(prompt.strip()) > 48 else "")
    tid = "adhoc"

    async def emit(state: str, **extra):
        await bus.publish({"type": "task", "id": tid, "title": title, "domain": domain,
                           "state": state, "channel": channel, **extra})

    await emit("queued", q=prompt)   # volle Frage für den Chat-Verlauf
    health = await provider.health()
    if not health["connected"]:
        await emit("error", error=health.get("error") or "kein Provider verbunden")
        return

    await emit("thinking")
    result = ""
    # RAG: relevantes Vault-Wissen als Kontext beimischen (falls aktiviert)
    rag_ctx = ""
    from . import settings as settings_mod
    if settings_mod.get().get("rag_enabled"):
        try:
            from . import rag
            rag_ctx = await rag.context_block(prompt)
        except Exception:  # noqa: BLE001
            rag_ctx = ""

    _now = dt.datetime.now()
    date_ctx = (f"Heute ist {_now.strftime('%A, %d.%m.%Y')}, aktuelle Uhrzeit "
                f"{_now.strftime('%H:%M')}. Datum und Uhrzeit kennst du damit bereits – "
                f"dafür KEINE Web-Suche nutzen. ")
    used_tools = hasattr(provider, "chat_with_tools")
    if used_tools:
        # Werkzeug-fähig: das Modell darf Web-Suche/Vault/MCP nutzen
        from . import tools as tools_mod

        async def on_tool(ev):
            await emit("tool", tool=ev.get("tool", ""))
        try:
            result = await provider.chat_with_tools(
                prompt, tools_mod.toolset(), tools_mod.execute,
                system=date_ctx + "Du bist ein hilfreicher Assistent mit Werkzeugen "
                       "(Web-Suche, Web-Abruf, Vault-Suche). Nutze sie bei aktuellen "
                       "Fakten/Zahlen. Antworte kurz und direkt auf Deutsch." + rag_ctx,
                on_event=on_tool)
            await emit("stream", chunk=result, step=1, steps=1)
        except Exception:  # noqa: BLE001 – Fallback ohne Tools
            used_tools = False
            result = ""
    if not used_tools:
        try:
            async for chunk in provider.generate_stream(prompt, system=(date_ctx + rag_ctx)):
                result += chunk
                await emit("stream", chunk=chunk, step=1, steps=1)
        except Exception as exc:  # noqa: BLE001
            await emit("error", error=str(exc))
            return

    await emit("writing")
    stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    runs_dir = VAULT_DIR / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    out_path = runs_dir / f"{stamp}-adhoc.md"
    try:
        out_path.write_text(
            f"# {title}\n\n- Ad-hoc-Aufgabe · {dt.datetime.now().isoformat(timespec='seconds')}\n\n"
            f"**Frage:** {prompt}\n\n---\n\n{result}\n", encoding="utf-8")
        rel = str(out_path).replace(str(VAULT_DIR), "vault")
    except Exception as exc:  # noqa: BLE001
        await emit("error", error=f"Schreiben fehlgeschlagen: {exc}")
        return
    await emit("done", output_path=rel, preview=result[:280])
    return result


async def run_task(task_id: str, provider: Provider, bus: EventBus) -> None:
    task = get_task(task_id)
    if not task:
        await bus.publish({"type": "task", "id": task_id, "state": "error", "error": "unbekannter Task"})
        return

    domain = task.get("domain", "ops")

    async def emit(state: str, **extra):
        await bus.publish({"type": "task", "id": task_id, "title": task["title"],
                           "domain": domain, "state": state, **extra})

    await emit("queued")
    health = await provider.health()
    if not health["connected"]:
        await emit("error", error=health.get("error") or "kein Provider verbunden")
        return

    await emit("thinking")
    steps = task.get("steps") or [{"type": "prompt", "prompt": task.get("title", "")}]
    model = task.get("model") or None
    context = ""
    outputs: list[str] = []
    try:
        for i, step in enumerate(steps):
            prompt = _resolve_step_prompt(step)
            if context:
                prompt = f"{prompt}\n\n--- Kontext aus vorherigem Schritt ---\n{context}"
            # Streaming: Chunks live ans HUD schicken
            result = ""
            async for chunk in provider.generate_stream(prompt, model=model):
                result += chunk
                await emit("stream", chunk=chunk, step=i + 1, steps=len(steps))
            outputs.append(result)
            context = result
    except Exception as exc:  # noqa: BLE001
        await emit("error", error=str(exc))
        return

    await emit("writing")
    stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    runs_dir = VAULT_DIR / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    out_path = runs_dir / f"{stamp}-{task_id}.md"
    body = "\n\n---\n\n".join(outputs)
    try:
        out_path.write_text(
            f"# {task['title']}\n\n"
            f"- Task: `{task_id}` · Domäne: {domain} · Schritte: {len(steps)} · "
            f"{dt.datetime.now().isoformat(timespec='seconds')}\n\n{body}\n",
            encoding="utf-8",
        )
        rel = str(out_path).replace(str(VAULT_DIR), "vault")
    except Exception as exc:  # noqa: BLE001
        await emit("error", error=f"Schreiben fehlgeschlagen: {exc}")
        return

    await emit("done", output_path=rel, preview=body[:280])
