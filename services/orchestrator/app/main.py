"""V.A.U.L.T. Orchestrator – FastAPI-App."""
from __future__ import annotations
import asyncio
import contextlib
import os
import subprocess

from fastapi import Body, FastAPI, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

from .events import EventBus
from .tasks import run_task, task_list, get_task, save_task, delete_task
from .vitals import build_vitals
from . import auth, voice, settings as settings_mod, skills as skills_mod, agents as agents_mod
from .projects import run_project

app = FastAPI(title="V.A.U.L.T. Orchestrator")
bus = EventBus()

REPO_DIR = os.environ.get("REPO_DIR", "/repo")

_last_status: dict = {"type": "status", "connected": False, "providers": [], "tasks": task_list()}


def provider():
    return settings_mod.build_provider()


async def _status_snapshot() -> dict:
    p = provider()
    health = await p.health()
    return {"type": "status", "active_provider": p.name, "connected": health["connected"],
            "providers": [health], "tasks": task_list()}


async def _status_poller() -> None:
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


# ---- Anmeldung + MFA --------------------------------------------------------
_OPEN_PATHS = {"/login", "/setup"}
_OPEN_PREFIXES = ("/auth/",)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if not auth.required():
        return await call_next(request)
    path = request.url.path
    if path in _OPEN_PATHS or any(path.startswith(p) for p in _OPEN_PREFIXES):
        return await call_next(request)
    if not auth.configured():
        if path.startswith("/api/"):
            return JSONResponse({"error": "setup required"}, status_code=401)
        return RedirectResponse("/setup")
    if auth.verify_session(request.cookies.get(auth.COOKIE)):
        return await call_next(request)
    if path.startswith("/api/"):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return RedirectResponse("/login")


@app.get("/setup")
async def page_setup():
    if auth.configured():
        return RedirectResponse("/login")
    return FileResponse("static/setup.html")


@app.get("/login")
async def page_login():
    if auth.required() and not auth.configured():
        return RedirectResponse("/setup")
    return FileResponse("static/login.html")


@app.post("/auth/setup")
async def auth_setup(data: dict = Body(...)) -> JSONResponse:
    if auth.configured():
        return JSONResponse({"ok": False, "error": "bereits eingerichtet"}, status_code=403)
    pw = data.get("password") or ""
    if len(pw) < 8:
        return JSONResponse({"ok": False, "error": "Passwort min. 8 Zeichen"}, status_code=400)
    return JSONResponse({"ok": True, **auth.start_setup(pw)})


@app.post("/auth/setup/verify")
async def auth_setup_verify(data: dict = Body(...)) -> JSONResponse:
    if auth.confirm_setup(data.get("setup_token", ""), data.get("code", "")):
        return JSONResponse({"ok": True})
    return JSONResponse({"ok": False, "error": "Code falsch"}, status_code=400)


@app.post("/auth/login")
async def auth_login(data: dict = Body(...)) -> JSONResponse:
    token = auth.login(data.get("password", ""), data.get("code", ""))
    if not token:
        return JSONResponse({"ok": False, "error": "Passwort oder Code falsch"}, status_code=401)
    resp = JSONResponse({"ok": True})
    resp.set_cookie(auth.COOKIE, token, max_age=auth.SESSION_TTL,
                    httponly=True, samesite="lax")
    return resp


@app.post("/auth/logout")
async def auth_logout() -> JSONResponse:
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth.COOKIE)
    return resp


# ---- Status / Vitals -------------------------------------------------------
@app.get("/api/status")
async def api_status() -> JSONResponse:
    return JSONResponse(await _status_snapshot())


@app.get("/api/vitals")
async def api_vitals() -> JSONResponse:
    health = await provider().health()
    model = health["models"][0] if health["models"] else None
    return JSONResponse(build_vitals(model))


# ---- Tasks -----------------------------------------------------------------
@app.get("/api/tasks")
async def api_tasks() -> JSONResponse:
    return JSONResponse(task_list())


