"""V.A.U.L.T. Orchestrator – FastAPI-App.

Stellt bereit:
  • GET  /api/status         → Provider-/Verbindungsstatus + Task-Liste
  • POST /api/tasks/{id}/run → Task starten (Events kommen über den WebSocket)
  • WS   /ws                 → Live-Status + Task-Events (steuert das „Gehirn")
  • /                        → statisches HUD
"""
from __future__ import annotations
import asyncio
import contextlib
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .events import EventBus
from .providers.ollama import OllamaProvider
from .tasks import run_task, task_list

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://host.docker.internal:11434")

app = FastAPI(title="V.A.U.L.T. Orchestrator")
bus = EventBus()
provider = OllamaProvider(OLLAMA_HOST)

_last_status: dict = {"type": "status", "connected": False, "providers": [], "tasks": task_list()}


async def _status_snapshot() -> dict:
    health = await provider.health()
    return {
        "type": "status",
        "connected": health["connected"],
        "providers": [health],
        "tasks": task_list(),
    }


async def _status_poller() -> None:
    """Pollt regelmäßig den Provider-Status und published Änderungen."""
    global _last_status
    while True:
        try:
            snap = await _status_snapshot()
            if snap != _last_status:
                _last_status = snap
                await bus.publish(snap)
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(4)


@app.on_event("startup")
async def _startup() -> None:
    app.state.poller = asyncio.create_task(_status_poller())


@app.on_event("shutdown")
async def _shutdown() -> None:
    app.state.poller.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await app.state.poller


@app.get("/api/status")
async def api_status() -> JSONResponse:
    return JSONResponse(await _status_snapshot())


@app.post("/api/tasks/{task_id}/run")
async def api_run_task(task_id: str) -> JSONResponse:
    asyncio.create_task(run_task(task_id, provider, bus))
    return JSONResponse({"ok": True, "task": task_id})


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    queue = bus.subscribe()
    # Sofort aktuellen Status schicken, damit das HUD nicht auf den Poller warten muss.
    await ws.send_json(await _status_snapshot())
    try:
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(queue)


# Statisches HUD unter "/" (muss NACH den API-Routen gemountet werden).
app.mount("/", StaticFiles(directory="static", html=True), name="hud")
