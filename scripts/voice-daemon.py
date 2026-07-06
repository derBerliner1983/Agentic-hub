#!/usr/bin/env python3
"""V.A.U.L.T. Sprach-Daemon (Server-Mikro, lokales Weckwort via openWakeWord).

Läuft auf dem HOST (nicht im Container), weil nur dort Mikrofon + Lautsprecher
erreichbar sind. Ablauf:
  1) lauscht durchgehend am Mikro und erkennt lokal das Weckwort (openWakeWord)
  2) nimmt danach den Befehl auf (bis kurze Stille)
  3) schickt ihn an den Orchestrator  → /api/voice/command (Whisper-STT + Antwort)
  4) lässt die Antwort per Piper (/api/voice/tts) sprechen und spielt sie ab

Alles bleibt lokal. Konfiguration in instance/settings.json:
  owakeword_model      z. B. "hey_jarvis" (vortrainiert)
  owakeword_threshold  0..1 (Empfindlichkeit)
Token zum Zugriff auf die Voice-Endpoints: instance/voice_token
"""
from __future__ import annotations
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INSTANCE = REPO / "instance"
ORCH_URL = os.environ.get("ORCH_URL", "https://localhost")

RATE = 16000
CHUNK = 1280           # 80 ms Blöcke (openWakeWord-Standard)
SILENCE_ENERGY = 500   # unter diesem Pegel gilt es als Stille
SILENCE_SEC = 1.2      # so lange Stille beendet die Aufnahme
MAX_RECORD = 10        # harte Obergrenze pro Befehl (s)


def log(*a):
    print("[voice-daemon]", *a, flush=True)


def load_settings() -> dict:
    try:
        return json.loads((INSTANCE / "settings.json").read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def load_token() -> str:
    try:
        return (INSTANCE / "voice_token").read_text(encoding="utf-8").strip()
    except Exception:  # noqa: BLE001
        return ""


def to_wav_bytes(audio) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(audio.tobytes())
    return buf.getvalue()


def play_wav(wav_bytes: bytes):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        path = f.name
    try:
        subprocess.run(["aplay", "-q", path], check=False)
    finally:
        try:
            os.unlink(path)
        except Exception:  # noqa: BLE001
            pass


def play_audio(data: bytes, mime: str = ""):
    """WAV direkt über aplay; MP3 (ElevenLabs) über ffplay/mpg123 oder ffmpeg→aplay."""
    is_mp3 = "mpeg" in (mime or "") or data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF)
    if not is_mp3 or data[:4] == b"RIFF":
        play_wav(data)
        return
    for player in (["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", "-"],
                   ["mpg123", "-q", "-"]):
        try:
            subprocess.run(player, input=data, check=True)
            return
        except Exception:  # noqa: BLE001
            continue
    try:
        wav = subprocess.run(["ffmpeg", "-i", "pipe:0", "-f", "wav", "pipe:1",
                              "-loglevel", "quiet"], input=data,
                             capture_output=True, check=True).stdout
        play_wav(wav)
    except Exception:  # noqa: BLE001
        log("Kein MP3-Player gefunden (ffplay/mpg123/ffmpeg fehlen).")


