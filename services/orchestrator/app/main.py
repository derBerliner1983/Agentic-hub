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
from . import (auth, audit, voice, executor, backup as backup_mod, board as board_mod,
               worker as worker_mod, settings as settings_mod, skills as skills_mod,
               agents as agents_mod, mcp as mcp_mod, notes as notes_mod)
from .projects import run_project

FORCE_HTTPS = os.environ.get("FORCE_HTTPS") == "1"
PUBLIC_HTTPS_PORT = os.environ.get("PUBLIC_HTTPS_PORT", "3443")

app = FastAPI(title="V.A.U.L.T. Orchestrator")
bus = EventBus()

REPO_DIR = os.environ.get("REPO_DIR", "/repo")

_last_status: dict = {"type": "status", "connected": False, "providers": [], "tasks": task_list()}


def provider():
    return settings_mod.build_provider()


def _knowledge() -> int:
    """„Wissen" des Gehirns: Vault-Notizen + Skills + eingebundene MCPs.
    Skills/MCPs zählen stärker (aktiv angewandtes Können)."""
    from .vitals import _md_files
    try:
        notes = len(_md_files())
    except Exception:  # noqa: BLE001
        notes = 0
    sk = len(skills_mod.list_skills())
    mc = len([m for m in mcp_mod.list_mcp() if m.get("enabled", True)])
    return notes + sk * 3 + mc * 4


async def _status_snapshot() -> dict:
    p = provider()
    health = await p.health()
    return {"type": "status", "active_provider": p.name, "connected": health["connected"],
            "providers": [health], "tasks": task_list(), "knowledge": _knowledge()}


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
    from . import scheduler as scheduler_mod
    app.state.poller = asyncio.create_task(_status_poller())
    app.state.worker = asyncio.create_task(worker_mod.worker_loop(bus))
    app.state.scheduler = asyncio.create_task(scheduler_mod.scheduler_loop(bus))


@app.on_event("shutdown")
async def _shutdown() -> None:
    for t in (app.state.poller, app.state.worker, app.state.scheduler):
        t.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await t


