"""Autonom-Worker: arbeitet Kanban-Karten im Hintergrund ab.

Läuft nur, wenn der Autonom-Modus aktiv ist und ein Provider verbunden ist.
Nimmt sich die nächste To-Do-Karte, führt sie aus (Coder-Karten mit echter
Selbsttest-Schleife, sonst über das Agent-Mesh) und legt das Ergebnis in
'review' zur Bewertung. Immer nur EINE Karte gleichzeitig – „wenn er Zeit hat".
"""
from __future__ import annotations
import asyncio
import datetime as dt
import os
from pathlib import Path

from .events import EventBus
from . import board, agents, settings as settings_mod, coder_loop

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))
POLL_SECONDS = int(os.environ.get("WORKER_POLL", "15"))


def _is_code_card(project: dict, card: dict) -> bool:
    if project.get("type") == "code":
        return True
    text = f"{card.get('title','')} {card.get('detail','')}".lower()
    return any(k in text for k in ("code", "script", "programm", "python", "api",
                                   "webseite", "website", "app", "funktion", "bug"))


async def _process(project: dict, card: dict, bus: EventBus) -> None:
    pid, cid = project["id"], card["id"]
    goal = f"{card['title']}. {card.get('detail','')}".strip()

    async def emit(**extra):
        await bus.publish({"type": "board", "project": pid, "card": cid, **extra})

    board.update_card(pid, cid, {"status": "doing"})
    await emit(state="doing", title=card["title"])

    ollama = settings_mod.ollama_provider()
    artifacts: dict = {}
    try:
        if _is_code_card(project, card):
            res = await coder_loop.build_and_test(
                goal, ollama, bus, network=bool(project.get("network")))
            artifacts = res.get("artifacts", {})
            result_md = (f"**Sprache:** {res['lang']} · **Versuche:** {res['attempts']} · "
                         f"**getestet:** {'ja' if res.get('tested') else 'nein'}\n\n"
                         f"```{res['lang']}\n{res['code']}\n```\n\n"
                         f"**Ausgabe:**\n```\n{res.get('output','')[:1500]}\n```"
                         + (f"\n\n**Erzeugte Dateien:** {', '.join(artifacts)}" if artifacts else ""))
            ok = res["ok"]
            err = res.get("error", "")
        else:
            agent = agents.get_agent("writer")
            await ollama.ensure_model(agent["model"], bus)
            result_md = await ollama.generate(goal, model=agent["model"], system=agent["system"])
            ok, err = True, ""
    except Exception as exc:  # noqa: BLE001
        board.update_card(pid, cid, {"status": "failed", "error": str(exc)})
        await emit(state="failed", error=str(exc))
        return

    # Ergebnis auch als Datei im Vault ablegen
    try:
        stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
        d = VAULT_DIR / "projects" / project["id"]
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{stamp}-{cid}.md").write_text(
            f"# {card['title']}\n\n{result_md}\n", encoding="utf-8")
        # Erzeugte Dateien (Deliverables) als echte Dateien ablegen
        for fn, content in (artifacts or {}).items():
            safe = (d / "artifacts" / fn).resolve()
            if str(safe).startswith(str((d / "artifacts").resolve())):
                safe.parent.mkdir(parents=True, exist_ok=True)
                safe.write_text(content, encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass

    status = "review" if ok else "failed"
    board.update_card(pid, cid, {"status": status, "result": result_md[:6000], "error": err})
    await emit(state=status, title=card["title"])


async def worker_loop(bus: EventBus) -> None:
    while True:
        await asyncio.sleep(POLL_SECONDS)
        try:
            b = board.get_board()
            if not b.get("autonomous"):
                continue
            if board.has_active():
                continue
            health = await settings_mod.ollama_provider().health()
            if not health["connected"]:
                continue
            nxt = board.next_todo()
            if not nxt:
                continue
            await _process(nxt[0], nxt[1], bus)
        except Exception:  # noqa: BLE001
            pass
