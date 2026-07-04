"""Scheduler: führt Tasks zeitgesteuert aus (Cadence „scheduled").

Ein Task kann ein `schedule`-Feld haben:
  {"type": "interval", "minutes": 60}         → alle 60 Minuten
  {"type": "daily", "time": "07:00"}          → täglich um 07:00
Ohne/andere Werte = nicht geplant (nur on-demand).

Letzte Läufe werden in instance/schedule.json gemerkt (überlebt Neustarts).
"""
from __future__ import annotations
import asyncio
import datetime as dt

from .events import EventBus
from . import store, tasks as tasks_mod, settings as settings_mod, backup as backup_mod
from .tasks import run_task


def _due(sched: dict, last: dt.datetime | None, now: dt.datetime) -> bool:
    if not isinstance(sched, dict):
        return False
    kind = sched.get("type")
    if kind == "interval":
        mins = int(sched.get("minutes", 0) or 0)
        if mins <= 0:
            return False
        return last is None or (now - last).total_seconds() >= mins * 60
    if kind == "daily":
        try:
            hh, mm = str(sched.get("time", "07:00")).split(":")
            target = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
        except Exception:  # noqa: BLE001
            return False
        if now < target:
            return False
        return last is None or last < target
    return False


async def scheduler_loop(bus: EventBus) -> None:
    while True:
        await asyncio.sleep(60)
        try:
            now = dt.datetime.now()
            state = store.load("schedule.json", {}) or {}
            changed = False

            # Automatisches Backup (unabhängig vom Provider)
            cfg = settings_mod.get()
            if cfg.get("backup_enabled"):
                last_bk = state.get("_backup")
                last_bk_dt = dt.datetime.fromisoformat(last_bk) if last_bk else None
                interval = float(cfg.get("backup_interval_hours", 24) or 24) * 3600
                if last_bk_dt is None or (now - last_bk_dt).total_seconds() >= interval:
                    try:
                        path = backup_mod.write_scheduled(cfg.get("backup_dir", "/backups"),
                                                          int(cfg.get("backup_keep", 7)))
                        await bus.publish({"type": "backup", "state": "done", "path": path})
                    except Exception as exc:  # noqa: BLE001
                        await bus.publish({"type": "backup", "state": "error", "error": str(exc)})
                    state["_backup"] = now.isoformat()
                    changed = True

            connected = (await settings_mod.build_provider().health())["connected"]
            if not connected:
                if changed:
                    store.save("schedule.json", state)
                continue
            for t in tasks_mod.all_tasks():
                sched = t.get("schedule")
                last_iso = state.get(t["id"])
                last = dt.datetime.fromisoformat(last_iso) if last_iso else None
                if _due(sched, last, now):
                    await bus.publish({"type": "task", "id": t["id"], "title": t["title"],
                                       "domain": t.get("domain", "ops"), "state": "scheduled"})
                    asyncio.create_task(run_task(t["id"], settings_mod.build_provider(), bus))
                    state[t["id"]] = now.isoformat()
                    changed = True
            if changed:
                store.save("schedule.json", state)
        except Exception:  # noqa: BLE001
            pass
