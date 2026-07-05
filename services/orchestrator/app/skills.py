"""Skill-Verwaltung: Skills sind Markdown-Dateien in SKILLS_DIR/<name>/SKILL.md
mit YAML-Frontmatter (name, description) und einer Schritt-für-Schritt-Anweisung.
"""
from __future__ import annotations
import os
import re
from pathlib import Path

SKILLS_DIR = Path(os.environ.get("SKILLS_DIR", "/skills"))

_slug_re = re.compile(r"[^a-z0-9-]+")


def slugify(name: str) -> str:
    s = name.strip().lower().replace(" ", "-")
    return _slug_re.sub("", s) or "skill"


def _parse(md: str) -> tuple[str | None, str | None, bool, str]:
    name = desc = None
    enabled = True
    body = md
    if md.startswith("---"):
        end = md.find("---", 3)
        if end != -1:
            fm = md[3:end]
            body = md[end + 3:].strip()
            for line in fm.splitlines():
                low = line.lower()
                if low.startswith("name:"):
                    name = line.split(":", 1)[1].strip()
                elif low.startswith("description:"):
                    desc = line.split(":", 1)[1].strip()
                elif low.startswith("enabled:"):
                    enabled = line.split(":", 1)[1].strip().lower() not in ("false", "no", "0")
    return name, desc, enabled, body


def list_skills() -> list[dict]:
    out: list[dict] = []
    if not SKILLS_DIR.exists():
        return out
    for d in sorted(SKILLS_DIR.iterdir()):
        f = d / "SKILL.md"
        if f.is_file():
            name, desc, enabled, _ = _parse(f.read_text(encoding="utf-8"))
            out.append({"id": d.name, "name": name or d.name,
                        "description": desc or "", "enabled": enabled})
    return out


_id_ok = re.compile(r"^[a-z0-9-]+$")


def get_skill(skill_id: str) -> dict | None:
    # Path-Traversal-Schutz: nur einfache Slug-IDs erlauben.
    if not skill_id or not _id_ok.match(skill_id):
        return None
    f = SKILLS_DIR / skill_id / "SKILL.md"
    if not f.is_file():
        return None
    name, desc, enabled, body = _parse(f.read_text(encoding="utf-8"))
    return {"id": skill_id, "name": name or skill_id, "description": desc or "",
            "enabled": enabled, "body": body}


def skill_prompt(skill_id: str) -> str | None:
    s = get_skill(skill_id)
    return s["body"] if s else None


def _write(sid: str, name: str, description: str, body: str, enabled: bool) -> dict:
    d = SKILLS_DIR / sid
    d.mkdir(parents=True, exist_ok=True)
    content = (f"---\nname: {name}\ndescription: {description}\n"
               f"enabled: {'true' if enabled else 'false'}\n---\n\n{body.strip()}\n")
    (d / "SKILL.md").write_text(content, encoding="utf-8")
    return {"id": sid, "name": name, "description": description, "enabled": enabled}


def create_skill(name: str, description: str, body: str,
                 skill_id: str | None = None, enabled: bool = True) -> dict:
    # Bestehenden Skill bearbeiten (skill_id) oder neuen anlegen (aus Name).
    sid = skill_id if (skill_id and _id_ok.match(skill_id)) else slugify(name)
    return _write(sid, name, description, body, enabled)


def set_enabled(skill_id: str, enabled: bool) -> bool:
    s = get_skill(skill_id)
    if not s:
        return False
    _write(skill_id, s["name"], s["description"], s["body"], enabled)
    return True