# ---- Anmeldung + MFA --------------------------------------------------------
_OPEN_PATHS = {"/login", "/setup"}
_OPEN_PREFIXES = ("/auth/",)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    # Optional: Browser-Navigation auf HTTPS umleiten (FORCE_HTTPS=1)
    if (FORCE_HTTPS and request.method == "GET"
            and request.headers.get("x-forwarded-proto", request.url.scheme) != "https"
            and not request.url.path.startswith("/api/")):
        host = request.url.hostname or "localhost"
        return RedirectResponse(f"https://{host}:{PUBLIC_HTTPS_PORT}{request.url.path}", status_code=308)
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    # HTML/CSS/JS immer revalidieren, damit neue Versionen nach Update sofort greifen
    p = request.url.path
    if request.method == "GET" and not p.startswith("/api") and not p.startswith("/ws"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


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
    username = auth.verify_session(request.cookies.get(auth.COOKIE))
    if username:
        request.state.username = username
        request.state.role = auth.get_role(username) or "user"
        return await call_next(request)
    if path.startswith("/api/"):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return RedirectResponse("/login")


def _require_admin(request: Request) -> bool:
    return getattr(request.state, "role", None) == "admin" or not auth.required()


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


def _client_key(request: Request) -> str:
    # Hinter Caddy: echte Client-IP aus X-Forwarded-For, sonst Peer-IP.
    xff = request.headers.get("x-forwarded-for", "")
    return (xff.split(",")[0].strip() if xff else "") or (request.client.host if request.client else "unknown")


def _is_https(request: Request) -> bool:
    return (request.headers.get("x-forwarded-proto") == "https"
            or request.url.scheme == "https")


# Optionaler Schutz gegen „Trust-on-first-use": wenn SETUP_TOKEN gesetzt ist,
# muss es bei der Ersteinrichtung mitgegeben werden.
_SETUP_TOKEN = os.environ.get("SETUP_TOKEN", "")


@app.post("/auth/setup")
async def auth_setup(request: Request, data: dict = Body(...)) -> JSONResponse:
    if auth.configured():
        return JSONResponse({"ok": False, "error": "bereits eingerichtet"}, status_code=403)
    if _SETUP_TOKEN and data.get("setup_secret", "") != _SETUP_TOKEN:
        return JSONResponse({"ok": False, "error": "Setup-Token falsch"}, status_code=403)
    pw = data.get("password") or ""
    if len(pw) < 8:
        return JSONResponse({"ok": False, "error": "Passwort min. 8 Zeichen"}, status_code=400)
    res = auth.start_setup(data.get("username", "admin"), pw, bool(data.get("enable_mfa")))
    if res is None:
        return JSONResponse({"ok": False, "error": "Ungültiger Benutzername (a-z0-9_-, 2-32)"}, status_code=400)
    return JSONResponse({"ok": True, **res})


@app.post("/auth/setup/verify")
async def auth_setup_verify(request: Request, data: dict = Body(...)) -> JSONResponse:
    key = _client_key(request)
    wait = auth.locked_for(key)
    if wait:
        return JSONResponse({"ok": False, "error": f"Zu viele Versuche – warte {wait}s"}, status_code=429)
    if auth.confirm_setup(data.get("setup_token", ""), data.get("code", "")):
        auth.clear_fails(key)
        return JSONResponse({"ok": True})
    auth.record_fail(key)
    return JSONResponse({"ok": False, "error": "Code falsch"}, status_code=400)


@app.post("/auth/login")
async def auth_login(request: Request, data: dict = Body(...)) -> JSONResponse:
    key = _client_key(request)
    wait = auth.locked_for(key)
    if wait:
        return JSONResponse({"ok": False, "error": f"Zu viele Fehlversuche – gesperrt für {wait}s"},
                            status_code=429)
    username = (data.get("username", "") or "").strip().lower()
    if not auth.check_password(username, data.get("password", "")):
        auth.record_fail(key)
        audit.auth_fail(key, username)
        return JSONResponse({"ok": False, "error": "Benutzer oder Passwort falsch"}, status_code=401)

    # MFA nur, wenn der Benutzer sie aktiviert hat UND das Gerät nicht gemerkt ist
    if auth.mfa_enabled(username):
        dev = request.cookies.get(auth.DEVICE_COOKIE)
        if not auth.verify_device(dev, username):
            code = data.get("code", "")
            if not code:
                return JSONResponse({"ok": False, "mfa_required": True})   # Schritt 2 nötig
            if not auth.verify_code(username, code):
                auth.record_fail(key)
                audit.auth_fail(key, username)
                return JSONResponse({"ok": False, "error": "MFA-Code falsch"}, status_code=401)

    auth.clear_fails(key)
    audit.log(username, "login")
    secure = _is_https(request)
    resp = JSONResponse({"ok": True})
    resp.set_cookie(auth.COOKIE, auth.create_session(username), max_age=auth.SESSION_TTL,
                    httponly=True, samesite="lax", secure=secure)
    # Gerät merken → beim nächsten Mal kein MFA-Code nötig
    resp.set_cookie(auth.DEVICE_COOKIE, auth.create_device(username), max_age=auth.DEVICE_TTL,
                    httponly=True, samesite="lax", secure=secure)
    return resp


# ---- MFA nachträglich aktivieren/deaktivieren (eigener Account) ------------
@app.post("/api/mfa/enable")
async def api_mfa_enable(request: Request) -> JSONResponse:
    user = getattr(request.state, "username", None)
    res = auth.begin_enable_mfa(user) if user else None
    return JSONResponse(res or {"error": "nicht möglich"}, status_code=200 if res else 400)


@app.post("/api/mfa/enable/verify")
async def api_mfa_enable_verify(request: Request, data: dict = Body(...)) -> JSONResponse:
    user = getattr(request.state, "username", None)
    ok = auth.confirm_enable_mfa(user, data.get("code", "")) if user else False
    if ok:
        audit.log(user, "mfa_enabled")
    return JSONResponse({"ok": ok}, status_code=200 if ok else 400)


@app.post("/api/mfa/disable")
async def api_mfa_disable(request: Request) -> JSONResponse:
    user = getattr(request.state, "username", None)
    ok = auth.disable_mfa(user) if user else False
    if ok:
        audit.log(user, "mfa_disabled")
    return JSONResponse({"ok": ok})


# ---- Ollama-Erreichbarkeit testen -----------------------------------------
@app.post("/api/ollama/test")
async def api_ollama_test(data: dict = Body(...)) -> JSONResponse:
    from .providers.ollama import OllamaProvider
    url = (data.get("url") or "").strip() or settings_mod.get()["ollama_url"]
    health = await OllamaProvider(url).health()
    return JSONResponse({"reachable": health["reachable"], "models": health["models"],
                         "error": health.get("error")})


@app.post("/auth/logout")
async def auth_logout() -> JSONResponse:
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth.COOKIE)
    return resp


