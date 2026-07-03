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

from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .events import EventBus
from .providers.ollama import OllamaProvider
from .tasks import run_task, task_list
from .vitals import build_vitals
from . import voice

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


@app.get("/api/vitals")
async def api_vitals() -> JSONResponse:
    health = await provider.health()
    model = health["models"][0] if health["models"] else None
    return JSONResponse(build_vitals(model))


@app.post("/api/tasks/{task_id}/run")
async def api_run_task(task_id: str) -> JSONResponse:
    asyncio.create_task(run_task(task_id, provider, bus))
    return JSONResponse({"ok": True, "task": task_id})


@app.get("/api/voice/status")
async def api_voice_status() -> JSONResponse:
    return JSONResponse({"stt": voice.stt_available(), "tts": voice.tts_available()})


@app.post("/api/voice/command")
async def api_voice_command(file: UploadFile) -> JSONResponse:
    """Browser-Audio → Text → passenden Task auslösen."""
    audio = await file.read()
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    try:
        text = await asyncio.to_thread(voice.transcribe, audio, suffix)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": f"STT fehlgeschlagen: {exc}"}, status_code=500)

    task_id = voice.match_task(text)
    if task_id:
        asyncio.create_task(run_task(task_id, provider, bus))
    return JSONResponse({"ok": True, "text": text, "task": task_id})


@app.get("/api/voice/tts")
async def api_voice_tts(text: str) -> Response:
    try:
        wav = await asyncio.to_thread(voice.synthesize, text)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)
    if wav is None:
        return JSONResponse({"ok": False, "error": "TTS nicht verfügbar"}, status_code=503)
    return Response(content=wav, media_type="audio/wav")


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
