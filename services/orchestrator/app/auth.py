"""Anmeldung mit optionalem MFA (TOTP) + Mehrbenutzer & Rollen.

Flow:
- Ersteinrichtung (/setup): erster Benutzer = Admin. MFA optional.
- Login zweistufig: erst Benutzername+Passwort. NUR wenn der Benutzer MFA
  aktiviert hat (und das Gerät nicht als vertrauenswürdig gemerkt ist), wird
  danach der MFA-Code verlangt.
- Session-Cookie 30 Tage (bleibt angemeldet). Zusätzlich ein „Gerät gemerkt"-
  Cookie (60 Tage), damit auf demselben Browser nach Ablauf der Session der
  MFA-Code nicht erneut nötig ist.

Speicherung in instance/auth.json. Migration alter Formate automatisch.
Reset: Datei löschen. Escape-Hatch: AUTH_DISABLED=1.
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
SESSION_TTL = 30 * 24 * 3600      # 30 Tage angemeldet bleiben
DEVICE_TTL = 60 * 24 * 3600       # 60 Tage „Gerät gemerkt" (MFA überspringen)
COOKIE = "vault_session"
DEVICE_COOKIE = "vault_device"
USERNAME_RE = re.compile(r"^[a-z0-9_-]{2,32}$")

LOCK_MAX = 5
LOCK_WINDOW = 300
LOCK_TIME = 300

_pending: dict[str, dict] = {}          # Setup-Zwischenspeicher
_pending_mfa: dict[str, str] = {}       # username -> secret (MFA nachträglich aktivieren)
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
    changed = False
    # Alt: Single-User {salt,pwhash,totp_secret} → users['admin']
    if d.get("pwhash") and "users" not in d:
        d = {"session_key": d.get("session_key") or secrets.token_hex(32),
             "users": {"admin": {"salt": d["salt"], "pwhash": d["pwhash"],
                                 "totp_secret": d["totp_secret"], "totp_last": d.get("totp_last", 0),
                                 "role": "admin", "mfa_enabled": True}}}
        changed = True
    # Jeden Benutzer normalisieren: mfa_enabled aus vorhandenem Secret ableiten
    for u in d.get("users", {}).values():
        if "mfa_enabled" not in u:
            u["mfa_enabled"] = bool(u.get("totp_secret"))
            changed = True
        u.setdefault("totp_secret", "")
        u.setdefault("totp_last", 0)
    if changed and d.get("users"):
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
    return [{"username": u, "role": v.get("role", "user"), "mfa": bool(v.get("mfa_enabled"))}
            for u, v in _users().items()]


def get_role(username: str) -> str | None:
    u = _users().get(username)
    return u.get("role") if u else None


def mfa_enabled(username: str) -> bool:
    u = _users().get(username)
    return bool(u and u.get("mfa_enabled") and u.get("totp_secret"))


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
def start_setup(username: str, password: str, enable_mfa: bool) -> dict | None:
    username = (username or "admin").strip().lower()
    if not USERNAME_RE.match(username):
        return None
    salt = secrets.token_bytes(16)
    pwhash = _hash_pw(password, salt)
    if not enable_mfa:
        _save({"session_key": secrets.token_hex(32),
               "users": {username: {"salt": salt.hex(), "pwhash": pwhash, "totp_secret": "",
                                    "totp_last": 0, "role": "admin", "mfa_enabled": False}}})
        return {"done": True}
    secret = new_totp_secret()
    token = secrets.token_urlsafe(24)
    _pending.clear()
    _pending[token] = {"username": username, "secret": secret, "salt": salt.hex(), "pwhash": pwhash}
    uri = _enroll_uri(username, secret)
    return {"done": False, "setup_token": token, "secret": secret,
            "otpauth": uri, "qr_svg": qr_svg(uri)}


def confirm_setup(token: str, code: str) -> bool:
    p = _pending.get(token)
    if not p or not verify_totp(p["secret"], code):
        return False
    _save({"session_key": secrets.token_hex(32),
           "users": {p["username"]: {"salt": p["salt"], "pwhash": p["pwhash"],
                                     "totp_secret": p["secret"], "totp_last": 0,
                                     "role": "admin", "mfa_enabled": True}}})
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
    salt = secrets.token_bytes(16)
    d["users"][username] = {"salt": salt.hex(), "pwhash": _hash_pw(password, salt),
                            "totp_secret": "", "totp_last": 0,
                            "role": "admin" if role == "admin" else "user", "mfa_enabled": False}
    _save(d)
    return {"username": username, "role": d["users"][username]["role"]}


def delete_user(username: str) -> bool:
    d = _data()
    users = d.get("users", {})
    if username not in users:
        return False
    admins = [u for u, v in users.items() if v.get("role") == "admin"]
    if users[username].get("role") == "admin" and len(admins) <= 1:
        return False
    del users[username]
    _save(d)
    return True


# ---- MFA nachträglich aktivieren/deaktivieren ------------------------------
def begin_enable_mfa(username: str) -> dict | None:
    if username not in _users():
        return None
    secret = new_totp_secret()
    _pending_mfa[username] = secret
    uri = _enroll_uri(username, secret)
    return {"secret": secret, "otpauth": uri, "qr_svg": qr_svg(uri)}


def confirm_enable_mfa(username: str, code: str) -> bool:
    secret = _pending_mfa.get(username)
    if not secret or not verify_totp(secret, code):
        return False
    d = _data()
    u = d["users"].get(username)
    if not u:
        return False
    u["totp_secret"] = secret
    u["totp_last"] = 0
    u["mfa_enabled"] = True
    _save(d)
    _pending_mfa.pop(username, None)
    return True


def disable_mfa(username: str) -> bool:
    d = _data()
    u = d["users"].get(username)
    if not u:
        return False
    u["mfa_enabled"] = False
    u["totp_secret"] = ""
    _save(d)
    return True


# ---- Login (zweistufig) -----------------------------------------------------
def check_password(username: str, password: str) -> bool:
    u = _users().get((username or "").strip().lower())
    if not u:
        return False
    return hmac.compare_digest(_hash_pw(password or "", bytes.fromhex(u["salt"])), u["pwhash"])


def verify_code(username: str, code: str) -> bool:
    username = (username or "").strip().lower()
    d = _data()
    u = d["users"].get(username)
    if not u or not u.get("totp_secret"):
        return False
    counter = totp_counter(u["totp_secret"], code)
    if counter < 0 or counter <= int(u.get("totp_last", 0)):
        return False
    u["totp_last"] = counter
    _save(d)
    return True


# ---- Session + „Gerät gemerkt" ---------------------------------------------
def _sign(kind: str, username: str, exp: str) -> str:
    key = bytes.fromhex(_data()["session_key"])
    return hmac.new(key, f"{kind}.{username}.{exp}".encode(), hashlib.sha256).hexdigest()


def create_session(username: str) -> str:
    exp = str(int(time.time()) + SESSION_TTL)
    return f"{username}.{exp}.{_sign('sess', username, exp)}"


def verify_session(token: str | None) -> str | None:
    if not token or token.count(".") != 2:
        return None
    if not _data().get("session_key"):
        return None
    username, exp, sig = token.split(".")
    if not exp.isdigit() or int(exp) < time.time():
        return None
    if not hmac.compare_digest(_sign("sess", username, exp), sig):
        return None
    return username if username in _users() else None


def create_device(username: str) -> str:
    exp = str(int(time.time()) + DEVICE_TTL)
    return f"{username}.{exp}.{_sign('dev', username, exp)}"


def verify_device(token: str | None, username: str) -> bool:
    if not token or token.count(".") != 2:
        return False
    u, exp, sig = token.split(".")
    if u != username or not exp.isdigit() or int(exp) < time.time():
        return False
    return hmac.compare_digest(_sign("dev", username, exp), sig)


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