@app.get("/api/me")
async def api_me(request: Request) -> JSONResponse:
    user = getattr(request.state, "username", None)
    return JSONResponse({"username": user, "role": getattr(request.state, "role", "user"),
                         "mfa": auth.mfa_enabled(user) if user else False})


@app.get("/api/users")
async def api_users(request: Request) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    return JSONResponse(auth.list_users())


@app.post("/api/users")
async def api_user_add(request: Request, data: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    res = auth.add_user(data.get("username", ""), data.get("password", ""), data.get("role", "user"))
    if not res:
        return JSONResponse({"ok": False, "error": "Ungültig (Name a-z0-9_-, PW min. 8, evtl. existiert)"},
                            status_code=400)
    audit.log(getattr(request.state, "username", "-"), "user_add", res["username"])
    return JSONResponse({"ok": True, **res})


@app.delete("/api/users/{username}")
async def api_user_del(request: Request, username: str) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    ok = auth.delete_user(username)
    if ok:
        audit.log(getattr(request.state, "username", "-"), "user_delete", username)
    return JSONResponse({"ok": ok})


# ---- Status / Vitals -------------------------------------------------------
@app.get("/api/status")
async def api_status() -> JSONResponse:
    return JSONResponse(await _status_snapshot())


@app.get("/api/vitals")
async def api_vitals() -> JSONResponse:
    health = await provider().health()
    models = health["models"]
    active = (settings_mod.get().get("ollama_model") or "").strip()
    # Aktives Modell bevorzugen, sonst das erste verfügbare
    model = active if active and active in models else (models[0] if models else None)
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
async def api_run_task(request: Request, task_id: str) -> JSONResponse:
    audit.log(getattr(request.state, "username", "-"), "task_run", task_id)
    asyncio.create_task(run_task(task_id, provider(), bus))
    return JSONResponse({"ok": True, "task": task_id})


@app.get("/api/audit")
async def api_audit(request: Request) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    return JSONResponse(audit.recent(150))


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
async def api_settings_save(request: Request, patch: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    settings_mod.update(patch)
    audit.log(getattr(request.state, "username", "-"), "settings_update",
              ",".join(k for k in patch if "key" not in k))
    # Provider evtl. gewechselt/URL geändert → Status sofort neu senden (Gehirn folgt).
    try:
        await bus.publish(await _status_snapshot())
    except Exception:  # noqa: BLE001
        pass
    return JSONResponse(settings_mod.public())


@app.get("/api/models")
async def api_models() -> JSONResponse:
    o = settings_mod.ollama_provider()
    return JSONResponse({"available": await o.models_detailed(), "running": await o.running(),
                         "reachable": (await o.health())["reachable"]})


# Bekannte Ollama-Library-Modelle (lokale Vorschläge ohne HuggingFace)
_OLLAMA_LIB = [
    "llama3.3", "llama3.2", "llama3.2:1b", "llama3.2:3b", "llama3.1", "llama3.1:8b",
    "llama3.1:70b", "qwen2.5", "qwen2.5:7b", "qwen2.5:14b", "qwen2.5-coder",
    "qwen2.5-coder:7b", "qwen2.5-coder:14b", "gemma2", "gemma2:2b", "gemma2:9b",
    "gemma2:27b", "gemma3", "phi3", "phi3.5", "mistral", "mistral-nemo", "mixtral",
    "deepseek-coder-v2", "deepseek-r1", "codellama", "starcoder2", "nomic-embed-text",
]


async def _hf_search(q: str) -> list[dict]:
    import httpx
    # HuggingFace-IDs nutzen Bindestriche – Leerzeichen entsprechend normalisieren
    variants = [q]
    if " " in q:
        variants += [q.replace(" ", "-"), q.replace(" ", "")]
    seen, out = set(), []
    async with httpx.AsyncClient(timeout=6.0, headers={"User-Agent": "VAULT/1.0"}) as client:
        for term in variants:
            try:
                r = await client.get(
                    "https://huggingface.co/api/models",
                    params={"search": term, "filter": "gguf", "sort": "downloads",
                            "direction": "-1", "limit": "20"})
                r.raise_for_status()
                data = r.json()
            except Exception:  # noqa: BLE001
                continue
            for m in data:
                mid = m.get("id") or m.get("modelId")
                if not mid or mid in seen:
                    continue
                seen.add(mid)
                out.append({"id": mid, "pull": f"hf.co/{mid}",
                            "downloads": m.get("downloads", 0), "source": "hf"})
            if out:
                break
    return out


@app.get("/api/models/search")
async def api_models_search(q: str = "") -> JSONResponse:
    """Live-Suche: erst lokale Ollama-Library, dann HuggingFace (GGUF)."""
    q = (q or "").strip()
    if len(q) < 3:
        return JSONResponse({"results": []})
    ql = q.lower().replace(" ", "")
    lib = [{"id": m, "pull": m, "downloads": None, "source": "ollama"}
           for m in _OLLAMA_LIB if ql in m.replace(" ", "").lower()][:8]
    hf = await _hf_search(q)
    return JSONResponse({"results": lib + hf})


async def _pull_and_refresh(name: str) -> None:
    """Modell laden und danach sofort einen frischen Status senden → Gehirn baut sich auf."""
    await settings_mod.ollama_provider().ensure_model(name, bus)
    try:
        await bus.publish(await _status_snapshot())
    except Exception:  # noqa: BLE001
        pass


@app.post("/api/models/pull")
async def api_model_pull(request: Request, data: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    name = (data.get("name") or "").strip()
    if not name:
        return JSONResponse({"ok": False, "error": "kein Modellname"}, status_code=400)
    audit.log(getattr(request.state, "username", "-"), "model_pull", name)
    asyncio.create_task(_pull_and_refresh(name))
    return JSONResponse({"ok": True, "note": "Download läuft – Fortschritt im Live-Log."})


@app.post("/api/models/delete")
async def api_model_delete(request: Request, data: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    name = (data.get("name") or "").strip()
    ok = await settings_mod.ollama_provider().delete_model(name)
    if ok:
        audit.log(getattr(request.state, "username", "-"), "model_delete", name)
    return JSONResponse({"ok": ok})


@app.post("/api/models/active")
async def api_model_active(request: Request, data: dict = Body(...)) -> JSONResponse:
    """Aktives Standard-Modell wählen (für Tasks/Projekte)."""
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    name = (data.get("name") or "").strip()
    settings_mod.update({"ollama_model": name})
    audit.log(getattr(request.state, "username", "-"), "model_active", name)
    try:
        await bus.publish(await _status_snapshot())
    except Exception:  # noqa: BLE001
        pass
    return JSONResponse({"ok": True, "active": name})


# ---- MCP-Server-Registry ---------------------------------------------------
@app.get("/api/mcp")
async def api_mcp_list() -> JSONResponse:
    return JSONResponse(mcp_mod.list_mcp())


@app.post("/api/mcp")
async def api_mcp_save(request: Request, entry: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    res = mcp_mod.save_mcp(entry)
    audit.log(getattr(request.state, "username", "-"), "mcp_save", res["id"])
    try:
        await bus.publish(await _status_snapshot())   # zählt zum Wissen → Gehirn wächst
    except Exception:  # noqa: BLE001
        pass
    return JSONResponse(res)


@app.delete("/api/mcp/{mcp_id}")
async def api_mcp_delete(request: Request, mcp_id: str) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    ok = mcp_mod.delete_mcp(mcp_id)
    try:
        await bus.publish(await _status_snapshot())
    except Exception:  # noqa: BLE001
        pass
    return JSONResponse({"ok": ok})


# ---- Vault-Notizen (Memory im Browser bearbeiten) -------------------------
@app.get("/api/notes")
async def api_notes_list() -> JSONResponse:
    return JSONResponse(notes_mod.list_notes())


@app.get("/api/notes/read")
async def api_notes_read(path: str = "") -> JSONResponse:
    n = notes_mod.read_note(path)
    return JSONResponse(n or {"error": "nicht gefunden"}, status_code=200 if n else 404)


@app.post("/api/notes/save")
async def api_notes_save(request: Request, data: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    res = notes_mod.write_note(data.get("path", ""), data.get("content", ""))
    if res:
        audit.log(getattr(request.state, "username", "-"), "note_save", data.get("path", ""))
        try:
            await bus.publish(await _status_snapshot())   # mehr Notizen → mehr Wissen
        except Exception:  # noqa: BLE001
            pass
    return JSONResponse(res or {"error": "ungültiger Pfad (.md, innerhalb Vault)"},
                        status_code=200 if res else 400)


@app.delete("/api/notes")
async def api_notes_delete(request: Request, path: str = "") -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    ok = notes_mod.delete_note(path)
    return JSONResponse({"ok": ok})


# ---- Backup / Restore ------------------------------------------------------
@app.get("/api/backup")
async def api_backup() -> Response:
    import datetime as _dt
    data = await asyncio.to_thread(backup_mod.create_backup)
    fn = f"vault-backup-{_dt.date.today().isoformat()}.tar.gz"
    return Response(content=data, media_type="application/gzip",
                    headers={"Content-Disposition": f'attachment; filename="{fn}"'})


@app.post("/api/restore")
async def api_restore(file: UploadFile) -> JSONResponse:
    data = await file.read()
    try:
        res = await asyncio.to_thread(backup_mod.restore, data)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": f"Restore fehlgeschlagen: {exc}"}, status_code=400)
    return JSONResponse({"ok": True, **res})


# ---- Agents / Projekte (Agent-Mesh) ---------------------------------------
@app.get("/api/agents")
async def api_agents() -> JSONResponse:
    return JSONResponse(agents_mod.list_agents())


@app.post("/api/agents")
async def api_agent_save(request: Request, agent: dict = Body(...)) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    return JSONResponse(agents_mod.save_agent(agent))


@app.post("/api/projects/run")
async def api_project_run(request: Request, data: dict = Body(...)) -> JSONResponse:
    goal = (data.get("goal") or "").strip()
    if not goal:
        return JSONResponse({"ok": False, "error": "kein Ziel"}, status_code=400)
    audit.log(getattr(request.state, "username", "-"), "project_run", goal[:80])
    asyncio.create_task(run_project(goal, settings_mod.ollama_provider(), bus))
    return JSONResponse({"ok": True})


# ---- Kanban-Board & Autonom-Modus -----------------------------------------
@app.get("/api/board")
async def api_board() -> JSONResponse:
    b = board_mod.get_board()
    return JSONResponse({**b, "executor": executor.available(),
                         "exec_langs": executor.supported_langs()})


@app.post("/api/board/autonomous")
async def api_board_autonomous(data: dict = Body(...)) -> JSONResponse:
    return JSONResponse(board_mod.set_autonomous(bool(data.get("on"))))


@app.post("/api/board/projects")
async def api_board_add_project(data: dict = Body(...)) -> JSONResponse:
    return JSONResponse(board_mod.add_project(
        data.get("title", ""), data.get("goal", ""),
        data.get("detail", ""), data.get("type", "general"),
        bool(data.get("network", False)), data.get("runner")))


@app.delete("/api/board/projects/{pid}")
async def api_board_del_project(pid: str) -> JSONResponse:
    return JSONResponse({"ok": board_mod.delete_project(pid)})


@app.post("/api/board/projects/{pid}/cards")
async def api_board_add_card(pid: str, data: dict = Body(...)) -> JSONResponse:
    card = board_mod.add_card(pid, data.get("title", ""), data.get("detail", ""),
                              data.get("status", "todo"))
    return JSONResponse(card or {"error": "Projekt nicht gefunden"},
                        status_code=200 if card else 404)


@app.post("/api/board/projects/{pid}/plan")
async def api_board_plan(pid: str) -> JSONResponse:
    """Ziel automatisch in Karten zerlegen (Planner-Agent)."""
    proj = board_mod.get_project(pid)
    if not proj:
        return JSONResponse({"error": "Projekt nicht gefunden"}, status_code=404)
    asyncio.create_task(_plan_cards(pid, proj.get("goal") or proj["title"]))
    return JSONResponse({"ok": True})


@app.patch("/api/board/projects/{pid}/cards/{cid}")
async def api_board_update_card(pid: str, cid: str, patch: dict = Body(...)) -> JSONResponse:
    card = board_mod.update_card(pid, cid, patch)
    return JSONResponse(card or {"error": "nicht gefunden"}, status_code=200 if card else 404)


@app.delete("/api/board/projects/{pid}/cards/{cid}")
async def api_board_del_card(pid: str, cid: str) -> JSONResponse:
    return JSONResponse({"ok": board_mod.delete_card(pid, cid)})


async def _plan_cards(pid: str, goal: str) -> None:
    ollama = settings_mod.ollama_provider()
    planner = agents_mod.get_agent("planner")
    try:
        await ollama.ensure_model(planner["model"], bus)
        raw = await ollama.generate(
            f"Ziel: {goal}\n\nZerlege es in 3-6 konkrete Arbeitsschritte. "
            f"Gib nur eine nummerierte Liste zurück, ein Schritt pro Zeile.",
            model=planner["model"], system=planner["system"])
        import re
        for line in raw.splitlines():
            t = re.sub(r"^\s*[\d\-\*\.\)]+\s*", "", line).strip()
            if t:
                board_mod.add_card(pid, t[:120], status="todo")
        await bus.publish({"type": "board", "project": pid, "state": "planned"})
    except Exception as exc:  # noqa: BLE001
        await bus.publish({"type": "board", "project": pid, "state": "plan-error", "error": str(exc)})


# ---- System-Update (UPDATE-Button) ----------------------------------------
@app.post("/api/system/update")
async def api_system_update(request: Request) -> JSONResponse:
    if not _require_admin(request):
        return JSONResponse({"error": "nur Admin"}, status_code=403)
    script = os.path.join(REPO_DIR, "update.sh")
    if not os.path.isfile(script):
        return JSONResponse({"ok": False, "error": f"update.sh nicht gefunden ({script}). "
                             "Repo muss als /repo gemountet sein."}, status_code=503)
    try:
        subprocess.Popen(["bash", script], cwd=REPO_DIR)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)
    audit.log(getattr(request.state, "username", "-"), "system_update", "")
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
    # Kein vordefinierter Kurzbefehl → freien Sprachbefehl als Projekt ausführen
    if text and len(text.strip()) >= 3:
        asyncio.create_task(run_project(text.strip(), settings_mod.ollama_provider(), bus))
        return JSONResponse({"ok": True, "text": text, "task": None, "project": True})
    return JSONResponse({"ok": True, "text": text, "task": None})


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
