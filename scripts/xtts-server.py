#!/usr/bin/env python3
"""V.A.U.L.T. XTTS-Dienst – lokales, sehr natürliches TTS (Coqui XTTS v2).

Läuft am HOST (eigenes venv, siehe setup-xtts.sh) und liefert WAV über HTTP:
  GET /tts?text=Hallo&language=de   →  audio/wav
  GET /health                       →  {"ok": true}

Eigene Stimme klonen: eine 6-30s saubere Sprachaufnahme als
  instance/xtts_speaker.wav
ablegen – der Dienst nutzt sie automatisch als Referenzstimme. Ohne Datei wird
die eingebaute Standardstimme verwendet (XTTS_SPEAKER, Default 'Claribel Dervla').
"""
from __future__ import annotations
import json
import os
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SPEAKER_WAV = REPO / "instance" / "xtts_speaker.wav"
PORT = int(os.environ.get("XTTS_PORT", "5002"))
SPEAKER = os.environ.get("XTTS_SPEAKER", "Claribel Dervla")

print("[xtts] Lade XTTS v2 (erster Start lädt ~2 GB Modell) …", flush=True)
os.environ.setdefault("COQUI_TOS_AGREED", "1")
import torch  # noqa: E402
from TTS.api import TTS  # noqa: E402

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE)
print(f"[xtts] Bereit auf Port {PORT} (Device: {DEVICE}, "
      f"Stimme: {'eigene (xtts_speaker.wav)' if SPEAKER_WAV.exists() else SPEAKER})", flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # leiser
        pass

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        u = urllib.parse.urlparse(self.path)
        if u.path == "/health":
            return self._json(200, {"ok": True, "device": DEVICE,
                                    "own_voice": SPEAKER_WAV.exists()})
        if u.path != "/tts":
            return self._json(404, {"error": "unbekannter Pfad"})
        q = urllib.parse.parse_qs(u.query)
        text = (q.get("text", [""])[0] or "").strip()
        lang = (q.get("language", ["de"])[0] or "de")[:5]
        if not text:
            return self._json(400, {"error": "text fehlt"})
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                out = f.name
            kw = {"text": text[:1000], "language": lang, "file_path": out}
            if SPEAKER_WAV.exists():
                kw["speaker_wav"] = str(SPEAKER_WAV)
            else:
                kw["speaker"] = SPEAKER
            tts.tts_to_file(**kw)
            data = Path(out).read_bytes()
            os.unlink(out)
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"error": str(exc)})
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
