"""Task-Registry + Runner.

Ein Task ist ein benannter Job aus dem Command Deck. Er ruft den aktiven
Provider auf, streamt Lebenszyklus-Events (queued → thinking → writing → done)
und schreibt das Ergebnis in den Vault (Memory-Layer).
"""
from __future__ import annotations
import os
import datetime as dt
from pathlib import Path

from .providers.base import Provider
from .events import EventBus

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))

# id -> (Anzeigename, Hirn-Domäne, Prompt-Vorlage)
TASKS: dict[str, dict] = {
    "metrics-pull": {"title": "Metrics Pull", "domain": "ops",
                     "prompt": "Fasse die wichtigsten Kennzahlen des Tages stichpunktartig zusammen."},
    "am-report":    {"title": "AM Report", "domain": "ops",
                     "prompt": "Erstelle einen kurzen Morgen-Report mit Fokus und Prioritäten für heute."},
    "inbox-brief":  {"title": "Inbox Brief", "domain": "inbox",
                     "prompt": "Erstelle ein kurzes Inbox-Briefing: was ist dringend, was kann warten."},
    "gh-trending":  {"title": "GH Trending", "domain": "research",
                     "prompt": "Nenne 5 interessante Themen/Trends aus der Entwickler-Welt mit je einem Satz."},
    "trend-scan":   {"title": "Trend Scan", "domain": "research",
                     "prompt": "Führe einen kurzen Trend-Scan zu KI-Agenten durch (3-5 Punkte)."},
    "yt-week":      {"title": "YT Week", "domain": "content",
                     "prompt": "Schlage 3 YouTube-Video-Ideen für diese Woche vor, je mit Hook."},
    "plan-today":   {"title": "Plan Today", "domain": "ops",
                     "prompt": "Erstelle einen fokussierten Tagesplan mit 3 wichtigsten Aufgaben."},
    "plan-tmrw":    {"title": "Plan Tmrw", "domain": "ops",
                     "prompt": "Skizziere einen Plan für morgen mit den 3 wichtigsten Zielen."},
    "wk-review":    {"title": "Wk Review", "domain": "ops",
                     "prompt": "Erstelle ein kurzes Wochen-Review: Erfolge, Learnings, nächste Schritte."},
    "vault-clean":  {"title": "Vault Clean", "domain": "ops",
                     "prompt": "Schlage vor, wie der Vault aufgeräumt/strukturiert werden könnte."},
}


def task_list() -> list[dict]:
    return [{"id": tid, "title": t["title"], "domain": t["domain"]} for tid, t in TASKS.items()]


async def run_task(task_id: str, provider: Provider, bus: EventBus) -> None:
    task = TASKS.get(task_id)
    if not task:
        await bus.publish({"type": "task", "id": task_id, "state": "error", "error": "unbekannter Task"})
        return

    domain = task["domain"]

    async def emit(state: str, **extra):
        await bus.publish({"type": "task", "id": task_id, "title": task["title"],
                           "domain": domain, "state": state, **extra})

    await emit("queued")
    health = await provider.health()
    if not health["connected"]:
        await emit("error", error=health.get("error") or "kein Provider verbunden")
        return

    await emit("thinking")
    try:
        output = await provider.generate(task["prompt"])
    except Exception as exc:  # noqa: BLE001
        await emit("error", error=str(exc))
        return

    await emit("writing")
    stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    runs_dir = VAULT_DIR / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    out_path = runs_dir / f"{stamp}-{task_id}.md"
    try:
        out_path.write_text(
            f"# {task['title']}\n\n"
            f"- Task: `{task_id}`  ·  Domäne: {domain}  ·  {dt.datetime.now().isoformat(timespec='seconds')}\n\n"
            f"{output}\n",
            encoding="utf-8",
        )
        rel = str(out_path).replace(str(VAULT_DIR), "vault")
    except Exception as exc:  # noqa: BLE001
        await emit("error", error=f"Schreiben fehlgeschlagen: {exc}")
        return

    await emit("done", output_path=rel, preview=output[:280])
