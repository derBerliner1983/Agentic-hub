"""Anmeldung mit MFA (TOTP) für das HUD.

- Ersteinrichtung (/setup): Passwort setzen + TOTP-Secret per QR in eine
  Authenticator-App (Google Authenticator, Aegis, 2FAS, …) übernehmen.
- Login (/login): Passwort + 6-stelliger Code.
- Session: HMAC-signierter Cookie (HttpOnly, SameSite=Lax), 12 h gültig.

Speicherung in instance/auth.json (gitignored, überlebt Updates).
Notfall-Reset: Datei löschen → Setup beginnt neu.
Escape-Hatch: AUTH_DISABLED=1 in der Umgebung schaltet die Anmeldung ab.
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import io
import os
import secrets
import struct
import time

from . import store

PBKDF_ITER = 200_000
SESSION_TTL = 12 * 3600
COOKIE = "vault_session"

# Brute-Force-Schutz (in-memory, pro Client-Key)
LOCK_MAX = 5            # so viele Fehlversuche …
LOCK_WINDOW = 300       # … innerhalb dieser Sekunden →
LOCK_TIME = 300         # … Sperre für diese Sekunden

_pending: dict[str, dict] = {}   # Setup-Zwischenspeicher (nur im RAM)
_fails: dict[str, list[float]] = {}   # Fehlversuche pro Client-Key


# ---- Brute-Force-Schutz -----------------------------------------------------
def locked_for(key: str) -> int:
    """Sekunden verbleibende Sperre für diesen Client-Key (0 = frei)."""
    now = time.time()
    hits = [t for t in _fails.get(key, []) if now - t < LOCK_WINDOW]
    _fails[key] = hits
    if len(hits) >= LOCK_MAX:
        remaining = int(LOCK_TIME - (now - hits[-LOCK_MAX]))
        return max(0, remaining)
    return 0


def record_fail(key: str) -> None:
    _fails.setdefault(key, []).append(time.time())


def clear_fails(key: str) -> None:
    _fails.pop(key, None)


# ---- Status ----------------------------------------------------------------
def _cfg() -> dict | None:
    return store.load("auth.json", None)


def configured() -> bool:
    c = _cfg()
    return bool(c and c.get("pwhash"))


def required() -> bool:
    return os.environ.get("AUTH_DISABLED") != "1"


# ---- Passwort ---------------------------------------------------------------
def _hash_pw(pw: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, PBKDF_ITER).hex()


# ---- TOTP (RFC 6238, SHA1, 30s, 6 Stellen) ----------------------------------
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
    """Passender 30s-Zähler für den Code, oder -1. Für Replay-Schutz."""
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


# ---- Setup-Flow --------------------------------------------------------------
def start_setup(password: str) -> dict:
    secret = new_totp_secret()
    salt = secrets.token_bytes(16)
    token = secrets.token_urlsafe(24)
    _pending.clear()
    _pending[token] = {"secret": secret, "salt": salt.hex(),
                       "pwhash": _hash_pw(password, salt)}
    uri = f"otpauth://totp/V.A.U.L.T.?secret={secret}&issuer=VAULT"
    return {"setup_token": token, "secret": secret, "otpauth": uri,
            "qr_svg": qr_svg(uri)}


def confirm_setup(token: str, code: str) -> bool:
    p = _pending.get(token)
    if not p or not verify_totp(p["secret"], code):
        return False
    store.save("auth.json", {"salt": p["salt"], "pwhash": p["pwhash"],
                             "totp_secret": p["secret"],
                             "session_key": secrets.token_hex(32)})
    _pending.clear()
    return True


# ---- Login / Session ----------------------------------------------------------
def login(password: str, code: str) -> str | None:
    c = _cfg()
    if not c:
        return None
    if not hmac.compare_digest(_hash_pw(password or "", bytes.fromhex(c["salt"])),
                               c["pwhash"]):
        return None
    counter = totp_counter(c["totp_secret"], code)
    if counter < 0:
        return None
    # Replay-Schutz: ein einmal genutzter Code (bzw. älterer) wird abgelehnt.
    if counter <= int(c.get("totp_last", 0)):
        return None
    c["totp_last"] = counter
    store.save("auth.json", c)
    return create_session()


def create_session() -> str:
    c = _cfg()
    exp = str(int(time.time()) + SESSION_TTL)
    sig = hmac.new(bytes.fromhex(c["session_key"]), exp.encode(), hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def verify_session(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    c = _cfg()
    if not c:
        return False
    exp_s, sig = token.split(".", 1)
    if not exp_s.isdigit() or int(exp_s) < time.time():
        return False
    good = hmac.new(bytes.fromhex(c["session_key"]), exp_s.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(good, sig)


# ---- QR-Code (SVG, für die Authenticator-App) ---------------------------------
def qr_svg(data: str) -> str | None:
    try:
        import qrcode
        from qrcode.image.svg import SvgPathImage
        img = qrcode.make(data, image_factory=SvgPathImage, box_size=8)
        buf = io.BytesIO()
        img.save(buf)
        return buf.getvalue().decode()
    except Exception:  # noqa: BLE001 – ohne qrcode-Paket: Secret manuell eintippen
        return None