def main():
    try:
        import numpy as np
        import sounddevice as sd
        import requests
        import urllib3
        from openwakeword.model import Model
    except Exception as exc:  # noqa: BLE001
        log("Abhängigkeiten fehlen:", exc)
        log("Bitte scripts/setup-voice-daemon.sh ausführen.")
        sys.exit(1)
    urllib3.disable_warnings()

    s = load_settings()
    wake = s.get("owakeword_model", "hey_jarvis")
    threshold = float(s.get("owakeword_threshold", 0.5) or 0.5)
    token = load_token()
    settings_mtime = (INSTANCE / "settings.json").stat().st_mtime if (INSTANCE / "settings.json").exists() else 0

    log(f"Lade Weckwort-Modell '{wake}' …")
    try:
        oww = Model(wakeword_models=[wake])
    except Exception:  # noqa: BLE001
        # Modelle noch nicht heruntergeladen → nachladen und erneut versuchen
        import openwakeword
        openwakeword.utils.download_models()
        oww = Model(wakeword_models=[wake])
    log(f"Bereit. Lausche auf '{wake}' (Schwelle {threshold}). Sag es jetzt.")

    def http(method, path, **kw):
        kw.setdefault("verify", False)
        kw.setdefault("timeout", 120)
        kw.setdefault("headers", {})
        kw["headers"]["x-vault-token"] = token
        return getattr(requests, method)(f"{ORCH_URL}{path}", **kw)

    # Sofort-Bestätigung vorab als Audio holen → spielt ohne Verzögerung,
    # während das LLM noch an der echten Antwort arbeitet.
    import threading
    ack_audio = {"data": None, "mime": ""}

    def fetch_ack():
        phrase = (load_settings().get("ack_phrase") or "").strip()
        if not phrase:
            ack_audio["data"] = None
            return
        try:
            r = http("get", "/api/voice/tts", params={"text": phrase}, timeout=60)
            if r.status_code == 200 and r.content:
                ack_audio["data"] = r.content
                ack_audio["mime"] = r.headers.get("content-type", "")
                log("Sofort-Bestätigung geladen.")
        except Exception:  # noqa: BLE001
            ack_audio["data"] = None
    fetch_ack()

    def record_command(stream, np):
        frames, silent, start = [], 0.0, time.time()
        while time.time() - start < MAX_RECORD:
            data, _ = stream.read(CHUNK)
            a = np.frombuffer(bytes(data), dtype=np.int16)
            frames.append(a)
            if float(abs(a).mean()) < SILENCE_ENERGY:
                silent += CHUNK / RATE
            else:
                silent = 0.0
            if silent >= SILENCE_SEC and time.time() - start > 1.0:
                break
        return np.concatenate(frames) if frames else np.zeros(0, dtype=np.int16)

    def handle(stream, np):
        log("Weckwort erkannt – höre auf den Befehl …")
        audio = record_command(stream, np)
        if audio.size < RATE // 2:
            return
        # Bestätigung SOFORT sprechen (parallel), Befehl läuft derweil zum LLM
        ack_th = None
        if ack_audio["data"]:
            ack_th = threading.Thread(target=play_audio,
                                      args=(ack_audio["data"], ack_audio["mime"]), daemon=True)
            ack_th.start()
        try:
            r = http("post", "/api/voice/command",
                     files={"file": ("cmd.wav", to_wav_bytes(audio), "audio/wav")})
            j = r.json()
        except Exception as exc:  # noqa: BLE001
            log("Fehler beim Senden:", exc)
            return
        text = j.get("text", "")
        answer = j.get("answer") or ("Erledigt." if j.get("task") else "")
        if j.get("t_stt_ms") is not None:
            log(f"Latenz: STT {j['t_stt_ms']} ms · Antwort {j.get('t_answer_ms', '?')} ms")
        log(f"Verstanden: '{text}'  ->  {answer[:100]!r}")
        if answer:
            try:
                tts = http("get", "/api/voice/tts", params={"text": answer}, timeout=60)
                if ack_th:
                    ack_th.join(timeout=15)   # Bestätigung ausreden lassen
                if tts.status_code == 200 and tts.content:
                    play_audio(tts.content, tts.headers.get("content-type", ""))
            except Exception as exc:  # noqa: BLE001
                log("TTS-Fehler:", exc)

    with sd.RawInputStream(samplerate=RATE, channels=1, dtype="int16", blocksize=CHUNK) as stream:
        while True:
            data, _ = stream.read(CHUNK)
            a = np.frombuffer(bytes(data), dtype=np.int16)
            pred = oww.predict(a)
            if pred.get(wake, 0.0) >= threshold:
                oww.reset()
                handle(stream, np)
                log(f"Lausche wieder auf '{wake}'.")
            # Einstellungen live nachladen (Weckwort/Schwelle geändert?)
            try:
                mt = (INSTANCE / "settings.json").stat().st_mtime
                if mt != settings_mtime:
                    settings_mtime = mt
                    s2 = load_settings()
                    nw = s2.get("owakeword_model", wake)
                    threshold = float(s2.get("owakeword_threshold", threshold) or threshold)
                    fetch_ack()   # Bestätigungssatz evtl. geändert
                    if nw != wake:
                        wake = nw
                        oww = Model(wakeword_models=[wake])
                        log(f"Weckwort gewechselt -> '{wake}'")
            except Exception:  # noqa: BLE001
                pass


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
