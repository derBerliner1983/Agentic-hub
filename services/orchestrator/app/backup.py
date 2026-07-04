"""Backup & Restore des „Gehirns": vault/ (Memory), instance/ (Config/Board)
und .claude/skills/ (Skill-Bibliothek) als ein tar.gz.

Restore mit Path-Traversal-Schutz (keine absoluten Pfade, kein ../, keine
Symlinks) – es wird nur in die bekannten Zielordner extrahiert.
"""
from __future__ import annotations
import io
import os
import tarfile
from pathlib import Path

VAULT_DIR = Path(os.environ.get("VAULT_DIR", "/vault"))
STORE_DIR = Path(os.environ.get("STORE_DIR", "/instance"))
SKILLS_DIR = Path(os.environ.get("SKILLS_DIR", "/skills"))

# arcname → Zielordner (Basename muss zum arcname passen, s. u.)
SOURCES = {"vault": VAULT_DIR, "instance": STORE_DIR, "skills": SKILLS_DIR}


def create_backup() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, path in SOURCES.items():
            if path.exists():
                tar.add(str(path), arcname=name)
    return buf.getvalue()


def restore(data: bytes) -> dict:
    roots = {name: path.resolve() for name, path in SOURCES.items()}
    counts = {name: 0 for name in SOURCES}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for m in tar.getmembers():
            if m.issym() or m.islnk():           # keine (Hard-)Links
                continue
            top = m.name.split("/", 1)[0]
            if top not in roots:                  # nur bekannte Wurzeln
                continue
            base = roots[top]
            # Zielpfad: base.parent + arcname (z. B. / + vault/…)
            target = (base.parent / m.name).resolve()
            if not (str(target) == str(base) or str(target).startswith(str(base) + os.sep)):
                continue                           # Traversal blockiert
            tar.extract(m, str(base.parent))
            if m.isfile():
                counts[top] += 1
    return {"restored": counts}
