FROM python:3.12-slim

WORKDIR /app

# System-Abhängigkeiten: ffmpeg (Audio-Decode für STT), curl/tar (Piper laden)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg curl ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

# Python-Abhängigkeiten (inkl. faster-whisper)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Piper (lokales TTS) + deutsche Stimme --------------------------------
ARG PIPER_VER=2023.11.14-2
RUN mkdir -p /app/piper && cd /app/piper \
 && curl -fsSL -o piper.tar.gz \
      "https://github.com/rhasspy/piper/releases/download/${PIPER_VER}/piper_linux_x86_64.tar.gz" \
 && tar xzf piper.tar.gz && rm piper.tar.gz \
 && curl -fsSL -o de.onnx \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx" \
 && curl -fsSL -o de.onnx.json \
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json"

ENV PIPER_BIN=/app/piper/piper/piper \
    PIPER_VOICE=/app/piper/de.onnx \
    WHISPER_MODEL=small

# STT-Modell schon beim Build laden, damit v1 offline startklar ist
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')" || true

COPY app ./app
COPY static ./static

EXPOSE 3000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
