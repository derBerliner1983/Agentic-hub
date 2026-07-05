"""Voice-Layer: STT (faster-whisper) + TTS (Piper) + Sprachbefehl-Zuordnung.

Alles lokal, kostenlos. STT wandelt Browser-Audio in Text, ein einfacher
Keyword-Matcher ordnet den Text einem Task zu, TTS spricht Antworten.
"""
from __future__ import annotations
import os
import subprocess
import tempfile
from pathlib import Path

# --- Konfiguration (Pfade werden im Docker-Image gesetzt) ------------------
PIPER_BIN = os.environ.get("PIPER_BIN", "/app/piper/piper/piper")
PIPER_VOICE = os.environ.get("PIPER_VOICE", "/app/piper/de.onnx")

# Auswählbare Whisper-Sprachmodelle (klein=schnell … groß=genauer).
# Der Server hat Power → auch large-v3 möglich (lädt beim ersten Nutzen nach).
STT_MODELS = ["tiny", "base", "small", "medium", "large-v3", "large-v3-turbo"]

# Auswählbare Piper-Stimmen (werden bei Bedarf von HuggingFace nachgeladen).
TTS_VOICES = [
    {"id": "de_DE-thorsten-medium", "label": "Deutsch · Thorsten (m, medium)"},
    {"id": "de_DE-thorsten-high", "label": "Deutsch · Thorsten (m, high)"},
    {"id": "de_DE-kerstin-low", "label": "Deutsch · Kerstin (w, low)"},
    {"id": "de_DE-eva_k-x_low", "label": "Deutsch · Eva (w, x-low)"},
    {"id": "de_DE-ramona-low", "label": "Deutsch · Ramona (w, low)"},
    {"id": "de_DE-karlsson-low", "label": "Deutsch · Karlsson (m, low)"},
    {"id": "en_US-amy-medium", "label": "English · Amy (f, medium)"},
    {"id": "en_US-ryan-high", "label": "English · Ryan (m, high)"},
]
_DEFAULT_VOICE = "de_DE-thorsten-medium"
VOICES_DIR = Path("/app/piper/voices")

_stt_name = os.environ.get("WHISPER_MODEL", "small")   # aktiv gewähltes Modell
_stt_model = None  # lazy geladen (Cache für _stt_name)
_tts_voice = os.environ.get("PIPER_VOICE_ID", _DEFAULT_VOICE)   # aktive Stimme


def stt_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def tts_available() -> bool:
    return Path(PIPER_BIN).exists() and Path(PIPER_VOICE).exists()


def current_stt_model() -> str:
    return _stt_name


def set_stt_model(name: str) -> None:
    """Sprach-Modell wechseln; Cache leeren, damit es beim nächsten Mal neu lädt."""
    global _stt_name, _stt_model
    name = (name or "").strip()
    if name and name != _stt_name:
        _stt_name = name
        _stt_model = None


def _get_model():
    global _stt_model
    if _stt_model is None:
        from faster_whisper import WhisperModel
        _stt_model = WhisperModel(_stt_name, device="cpu", compute_type="int8")
    return _stt_model


# ---- TTS-Stimme wählen/laden ----------------------------------------------
def current_tts_voice() -> str:
    return _tts_voice


def set_tts_voice(voice_id: str) -> None:
    global _tts_voice
    voice_id = (voice_id or "").strip()
    if voice_id:
        _tts_voice = voice_id


def voice_installed(voice_id: str) -> bool:
    if voice_id == _DEFAULT_VOICE and Path(PIPER_VOICE).exists():
        return True
    return (VOICES_DIR / f"{voice_id}.onnx").exists()


def _download_voice(voice_id: str, dest) -> bool:
    """Lädt eine Piper-Stimme (.onnx + .json) von HuggingFace nach."""
    try:
        lang, name, quality = voice_id.split("-")
        region = lang.split("_")[0]
        base = (f"https://huggingface.co/rhasspy/piper-voices/resolve/main/"
                f"{region}/{lang}/{name}/{quality}/{voice_id}")
        VOICES_DIR.mkdir(parents=True, exist_ok=True)
        import urllib.request
        urllib.request.urlretrieve(base + ".onnx", str(dest))
        urllib.request.urlretrieve(base + ".onnx.json", str(dest) + ".json")
        return True
    except Exception:  # noqa: BLE001
        return False


