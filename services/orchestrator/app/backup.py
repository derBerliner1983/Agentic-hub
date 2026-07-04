"""Backup & Restore des „Gehirns": vault/ (Memory), instance/ (Config/Board)
und .claude/skills/ (Skill-Bibliothek) als ein tar.gz.

Restore mit Path-Traversal-Schutz (keine absoluten Pfade, kein ../, keine
Symlinks) – es wird nur in die bekannten Zielordner extrahiert.
"""
from __future__ import annotations
import datetime as dt
import io
import os
import subprocess
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


def write_scheduled(dest_dir: str, keep: int = 7) -> str:
    """Backup als Datei ablegen und alte über `keep` hinaus löschen."""
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    fn = dest / f"vault-{dt.datetime.now():%Y%m%d-%H%M%S}.tar.gz"
    fn.write_bytes(create_backup())
    old = sorted(dest.glob("vault-*.tar.gz"))
    for f in old[:-keep] if keep > 0 else []:
        try:
            f.unlink()
        except Exception:  # noqa: BLE001
            pass
    return str(fn)


def git_sync(dest_dir: str, remote: str) -> tuple[bool, str]:
    """Backup-Ordner in ein Git-Remote pushen (offsite/NAS).

    remote z. B. https://<user>:<token>@github.com/<user>/<repo>.git
    Best-effort; initialisiert das Repo bei Bedarf.
    """
    dest = Path(dest_dir)
    if not remote or not dest.exists():
        return False, "kein Remote/Ordner"

    def _git(*args: str, **kw) -> subprocess.CompletedProcess:
        return subprocess.run(["git", "-C", str(dest), *args],
                              capture_output=True, text=True, timeout=120, **kw)

    try:
        if not (dest / ".git").exists():
            _git("init")
            _git("config", "user.email", "vault@local")
            _git("config", "user.name", "V.A.U.L.T.")
        # Remote setzen/aktualisieren
        if _git("remote", "get-url", "origin").returncode != 0:
            _git("remote", "add", "origin", remote)
        else:
            _git("remote", "set-url", "origin", remote)
        _git("add", "-A")
        _git("commit", "-m", f"backup {dt.datetime.now():%Y-%m-%d %H:%M:%S}")
        push = _git("push", "-u", "origin", "HEAD:main", "--force")
        if push.returncode != 0:
            return False, (push.stderr or push.stdout).strip()[:300]
        return True, "gepusht"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


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
