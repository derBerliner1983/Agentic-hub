# Runner-Profile erweitern (eigene Test-Umgebungen)

Der Code-Executor (`services/orchestrator/app/executor.py`) führt Code in
Wegwerf-Docker-Containern aus. Welche Umgebung dafür genutzt wird, steckt in den
**Runner-Profilen**.

## Eingebaute Profile

| Name | Image | Zweck |
|------|-------|-------|
| `python` | `python:3.12-slim` | Python-Skripte |
| `node` / `javascript` | `node:20-slim` | Node/JS |
| `bash` | `debian:stable-slim` | Shell |
| `python-deps` | `python:3.12-slim` | Python **mit** `pip install -r requirements.txt` (Netz an) |
| `web` | `mcr.microsoft.com/playwright/python` | **Web-E2E** mit echtem Chromium (Playwright) |

## Eigene Profile hinzufügen (ohne Code-Änderung)

Lege `instance/runners.json` an (überlebt Updates, gitignored). Jeder Eintrag:

```json
{
  "meine-umgebung": {
    "image": "<docker-image>",
    "cmd": "<startbefehl im container>",
    "file": "<hauptdateiname>",
    "network": true,
    "timeout": 120
  }
}
```

Das neue Profil erscheint dann automatisch als auswählbarer Runner (Board →
Code-Projekt → Runner-Name).

## Android testen (Emulator)

Android-Apps/Web brauchen einen Emulator. Möglich über ein Emulator-Image wie
`budtmo/docker-android` (enthält einen Android-Emulator + ADB). Beispiel-Profil:

```json
{
  "android": {
    "image": "budtmo/docker-android:emulator_11.0",
    "cmd": "bash main.sh",
    "file": "main.sh",
    "network": true,
    "timeout": 600
  }
}
```

**Ehrliche Voraussetzungen:** Der Host braucht **KVM** (Hardware-Virtualisierung),
der Container läuft `--privileged` und das Image ist groß (mehrere GB). Der
Emulator-Start dauert Minuten. Für einen echten Einsatz muss der Executor für
dieses Profil zusätzlich `--privileged` und `/dev/kvm` durchreichen – das ist
bewusst NICHT im Standard-Executor aktiv (Sicherheit). Wer Android braucht,
erweitert `executor.run` um diese Sonderbehandlung.

## Windows testen (VM)

Windows läuft nur in einer VM. Container-Lösungen wie `dockurr/windows` starten
eine QEMU/KVM-Windows-VM. Auch hier: **KVM nötig**, `--privileged`/`/dev/kvm`,
sehr große Images, Lizenzfragen. Ebenfalls als Sonderprofil mit angepasstem
`executor.run` umzusetzen.

> Kurz: Python/Node/Bash/Web laufen out-of-the-box sicher isoliert. Android/Windows
> sind möglich, aber schwergewichtig (KVM, privilegierte Container) und daher
> bewusst als optionale, selbst zu aktivierende Erweiterung dokumentiert.
