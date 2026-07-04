"""Anmeldung mit MFA (TOTP) + Mehrbenutzer & Rollen.

- Ersteinrichtung (/setup): erster Benutzer = Rolle 'admin'. Passwort + TOTP.
- Weitere Benutzer legt ein Admin an (Rolle 'admin' oder 'user').
- Rollen: 'admin' darf alles (Settings, Benutzer, Update, Agenten);
  'user' darf Tasks/Projekte nutzen, aber keine Systemeinstellungen ändern.
- Session: HMAC-signierter Cookie mit Benutzername, HttpOnly, SameSite=Lax, 12 h.

Speicherung in instance/auth.json (gitignored). Migration vom alten
Single-User-Format erfolgt automatisch (→ Benutzer 'admin').
Notfall-Reset: Datei löschen. Escape-Hatch: AUTH_DISABLED=1.
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import io
import os
import re
import secrets
import struct
import time

from . import store

PBKDF_ITER = 200_000
SESSION_TTL = 12 * 3600
COOKIE = "vault_session"
USERNAME_RE = re.compile(r"^[a-z0-9_-]{2,32}$")

LOCK_MAX = 5
LOCK_WINDOW = 300
LOCK_TIME = 300

_pending: dict[str, dict] = {}
_fails: dict[str, list[float]] = {}


# ---- Brute-Force-Schutz -----------------------------------------------------
def locked_for(key: str) -> int:
    now = time.time()
    hits = [t for t in _fails.get(key, []) if now - t < LOCK_WINDOW]
    _fails[key] = hits
    if len(hits) >= LOCK_MAX:
        return max(0, int(LOCK_TIME - (now - hits[-LOCK_MAX])))
    return 0


def record_fail(key: str) -> None:
    _fails.setdefault(key, []).append(time.time())


def clear_fails(key: str) -> None:
    _fails.pop(key, None)


# ---- Datenzugriff + Migration ----------------------------------------------
def _data() -> dict:
    d = store.load("auth.json", None) or {}
    # Migration: altes Single-User-Format → users['admin']
    if d.get("pwhash") and "users" not in d:
        d = {"session_key": d.get("session_key") or secrets.token_hex(32),
             "users": {"admin": {"salt": d["salt"], "pwhash": d["pwhash"],
                                 "totp_secret": d["totp_secret"],
                                 "totp_last": d.get("totp_last", 0), "role": "admin"}}}
        store.save("auth.json", d)
    return d


def _save(d: dict) -> None:
    store.save("auth.json", d)


def _users() -> dict:
    return _data().get("users", {})


def configured() -> bool:
    return bool(_users())


def required() -> bool:
    return os.environ.get("AUTH_DISABLED") != "1"


def list_users() -> list[dict]:
    return [{"username": u, "role": v.get("role", "user")} for u, v in _users().items()]


def get_role(username: str) -> str | None:
    u = _users().get(username)
    return u.get("role") if u else None


# ---- Passwort / TOTP --------------------------------------------------------
def _hash_pw(pw: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, PBKDF_ITER).hex()


def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    pad = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret + pad)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def totp_counter(secret: str, code: str, window: int = 1) -> int:
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit():
        return -1
    now = int(time.time() // 30)
    for w in range(-window, window + 1):
        if hmac.compare_digest(_totp_at(secret, now + w), code):
            return now + w
    return -1


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    return totp_counter(secret, code, window) >= 0


def _enroll_uri(username: str, secret: str) -> str:
    return f"otpauth://totp/V.A.U.L.T.:{username}?secret={secret}&issuer=VAULT"


# ---- Ersteinrichtung (erster Admin) ----------------------------------------
def start_setup(username: str, password: str) -> dict | None:
    username = (username or "admin").strip().lower()
    if not USERNAME_RE.match(username):
        return None
    secret = new_totp_secret()
    salt = secrets.token_bytes(16)
    token = secrets.token_urlsafe(24)
    _pending.clear()
    _pending[token] = {"username": username, "secret": secret, "salt": salt.hex(),
                       "pwhash": _hash_pw(password, salt)}
    uri = _enroll_uri(username, secret)
    return {"setup_token": token, "secret": secret, "otpauth": uri, "qr_svg": qr_svg(uri)}


def confirm_setup(token: str, code: str) -> bool:
    p = _pending.get(token)
    if not p or not verify_totp(p["secret"], code):
        return False
    _save({"session_key": secrets.token_hex(32),
           "users": {p["username"]: {"salt": p["salt"], "pwhash": p["pwhash"],
                                     "totp_secret": p["secret"], "totp_last": 0,
                                     "role": "admin"}}})
    _pending.clear()
    return True


# ---- Benutzerverwaltung (Admin) --------------------------------------------
def add_user(username: str, password: str, role: str = "user") -> dict | None:
    username = (username or "").strip().lower()
    if not USERNAME_RE.match(username) or len(password or "") < 8:
        return None
    d = _data()
    if not d.get("users") or username in d["users"]:
        return None
    secret = new_totp_secret()
    salt = secrets.token_bytes(16)
    d["users"][username] = {"salt": salt.hex(), "pwhash": _hash_pw(password, salt),
                            "totp_secret": secret, "totp_last": 0,
                            "role": "admin" if role == "admin" else "user"}
    _save(d)
    uri = _enroll_uri(username, secret)
    return {"username": username, "role": d["users"][username]["role"],
            "secret": secret, "otpauth": uri, "qr_svg": qr_svg(uri)}


def delete_user(username: str) -> bool:
    d = _data()
    users = d.get("users", {})
    if username not in users:
        return False
    # letzten Admin nicht löschen
    admins = [u for u, v in users.items() if v.get("role") == "admin"]
    if users[username].get("role") == "admin" and len(admins) <= 1:
        return False
    del users[username]
    _save(d)
    return True


# ---- Login / Session --------------------------------------------------------
def login(username: str, password: str, code: str) -> str | None:
    username = (username or "").strip().lower()
    d = _data()
    u = d.get("users", {}).get(username)
    if not u:
        return None
    if not hmac.compare_digest(_hash_pw(password or "", bytes.fromhex(u["salt"])), u["pwhash"]):
        return None
    counter = totp_counter(u["totp_secret"], code)
    if counter < 0 or counter <= int(u.get("totp_last", 0)):
        return None
    u["totp_last"] = counter
    _save(d)
    return create_session(username)


def create_session(username: str) -> str:
    d = _data()
    exp = str(int(time.time()) + SESSION_TTL)
    msg = f"{username}.{exp}"
    sig = hmac.new(bytes.fromhex(d["session_key"]), msg.encode(), hashlib.sha256).hexdigest()
    return f"{msg}.{sig}"


def verify_session(token: str | None) -> str | None:
    """Gibt den Benutzernamen zurück oder None."""
    if not token or token.count(".") != 2:
        return None
    d = _data()
    if not d.get("session_key"):
        return None
    username, exp_s, sig = token.split(".")
    if not exp_s.isdigit() or int(exp_s) < time.time():
        return None
    good = hmac.new(bytes.fromhex(d["session_key"]), f"{username}.{exp_s}".encode(),
                    hashlib.sha256).hexdigest()
    if not hmac.compare_digest(good, sig):
        return None
    return username if username in d.get("users", {}) else None


# ---- QR-Code ----------------------------------------------------------------
def qr_svg(data: str) -> str | None:
    try:
        import qrcode
        from qrcode.image.svg import SvgPathImage
        img = qrcode.make(data, image_factory=SvgPathImage, box_size=8)
        buf = io.BytesIO()
        img.save(buf)
        return buf.getvalue().decode()
    except Exception:  # noqa: BLE001
        return None