def _resolve_voice_path(vid: str | None = None) -> str:
    """Pfad zur (ggf. bestimmten) Stimme; lädt sie bei Bedarf nach, sonst Standard."""
    vid = (vid or _tts_voice)
    if vid == _DEFAULT_VOICE and Path(PIPER_VOICE).exists():
        return PIPER_VOICE
    onnx = VOICES_DIR / f"{vid}.onnx"
    if onnx.exists():
        return str(onnx)
    if _download_voice(vid, onnx) and onnx.exists():
        return str(onnx)
    return PIPER_VOICE   # Fallback auf vorinstallierte Stimme


def transcribe(audio_bytes: bytes, suffix: str = ".webm") -> str:
    """Browser-Audio → Text. Konvertiert robust via ffmpeg nach 16k-Mono-WAV."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"in{suffix}"
        wav = Path(tmp) / "in.wav"
        src.write_bytes(audio_bytes)
        # ffmpeg-Konvertierung (robust für webm/opus etc.)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(wav)],
            check=True, capture_output=True,
        )
        model = _get_model()
        segments, _info = model.transcribe(str(wav), language="de", vad_filter=True)
        return "".join(seg.text for seg in segments).strip()


def synthesize(text: str, voice_id: str | None = None) -> bytes | None:
    """Text → WAV-Bytes via Piper. `voice_id` überschreibt die aktive Stimme
    (für Vorhören). None, wenn Piper nicht verfügbar."""
    if not tts_available() or not text.strip():
        return None
    voice_path = _resolve_voice_path(voice_id)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.wav"
        env = dict(os.environ)
        piper_dir = str(Path(PIPER_BIN).parent)
        env["LD_LIBRARY_PATH"] = piper_dir + ":" + env.get("LD_LIBRARY_PATH", "")
        subprocess.run(
            [PIPER_BIN, "--model", voice_path, "--output_file", str(out)],
            input=text.encode("utf-8"), check=True, capture_output=True,
            cwd=piper_dir, env=env,
        )
        return out.read_bytes()


# --- Sprachbefehl → Task ---------------------------------------------------
# Reihenfolge = Priorität; erstes Match gewinnt.
_KEYWORDS: list[tuple[str, list[str]]] = [
    ("inbox-brief",  ["inbox", "posteingang", "mails", "e-mail", "email", "briefing"]),
    ("gh-trending",  ["github", "git hub", "repos", "repository"]),
    ("trend-scan",   ["trend", "trends", "scan"]),
    ("yt-week",      ["youtube", "video", "videos"]),
    ("plan-tmrw",    ["morgen", "plan morgen"]),
    ("plan-today",   ["heute", "tagesplan", "plan heute"]),
    ("wk-review",    ["woche", "wochen", "review", "rückblick", "wochenrückblick"]),
    ("metrics-pull", ["metrik", "metriken", "kennzahl", "kennzahlen", "metrics", "zahlen"]),
    ("am-report",    ["morgenreport", "morgen report", "report", "bericht"]),
    ("vault-clean",  ["aufräumen", "aufraeumen", "clean", "vault putzen"]),
]


def match_task(text: str) -> str | None:
    low = text.lower()
    for task_id, keys in _KEYWORDS:
        if any(k in low for k in keys):
            return task_id
    return None


# Nur bei ausdrücklichen Kommandos einen Task starten – normale Fragen werden
# beantwortet (nicht mehr versehentlich als „Plan Today" o. ä. ausgelöst).
_CMD_TRIGGERS = ("starte", "start", "führe", "fuehre", "fuhre", "run", "öffne",
                 "oeffne", "offne", "mach", "task", "aufgabe", "los")


def match_command(text: str) -> str | None:
    words = text.lower().strip().split()
    if not words:
        return None
    if not any(w in _CMD_TRIGGERS for w in words[:2]):
        return None
    return match_task(text)