@app.get("/api/tasks/{task_id}")
async def api_task_get(task_id: str) -> JSONResponse:
    t = get_task(task_id)
    return JSONResponse(t or {"error": "not found"}, status_code=200 if t else 404)


@app.post("/api/tasks")
async def api_task_save(task: dict = Body(...)) -> JSONResponse:
    return JSONResponse(save_task(task))


@app.delete("/api/tasks/{task_id}")
async def api_task_delete(task_id: str) -> JSONResponse:
    return JSONResponse({"ok": delete_task(task_id)})


@app.post("/api/tasks/{task_id}/run")
async def api_run_task(task_id: str) -> JSONResponse:
    asyncio.create_task(run_task(task_id, provider(), bus))
    return JSONResponse({"ok": True, "task": task_id})


# ---- Skills ----------------------------------------------------------------
@app.get("/api/skills")
async def api_skills() -> JSONResponse:
    return JSONResponse(skills_mod.list_skills())


@app.post("/api/skills")
async def api_skill_create(data: dict = Body(...)) -> JSONResponse:
    return JSONResponse(skills_mod.create_skill(
        data.get("name", "Skill"), data.get("description", ""), data.get("body", "")))


# ---- Settings (Phase 4) ----------------------------------------------------
@app.get("/api/settings")
async def api_settings() -> JSONResponse:
    return JSONResponse(settings_mod.public())


@app.post("/api/settings")
async def api_settings_save(patch: dict = Body(...)) -> JSONResponse:
    settings_mod.update(patch)
    return JSONResponse(settings_mod.public())


# ---- Agents / Projekte (Agent-Mesh) ---------------------------------------
@app.get("/api/agents")
async def api_agents() -> JSONResponse:
    return JSONResponse(agents_mod.list_agents())


@app.post("/api/agents")
async def api_agent_save(agent: dict = Body(...)) -> JSONResponse:
    return JSONResponse(agents_mod.save_agent(agent))


@app.post("/api/projects/run")
async def api_project_run(data: dict = Body(...)) -> JSONResponse:
    goal = (data.get("goal") or "").strip()
    if not goal:
        return JSONResponse({"ok": False, "error": "kein Ziel"}, status_code=400)
    asyncio.create_task(run_project(goal, settings_mod.ollama_provider(), bus))
    return JSONResponse({"ok": True})


# ---- System-Update (UPDATE-Button) ----------------------------------------
@app.post("/api/system/update")
async def api_system_update() -> JSONResponse:
    script = os.path.join(REPO_DIR, "update.sh")
    if not os.path.isfile(script):
        return JSONResponse({"ok": False, "error": f"update.sh nicht gefunden ({script}). "
                             "Repo muss als /repo gemountet sein."}, status_code=503)
    try:
        subprocess.Popen(["bash", script], cwd=REPO_DIR)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)
    return JSONResponse({"ok": True, "note": "Update gestartet – Container startet gleich neu."})


# ---- Voice -----------------------------------------------------------------
@app.get("/api/voice/status")
async def api_voice_status() -> JSONResponse:
    return JSONResponse({"stt": voice.stt_available(), "tts": voice.tts_available()})


@app.post("/api/voice/command")
async def api_voice_command(file: UploadFile) -> JSONResponse:
    audio = await file.read()
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    try:
        text = await asyncio.to_thread(voice.transcribe, audio, suffix)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": f"STT fehlgeschlagen: {exc}"}, status_code=500)
    task_id = voice.match_task(text)
    if task_id:
        asyncio.create_task(run_task(task_id, provider(), bus))
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


# ---- WebSocket -------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    if auth.required():
        if not auth.configured() or not auth.verify_session(ws.cookies.get(auth.COOKIE)):
            await ws.close(code=4401)
            return
    await ws.accept()
    queue = bus.subscribe()
    await ws.send_json(await _status_snapshot())
    try:
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(queue)


# Statisches HUD unter "/" (nach den API-Routen).
app.mount("/", StaticFiles(directory="static", html=True), name="hud")
