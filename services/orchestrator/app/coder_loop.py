"""Autonome Code-Schleife: schreiben → AUSFÜHREN → Fehler → fixen → erneut.

Der Coder-Agent schreibt Code, der Executor führt ihn REAL in einem Container
aus. Schlägt er fehl, geht die echte Fehlermeldung zurück an den Coder, der
korrigiert – so lange, bis der Code läuft oder das Limit erreicht ist. Genau
das „er testet es selbst und fixt sich, bis es geht".
"""
from __future__ import annotations
import os
import re

from .events import EventBus
from .providers.ollama import OllamaProvider
from . import agents, executor

MAX_ATTEMPTS = int(os.environ.get("CODER_MAX_ATTEMPTS", "5"))

_FENCE = re.compile(r"```([A-Za-z0-9_+.-]*)[ \t]*\r?\n(.*?)```", re.DOTALL)
_LANG_ALIAS = {"py": "python", "python3": "python", "js": "javascript",
               "node": "javascript", "sh": "bash", "shell": "bash"}


def _extract_code(text: str, prefer: str | None = None) -> tuple[str, str]:
    """Ersten passenden Code-Block ziehen → (lang, code)."""
    blocks = [(_LANG_ALIAS.get(m.group(1).strip().lower(), m.group(1).strip().lower() or "python"),
               m.group(2).strip()) for m in _FENCE.finditer(text or "")]
    blocks = [(l, c) for l, c in blocks if c]
    if not blocks:
        return "python", (text or "").strip()
    if prefer:
        for l, c in blocks:
            if l == prefer or (prefer == "javascript" and l == "node"):
                return l, c
    return blocks[0]


async def build_and_test(goal: str, ollama: OllamaProvider, bus: EventBus,
                         lang_hint: str | None = None, network: bool | None = None,
                         profile: str | None = None) -> dict:
    coder = agents.get_agent("coder")

    async def emit(state: str, **extra):
        await bus.publish({"type": "coder", "state": state, "goal": goal[:80], **extra})

    await emit("starting")
    await ollama.ensure_model(coder["model"], bus)

    forced = profile if (profile and profile in executor.PROFILES) else None
    if forced == "web":
        write_prompt = (
            f"Aufgabe: {goal}\n\n"
            f"Schreibe ein vollständiges Playwright-Python-Skript (sync API, "
            f"`from playwright.sync_api import sync_playwright`, headless=True), das die "
            f"Aufgabe testet und bei Erfolg 'OK' ausgibt bzw. bei Fehler eine Exception wirft. "
            f"Gib NUR einen Python-Code-Block zurück.")
    else:
        langs = ", ".join(executor.supported_langs())
        write_prompt = (
            f"Aufgabe: {goal}\n\n"
            f"Schreibe VOLLSTÄNDIGEN, lauffähigen Code in EINER Datei. "
            f"Unterstützte Sprachen: {langs}. Gib NUR einen Markdown-Code-Block mit "
            f"Sprach-Tag zurück, keinen Text davor/danach.")
    draft = await ollama.generate(write_prompt, model=coder["model"], system=coder["system"])
    lang, code = _extract_code(draft, lang_hint)
    if forced:
        lang = forced   # Profil bestimmt den Runner (z. B. 'web')

    last = {"ok": False, "stderr": "", "stdout": ""}
    for attempt in range(1, MAX_ATTEMPTS + 1):
        await emit("running", attempt=attempt, lang=lang)
        result = executor.run(lang, code, network=network)
        last = result
        if result.get("skipped"):
            await emit("skipped", reason=result.get("reason"))
            return {"ok": False, "code": code, "lang": lang, "attempts": attempt,
                    "output": "", "error": result.get("reason", "Ausführung nicht möglich"),
                    "tested": False, "artifacts": {}}
        if result["ok"]:
            await emit("passed", attempt=attempt)
            return {"ok": True, "code": code, "lang": lang, "attempts": attempt,
                    "output": result["stdout"], "error": "", "tested": True,
                    "artifacts": result.get("artifacts", {})}

        # Fehlgeschlagen → mit echter Fehlermeldung fixen lassen
        err = (result["stderr"] or result["stdout"] or "").strip()[-2500:]
        await emit("fixing", attempt=attempt, error=err[:160])
        if attempt < MAX_ATTEMPTS:
            fix_prompt = (
                f"Aufgabe: {goal}\n\nDein bisheriger {lang}-Code:\n```{lang}\n{code}\n```\n\n"
                f"Beim Ausführen kam dieser FEHLER:\n{err}\n\n"
                f"Gib den KORRIGIERTEN vollständigen Code als einzelnen Code-Block zurück, "
                f"sonst nichts.")
            fixed = await ollama.generate(fix_prompt, model=coder["model"], system=coder["system"])
            lang, code = _extract_code(fixed, lang)

    await emit("failed", attempts=MAX_ATTEMPTS)
    return {"ok": False, "code": code, "lang": lang, "attempts": MAX_ATTEMPTS,
            "output": last.get("stdout", ""), "error": last.get("stderr", ""),
            "tested": True, "artifacts": last.get("artifacts", {})}
